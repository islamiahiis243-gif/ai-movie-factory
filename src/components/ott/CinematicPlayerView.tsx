/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.2B: Cinematic Video Player Engine (HTML5 Progressive MP4)
 * 
 * Strict Architectural Invariants:
 * 1. Control Plane Integration: Coordinates session lifecycle (acquire -> heartbeat -> renew -> terminate)
 *    strictly via /api/ott/playback-session.
 * 2. Media Delivery: Direct byte streaming from Supabase Storage CDN via signed delivery URL.
 * 3. Range & Seek Continuity: Retains currentTime and buffer state across seamless URL renewal.
 * 4. Anti-Tampering: Halts playback immediately if heartbeat/renewal reports revocation.
 * 5. Dual-Format Responsive: 16:9 Widescreen & 9:16 Vertical Web Drama Micro-Series.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  FastForward,
  Rewind,
  Subtitles,
  List,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { OttDynamicWatermark } from './OttDynamicWatermark.tsx';
import { OttCheckoutModal } from './OttCheckoutModal.tsx';
import Hls from 'hls.js';

export interface ChapterMarker {
  time: number;
  title: string;
}

export interface CinematicPlayerProps {
  contentId: string;
  contentType: 'film' | 'episode';
  channelId: string;
  grantToken: string;
  title: string;
  posterUrl?: string;
  aspectRatio?: '16:9' | '9:16';
  initialPositionSeconds?: number;
  chapters?: ChapterMarker[];
  subtitleVttUrl?: string;
  priceIdr?: number;
  onClose?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPrevEpisode?: boolean;
  onPlaybackError?: (error: { code: string; message: string }) => void;
}

