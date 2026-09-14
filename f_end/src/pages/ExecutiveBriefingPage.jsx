import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  RefreshCw,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import Ballpit from '../components/Ballpit';

const defaultFormatAudioTime = (sec) => {
  if (isNaN(sec) || sec === null) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ==========================================
// 2. MAIN EXECUTIVE BRIEFING PAGE COMPONENT
// ==========================================
export default function ExecutiveBriefingPage({
  briefing,
  briefingLoading,
  briefingPollStatus,
  onTriggerBriefing,
  audioPlaying,
  setAudioPlaying,
  audioCurrentTime = 0,
  audioDuration = 0,
  playbackSpeed = 1.0,
  audioPlayerRef,
  apiBase = import.meta.env.VITE_API_BASE_URL || '',
  formatAudioTime = defaultFormatAudioTime,
  onTogglePlay,
  onAudioSeek,
  onSpeedChange,
  onSkipTime,
  onAudioTimeUpdate,
  onAudioLoadedMetadata,
  copiedTranscript,
  isSpeaking,
  onCopyTranscript,
  onSpeakTranscript,
}) {
  const [showScript, setShowScript] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isPlayingVoice = Boolean(audioPlaying || isSpeaking);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsLoaded(true);
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const audioSrc = briefing?.audio_url
    ? `${apiBase}${briefing.audio_url}`
    : (briefing?.media_url ? `${apiBase}${briefing.media_url}` : '');

  const isSynthesizing = briefingLoading || briefing?.status === 'queued' || briefing?.status === 'processing';

  useEffect(() => {
    if (audioPlayerRef?.current && audioSrc) {
      audioPlayerRef.current.load();
    }
  }, [audioSrc, audioPlayerRef]);

  return (
    <>
      <style>{`
        @keyframes voiceEqualizerBounce {
          0%, 100% { height: 4px; }
          50% { height: 18px; }
        }
      `}</style>

      {/* 100% Full Width and Height Outer Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'calc(100vh - 120px)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          backgroundColor: '#09080d'
        }}
      >
        {/* Fullscreen Background — interactive Ballpit Three.js canvas */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            overflow: 'hidden'
          }}
        >
          <Ballpit
            count={50}
            gravity={isPlayingVoice ? 0.03 : 0.01}
            friction={0.9975}
            wallBounce={0.95}
            followCursor={true}
            colors={isPlayingVoice
              ? [0x2563eb, 0x38bdf8, 0xa78bfa]
              : [0x1e3a5f, 0x2255cc, 0x1d4ed8]}
            ambientIntensity={isPlayingVoice ? 1.4 : 0.8}
            lightIntensity={isPlayingVoice ? 300 : 150}
            minSize={0.4}
            maxSize={isPlayingVoice ? 1.2 : 0.9}
          />
        </div>

        {/* Foreground Briefing Box */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '640px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0px)' : 'translateY(40px)',
              transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform, opacity'
            }}
          >
            {/* Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Volume2 style={{ width: '16px', height: '16px', color: '#0a66c2' }} />
                </div>
                <span>Executive Briefing</span>
              </div>

              <button
                type="button"
                onClick={onTriggerBriefing}
                disabled={isSynthesizing}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#0a66c2',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isSynthesizing ? 'not-allowed' : 'pointer',
                  opacity: isSynthesizing ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSynthesizing ? (
                  <>
                    <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: '13px', height: '13px' }} />
                    <span>{briefing ? 'Regenerate' : 'Generate'}</span>
                  </>
                )}
              </button>
            </div>

            {/* State 1: Synthesizing Loader */}
            {isSynthesizing ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '28px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <RefreshCw style={{ width: '18px', height: '18px', color: '#0a66c2', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>
                  Synthesizing Executive Voice Briefing...
                </div>
              </div>
            ) : briefing && (briefing.media_url || briefing.audio_url || briefing.script) ? (
              /* State 2: Active Audio Player Deck with Voice Waveform Animation */
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isPlayingVoice ? '#10b981' : '#0a66c2'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {isPlayingVoice ? 'Speaking' : 'Ready'}
                    </span>

                    {/* Live Waveform Equalizer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '18px', marginLeft: '6px' }}>
                      {[0.1, 0.35, 0.2, 0.5, 0.25].map((delay, idx) => (
                        <span
                          key={idx}
                          style={{
                            width: '3px',
                            backgroundColor: '#0a66c2',
                            borderRadius: '9999px',
                            height: isPlayingVoice ? '18px' : '4px',
                            animation: isPlayingVoice ? `voiceEqualizerBounce 0.8s ease-in-out infinite ${delay}s` : 'none',
                            transition: 'height 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration || 60)}
                  </div>
                </div>

                <div style={{ width: '100%' }}>
                  <input
                    type="range"
                    min="0"
                    max={audioDuration || 60}
                    step="0.1"
                    value={audioCurrentTime}
                    onChange={onAudioSeek}
                    style={{
                      width: '100%',
                      accentColor: '#0a66c2',
                      cursor: 'pointer',
                      height: '5px',
                      backgroundColor: '#cbd5e1',
                      borderRadius: '9999px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => onSkipTime(-10)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Rewind 10s"
                  >
                    <RotateCcw style={{ width: '14px', height: '14px' }} />
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlay}
                    disabled={!audioSrc}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#0a66c2',
                      color: '#ffffff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: !audioSrc ? 'not-allowed' : 'pointer',
                      opacity: !audioSrc ? 0.5 : 1
                    }}
                    title={audioPlaying ? 'Pause' : 'Play'}
                  >
                    {audioPlaying ? (
                      <Pause style={{ width: '16px', height: '16px', fill: 'currentColor' }} />
                    ) : (
                      <Play style={{ width: '16px', height: '16px', fill: 'currentColor', marginLeft: '2px' }} />
                    )}
                  </button>

                  {briefing.script && onSpeakTranscript && (
                    <button
                      type="button"
                      onClick={() => onSpeakTranscript(briefing.script)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: isSpeaking ? '1px solid #0a66c2' : '1px solid #cbd5e1',
                        backgroundColor: isSpeaking ? '#0a66c2' : '#ffffff',
                        color: isSpeaking ? '#ffffff' : '#334155'
                      }}
                    >
                      <Volume2 style={{ width: '13px', height: '13px' }} />
                      <span>{isSpeaking ? 'Stop' : 'Browser Voice'}</span>
                    </button>
                  )}
                </div>

                {briefing.script && (
                  <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setShowScript(!showScript)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#64748b',
                        background: 'none',
                        border: 'none',
                        padding: '2px 0',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Script Transcript</span>
                      {showScript ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                    </button>

                    {showScript && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#334155',
                          lineHeight: '1.6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <p style={{ margin: 0 }}>{briefing.script}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => onCopyTranscript(briefing.script)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#0a66c2',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {copiedTranscript ? <Check style={{ width: '12px', height: '12px', color: '#059669' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                            <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <audio
                  key={audioSrc || 'empty-audio'}
                  ref={audioPlayerRef}
                  src={audioSrc}
                  onTimeUpdate={onAudioTimeUpdate}
                  onLoadedMetadata={onAudioLoadedMetadata}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onEnded={() => setAudioPlaying(false)}
                  onError={(e) => {
                    console.warn('Audio error:', e);
                    setAudioPlaying(false);
                  }}
                  preload="auto"
                />
              </div>
            ) : (
              /* State 3: Empty State */
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  padding: '28px 16px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Volume2 style={{ width: '22px', height: '22px', color: '#94a3b8' }} />
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                  No active voice briefing generated yet.
                </p>
                <button
                  type="button"
                  onClick={onTriggerBriefing}
                  disabled={isSynthesizing}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles style={{ width: '13px', height: '13px' }} />
                  <span>Generate Briefing</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
