import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Briefcase,
  Bot,
  Radio,
  BarChart3,
  LogOut,
  Sparkles,
  BookmarkCheck
} from 'lucide-react';
import Login from './Login';
import LoadingScreen from './LoadingScreen';
import RankedMatchesPage from './pages/RankedMatchesPage';
import AgentChatPage from './pages/AgentChatPage';
import ExecutiveBriefingPage from './pages/ExecutiveBriefingPage';
import MyShortlistPage from './pages/MyShortlistPage';
import CostAnalyticsPage from './pages/CostAnalyticsPage';
import OnboardingResumePage from './pages/OnboardingResumePage';
import PersonalDetailsPage from './pages/PersonalDetailsPage';
import UserProfileDropdown from './components/UserProfileDropdown';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// INSPECTABLE STYLES REGISTRY & PAGE BACKGROUND
// Change the full website background gradient right here!
// ============================================================================
const PAGE_BACKGROUND = 'linear-gradient(135deg, #f8ecea 0%, #ebf5f7 48%, #9db8f1 100%) fixed';

const styles = {
  layout: {
    rootContainer: 'min-h-screen text-gray-900 flex flex-col font-sans',
    rootStyle: {
      background: PAGE_BACKGROUND,
      minHeight: '100vh',
    },
    mainContent: 'flex-1 max-w-5xl w-full mx-auto p-4 sm:py-6 sm:px-4',
  },
  header: {
    container: 'sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 py-2 shadow-xs',
    innerWrapper: 'max-w-6xl mx-auto flex items-center justify-between gap-4',
    brandingWrapper: 'flex items-center shrink-0',
    logoButton: 'flex items-center cursor-pointer select-none transition-opacity hover:opacity-80 py-1',
    navGroup: 'flex items-center gap-2 sm:gap-8',
    tabItem: (isActive) =>
      `flex flex-col items-center justify-center px-3 py-1 text-xs font-semibold relative transition-colors ${
        isActive ? 'text-[#0a66c2]' : 'text-gray-500 hover:text-gray-900'
      }`,
    tabIcon: 'w-5 h-5 mb-0.5',
    tabLabel: 'text-[11px] whitespace-nowrap',
    activeIndicator: 'absolute bottom-[-8px] left-0 right-0 h-[2px] bg-[#0a66c2]',
  },
};

