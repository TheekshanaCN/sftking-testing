'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import SecurePlayer from '@/components/shared/SecurePlayer';
import PdfSmartButton from './PdfSmartButton'; 
import { Lock, Play, Video, Loader2} from 'lucide-react';
import { socket } from '@/lib/socket'; 
import { emitStudentActivity } from '@/lib/studentActivity';

export default function VideoCard({ item, user, onUnlock, activityRoute = '/student/live' }) {
  const [showPlayer, setShowPlayer] = useState(false);
  const router = useRouter();

  // 🚀 PHASE 4: ZOOM JOINING STATE
  const [isJoiningZoom, setIsJoiningZoom] = useState(false);

  // 🚀 PHASE 5: RECORDING ACCESS STATE
  const [isAccessingRecording, setIsAccessingRecording] = useState(false);

  if (!item) return null;

  const getYTID = (url) => {
    if (!url) return '';
    const match = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)\??v?=?|(&v=)|(live\/))([^#&?]*).*/);
    return match && match[9]?.length === 11 ? match[9] : '';
  };

  const videoId = getYTID(item.youtube_link);

  // 🚀 PHASE 3: PROGRESS BAR STATE & MEMORY READER
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    // Only check memory if the video is not actively playing right now
    if (user?.id && videoId && !showPlayer) {
      try {
        const saved = localStorage.getItem(`sft_progress_${user.id}_${videoId}`);
        if (saved) {
          const { currentTime, duration } = JSON.parse(saved);
          
          // Only show the bar if they watched more than 5 seconds, and aren't basically finished (98%)
          if (duration > 0 && currentTime > 5) {
            const pct = (currentTime / duration) * 100;
            if (pct < 98) {
              setProgressPct(pct);
            }
          }
        }
      } catch (e) {}
    }
  }, [user, videoId, showPlayer]);

  // 🚀 PHASE 4: THE INVISIBLE HANDSHAKE ENGINE
  const handleZoomJoin = async (e) => {
    e.stopPropagation(); // Stop the card from clicking
    
    // 1. If they haven't paid, slap them with the lock screen! Heee heee!
    if (!item.isPaid) {
      if (onUnlock) onUnlock();
      return;
    }

    setIsJoiningZoom(true);
    try {
      const liveTitle = String(item.title || 'Live Class').trim();
      try {
        window.sessionStorage.setItem('sft_live_title', liveTitle);
      } catch {}

      emitStudentActivity(socket, user, {
        page: `Watching Live: ${liveTitle}`,
        action: `Watching Live: ${liveTitle}`,
        detail: liveTitle,
        route: `/live-zoom/${item.id}`,
        kind: 'content'
      });
      // 🚀 PHASE 3: REROUTE TO THE EMBEDDED SDK PORTAL
      // We don't fetch the password here anymore. We just send them to our secure room!
      router.push(`/live-zoom/${item.id}`);
      
    } catch (error) {
      alert("Failed to join Zoom. Please check your access.");
    } finally {
      setIsJoiningZoom(false);
    }
  };

  // 🚀 PHASE 5: ZOOM RECORDING ACCESS HANDLER
  const handleRecordingAccess = async (e) => {
    e.stopPropagation();
    
    if (!item.isPaid) {
      if (onUnlock) onUnlock();
      return;
    }

    setIsAccessingRecording(true);
    try {
      const recordingTitle = String(item.title || 'Recording').trim();
      try {
        window.sessionStorage.setItem('sft_recording_title', recordingTitle);
      } catch {}

      emitStudentActivity(socket, user, {
        page: `Watching Recording: ${recordingTitle}`,
        action: `Watching Recording: ${recordingTitle}`,
        detail: recordingTitle,
        route: `/zoom-recording/${item.id}`,
        kind: 'content'
      });
      router.push(`/zoom-recording/${item.id}`);
    } catch (error) {
      alert("Failed to access recording. Please check your access.");
    } finally {
      setIsAccessingRecording(false);
    }
  };

  const handlePlayClick = () => {
    setShowPlayer(true); 
    
    if (user && item.isPaid) {
      const contentLabel = item.type === 'Live' ? 'Live' : 'Recording';
      const cleanTitle = String(item.title || `${contentLabel} Content`).trim();

      try {
        if (contentLabel === 'Live') {
          window.sessionStorage.setItem('sft_live_title', cleanTitle);
        } else {
          window.sessionStorage.setItem('sft_recording_title', cleanTitle);
        }
      } catch {}

      emitStudentActivity(socket, user, {
        page: `Watching ${contentLabel}: ${cleanTitle}`,
        action: `Watching ${contentLabel}: ${cleanTitle}`,
        detail: cleanTitle,
        route: activityRoute,
        kind: 'content'
      });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[30px] overflow-hidden border border-slate-100 dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-transform duration-300 relative flex flex-col h-full transform-gpu">
      
      {/* =========================================
          ULTRA MODERN VIDEO COVER (NOW MASSIVE & CINEMATIC) 
         ========================================= */}
      {/* 🚀 FIX: Removed 'aspect-video' and added 'flex-1 min-h-[220px]'. This forces the video area to take up 70%+ of the card! */}
      <div className="flex-1 w-full bg-slate-950 relative flex items-center justify-center overflow-hidden min-h-[220px] sm:min-h-[260px]">
        
        {item.isPaid ? (
          showPlayer ? (
            <div className="absolute inset-0 w-full h-full animate-in fade-in duration-700">
                <SecurePlayer
                  videoId={videoId}
                  user={user}
                  trackingTitle={item.title}
                  trackingType={item.type === 'Live' ? 'live' : 'recording'}
                  trackingRoute={activityRoute}
                  contentId={item.id}
                />
            </div>
          ) : (
            <div 
              onClick={handlePlayClick} 
              className="absolute inset-0 w-full h-full cursor-pointer group bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 z-10"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.15),transparent_50%)] pointer-events-none"></div>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(159,18,57,0.2),transparent_50%)] pointer-events-none group-hover:opacity-70 transition-opacity duration-500"></div>
              <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

              <div className="relative z-20 w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4 shadow-xl group-hover:bg-white/20 group-hover:scale-105 transition-transform duration-300 transform-gpu">
                <Play className="text-white w-8 h-8 md:w-10 md:h-10 ml-1.5 opacity-90 group-hover:opacity-100 drop-shadow-md" fill="currentColor" />
              </div>

              <h3 className="relative z-20 text-white text-center font-black text-lg md:text-2xl uppercase tracking-widest leading-snug drop-shadow-2xl line-clamp-3 px-2 group-hover:-translate-y-1 transition-transform duration-300 transform-gpu">
                {item.title}
              </h3>
              {/* 🚀 PHASE 3: THE NETFLIX-STYLE PROGRESS BAR */}
              {progressPct > 0 && (
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/60 z-30">
                  <div 
                    className="h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] rounded-r-full transition-all duration-1000 ease-out" 
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>
          )
        ) : (
          <div 
            onClick={onUnlock} 
            className="absolute inset-0 w-full h-full cursor-pointer group bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 z-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.08)_0%,transparent_60%)] pointer-events-none"></div>

            <div className="relative z-20 w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-500/10 backdrop-blur-md border border-red-500/20 flex items-center justify-center mb-4 group-hover:bg-red-500/20 group-hover:scale-105 transition-transform duration-300 transform-gpu">
              <Lock className="text-red-500 w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
            </div>

            <h3 className="relative z-20 text-slate-400 text-center font-black text-sm md:text-xl uppercase tracking-widest leading-snug opacity-60 line-clamp-2 px-2 mb-3 group-hover:opacity-80 transition-opacity duration-300">
              {item.title}
            </h3>

            <span className="relative z-20 text-red-500 font-black uppercase text-[9px] md:text-[10px] tracking-[0.5em] bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20 shadow-inner">
              Access Locked
            </span>
          </div>
        )}
      </div>

      {/* =========================================
          INFO AREA (NOW COMPACT & TIGHT)
         ========================================= */}
      {/* 🚀 FIX: Removed 'flex-grow', reduced padding to 'p-4 md:p-5', and added 'shrink-0' so it stays small! */}
      <div className="p-4 md:p-5 flex flex-col shrink-0 bg-white dark:bg-slate-900 relative z-20 transform-gpu">
        
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-widest bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-md">
            {item.month || 'CONTENT'}
          </span>
          {item.isPaid ? (
            <span className="text-green-600 dark:text-green-400 text-[10px] font-black uppercase italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Unlocked
            </span>
          ) : (
            <span className="text-red-400 dark:text-red-500 text-[10px] font-black uppercase italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Locked
            </span>
          )}
        </div>

        <div className="pt-1">
            <PdfSmartButton 
              item={item} 
              user={user} 
              className="w-full py-3 rounded-xl text-xs shadow-sm border border-slate-200 dark:border-white/5 transition-transform hover:scale-[1.02] duration-300 transform-gpu"
            />
            {/* 🚀 PHASE 4: THE GLOWING ZOOM BUTTON (Only shows on Live videos) */}
        {/* 🚀 PHASE 4: THE GLOWING ZOOM BUTTON (Only shows if it is Live AND Admin flipped the switch!) */}
        {item.type === 'Live' && item.zoomVisible && (
          <div className="pt-2">
            <button 
              onClick={handleZoomJoin} 
              disabled={isJoiningZoom}
              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-transform duration-300 transform-gpu ${
                item.isPaid 
                  ? "bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] text-white shadow-blue-500/30" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-white/5"
              }`}
            >
              {isJoiningZoom ? (
                <Loader2 className="animate-spin" size={16} />
              ) : item.isPaid ? (
                <Video size={16} className="animate-pulse" />
              ) : (
                <Lock size={16} />
              )}
              {item.isPaid ? (isJoiningZoom ? "Teleporting..." : "Join Live Zoom") : "Zoom Locked"}
            </button>
          </div>
        )}

        {/* 🚀 PHASE 5: THE ZOOM RECORDING BUTTON */}
        {item.type === 'Live' && item.recordingVisible && item.hasRecording && (
          <div className="pt-2">
            <button 
              onClick={handleRecordingAccess} 
              disabled={isAccessingRecording}
              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-transform duration-300 transform-gpu ${
                item.isPaid 
                  ? "bg-purple-600 hover:bg-purple-700 hover:scale-[1.02] text-white shadow-purple-500/30" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-white/5"
              }`}
            >
              {isAccessingRecording ? (
                <Loader2 className="animate-spin" size={16} />
              ) : item.isPaid ? (
                <Play size={16} className="animate-pulse" />
              ) : (
                <Lock size={16} />
              )}
              {item.isPaid ? (isAccessingRecording ? "Loading..." : "Zoom Recording") : "Locked"}
            </button>
          </div>
        )}
        </div>

      </div>
    </div>
  );
}