'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '@/lib/socket'; 
import { emitStudentActivity } from '@/lib/studentActivity';
import {
  Play, Pause, Maximize, Minimize, Loader2, Settings, Check,
  Volume2, VolumeX, RotateCcw, MessageSquare, X,
  FastForward, Rewind, Activity, Gauge, Lock, Unlock,
  Battery, Palette, Flame, Info // 🚀 ADDED INFO
} from 'lucide-react';

const THEMES = {
  red:    { primary: '#dc2626', glow: 'shadow-red-500/50' },
  blue:   { primary: '#2563eb', glow: 'shadow-blue-500/50' },
  green:  { primary: '#16a34a', glow: 'shadow-green-500/50' },
  purple: { primary: '#9333ea', glow: 'shadow-purple-500/50' },
  gold:   { primary: '#eab308', glow: 'shadow-yellow-500/50' },
};

export default function SecurePlayer({
  videoId,
  onStreamEnd,
  user,
  trackingTitle = '',
  trackingType = 'live',
  trackingRoute = null,
  contentId = null,
}) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [player, setPlayer] = useState(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false); // 🚀 APPLE BYPASS STATE

  // Time & Progress
  const [currentTime, setCurrentTime] = useState(0); 
  const [dragTime, setDragTime] = useState(null);    
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [atLiveEdge, setAtLiveEdge] = useState(false);
  const [secondsBehind, setSecondsBehind] = useState(0);

  // 🚀 ULTRA-POWERED: The Anti-Magnetic Snap Shield
  const isSeeking = useRef(false);
  const jumpingToLive = useRef(false);

  const [ping, setPing] = useState(0);
  const [pingColor, setPingColor] = useState('text-green-500');
  const [liveViewers, setLiveViewers] = useState(0); 
  
  // 🚀 VOLUME UPGRADES
  const [volume, setVolume] = useState(100);
  const [prevVol, setPrevVol] = useState(100); // Remembers volume before mute
  const [isMuted, setIsMuted] = useState(false);
  const [volPopup, setVolPopup] = useState(null); // Top volume indicator for PC arrows
  const volTimer = useRef(null);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); 
  const [showControls, setShowControls] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [theme, setTheme] = useState('red'); 
  const [showIntro, setShowIntro] = useState(true); 
  const [isLocked, setIsLocked] = useState(false); 
  const [batterySaver, setBatterySaver] = useState(false);

  // 🚀 PHASE 1: LIQUID RIPPLE STATE (Now tracks exact thumb position!)
  const [doubleTapData, setDoubleTapData] = useState(null);
  const [isFastForwarding, setIsFastForwarding] = useState(false); 
  const longPressTimer = useRef(null); 

  // 🚀 DEVICE AWARENESS & INFO MODAL
  const [isMobile, setIsMobile] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // 🚀 SAMSUNG DETECTOR STATES
  const [isSamsungBrowser, setIsSamsungBrowser] = useState(false);
  const [dismissSamsung, setDismissSamsung] = useState(false);

  // 🚀 PHASE 2: Toast State
  const [resumeToast, setResumeToast] = useState(null);

  const [watermarkPos, setWatermarkPos] = useState({ top: '10%', left: '10%' });

  const containerRef = useRef(null);
  const seekRef = useRef(null);
  const hideTimer = useRef(null);
  const lastTap = useRef(0);
  const touchStartY = useRef(0); 

  const [origin, setOrigin] = useState('');
  const [hostname, setHostname] = useState('');
  
  useEffect(() => {
    setIsMounted(true);
    setOrigin(window.location.origin);
    setHostname(window.location.hostname);
    // Detect if Mobile or PC for the Info Menu
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    setTimeout(() => setShowIntro(false), 3500);
  }, []);

  // 🚀 SAMSUNG BROWSER SNIPER
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      // Secretly checks the User Agent for Samsung's signature
      if (/SamsungBrowser/i.test(navigator.userAgent)) {
        setIsSamsungBrowser(true);
      }
    }
  }, []);

  // 🚀 ISOLATED BRAIN: THE "SEE FROM OUTSIDE" UPGRADE
  useEffect(() => {
    socket.emit('get_viewers', videoId);
    const handleViewers = (data) => {
      if (data && data.videoId) {
        if (data.videoId === videoId) setLiveViewers(data.count);
      } 
      else if (playing && typeof data === 'number') {
        setLiveViewers(data);
      }
    };
    socket.on('live_viewers', handleViewers);
    return () => socket.off('live_viewers', handleViewers);
  }, [playing, videoId]);

  // 🚀 ACTIVE VIEWER TRACKING (The engine I accidentally nuked! 🤦‍♂️)
  // This physically tells the server "I am watching this video right now!"
  useEffect(() => {
    if (!videoId) return;

    // Small delay prevents React from spamming "join" and "leave" simultaneously
    const timer = setTimeout(() => {
      if (playing) {
        socket.emit('join_live', videoId);
      } else {
        socket.emit('leave_live', videoId);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      socket.emit('leave_live', videoId);
    };
  }, [playing, videoId]);

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, origin, playsinline: 1, autoplay: 1 },
  };

  const formatTime = (t) => {
    if (!Number.isFinite(t)) return '0:00';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const liveEdge = useCallback(() => {
    try { if (!player) return safeDuration; return Math.max(0, player.getDuration() - 1); } catch { return safeDuration; }
  }, [player, safeDuration]);

  useEffect(() => {
    const handleGlobalPlay = (e) => {
      if (e.detail.videoId !== videoId && playing) {
        if (player && typeof player.pauseVideo === 'function') {
          player.pauseVideo();
          setPlaying(false);
        }
      }
    };
    window.addEventListener('sft-global-play', handleGlobalPlay);
    return () => window.removeEventListener('sft-global-play', handleGlobalPlay);
  }, [videoId, playing, player]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const moveWatermark = () => setWatermarkPos({ top: Math.floor(Math.random() * 80) + 10 + '%', left: Math.floor(Math.random() * 80) + 10 + '%' });
    const intervalId = setInterval(moveWatermark, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const checkPing = async () => {
      const start = Date.now();
      try {
        await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
        const latency = Date.now() - start;
        setPing(latency);
        if (latency < 100) setPingColor('text-green-500');
        else if (latency < 300) setPingColor('text-yellow-500');
        else setPingColor('text-red-500');
      } catch (e) { setPing(999); setPingColor('text-red-600'); }
    };
    const interval = setInterval(checkPing, 5000);
    checkPing();
    return () => clearInterval(interval);
  }, []);

  // 🚀 PHASE 1: THE SILENT MEMORY BRAIN (Saves progress every 5 seconds)
  useEffect(() => {
    // Safety check: Only run if playing, not live, and we have a user
    if (!player || !playing || isLive || !user?.id || !videoId) return;

    const saveInterval = setInterval(() => {
      try {
        const ct = player.getCurrentTime();
        const dur = player.getDuration();
        
        // Only start saving if they have watched at least 5 seconds, and it's a real video
        if (Number.isFinite(ct) && ct > 5 && dur > 0) { 
          const progressData = {
            currentTime: ct,
            duration: dur,
            lastWatched: Date.now()
          };
          // Save directly to the phone/PC memory! (Zero internet data used)
          localStorage.setItem(`sft_progress_${user.id}_${videoId}`, JSON.stringify(progressData));
        }
      } catch (e) {}
    }, 5000); // 👈 Runs silently every 5 seconds

    return () => clearInterval(saveInterval);
  }, [player, playing, isLive, user, videoId]);

  useEffect(() => {
    if (!player || !ready) return;
    const id = setInterval(() => {
      // 🛑 THE TITANIUM SHIELD: Do NOT read YouTube's time while dragging or buffering!
      if (dragTime !== null || isSeeking.current) return; 

      try {
        const ct = player.getCurrentTime();
        const dur = player.getDuration();
        const buf = player.getVideoLoadedFraction() * dur;
        const live = player.getVideoData()?.isLive === true;

        if (Number.isFinite(ct)) setCurrentTime(ct);
        if (Number.isFinite(dur) && dur > 0) setDuration(dur);
        if (Number.isFinite(buf)) setBuffered(buf);
        setIsLive(live);
        
        if (live) {
          // If user just clicked "Return to Live", don't let stale position override it
          if (jumpingToLive.current) {
            setAtLiveEdge(true);
            setSecondsBehind(0);
          } else {
            const edge = Math.max(0, dur - 1);
            const behind = Math.max(0, edge - ct);
            setSecondsBehind(behind);
            setAtLiveEdge(behind < 65);
          }
        }
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [player, ready, dragTime]); // removed liveEdge

  useEffect(() => {
    const safeTitle = String(trackingTitle || '').trim();
    if (!playing || !user || user.role !== 'student' || !safeTitle) return;

    const isRecording = String(trackingType || '').toLowerCase().includes('record');
    const prefix = isRecording ? 'Watching Recording' : 'Watching Live';
    const route = trackingRoute || (typeof window !== 'undefined' ? window.location.pathname : null);

    try {
      window.sessionStorage.setItem(isRecording ? 'sft_recording_title' : 'sft_live_title', safeTitle);
    } catch {}

    const emitWatching = () => {
      emitStudentActivity(socket, user, {
        page: `${prefix}: ${safeTitle}`,
        action: `${prefix}: ${safeTitle}`,
        detail: safeTitle,
        route,
        kind: 'content',
        contentId,
      });
    };

    emitWatching();
    const timer = setInterval(emitWatching, 5000);
    return () => clearInterval(timer);
  }, [playing, user, trackingTitle, trackingType, trackingRoute, contentId]);

  useEffect(() => {
    const safeTitle = String(trackingTitle || '').trim();
    if (!safeTitle) return;

    const isRecording = String(trackingType || '').toLowerCase().includes('record');
    const key = isRecording ? 'sft_recording_title' : 'sft_live_title';

    return () => {
      try {
        const current = (window.sessionStorage.getItem(key) || '').trim();
        if (current === safeTitle) {
          window.sessionStorage.removeItem(key);
        }
      } catch {}
    };
  }, [trackingTitle, trackingType]);

  // 🚀 MASTER VOLUME CONTROLLER (Fixes all Mute/Swipe bugs perfectly)
  const changeVolume = useCallback((newVol, showTopPopup = false) => {
    if (!player) return;
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    player.setVolume(clamped);
    
    if (clamped === 0) {
      setIsMuted(true);
      player.mute();
    } else {
      setIsMuted(false);
      player.unMute();
      setPrevVol(clamped); // Remember last good volume
    }

    // Trigger the cool top popup for keyboard arrows
    if (showTopPopup) {
      setVolPopup(clamped);
      clearTimeout(volTimer.current);
      volTimer.current = setTimeout(() => setVolPopup(null), 1500);
    }
  }, [player]);

  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!player) return;
    if (isMuted) {
      changeVolume(prevVol > 0 ? prevVol : 100, false); // Restore old volume
    } else {
      changeVolume(0, false); // Kill volume completely
    }
  };

  // 🚀 PC KEYBOARD SHORTCUTS ENGINE
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 🛑 SAFETY SHIELD: Ignore keys if they are typing in an input field!
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (isLocked || !player || !ready) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          const nextT = Math.min(sliderMax, currentTime + 10);
          player.seekTo(nextT, true); setCurrentTime(nextT);
          setShowDoubleTapOverlay('right');
          setTimeout(() => setShowDoubleTapOverlay(null), 600);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const prevT = Math.max(0, currentTime - 10);
          player.seekTo(prevT, true); setCurrentTime(prevT);
          setShowDoubleTapOverlay('left');
          setTimeout(() => setShowDoubleTapOverlay(null), 600);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(volume + 5, true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(volume - 5, true);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, ready, playing, isLocked, currentTime, volume, isMuted, changeVolume]);



  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (playing && !showSettingsMenu && !showChat && !showInfo && dragTime === null && !isLocked) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [playing, showSettingsMenu, showChat, showInfo, dragTime, isLocked]);

  const handleInteract = () => {
    if (!isLocked) {
      setShowControls(true);
      scheduleHide();
    }
  };

  const onReady = (e) => {
    setPlayer(e.target);
    setReady(true);
    setVolume(e.target.getVolume());
    setIsMuted(e.target.isMuted());

    // 🚀 PHASE 2: THE AUTO-RESUME ENGINE
    if (user?.id && videoId) {
      try {
        const saved = localStorage.getItem(`sft_progress_${user.id}_${videoId}`);
        if (saved) {
          const { currentTime } = JSON.parse(saved);
          // Only trigger resume if they watched more than 10 seconds!
          if (currentTime > 10) {
            e.target.seekTo(currentTime, true); // Jump instantly!
            setResumeToast(currentTime); // Show the beautiful UI toast
            
            // Auto-hide the toast after 6 seconds
            setTimeout(() => setResumeToast(null), 6000);
          }
        }
      } catch (err) {}
    }

    e.target.playVideo();
    setTimeout(() => setShowControls(false), 2000);
  };

  const onStateChange = (e) => {
    if (e.data === 3) setIsBuffering(true);
    else setIsBuffering(false);
    
    if (e.data === 0) {
      setHasEnded(true); setPlaying(false); setShowControls(true); setShowChat(false);
      
      // 🚀 PHASE 1: WIPE MEMORY WHEN FINISHED
      if (user?.id && videoId) {
          localStorage.removeItem(`sft_progress_${user.id}_${videoId}`);
      }

      if (onStreamEnd) onStreamEnd();
    } else if (e.data === 1) {
      setHasEnded(false); setPlaying(true); scheduleHide();
      window.dispatchEvent(new CustomEvent('sft-global-play', { detail: { videoId } }));
    } else if (e.data === 2) {
      setPlaying(false); setShowControls(true);
    }
  };

  // 🚀 PHASE 2: "START FROM BEGINNING" LOGIC
  const handleRestartVideo = (e) => {
    e?.stopPropagation();
    if (player) {
      player.seekTo(0, true);
      setResumeToast(null);
      // Wipe the old memory so it starts fresh!
      if (user?.id && videoId) localStorage.removeItem(`sft_progress_${user.id}_${videoId}`);
    }
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (isLocked) return;
    if (!player) return;
    if (hasEnded) { player.seekTo(0, true); player.playVideo(); setHasEnded(false); }
    else if (playing) { player.pauseVideo(); }
    else { player.playVideo(); }
  };

  // 🚀 ULTRA-POWERED: Flawless Seeking
  const handleSeekEnd = (e) => {
    const newTime = Number(e.target.value);
    
    if (player) {
      player.seekTo(newTime, true);
      setCurrentTime(newTime);
      
      if (isLive) {
        const edge = Math.max(0, player.getDuration() - 1);
        setAtLiveEdge(Math.abs(edge - newTime) < 65);
        setSecondsBehind(Math.max(0, edge - newTime));
      }
    }

    // 🛑 HOLD THE SHIELD! Wait 1.5s for YouTube to finish buffering before unlocking the UI!
    setTimeout(() => {
      isSeeking.current = false;
      setDragTime(null);
    }, 1500);
  };

  // 🚀 PHASE 1: LIQUID RIPPLE ENGINE
  const handleDoubleTap = (e, side) => {
    if (isLocked) return;
    const now = Date.now();
    
    if (now - lastTap.current < 300) {
      // Calculate exact Y position of the thumb relative to the player
      const rect = containerRef.current.getBoundingClientRect();
      const tapY = e.clientY - rect.top;

      if (side === 'left') {
        const newT = Math.max(0, currentTime - 10);
        player?.seekTo(newT, true); setCurrentTime(newT);
        setDoubleTapData({ side: 'left', y: tapY });
      } else {
        const newT = Math.min(sliderMax, currentTime + 10);
        player?.seekTo(newT, true); setCurrentTime(newT);
        setDoubleTapData({ side: 'right', y: tapY });
      }
      
      // Let the ripple animation play for 700ms before hiding
      setTimeout(() => setDoubleTapData(null), 700);
    } else {
      handleInteract();
    }
    lastTap.current = now;
  };

  const handlePointerDown = () => {
    if (isLocked) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (player && playing && !isLive) {
        player.setPlaybackRate(2.0);
        setIsFastForwarding(true);
      }
    }, 500); 
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
    if (isFastForwarding) {
      if (player) player.setPlaybackRate(playbackRate); 
      setIsFastForwarding(false);
    }
  };
  // 🚀 THE FIX: Apple iOS Fake Fullscreen Bypass
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && !isFakeFullscreen) {
        try {
            // Try standard native fullscreen
            if (containerRef.current?.requestFullscreen) {
                await containerRef.current.requestFullscreen();
            } 
            // Try Safari-specific native fullscreen (for Mac/iPad)
            else if (containerRef.current?.webkitRequestFullscreen) {
                await containerRef.current.webkitRequestFullscreen();
            } 
            else {
                throw new Error("Native blocked");
            }
        } catch (err) {
            // 🍏 APPLE BLOCKED IT? ACTIVATE THE MATRIX FAKE FULLSCREEN!
            setIsFakeFullscreen(true);
            setIsFullscreen(true);
            document.body.style.overflow = 'hidden'; // Lock background scrolling
        }
    } else {
        // Exit Fullscreen
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen && document.fullscreenElement) {
            document.webkitExitFullscreen();
        } else {
            // Disable Fake Fullscreen
            setIsFakeFullscreen(false);
            setIsFullscreen(false);
            document.body.style.overflow = ''; // Unlock background scrolling
        }
    }
  };

  const jumpToLive = () => {
    if (!player) return;
    const edge = Math.max(0, player.getDuration() - 1);
    
    // Lock BOTH shields simultaneously
    isSeeking.current = true;
    jumpingToLive.current = true;
    
    player.seekTo(edge, true); 
    player.playVideo(); 
    setAtLiveEdge(true); 
    setSecondsBehind(0);
    
    // Release after YouTube finishes buffering to live edge
    setTimeout(() => {
        isSeeking.current = false;
        jumpingToLive.current = false;
    }, 10000);
};

  const sliderMax = safeDuration; // 👈 Back to native duration
  const displayTime = dragTime !== null ? dragTime : currentTime;
  const sliderValue = Math.min(displayTime, sliderMax || 0);
  const progress = sliderMax ? (sliderValue / sliderMax) * 100 : 0;
  const bufferPct = sliderMax ? (buffered / sliderMax) * 100 : 0;
  const activeColor = THEMES[theme].primary;

  if (!isMounted) return <div className="w-full h-full bg-black rounded-xl flex items-center justify-center"><Loader2 className="animate-spin text-red-600" /></div>;

  return (
    <div
      ref={containerRef}
      className={`bg-black group select-none transition-all duration-300 ${
        isFakeFullscreen 
        ? 'fixed inset-0 z-[99999] w-[100vw] h-[100dvh] rounded-none' // 🚀 FAKE FULLSCREEN CSS
        : 'relative w-full h-full rounded-xl overflow-hidden'
      }`}
      onMouseMove={handleInteract}
      onMouseLeave={() => playing && !showSettingsMenu && !showInfo && setShowControls(false)}
      onClick={handleInteract}
      tabIndex={0} // Allows the div to catch keyboard events easily
    >
      {batterySaver && (
        <div className="absolute inset-0 z-[15] bg-black flex flex-col items-center justify-center">
            <Battery size={48} className="animate-pulse mb-4" style={{ color: activeColor }}/>
            <p className="text-white font-bold tracking-widest text-sm uppercase">Audio Only Mode</p>
        </div>
      )}

      {/* YOUTUBE IFRAME */}
      <div className="absolute inset-0 pointer-events-none">
        <YouTube videoId={videoId} opts={opts} onReady={onReady} onStateChange={onStateChange} className="w-full h-full" />
      </div>

      {/* 🚀 PHASE 2: THE NETFLIX-STYLE RESUME TOAST */}
      <AnimatePresence>
        {resumeToast !== null && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20, filter: "blur(5px)" }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-[80] bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 pointer-events-auto"
            onClick={(e) => e.stopPropagation()} // Stop click from pausing video
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={14} style={{ color: activeColor }} />
              <span className="text-white text-[10px] font-black uppercase tracking-widest">
                Resumed at {formatTime(resumeToast)}
              </span>
            </div>
            <button 
              onClick={handleRestartVideo}
              className="w-full py-1.5 px-4 bg-white/10 hover:bg-white/20 hover:scale-105 rounded-lg text-[10px] font-bold text-white transition-all border border-white/5"
            >
              Start from Beginning
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {(!ready || isBuffering) && !errorMsg && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <Loader2 className="animate-spin text-white w-12 h-12 drop-shadow-lg" />
        </div>
      )}

      {/* 🚀 TOP ARROW VOLUME HUD */}
      <AnimatePresence>
        {volPopup !== null && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[80] bg-black/80 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl pointer-events-none"
          >
            {isMuted ? <VolumeX size={18} className="text-white/50" /> : <Volume2 size={18} style={{ color: activeColor }} />}
            <div className="h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-100" style={{ width: `${volPopup}%`, backgroundColor: activeColor }} />
            </div>
            <span className="text-white font-black font-mono text-xs">{Math.round(volPopup)}%</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 left-4 z-30 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/5 flex items-center gap-3 shadow-lg pointer-events-none">
          <div className="flex items-center gap-1.5">
              <Activity size={10} className={pingColor} /> 
              <span className={`text-[10px] font-mono font-bold ${pingColor}`}>{ping}ms</span>
          </div>
          <div className="w-[1px] h-3 bg-white/20"></div>
          <div className="flex items-center gap-1.5">
              <Flame size={12} className="text-red-500 animate-pulse" />
              <span className="text-[10px] font-mono font-black text-white">{liveViewers}</span>
          </div>
      </div>

      {user && (
        <div className="absolute z-0 pointer-events-none transition-all duration-[5000ms] ease-linear opacity-30" style={{ top: watermarkPos.top, left: watermarkPos.left }}>
          <p className="text-white text-[10px] font-mono font-bold drop-shadow-md whitespace-nowrap">{user.mobile} • {user.name}</p>
        </div>
      )}

      {/* 🚀 SAMSUNG BROWSER WARNING TOAST */}
      <AnimatePresence>
        {isSamsungBrowser && !dismissSamsung && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-purple-900/95 backdrop-blur-xl border border-purple-500/50 p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 w-[85%] sm:w-auto min-w-[280px] pointer-events-auto"
            onClick={(e) => e.stopPropagation()} // Prevents video pause when clicking toast
          >
            <div className="flex items-start justify-between w-full gap-3">
              <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-300 shrink-0">
                <Info size={16} />
              </div>
              <div className="flex-1">
                <p className="text-white text-[10px] font-black uppercase tracking-widest mb-0.5 shadow-sm">
                  Samsung Browser Detected
                </p>
                <p className="text-purple-200/80 text-[9px] leading-relaxed font-medium">
                  For the premium cinematic experience, turn off <strong className="text-white">"Video Assistant"</strong> in your browser settings, or switch to Chrome.
                </p>
              </div>
              <button 
                onClick={() => setDismissSamsung(true)} 
                className="text-purple-400 hover:text-white shrink-0 p-1 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 INFO/SHORTCUT ICON (TOP RIGHT) */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
        className="absolute top-4 right-4 z-[90] bg-black/40 backdrop-blur-md p-2.5 rounded-full text-white/70 hover:bg-black/60 hover:text-white transition-all border border-white/10 shadow-lg"
      >
        <Info size={16} />
      </button>

      {/* 🚀 DEVICE SPECIFIC INFO MODAL */}
      {/* 🚀 UPGRADED: DEVICE SPECIFIC INFO MODAL (Lag-Free Popup) */}
      <AnimatePresence>
        {showInfo && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-14 right-4 z-[100] bg-slate-900/95 backdrop-blur-xl border border-white/10 p-5 rounded-3xl w-72 md:w-80 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-3">
                    <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <Info size={16} style={{ color: activeColor }} /> Player Controls
                    </h3>
                    <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="space-y-3">
                    {isMobile ? (
                        // MOBILE INSTRUCTIONS
                        <>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-white/10 rounded-lg text-white flex"><Rewind size={14}/> <FastForward size={14}/></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Double Tap Edge</p><p className="text-[9px] text-slate-400">Skip forward or backward 10s</p></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-white/10 rounded-lg text-white"><Volume2 size={14}/></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Swipe Right Edge</p><p className="text-[9px] text-slate-400">Drag finger to adjust volume</p></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-white/10 rounded-lg text-white"><Gauge size={14}/></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Long Press Center</p><p className="text-[9px] text-slate-400">Hold to play at 2x speed</p></div>
                            </div>
                        </>
                    ) : (
                        // PC INSTRUCTIONS (Now includes Click & Hold)
                        <>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="px-2 py-1 bg-white/10 rounded-md text-white font-mono text-[9px] font-black border border-white/20">SPACE</div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Play / Pause</p></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="flex gap-1"><div className="px-1.5 py-0.5 bg-white/10 rounded-md text-white font-mono text-[9px] font-black border border-white/20">←</div><div className="px-1.5 py-0.5 bg-white/10 rounded-md text-white font-mono text-[9px] font-black border border-white/20">→</div></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Seek +/- 10 Sec</p></div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="flex gap-1"><div className="px-1.5 py-0.5 bg-white/10 rounded-md text-white font-mono text-[9px] font-black border border-white/20">↑</div><div className="px-1.5 py-0.5 bg-white/10 rounded-md text-white font-mono text-[9px] font-black border border-white/20">↓</div></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Volume +/- 5%</p></div>
                            </div>
                            {/* 🚀 ADDED DESKTOP CLICK & HOLD */}
                            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-white/10 rounded-lg text-white"><Gauge size={14}/></div>
                                <div><p className="text-[11px] font-bold text-white uppercase tracking-wider">Click & Hold</p><p className="text-[9px] text-slate-400">Play at 2x speed</p></div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {isLocked && (
        <button onClick={() => setIsLocked(false)} className="absolute top-4 right-16 z-[90] bg-white/10 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white/20 transition-all border border-white/10 animate-pulse">
          <Lock size={16} style={{ color: activeColor }} />
        </button>
      )}

      
      <div className="absolute inset-y-0 left-0 w-1/3 z-10 outline-none" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onClick={(e) => { e.stopPropagation(); handleDoubleTap(e, 'left'); }} />
      <div className="absolute inset-y-0 right-0 w-1/3 z-10 outline-none" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onClick={(e) => { e.stopPropagation(); handleDoubleTap(e, 'right'); }} />
      <div className="absolute inset-y-0 left-1/3 right-1/3 z-10 flex items-center justify-center outline-none" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onClick={togglePlay}>
        {!playing && ready && !isLocked && (
           <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Play fill="white" className="text-white ml-1" size={32} />
           </div>
        )}
      </div>

      {/* 🚀 UPGRADED: SLEEK TIKTOK 2X SPEED PILL (Top Center) */}
      <AnimatePresence>
        {isFastForwarding && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -20, scale: 0.9 }} 
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[80] bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl pointer-events-none"
          >
            <span className="text-white font-black tracking-widest uppercase text-xs">2X Speed</span>
            <FastForward size={14} className="text-white animate-pulse" style={{ color: activeColor }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 PHASE 2: NATIVE MOBILE LIQUID RIPPLE UI */}
      <AnimatePresence>
        {doubleTapData && (
          <motion.div 
            initial={{ opacity: 1 }} 
            animate={{ opacity: 0 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.7, ease: "easeOut" }} 
            className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center z-20 pointer-events-none overflow-hidden ${
              doubleTapData.side === 'left' ? 'left-0 rounded-r-[50%]' : 'right-0 rounded-l-[50%]'
            }`}
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)' }}
          >
            {/* 🌊 The Liquid Thumb Ripple (Emanates from the exact tap Y-coordinate!) */}
            <motion.div 
              initial={{ scale: 0, opacity: 0.6 }} 
              animate={{ scale: 4, opacity: 0 }} 
              transition={{ duration: 0.6, ease: "easeOut" }} 
              className="absolute w-32 h-32 rounded-full bg-white/20 blur-md"
              style={{ 
                top: doubleTapData.y - 64, // Centers the 128px circle exactly on their thumb!
                [doubleTapData.side === 'left' ? 'left' : 'right']: '10%',
              }}
            />

            {/* The Bouncing Icons */}
            <motion.div 
              initial={{ scale: 0.5, x: doubleTapData.side === 'left' ? -20 : 20, opacity: 0 }} 
              animate={{ scale: 1.1, x: 0, opacity: 1 }} 
              className="relative z-30 flex flex-col items-center text-white drop-shadow-2xl"
            >
              {doubleTapData.side === 'left' ? <Rewind size={48} fill="currentColor" /> : <FastForward size={48} fill="currentColor" />}
              <span className="text-xl font-black mt-2 drop-shadow-lg">
                {doubleTapData.side === 'left' ? '-10s' : '+10s'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showChat && (
        <div className="absolute top-0 right-0 bottom-16 z-[60] w-full md:max-w-[320px] bg-black/90 border-l border-white/10 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black">
                <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} style={{ color: activeColor }}/> Live Chat</span>
                <button onClick={() => setShowChat(false)} className="text-white/50 hover:text-white"><X size={16}/></button>
            </div>
            <div className="flex-1 w-full bg-white relative">
                 {hostname && videoId && (<iframe src={`https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${hostname}`} className="w-full h-full border-0 absolute inset-0"/>)}
            </div>
        </div>
      )}

      <AnimatePresence>
        {!isLocked && showControls && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-0 w-full z-50 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pb-2 px-3 md:px-5" onClick={(e) => e.stopPropagation()}>
            
            <div className="relative h-1.5 md:h-1 group/seek w-full cursor-pointer mb-3 flex items-center" ref={seekRef}>
              <div className="absolute w-full h-full bg-white/20 rounded-full" />
              <div className="absolute h-full bg-white/40 rounded-full" style={{ width: `${bufferPct}%` }} />
              <div className="absolute h-full rounded-full relative" style={{ width: `${progress}%`, backgroundColor: activeColor }}>
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full scale-0 group-hover/seek:scale-100 transition-transform shadow-lg border border-white" style={{ backgroundColor: activeColor }} />
              </div>
              <input 
                type="range" min={0} max={sliderMax || 0} step={0.1} value={sliderValue || 0} 
                className="absolute w-full h-full opacity-0 cursor-pointer z-20" 
                onPointerDown={(e) => { isSeeking.current = true; setDragTime(Number(e.target.value)); }} 
                onChange={(e) => { isSeeking.current = true; setDragTime(Number(e.target.value)); handleInteract(); }} 
                onMouseUp={handleSeekEnd} onTouchEnd={handleSeekEnd} 
              />
            </div>

            <div className="flex justify-between items-center text-white h-8">
              <div className="flex items-center gap-1.5 md:gap-4">
                <button onClick={togglePlay} className="hover:text-white/80 transition-colors">
                  {hasEnded ? <RotateCcw size={20} /> : playing ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} />}
                </button>
                {/* 🚀 VOLUME CONTROLS */}
                <div className="flex items-center gap-2 group/volume">
                  {/* 🚀 MUTE BUTTON (Visible on all devices) */}
                  <button onClick={toggleMute}>
                    {isMuted ? <VolumeX size={20} className="text-red-500" /> : <Volume2 size={20} />}
                  </button>
                  
                  {/* 🚀 VOLUME SLIDER (Bulletproof: Only renders if NOT a phone/tablet) */}
                  {!isMobile && (
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={isMuted ? 0 : volume} 
                      className="w-0 overflow-hidden group-hover/volume:w-20 transition-all h-1 bg-white/30 rounded-lg appearance-none cursor-pointer" 
                      onChange={(e) => changeVolume(Number(e.target.value), false)} 
                    />
                  )}
                </div>
                
                {/* 🚀 ULTRA-POWERED: Twitch-Style Live Display */}
                <div className="text-[9px] md:text-xs font-medium opacity-90 tracking-wide whitespace-nowrap">
                  {isLive ? (
                     <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: atLiveEdge ? activeColor : 'gray', color: atLiveEdge ? activeColor : 'gray' }}></span>
                         <span className={atLiveEdge ? 'text-white font-black' : 'text-gray-400 font-bold'}>
                           {atLiveEdge && dragTime === null ? 'LIVE' : `-${formatTime(Math.max(0, safeDuration - displayTime))}`}
                         </span>
                     </div>
                  ) : (
                     <span>{formatTime(displayTime)} / {formatTime(safeDuration)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-3">
              {isLive && !atLiveEdge && (<button onClick={jumpToLive} className="text-[9px] md:text-[10px] font-bold bg-white/10 hover:bg-white/20 px-1.5 md:px-2 py-1 rounded uppercase whitespace-nowrap" style={{ color: activeColor }}>Return to Live</button>)}
  
              <button onClick={() => setShowChat(!showChat)} className={`p-1 md:p-1.5 rounded transition-colors ${showChat ? 'bg-white text-black' : 'hover:bg-white/10'}`}><MessageSquare size={16} /></button>

              <button onClick={() => setIsLocked(true)} className="hidden md:flex p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Lock Screen"><Unlock size={18} /></button>
                <div className="relative">
                  <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className={`p-1 md:p-1.5 rounded transition-colors ${showSettingsMenu ? 'rotate-45' : ''}`}><Settings size={16} /></button>
                  {showSettingsMenu && (
                     <div className="absolute bottom-full right-0 mb-8 bg-black/95 border border-white/10 rounded-xl overflow-hidden w-52 shadow-2xl z-[70] p-3 backdrop-blur-xl">
                        <div className="mb-3">
                            <div className="px-2 py-1 text-[10px] font-bold text-white/50 uppercase flex items-center gap-2"><Gauge size={12} style={{ color: activeColor }}/> Playback Speed</div>
                            <div className="flex justify-between bg-white/5 rounded-lg p-1 border border-white/5 mt-1">
                                {[1, 1.5, 2].map((rate) => (
                                    <button key={rate} onClick={() => { player?.setPlaybackRate(rate); setPlaybackRate(rate); }} className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all ${playbackRate === rate ? 'text-white shadow-lg' : 'text-white/50 hover:text-white'}`} style={playbackRate === rate ? { backgroundColor: activeColor } : {}}>{rate}x</button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-3">
                            <div className="px-2 py-1 text-[10px] font-bold text-white/50 uppercase flex items-center gap-2"><Palette size={12} style={{ color: activeColor }}/> Player Skin</div>
                            <div className="flex justify-between px-2 mt-1">
                                {Object.keys(THEMES).map((t) => (
                                    <button key={t} onClick={() => setTheme(t)} className={`w-5 h-5 rounded-full border-2 transition-all ${theme === t ? 'border-white scale-125 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`} style={{ backgroundColor: THEMES[t].primary }} />
                                ))}
                            </div>
                        </div>

                        <button onClick={() => { setBatterySaver(!batterySaver); setShowSettingsMenu(false); }} className="w-full mt-1 text-left px-3 py-2.5 text-xs font-bold hover:bg-white/10 flex justify-between items-center text-white rounded-lg transition-colors border border-white/5 bg-white/5">
                            <div className="flex items-center gap-2"><Battery size={14} style={{ color: activeColor }}/> Audio Mode</div>
                            {batterySaver && <Check size={14} style={{ color: activeColor }}/>}
                        </button>
                     </div>
                  )}
                </div>
                <button onClick={toggleFullscreen} className="hover:text-white/80 transition-colors">{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}