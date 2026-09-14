import os
import json
import time
import datetime
import asyncio
import concurrent.futures
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import httpx
import numpy as np
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import get_db, SessionLocal, User, Resume, JobListing, Briefing, IS_POSTGRES
from auth import get_current_user_authenticated
from cost_analytics import record_cost
from matches import get_or_heal_user_resume_embedding, parse_and_validate_embedding

router = APIRouter(tags=["briefing"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

class BriefingResponse(BaseModel):
    id: int
    script: str
    media_url: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    fallback_reason: Optional[str] = None
    featured_jobs: List[Dict[str, Any]] = []
    status: str
    created_at: datetime.datetime

def synthesize_speech_audio(text: str, output_path: str) -> tuple[bool, str]:
    """
    Synthesize natural human spoken voice for the executive briefing.
    Tier 1: ElevenLabs API (if configured)
    Tier 2: Microsoft Edge Neural TTS (en-US-ChristopherNeural) - realistic human executive narrator
    Tier 3: Google Text-to-Speech (gTTS) - guaranteed spoken voice fallback
    Returns: (success: bool, engine_name: str)
    """
    eleven_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    eleven_voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()

    # 1. ElevenLabs
    if eleven_key:
        try:
            tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{eleven_voice_id}"
            headers = {
                "xi-api-key": eleven_key,
                "Content-Type": "application/json"
            }
            payload = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
            }
            resp = httpx.post(tts_url, json=payload, headers=headers, timeout=25.0)
            if resp.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                    return True, "ElevenLabs AI Voice"
        except Exception as e:
            print(f"[ElevenLabs Synthesis Notice] {e}")

    # 2. Edge Neural TTS (High-fidelity natural human executive narrator)
    try:
        import edge_tts

        async def _edge_task():
            comm = edge_tts.Communicate(text, "en-US-ChristopherNeural", rate="+0%", pitch="+0Hz")
            await comm.save(output_path)

        def _run_in_thread():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(_edge_task())
            finally:
                loop.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            fut = executor.submit(_run_in_thread)
            fut.result(timeout=25.0)

        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True, "Edge Neural (Christopher - Executive Voice)"
    except Exception as e:
        print(f"[Edge-TTS Synthesis Notice] {e}")

    # 3. gTTS Fallback
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang='en')
        tts.save(output_path)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True, "Google Spoken Voice (gTTS)"
    except Exception as e:
        print(f"[gTTS Synthesis Notice] {e}")

    return False, "None"

def briefing_worker_task(briefing_id: int, user_id: int):
    db = SessionLocal()
    try:
        briefing = db.query(Briefing).filter(Briefing.id == briefing_id).first()
        if not briefing:
            return

        briefing.status = "processing"
        db.commit()

        # 1. Fetch top 3 semantically matched jobs
        user_resume = db.query(Resume).filter(Resume.user_id == user_id).first()
        resume_emb = get_or_heal_user_resume_embedding(user_resume, user_id, db)

        if resume_emb:
            if IS_POSTGRES:
                distance_expr = JobListing.embedding.cosine_distance(resume_emb)
                top_3 = (
                    db.query(JobListing)
                    .filter(JobListing.is_active == True)
                    .order_by(distance_expr.asc())
                    .limit(3)
                    .all()
                )
            else:
                jobs = db.query(JobListing).filter(JobListing.is_active == True).all()
                parsed_embeddings = []
                valid_jobs = []
                for j in jobs:
                    emb_v = parse_and_validate_embedding(j.embedding)
                    if emb_v is not None:
                        parsed_embeddings.append(emb_v)
                        valid_jobs.append(j)

                if valid_jobs:
                    embeddings_matrix = np.array(parsed_embeddings, dtype=np.float32)
                    target_vec = np.array(resume_emb, dtype=np.float32)
                    t_norm = np.linalg.norm(target_vec)
                    if t_norm > 0:
                        target_vec = target_vec / t_norm
                    norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
                    norms[norms == 0] = 1.0
                    normalized_matrix = embeddings_matrix / norms
                    scores = np.dot(normalized_matrix, target_vec)
                    top_indices = np.argsort(scores)[::-1][:3]
                    top_3 = [valid_jobs[idx] for idx in top_indices]
                else:
                    top_3 = []
        else:
            top_3 = db.query(JobListing).filter(JobListing.is_active == True).limit(3).all()

        featured = []
        for j in top_3:
            skills = json.loads(j.required_skills or "[]")
            featured.append({
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "stipend": j.stipend,
                "skills": skills[:4]
            })

        # 2. Generate Executive Briefing Script via Gemini Flash
        top_role = featured[0]['title'] if featured else "Senior AI Engineer"
        top_comp = featured[0]['company'] if featured else "Top Guild Lab"
        top_skills = ", ".join(featured[0].get('skills', ['Python', 'System Architecture'])) if featured else "Python, Machine Learning"
        second_role = featured[1]['title'] if len(featured) > 1 else "Lead Data Architect"
        second_comp = featured[1]['company'] if len(featured) > 1 else "Tech Innovations"

        script_text = (
            f"Good morning and welcome to your SAHAAL executive intelligence dispatch. Today, our semantic vector engine "
            f"has analyzed over 10,000 active opportunities to pinpoint your strongest market advantages. Your number one target "
            f"is the {top_role} role at {top_comp}. This position represents a remarkable alignment with your core expertise in "
            f"{top_skills}. In addition, high-momentum teams at {second_comp} are actively scouting for leadership in the {second_role} "
            f"domain. Both opportunities boast competitive compensation packages and immediate application review windows. "
            f"Now is the time to finalize your tailored submissions, verify your portfolio metrics on your dashboard, and take decisive "
            f"action before the closing deadlines. Wishing you an empowered and successful career week ahead."
        )

        gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                prompt = (
                    "Write an engaging, high-energy executive spoken audio briefing (aim for 140 to 160 words to fill 60 to 90 seconds of natural speech) "
                    "for a job applicant based on their top 3 matched opportunities below.\n"
                    f"{json.dumps(featured, indent=2)}\n\n"
                    "Guidelines:\n"
                    "- Adopt a confident, professional, and encouraging executive narrator persona.\n"
                    "- Mention the top company name and specific skill alignments clearly.\n"
                    "- Do not use placeholder text or generic filler."
                )
                res = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                if res and res.text:
                    script_text = res.text.strip()
                    t_in = len(prompt) // 4
                    t_out = len(script_text) // 4
                    record_cost(user_id=user_id, feature="briefing_script", tokens_in=t_in, tokens_out=t_out, db=db)
            except Exception as e:
                print(f"[Briefing Script LLM Notice] {e}")

        # 3. Spoken Voice Audio Synthesis
        audio_filename = f"briefing_audio_{briefing_id}_{int(time.time())}.mp3"
        audio_path = os.path.join(MEDIA_DIR, audio_filename)
        audio_generated, engine_name = synthesize_speech_audio(script_text, audio_path)

        if not audio_generated or not os.path.exists(audio_path) or os.path.getsize(audio_path) < 500:
            try:
                from gtts import gTTS
                tts = gTTS(text=script_text, lang='en')
                tts.save(audio_path)
                audio_generated = True
                engine_name = "Google Spoken Voice (gTTS)"
            except Exception as e:
                print(f"[Speech Synthesis Fatal Error] {e}")

        audio_url = f"/media/{audio_filename}" if audio_generated else ""
        fallback_msg = f"Voice Model: {engine_name}" if audio_generated else "Voice synthesis unavailable."

        briefing.script = script_text
        briefing.media_url = audio_url
        briefing.audio_url = audio_url
        briefing.video_url = None
        briefing.fallback_reason = fallback_msg
        briefing.featured_jobs = json.dumps(featured)
        briefing.status = "done"
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Briefing Worker Error] {e}")
        try:
            briefing = db.query(Briefing).filter(Briefing.id == briefing_id).first()
            if briefing:
                briefing.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