export default function App() {
  const [isAppStarting, setIsAppStarting] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('nexus_token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false); // Step 1 after register
  const [showOnboarding, setShowOnboarding] = useState(false);           // Step 2 — resume
  const [activeTab, setActiveTab] = useState('matches');

  // isAppStarting is cleared only by LoadingScreen's onComplete callback —
  // do NOT add a separate timer here or it will override the animation duration.

  // Analytics & Cost Tracker
  const [analytics, setAnalytics] = useState({
    total_tokens_in: 0,
    total_tokens_out: 0,
    total_cost_inr: 0,
    features: []
  });

  // Tab 1: Matches & Resume
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [scrapingJobs, setScrapingJobs] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Tab 2: Agent Chat & Tools
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'agent',
      text: 'Hello! I am your SAHAAL Career Intelligence Agent. I can check closing deadlines, calculate technical skills gaps against active jobs, or perform semantic job queries. How can I help you today?',
      toolCalls: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [agentThinking, setAgentThinking] = useState(false);
  const chatBottomRef = useRef(null);

  // Tab 3: Briefing & Shortlist
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingPollStatus, setBriefingPollStatus] = useState('idle'); // idle | queued | rendering | ready | failed
  const [savedMatches, setSavedMatches] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [briefingHistory, setBriefingHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [resumeProfile, setResumeProfile] = useState(null);
  const [loadingResumeProfile, setLoadingResumeProfile] = useState(false);

  // Audio Briefing Player States
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const audioPlayerRef = useRef(null);

  const featuredJobsList = useMemo(() => {
    if (!briefing || !briefing.featured_jobs) return [];
    try {
      if (Array.isArray(briefing.featured_jobs)) return briefing.featured_jobs;
      if (typeof briefing.featured_jobs === 'string') return JSON.parse(briefing.featured_jobs);
    } catch (e) {
      console.error('Error parsing featured_jobs', e);
    }
    return [];
  }, [briefing]);

  const handleTogglePlay = async () => {
    if (!audioPlayerRef.current) return;
    if (audioPlaying) {
      audioPlayerRef.current.pause();
      setAudioPlaying(false);
    } else {
      try {
        if (audioPlayerRef.current.ended) {
          audioPlayerRef.current.currentTime = 0;
        }
        const promise = audioPlayerRef.current.play();
        if (promise !== undefined) {
          await promise;
          setAudioPlaying(true);
        }
      } catch (err) {
        console.warn('HTML5 audio playback error:', err);
        setAudioPlaying(false);
        if (briefing?.script) {
          handleSpeakTranscript(briefing.script);
        }
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioPlayerRef.current) {
      setAudioCurrentTime(audioPlayerRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioPlayerRef.current) {
      setAudioDuration(audioPlayerRef.current.duration || 0);
      audioPlayerRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleAudioSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setAudioCurrentTime(newTime);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = speed;
    }
  };

  const handleSkipTime = (secs) => {
    if (audioPlayerRef.current) {
      const target = Math.max(0, Math.min(audioDuration || 9999, audioPlayerRef.current.currentTime + secs));
      audioPlayerRef.current.currentTime = target;
      setAudioCurrentTime(target);
    }
  };

  const formatAudioTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopyTranscript = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleSpeakTranscript = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Browser speech synthesis is not supported on this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/auth/me`, authHeaders())
      .then(res => {
        setCurrentUser(res.data);
        const hasResume = Boolean(res.data?.has_resume);
        const skipped = sessionStorage.getItem('nexus_skipped_onboarding') === 'true';
        if (!hasResume && !skipped) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }
        fetchAllData();
      })
      .catch(() => {
        handleLogout();
      });
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user_id');
    localStorage.removeItem('nexus_user_email');
    localStorage.removeItem('nexus_profile_pic');
    localStorage.removeItem('nexus_onboarded');
    sessionStorage.removeItem('nexus_skipped_onboarding');
    setToken('');
    setCurrentUser(null);
    setShowOnboarding(false);
  };

  const fetchAllData = () => {
    fetchMatches();
    fetchAnalytics();
    fetchSavedMatches();
    fetchLatestBriefing();
    fetchResumeProfile();
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/analytics/costs`, authHeaders());
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  };

  const fetchMatches = async (query = '') => {
    setLoadingMatches(true);
    try {
      const url = query ? `${API_BASE}/matches/ranked?query=${encodeURIComponent(query)}` : `${API_BASE}/matches/ranked`;
      const res = await axios.get(url, authHeaders());
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleTriggerScrape = async () => {
    setScrapingJobs(true);
    setScrapeSuccess('');
    try {
      const res = await axios.post(`${API_BASE}/jobs/scrape`, {}, authHeaders());
      setScrapeSuccess(res.data.message || 'Scrape completed successfully');
      await fetchMatches(searchQuery);
      await fetchAnalytics();
    } catch (err) {
      console.error('Failed to trigger job scrape', err);
    } finally {
      setScrapingJobs(false);
    }
  };

  const fetchSavedMatches = async () => {
    setLoadingSaved(true);
    try {
      const res = await axios.get(`${API_BASE}/matches/saved`, authHeaders());
      setSavedMatches(res.data);
    } catch (err) {
      console.error('Failed to load saved matches', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const fetchLatestBriefing = async () => {
    try {
      const res = await axios.get(`${API_BASE}/briefing/latest`, authHeaders());
      if (res.data) {
        setBriefing(res.data);
        const bId = res.data.job_id || res.data.id;
        if (res.data.status === 'done') {
          setBriefingPollStatus('ready');
        } else if (res.data.status === 'queued') {
          setBriefingPollStatus('queued');
          if (bId) pollBriefing(bId);
        } else if (res.data.status === 'processing') {
          setBriefingPollStatus('rendering');
          if (bId) pollBriefing(bId);
        }
      }

      const histRes = await axios.get(`${API_BASE}/briefing/history`, authHeaders());
      if (Array.isArray(histRes.data)) {
        setBriefingHistory(histRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch briefing', err);
    }
  };

  const fetchResumeProfile = async () => {
    setLoadingResumeProfile(true);
    try {
      const res = await axios.get(`${API_BASE}/resume/profile`, authHeaders());
      setResumeProfile(res.data);
    } catch (err) {
      console.error('Failed to load resume profile', err);
    } finally {
      setLoadingResumeProfile(false);
    }
  };

  const handleResumeUpload = async (inputPayload) => {
    let file = null;
    let text = null;

    if (typeof inputPayload === 'string') {
      text = inputPayload.trim();
    } else if (inputPayload?.text) {
      text = inputPayload.text.trim();
    } else if (inputPayload instanceof File) {
      file = inputPayload;
    } else if (inputPayload?.target?.files?.[0]) {
      file = inputPayload.target.files[0];
    }

    if (!file && !text) return;

    setResumeUploading(true);
    setResumeSuccess('');

    try {
      let res;
      if (text) {
        res = await axios.post(
          `${API_BASE}/resume/text`,
          { text },
          authHeaders()
        );
      } else {
        const formData = new FormData();
        formData.append('file', file);
        res = await axios.post(`${API_BASE}/resume/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setResumeSuccess(`Indexed ${res.data.word_count} words.`);
      fetchMatches();
      fetchAnalytics();
      fetchResumeProfile();
      setCurrentUser(prev => prev ? { ...prev, has_resume: true } : prev);
      sessionStorage.setItem('nexus_skipped_onboarding', 'true');
      localStorage.setItem('nexus_onboarded', 'true');
      setTimeout(() => {
        setShowOnboarding(false);
      }, 900);
    } catch (err) {
      alert(err.response?.data?.detail || 'Resume indexing failed');
    } finally {
      setResumeUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveMatch = async (jobId, currentStatus) => {
    const nextStatus = currentStatus === 'saved' ? 'none' : 'saved';
    try {
      await axios.post(`${API_BASE}/matches/save`, {
        job_id: jobId,
        status: nextStatus
      }, authHeaders());

      setMatches(prev => prev.map(m => m.id === jobId ? { ...m, status: nextStatus } : m));
      fetchSavedMatches();
      fetchResumeProfile();
    } catch (err) {
      console.error('Save toggle error', err);
    }
  };

  const handleStatusChange = async (jobId, status) => {
    try {
      await axios.post(`${API_BASE}/matches/save`, {
        job_id: jobId,
        status: status
      }, authHeaders());
      fetchSavedMatches();
      fetchMatches();
      fetchResumeProfile();
    } catch (err) {
      console.error('Status change error', err);
    }
  };

  const triggerBriefing = async () => {
    setBriefingLoading(true);
    setBriefingPollStatus('queued');
    try {
      const res = await axios.post(`${API_BASE}/briefing/generate`, {}, authHeaders());
      const briefingId = res.data.job_id || res.data.id;
      setBriefing(res.data);
      if (briefingId) {
        pollBriefing(briefingId);
      }
    } catch (err) {
      alert('Failed to generate briefing');
      setBriefingPollStatus('idle');
      setBriefingLoading(false);
    }
  };

  const pollBriefing = (id) => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/briefing/status/${id}`, authHeaders());
        setBriefing(res.data);
        if (res.data.status === 'processing') {
          setBriefingPollStatus('rendering');
        } else if (res.data.status === 'done') {
          setBriefingPollStatus('ready');
          setBriefingLoading(false);
          clearInterval(interval);
          fetchAnalytics();
          axios.get(`${API_BASE}/briefing/history`, authHeaders())
            .then(hRes => {
              if (Array.isArray(hRes.data)) setBriefingHistory(hRes.data);
            })
            .catch(() => {});
        } else if (res.data.status === 'failed') {
          setBriefingPollStatus('failed');
          setBriefingLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
        setBriefingLoading(false);
      }
    }, 2000);
  };

  const sendChatMessage = async (presetText = null) => {
    const messageToSend = presetText || chatInput;
    if (!messageToSend.trim()) return;

    const userMessage = { sender: 'user', text: messageToSend, toolCalls: [] };
    setChatMessages(prev => [...prev, userMessage]);
    if (!presetText) setChatInput('');
    setAgentThinking(true);

    try {
      const res = await axios.post(`${API_BASE}/agent/chat`, {
        message: messageToSend
      }, authHeaders());

      const agentMessage = {
        sender: 'agent',
        text: res.data.response,
        toolCalls: res.data.tool_calls || []
      };
      setChatMessages(prev => [...prev, agentMessage]);
      fetchAnalytics();
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'agent', text: 'Error connecting to agent core.', toolCalls: [] }
      ]);
    } finally {
      setAgentThinking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (isAppStarting) {
    return (
      <LoadingScreen
        title="Starting SAHAAL"
        subtitle="Autonomous Career Intelligence & Vector Engine"
        mode="startup"
        onComplete={() => setIsAppStarting(false)}
      />
    );
  }

  if (!token) {
    return (
      <Login
        onAuthSuccess={(authData) => {
          const newToken = authData?.token || localStorage.getItem('nexus_token');
          setToken(newToken);
          // New users go through Personal Details first, then the resume step
          setShowPersonalDetails(true);
        }}
      />
    );
  }

  // ── Step 1: Personal Details (photo + name) — shown right after registration ──
  if (showPersonalDetails) {
    return (
      <PersonalDetailsPage
        onComplete={() => {
          setShowPersonalDetails(false);
          setShowOnboarding(true); // proceed to resume step
        }}
        onSkip={() => {
          setShowPersonalDetails(false);
          setShowOnboarding(true); // still go to resume step even if skipped
        }}
      />
    );
  }

  // ── Step 2: Resume Onboarding ──
  if (showOnboarding) {
    return (
      <OnboardingResumePage
        onUploadResume={handleResumeUpload}
        onSkip={() => {
          sessionStorage.setItem('nexus_skipped_onboarding', 'true');
          setShowOnboarding(false);
        }}
        resumeUploading={resumeUploading}
        resumeSuccess={resumeSuccess}
      />
    );
  }

  const userInitial = currentUser?.email ? currentUser.email[0].toUpperCase() : 'U';

  const navItems = [
    { id: 'matches', label: 'Ranked Matches', icon: Briefcase },
    { id: 'agent', label: 'Agent Chat', icon: Bot },
    { id: 'briefing', label: 'Executive Briefing', icon: Radio },
    { id: 'shortlist', label: 'My Shortlist', icon: BookmarkCheck },
  ];

  return (
    <div
      className={styles.layout.rootContainer}
      style={styles.layout.rootStyle}
    >

      {/* TOP BAR NAVIGATION */}
      <header className={styles.header.container}>
        <div className={styles.header.innerWrapper}>

          {/* Logo & Identity: Sahaal written in Petrona font */}
          <div className={styles.header.brandingWrapper}>
            <div
              onClick={() => setActiveTab('matches')}
              className={styles.header.logoButton}
              title="Sahaal"
            >
              <span
                style={{
                  fontFamily: "'Petrona', 'Petunia', serif",
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  lineHeight: 1
                }}
              >
                Sahaal<span style={{ color: '#0a66c2' }}>.</span>
              </span>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="flex items-center gap-1 sm:gap-6 md:gap-8 overflow-x-auto py-1 shrink-0">
            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={styles.header.tabItem(isActive)}
                  title={tab.label}
                >
                  <div className="relative">
                    <Icon className={styles.header.tabIcon} />
                    {tab.id === 'shortlist' && savedMatches.length > 0 && (
                      <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[#0a66c2] text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                        {savedMatches.length}
                      </span>
                    )}
                  </div>
                  <span className={styles.header.tabLabel}>{tab.label}</span>
                  {isActive && <span className={styles.header.activeIndicator} />}
                </button>
              );
            })}
          </nav>

          {/* Right User Profile Dropdown */}
          <UserProfileDropdown
            currentUser={currentUser}
            userInitial={userInitial}
            analytics={analytics}
            onUploadResume={handleResumeUpload}
            resumeUploading={resumeUploading}
            resumeSuccess={resumeSuccess}
            onLogout={handleLogout}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onRefreshAnalytics={fetchAnalytics}
          />

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={styles.layout.mainContent}>

        {/* TAB 1: RANKED MATCHES & RESUME */}
        {activeTab === 'matches' && (
          <RankedMatchesPage
            matches={matches}
            loadingMatches={loadingMatches}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={fetchMatches}
            onToggleSave={handleSaveMatch}
            onUploadResume={handleResumeUpload}
            resumeUploading={resumeUploading}
            resumeSuccess={resumeSuccess}
            scrapingJobs={scrapingJobs}
            scrapeSuccess={scrapeSuccess}
            onTriggerScrape={handleTriggerScrape}
            fileInputRef={fileInputRef}
          />
        )}

        {/* TAB 2: AGENT CHAT TERMINAL */}
        {activeTab === 'agent' && (
          <AgentChatPage
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            thinking={agentThinking}
            onSendMessage={sendChatMessage}
            chatBottomRef={chatBottomRef}
            userInitial={userInitial}
          />
        )}

        {/* TAB 3: EXECUTIVE BRIEFING — always mounted to preserve WebGL context */}
        <div style={{ display: activeTab === 'briefing' ? 'block' : 'none' }}>
          <ExecutiveBriefingPage
            briefing={briefing}
            briefingLoading={briefingLoading}
            briefingPollStatus={briefingPollStatus}
            onTriggerBriefing={triggerBriefing}
            audioPlaying={audioPlaying}
            setAudioPlaying={setAudioPlaying}
            audioCurrentTime={audioCurrentTime}
            audioDuration={audioDuration}
            playbackSpeed={playbackSpeed}
            audioPlayerRef={audioPlayerRef}
            apiBase={API_BASE}
            formatAudioTime={formatAudioTime}
            onTogglePlay={handleTogglePlay}
            onAudioSeek={handleAudioSeek}
            onSpeedChange={handleSpeedChange}
            onSkipTime={handleSkipTime}
            onAudioTimeUpdate={handleAudioTimeUpdate}
            onAudioLoadedMetadata={handleAudioLoadedMetadata}
            featuredJobsList={featuredJobsList}
            copiedTranscript={copiedTranscript}
            isSpeaking={isSpeaking}
            onCopyTranscript={handleCopyTranscript}
            onSpeakTranscript={handleSpeakTranscript}
            savedMatches={savedMatches}
            loadingSaved={loadingSaved}
            onStatusChange={handleStatusChange}
            briefingHistory={briefingHistory}
            setBriefing={setBriefing}
            setBriefingPollStatus={setBriefingPollStatus}
          />
        </div>

        {/* TAB 4: MY SHORTLIST & CAREER HUB */}
        {activeTab === 'shortlist' && (
          <MyShortlistPage
            savedMatches={savedMatches}
            loadingSaved={loadingSaved}
            onStatusChange={handleStatusChange}
            onToggleSave={handleSaveMatch}
            resumeProfile={resumeProfile}
            loadingResumeProfile={loadingResumeProfile}
            onUploadResume={handleResumeUpload}
            resumeUploading={resumeUploading}
            briefingHistory={briefingHistory}
            onNavigateToMatches={() => setActiveTab('matches')}
            onNavigateToBriefing={() => setActiveTab('briefing')}
            apiBase={API_BASE}
          />
        )}

        {/* TAB 5: COST & TOKEN ANALYTICS */}
        {activeTab === 'analytics' && (
          <CostAnalyticsPage
            analytics={analytics}
            onRefresh={fetchAnalytics}
          />
        )}

      </main>

    </div>
  );
}