export const CinematicPlayerView: React.FC<CinematicPlayerProps> = ({
  contentId,
  contentType,
  channelId,
  grantToken,
  title,
  posterUrl,
  aspectRatio = '16:9',
  initialPositionSeconds = 0,
  chapters = [],
  subtitleVttUrl,
  priceIdr = 25000,
  onClose,
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode = false,
  hasPrevEpisode = false,
  onPlaybackError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const renewalTimerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isSubtitlesActive, setIsSubtitlesActive] = useState<boolean>(Boolean(subtitleVttUrl));
  const [showChaptersMenu, setShowChaptersMenu] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);

  // Milestone 2.9.2D: HLS Adaptive Bitrate Streaming State
  const [streamMode, setStreamMode] = useState<'hls' | 'progressive'>('progressive');
  const [availableLevels, setAvailableLevels] = useState<Array<{ id: number; height: number; bitrate: number; label: string }>>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 = Auto ABR
  const [activeResolutionLabel, setActiveResolutionLabel] = useState<string>('Auto');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);

  // Sesi & Security State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [watermarkText, setWatermarkText] = useState<string | null>(null);
  const [currentDeliveryUrl, setCurrentDeliveryUrl] = useState<string | null>(null);
  const [urlExpiresAt, setUrlExpiresAt] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    code: string;
    message: string;
    errorMessage?: string;
    isFatal: boolean;
  } | null>(null);
  const [isRenewingUrl, setIsRenewingUrl] = useState<boolean>(false);

  // Resume Watching Storage Key
  const resumeStorageKey = `amf_playback_pos_${contentId}`;

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ---------------------------------------------------------------------------
  // 1. Session Lifecycle: ACQUIRE Playback Session
  // ---------------------------------------------------------------------------
  const acquireSession = useCallback(async () => {
    setIsBuffering(true);
    setErrorState(null);

    try {
      const response = await fetch('/api/ott/playback-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acquire',
          grantToken,
          channelId,
          contentId,
          contentType,
          deviceInfo: {
            userAgent: navigator.userAgent,
            fingerprint: `dev_${window.screen.width}x${window.screen.height}`,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.session) {
        const errorInfo = {
          code: data.error || 'ACQUIRE_FAILED',
          message: data.message || 'Gagal memulai sesi pemutaran.',
          isFatal: true,
        };
        setErrorState(errorInfo);
        if (onPlaybackError) onPlaybackError(errorInfo);
        setIsBuffering(false);
        return;
      }

      setSessionId(data.session.sessionId);
      if (data.session.watermark?.text) {
        setWatermarkText(data.session.watermark.text);
      }
      setCurrentDeliveryUrl(data.session.playbackUrl);
      setUrlExpiresAt(data.session.signedUrlExpiresAt);

      const isHls = data.session.streamMode === 'hls' && Boolean(data.session.hlsMasterPlaylistUrl);
      const streamUrl = isHls ? data.session.hlsMasterPlaylistUrl : data.session.playbackUrl;

      if (videoRef.current) {
        // Destroy existing HLS instance if any
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Check resume position
        const savedTime = localStorage.getItem(resumeStorageKey);
        const resumePos = savedTime ? parseFloat(savedTime) : initialPositionSeconds;

        if (isHls && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });
          hlsRef.current = hls;

          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, manifestData) => {
            setStreamMode('hls');
            const levels = manifestData.levels.map((lvl, idx) => ({
              id: idx,
              height: lvl.height,
              bitrate: lvl.bitrate,
              label: `${lvl.height}p`,
            }));
            setAvailableLevels(levels);
            setSelectedLevel(-1);
            setActiveResolutionLabel('Auto');

            if (resumePos > 5 && videoRef.current) {
              videoRef.current.currentTime = resumePos;
            }
            videoRef.current?.play().catch(() => setIsPlaying(false));
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, levelData) => {
            const currentLvl = hls.levels[levelData.level];
            if (currentLvl) {
              setActiveResolutionLabel(selectedLevel === -1 ? `Auto (${currentLvl.height}p)` : `${currentLvl.height}p`);
            }
          });

          hls.on(Hls.Events.ERROR, (_, errorData) => {
            if (errorData.fatal) {
              console.warn('[HLS Player] Fatal HLS error encountered, falling back to progressive MP4:', errorData.details);
              hls.destroy();
              hlsRef.current = null;
              setStreamMode('progressive');
              if (videoRef.current) {
                videoRef.current.src = data.session.playbackUrl;
                if (resumePos > 5) videoRef.current.currentTime = resumePos;
                videoRef.current.play().catch(() => setIsPlaying(false));
              }
            }
          });
        } else if (isHls && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari / iOS HLS
          setStreamMode('hls');
          videoRef.current.src = streamUrl;
          if (resumePos > 5) videoRef.current.currentTime = resumePos;
          videoRef.current.play().catch(() => setIsPlaying(false));
        } else {
          // Standard Progressive MP4 mode
          setStreamMode('progressive');
          videoRef.current.src = data.session.playbackUrl;
          if (resumePos > 5) {
            videoRef.current.currentTime = resumePos;
          }
          videoRef.current.play().catch(() => {
            setIsPlaying(false);
          });
        }
      }
    } catch (err: any) {
      const errorInfo = {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Gagal menghubungi server pemutaran.',
        isFatal: true,
      };
      setErrorState(errorInfo);
      if (onPlaybackError) onPlaybackError(errorInfo);
      setIsBuffering(false);
    }
  }, [channelId, contentId, contentType, grantToken, initialPositionSeconds, onPlaybackError, resumeStorageKey]);

  // Initial mount acquisition
  useEffect(() => {
    acquireSession();

    return () => {
      // Cleanup on unmount: Terminate session
      if (sessionId) {
        navigator.sendBeacon(
          '/api/ott/playback-session',
          JSON.stringify({ action: 'terminate', sessionId })
        );
      }
      clearInterval(heartbeatTimerRef.current);
      clearInterval(renewalTimerRef.current);
    };
  }, [acquireSession]);

  // ---------------------------------------------------------------------------
  // 2. Session Lifecycle: HEARTBEAT (Every 45 seconds)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    heartbeatTimerRef.current = setInterval(async () => {
      if (!videoRef.current || !sessionId) return;
      const pos = videoRef.current.currentTime;

      // Persist resume position locally
      if (pos > 0) {
        localStorage.setItem(resumeStorageKey, pos.toString());
      }

      try {
        const hbRes = await fetch('/api/ott/playback-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            sessionId,
            currentPositionSeconds: pos,
          }),
        });

        const hbData = await hbRes.json();
        if (!hbRes.ok || !hbData.success) {
          // Session was revoked on server or entitlement expired
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.src = '';
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
          }
          setIsPlaying(false);
          const errCode = hbData.error || 'SESSION_TERMINATED';
          const errMsg = hbData.message || (errCode === 'ENTITLEMENT_EXPIRED' ? 'Akses ditutup: Hak tonton telah berakhir.' : 'Sesi pemutaran Anda telah berakhir atau dialihkan.');
          setErrorState({
            code: errCode,
            message: errMsg,
            errorMessage: errMsg,
            isFatal: true,
          });
        }
      } catch {
        // Silently tolerate single network ping failures
      }
    }, 45000);

    return () => clearInterval(heartbeatTimerRef.current);
  }, [sessionId, resumeStorageKey]);

  // ---------------------------------------------------------------------------
  // 3. Session Lifecycle: SIGNED URL RENEWAL (Every 10 minutes)
  // ---------------------------------------------------------------------------
  // Seamless Video Source Transition Helper
  const switchVideoSource = useCallback((newSignedUrl: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // If browser is already pointing to this URL, do nothing
    if (video.src === newSignedUrl) return;

    const prevTime = video.currentTime;
    const wasPlaying = !video.paused;

    // Indicate brief re-buffering to viewer
    setIsBuffering(true);

    const onMetadataLoaded = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
      // Restore previous playback position accurately
      video.currentTime = prevTime;
      setCurrentTime(prevTime);

      if (wasPlaying) {
        video.play().catch(() => {});
      }
      setIsBuffering(false);
    };

    video.addEventListener('loadedmetadata', onMetadataLoaded);
    video.src = newSignedUrl;
  }, []);

  const renewSignedUrl = useCallback(async () => {
    if (!sessionId || isRenewingUrl) return;
    setIsRenewingUrl(true);

    try {
      const pos = videoRef.current?.currentTime || 0;
      const renewRes = await fetch('/api/ott/playback-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew',
          sessionId,
          grantToken,
          currentPositionSeconds: pos,
        }),
      });

      const renewData = await renewRes.json();

      if (!renewRes.ok || !renewData.success || !renewData.playbackUrl) {
        // Entitlement was revoked or subscription expired mid-stream!
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = '';
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        }
        setIsPlaying(false);
        setErrorState({
          code: renewData.error || 'ENTITLEMENT_REVOKED',
          message: renewData.message || 'Akses ditutup: Hak tonton telah berakhir atau dicabut.',
          errorMessage: renewData.message || 'Akses ditutup: Hak tonton telah berakhir atau dicabut.',
          isFatal: true,
        });
        setIsRenewingUrl(false);
        return;
      }

      // Seamless URL Renewal: Update state and expiry
      setCurrentDeliveryUrl(renewData.playbackUrl);
      setUrlExpiresAt(renewData.signedUrlExpiresAt);

      // Perform seamless source transition on HTML5 video element
      switchVideoSource(renewData.playbackUrl);
    } catch {
      // Retried on next cycle
    } finally {
      setIsRenewingUrl(false);
    }
  }, [grantToken, isRenewingUrl, sessionId, switchVideoSource]);

  useEffect(() => {
    if (!sessionId) return;
    // Renew URL every 10 minutes (600,000 ms) before 15-minute TTL lapses
    renewalTimerRef.current = setInterval(renewSignedUrl, 600000);
    return () => clearInterval(renewalTimerRef.current);
  }, [renewSignedUrl, sessionId]);

  // ---------------------------------------------------------------------------
  // 4. Video Element Event Handlers
  // ---------------------------------------------------------------------------
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Calculate buffer percentage
    const buff = videoRef.current.buffered;
    if (buff.length > 0 && videoRef.current.duration > 0) {
      const bufferedEnd = buff.end(buff.length - 1);
      const bufferProgress = (bufferedEnd / videoRef.current.duration) * 100;
      setBufferedPercent(bufferProgress);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsBuffering(false);
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };
  const handlePause = () => setIsPlaying(false);

  const handleVideoError = () => {
    setIsBuffering(false);
    setIsPlaying(false);
    setErrorState({
      code: 'MEDIA_DECODE_ERROR',
      message: 'Format video tidak dapat diputar atau koneksi streaming terputus.',
      isFatal: false,
    });
  };

  // ---------------------------------------------------------------------------
  // 5. User Controls: Play, Pause, Seek, Speed, Fullscreen
  // ---------------------------------------------------------------------------
  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };
  const togglePlay = handleTogglePlay;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const changeQualityLevel = (levelIndex: number) => {
    setSelectedLevel(levelIndex);
    setShowQualityMenu(false);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      if (levelIndex === -1) {
        setActiveResolutionLabel('Auto');
      } else {
        const lvl = hlsRef.current.levels[levelIndex];
        if (lvl) setActiveResolutionLabel(`${lvl.height}p`);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const seekRelative = (offsetSec: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + offsetSec));
  };

  const jumpToChapter = (chapterTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = chapterTime;
    setShowChaptersMenu(false);
  };

  // Auto-hide controls timer on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space' || e.code === 'KeyK' || e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyJ' || e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyL' || e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newVol = Math.min(1, volume + 0.1);
        setVolume(newVol);
        setIsMuted(false);
        if (videoRef.current) {
          videoRef.current.volume = newVol;
          videoRef.current.muted = false;
        }
      } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newVol = Math.max(0, volume - 0.1);
        setVolume(newVol);
        setIsMuted(newVol === 0);
        if (videoRef.current) {
          videoRef.current.volume = newVol;
          videoRef.current.muted = newVol === 0;
        }
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, duration, onClose]);

  const isVertical = aspectRatio === '9:16';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full bg-black select-none overflow-hidden flex items-center justify-center font-sans ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : 'rounded-2xl border border-slate-800'
      }`}
    >
      {/* --------------------------------------------------------------------- */}
      {/* HTML5 Progressive MP4 Video Element                                   */}
      {/* --------------------------------------------------------------------- */}
      <div className={`relative ${isVertical ? 'h-full max-h-[85vh] aspect-[9/16] shadow-2xl' : 'w-full aspect-video'}`}>
        <video
          ref={videoRef}
          controls={false}
          poster={posterUrl}
          playsInline
          preload="metadata"
          onClick={handleTogglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onError={handleVideoError}
          className="w-full h-full object-contain cursor-pointer"
        >
          {subtitleVttUrl && isSubtitlesActive && (
            <track
              src={subtitleVttUrl}
              kind="subtitles"
              srcLang="id"
              label="Bahasa Indonesia"
              default
            />
          )}
        </video>

        {/* Dynamic Visible Watermark Canvas Overlay (Milestone 2.9.2C) */}
        {sessionId && (
          <OttDynamicWatermark
            viewerPseudonym={watermarkText || `WM-${(sessionId || '').slice(-8)}`}
            sessionShortId={sessionId.length > 16 ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : sessionId}
            aspectRatio={aspectRatio}
            intervalSeconds={12}
            isActive={!errorState}
          />
        )}

        {/* Buffering Spinner */}
        {isBuffering && !errorState && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <span className="text-xs font-mono text-emerald-300">Memuat Streaming...</span>
            </div>
          </div>
        )}

        {/* Error / Revocation Modal */}
        {errorState && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-30 p-6">
            <div className="max-w-md w-full bg-[#111827] border border-red-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white tracking-wide">
                  {errorState.code === 'ENTITLEMENT_REVOKED' || errorState.code === 'PASS_REVOKED'
                    ? 'Akses Konten Dicabut'
                    : 'Gangguan Pemutaran Media'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{errorState.message}</p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Beli Tiket Nonton (PPV)
                </button>
                {!errorState.isFatal ? (
                  <button
                    onClick={acquireSession}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Ulang</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Tutup Pemutar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Controls Overlay Layer                                              */}
        {/* ------------------------------------------------------------------- */}
        <div
          className={`absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Bar: Title, Episode Nav, Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                {isVertical ? '9:16 Web Drama' : '16:9 Cinema'}
              </span>
              <h3 className="text-sm font-bold text-white truncate max-w-sm drop-shadow">{title}</h3>
            </div>

            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-black/40 hover:bg-black/80 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Center Play/Pause Large Trigger on Click */}
          <div className="flex-1 flex items-center justify-center" onClick={togglePlay}>
            {!isPlaying && !isBuffering && !errorState && (
              <div className="w-16 h-16 rounded-full bg-emerald-500/90 text-slate-950 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform cursor-pointer">
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            )}
          </div>

          {/* Bottom Bar: Progress Slider, Chapters, Volume, Fullscreen */}
          <div className="space-y-2 pt-2">
            {/* Custom Scrubbable Seek Bar */}
            <div className="relative group/bar flex items-center">
              {/* Buffer Bar */}
              <div
                className="absolute left-0 h-1 bg-slate-600/60 rounded-full pointer-events-none"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Progress Track */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-400 hover:h-2 transition-all"
              />
              {/* Chapter Markers */}
              {chapters.map((ch, idx) => {
                if (duration <= 0) return null;
                const pos = (ch.time / duration) * 100;
                return (
                  <div
                    key={idx}
                    title={ch.title}
                    onClick={() => jumpToChapter(ch.time)}
                    className="absolute top-0 bottom-0 w-1 bg-amber-400 hover:scale-150 transition-all cursor-pointer z-10"
                    style={{ left: `${pos}%` }}
                  />
                );
              })}
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={() => seekRelative(-10)}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Mundur 10 Detik (J)"
                >
                  <Rewind className="w-4 h-4" />
                </button>

                {/* Forward 10s */}
                <button
                  onClick={() => seekRelative(10)}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Maju 10 Detik (L)"
                >
                  <FastForward className="w-4 h-4" />
                </button>

                {/* Previous Episode */}
                {hasPrevEpisode && (
                  <button
                    onClick={onPrevEpisode}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Episode Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                {/* Next Episode */}
                {hasNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Episode Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {/* Volume & Mute */}
                <div className="flex items-center gap-1.5 group/vol">
                  <button onClick={toggleMute} className="hover:text-emerald-400 transition-colors cursor-pointer">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Time Display */}
                <span className="font-mono text-[11px] text-slate-300">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Chapters Drawer Button */}
                {chapters.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowChaptersMenu(!showChaptersMenu)}
                      className={`hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                        showChaptersMenu ? 'text-emerald-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline">Chapter</span>
                    </button>
                    {showChaptersMenu && (
                      <div className="absolute bottom-8 right-0 w-48 bg-[#111827] border border-slate-700 rounded-xl p-2 shadow-2xl space-y-1 z-30">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-1">
                          Daftar Bagian
                        </span>
                        {chapters.map((ch, idx) => (
                          <button
                            key={idx}
                            onClick={() => jumpToChapter(ch.time)}
                            className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-slate-800 text-slate-200 truncate flex items-center justify-between"
                          >
                            <span className="truncate">{ch.title}</span>
                            <span className="font-mono text-[10px] text-slate-400">{formatTime(ch.time)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtitle WebVTT Toggle */}
                {subtitleVttUrl && (
                  <button
                    onClick={() => setIsSubtitlesActive(!isSubtitlesActive)}
                    className={`hover:text-emerald-400 transition-colors cursor-pointer ${
                      isSubtitlesActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                    title="Subtitle (WebVTT)"
                  >
                    <Subtitles className="w-4 h-4" />
                  </button>
                )}

                {/* Playback Speed Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="font-mono text-[11px] hover:text-emerald-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded border border-slate-700"
                  >
                    {playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-8 right-0 bg-[#111827] border border-slate-700 rounded-xl p-1.5 shadow-2xl space-y-0.5 z-30">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`w-full text-left px-3 py-1 text-xs rounded hover:bg-slate-800 ${
                            playbackRate === rate ? 'text-emerald-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestone 2.9.2D: HLS Adaptive Quality Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className={`font-mono text-[11px] hover:text-emerald-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1 ${
                      streamMode === 'hls' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-slate-300'
                    }`}
                    title={streamMode === 'hls' ? 'HLS Adaptive Bitrate Quality' : 'Progressive Stream (1080p)'}
                  >
                    <Settings className="w-3 h-3" />
                    <span>{activeResolutionLabel}</span>
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-8 right-0 bg-[#111827] border border-slate-700 rounded-xl p-1.5 shadow-2xl space-y-0.5 z-30 min-w-36">
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                        Kualitas Video {streamMode === 'hls' ? '(HLS)' : '(MP4)'}
                      </div>
                      {streamMode === 'hls' ? (
                        <>
                          <button
                            onClick={() => changeQualityLevel(-1)}
                            className={`w-full text-left px-2.5 py-1 text-xs rounded hover:bg-slate-800 flex items-center justify-between ${
                              selectedLevel === -1 ? 'text-emerald-400 font-bold bg-emerald-500/10' : 'text-slate-300'
                            }`}
                          >
                            <span>Otomatis (ABR)</span>
                            <span className="text-[10px] font-mono text-emerald-400">Auto</span>
                          </button>
                          {availableLevels.map((lvl) => (
                            <button
                              key={lvl.id}
                              onClick={() => changeQualityLevel(lvl.id)}
                              className={`w-full text-left px-2.5 py-1 text-xs rounded hover:bg-slate-800 flex items-center justify-between ${
                                selectedLevel === lvl.id ? 'text-emerald-400 font-bold bg-emerald-500/10' : 'text-slate-300'
                              }`}
                            >
                              <span>{lvl.height}p</span>
                              <span className="text-[10px] font-mono text-slate-400">{Math.round(lvl.bitrate / 1000)}k</span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-2.5 py-1.5 text-xs text-slate-400">
                          Mode Progressive MP4 (1080p Full HD)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* B2C OTT Checkout Modal */}
      <OttCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        channelId={channelId}
        orderType="ppv_single"
        contentId={contentId}
        contentType={contentType}
        title={title}
        priceIdr={priceIdr}
        onPaymentSuccess={() => {
          setShowCheckoutModal(false);
          setErrorState(null);
          acquireSession();
        }}
      />
    </div>
  );
};
export default CinematicPlayerView;