@router.post("/briefing/generate", response_model=BriefingResponse)
def generate_briefing(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    new_briefing = Briefing(
        user_id=current_user.id,
        script="Executive brief compiling...",
        status="queued",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_briefing)
    db.commit()
    db.refresh(new_briefing)

    background_tasks.add_task(briefing_worker_task, new_briefing.id, current_user.id)

    return BriefingResponse(
        id=new_briefing.id,
        script=new_briefing.script,
        media_url=new_briefing.media_url,
        video_url=new_briefing.video_url,
        audio_url=new_briefing.audio_url,
        fallback_reason=new_briefing.fallback_reason,
        featured_jobs=[],
        status=new_briefing.status,
        created_at=new_briefing.created_at
    )

@router.get("/briefing/status/{briefing_id}", response_model=BriefingResponse)
def get_briefing_status(
    briefing_id: int,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    briefing = db.query(Briefing).filter(
        Briefing.id == briefing_id,
        Briefing.user_id == current_user.id
    ).first()
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing record not found")

    featured = []
    if briefing.featured_jobs:
        try:
            featured = json.loads(briefing.featured_jobs)
        except Exception:
            featured = []

    return BriefingResponse(
        id=briefing.id,
        script=briefing.script,
        media_url=briefing.media_url,
        video_url=briefing.video_url,
        audio_url=briefing.audio_url,
        fallback_reason=briefing.fallback_reason,
        featured_jobs=featured,
        status=briefing.status,
        created_at=briefing.created_at
    )

@router.get("/briefing/latest", response_model=Optional[BriefingResponse])
def get_latest_briefing(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    briefing = (
        db.query(Briefing)
        .filter(Briefing.user_id == current_user.id)
        .order_by(Briefing.created_at.desc())
        .first()
    )
    if not briefing:
        return None

    featured = []
    if briefing.featured_jobs:
        try:
            featured = json.loads(briefing.featured_jobs)
        except Exception:
            featured = []

    return BriefingResponse(
        id=briefing.id,
        script=briefing.script,
        media_url=briefing.media_url,
        video_url=briefing.video_url,
        audio_url=briefing.audio_url,
        fallback_reason=briefing.fallback_reason,
        featured_jobs=featured,
        status=briefing.status,
        created_at=briefing.created_at
    )

@router.get("/briefing/history", response_model=List[BriefingResponse])
def get_briefing_history(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    briefings = (
        db.query(Briefing)
        .filter(Briefing.user_id == current_user.id)
        .order_by(Briefing.created_at.desc())
        .limit(20)
        .all()
    )
    res = []
    for b in briefings:
        featured = []
        if b.featured_jobs:
            try:
                featured = json.loads(b.featured_jobs)
            except Exception:
                featured = []
        res.append(
            BriefingResponse(
                id=b.id,
                script=b.script,
                media_url=b.media_url,
                video_url=b.video_url,
                audio_url=b.audio_url,
                fallback_reason=b.fallback_reason,
                featured_jobs=featured,
                status=b.status,
                created_at=b.created_at
            )
        )
    return res
