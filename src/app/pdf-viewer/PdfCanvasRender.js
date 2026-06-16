'use client';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket'; 
import { Loader2, Timer, ShieldAlert, Minimize2, Maximize2, X, Infinity, Expand, Shrink, Lock, CheckCircle, RefreshCw, ZoomIn, ZoomOut, GripVertical } from 'lucide-react';
import SecurePlayer from '@/components/shared/SecurePlayer';
import { emitStudentActivity } from '@/lib/studentActivity';

// 🚀 RESTORED: The God-Tier Canvas PDF Renderer
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// FIX 1: Use the dynamic CDN link to guarantee the worker version EXACTLY matches the installed react-pdf version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// FIX 2: Move options OUTSIDE the component so it maintains reference stability across re-renders. 
// Inline objects cause the Document to unmount/remount the worker while pages are rendering, causing the sendWithPromise crash.
const pdfOptions = {
  disableRange: false,
  disableStream: false,
  disableAutoFetch: false,
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

export default function PdfCanvasRender() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id'); 
  const docType = searchParams.get('type');
  
  const [videoId, setVideoId] = useState(null);
  const [showVideo, setShowVideo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false); 
  const [lockReason, setLockReason] = useState("Access Denied");
  const [requestStatus, setRequestStatus] = useState('idle'); 
  const [currentUserId, setCurrentUserId] = useState(null); 

  const [pdfStreamUrl, setPdfStreamUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const [renderedPages, setRenderedPages] = useState(0);

  const [isMobile, setIsMobile] = useState(false);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [viewportWidth, setViewportWidth] = useState(0);
  
  const [timeLeft, setTimeLeft] = useState(null);
  const [isFreeMode, setIsFreeMode] = useState(false); 
  const [isBlurred, setIsBlurred] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  // 🚀 SPLIT PANE STATE - percentage of viewport the video panel takes
  const [splitPercent, setSplitPercent] = useState(40);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const pdfScrollRef = useRef(null);
  const splitContainerRef = useRef(null);

  // 🚀 DRAG HANDLERS FOR THE SPLIT BAR
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
    };

    const handleMouseUp = () => setIsDragging(false);

    // Touch support
    const handleTouchMove = (e) => {
      if (!splitContainerRef.current || !e.touches[0]) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percent = (x / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
    };

    const handleTouchEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/)([^#&?]*))/);
    return (match && match[1]) ? match[1] : null;
  };

  useEffect(() => {
    if (!id || docType === 'pastpaper') return;
    const fetchVideoInfo = async () => {
        try {
            const res = await axios.get('/student/content');
            if (res.data && res.data.content) {
                const found = res.data.content.find(c => String(c.id) === String(id));
                if (found && found.youtube_link) {
                    const vid = getYoutubeId(found.youtube_link);
                    if (vid) { setVideoId(vid); setShowVideo(true); }
                }
            }
        } catch (e) {}
    };
    fetchVideoInfo();
  }, [id, docType]);

  useEffect(() => {
    axios.get('/me').then(res => {
        setCurrentUserId(res.data.id);
        if (!socket.connected) socket.connect();
    }).catch(e => console.error(e));
  }, []);

  const loadContent = async () => {
    try {
        setLoading(true);
        if (currentUserId) {
          emitStudentActivity(socket, { role: 'student', id: currentUserId }, {
            page: 'Secure PDF',
            action: 'Opened Secure PDF',
            detail: docType === 'pastpaper' ? 'Past Paper' : 'Content PDF',
            route: '/pdf-viewer',
            kind: 'content',
            contentId: id
          });
        }
        const timestamp = new Date().getTime(); 
        const endpoint = docType === 'pastpaper' ? `/pastpapers/${id}/pdf-token` : `/content/${id}/pdf-token`;
        const tokenRes = await axios.get(`${endpoint}?t=${timestamp}`);
        
        setIsFreeMode(!!tokenRes.data.isFree); 
        setIsLocked(false); 
        if (!tokenRes.data.isFree) setTimeLeft(Math.floor(tokenRes.data.expiresInMins * 60)); 
        else setTimeLeft(null); 

        setPdfStreamUrl(`/api/secure-pdf/${tokenRes.data.token}?t=${timestamp}`);
        setRenderedPages(0);

        setLoading(false);

    } catch (err) {
        try {
            const statusEndpoint = docType === 'pastpaper' ? `/student/pastpaper-status/${id}` : `/student/pdf-status/${id}`;
            const statusRes = await axios.get(statusEndpoint);
            const status = statusRes.data.status;
            if (status === 'declined' || status === 'rejected') setLockReason("Admin has Revoked your Access");
            else if (status === 'expired') setLockReason("Time limit has expired");
            else setLockReason("Access Denied. Please Request Access.");
        } catch (e) { setLockReason("Access Denied"); }
        setIsLocked(true); setLoading(false);
    }
  };

  useEffect(() => { if (id) loadContent(); }, [id]);

  useEffect(() => {
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    const handleKeyDown = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && ['p', 's', 'u', 'c'].includes(e.key.toLowerCase())) || e.key === 'PrintScreen') {
          e.preventDefault(); 
          setIsBlurred(true);
          setWarningMsg("SECURITY ALERT: Action Blocked");
          setTimeout(() => { setIsBlurred(false); setWarningMsg(''); }, 2000);
      }
    };
    const handleContextMenu = (e) => { e.preventDefault(); setWarningMsg("Menu Disabled"); setTimeout(() => setWarningMsg(''), 2000); };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
          setViewportWidth(window.innerWidth);
          setIsMobile(window.innerWidth < 768);
          let newWidth = window.innerWidth < 900 ? window.innerWidth - 32 : 900;
          if (window.innerWidth > window.innerHeight && showVideo) newWidth = window.innerWidth * 0.50; 
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [showVideo]);

  const zoomIn = () => setPdfScale(prev => Math.min(prev + 0.25, 4.0));
  const zoomOut = () => setPdfScale(prev => Math.max(prev - 0.25, 0.5));
  const zoomReset = () => setPdfScale(1.0);

  useEffect(() => {
    if (isFreeMode || isLocked || timeLeft === null) return; 
    if (timeLeft <= 0) { setIsLocked(true); setLockReason("Time limit has expired."); axios.post(`/student/expire-pdf/${id}`).catch(()=>{}); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isLocked, isFreeMode, id]);

  const formatTime = (t) => {
    if (t === null) return '...';
    const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = Math.floor(t % 60);
    const pad = (n) => n.toString().padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  useEffect(() => {
    if (!numPages) return;
    if (renderedPages === 0) {
      setRenderedPages(Math.min(isMobile ? 1 : 2, numPages));
      return;
    }
    if (renderedPages >= numPages) return;

    const step = isMobile ? 1 : 2;
    const delay = isMobile ? 420 : 240;
    const t = setTimeout(() => {
      setRenderedPages(prev => Math.min(numPages, prev + step));
    }, delay);
    return () => clearTimeout(t);
  }, [numPages, renderedPages, isMobile]);

  const handlePdfScroll = (e) => {
    if (!numPages || renderedPages >= numPages) return;
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 500) {
      const boost = isMobile ? 2 : 4;
      setRenderedPages(prev => Math.min(numPages, prev + boost));
    }
  };

  const shouldLeftAlign = isMobile;
  const effectivePageWidth = isMobile
    ? Math.max(280, viewportWidth - 32)
    : Math.max(300, showVideo && viewportWidth > 900 ? viewportWidth * ((100 - splitPercent) / 100) - 60 : 800);

  if (isLocked) {
      return (
        <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
            <ShieldAlert size={80} className="text-red-600 mb-6 animate-pulse" />
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Access Denied</h1>
            <p className="text-slate-400 font-bold text-sm mb-8">{lockReason}</p>
        </div>
      );
  }

  if (loading) return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-red-600 w-12 h-12" /></div>;

  return (
    <div ref={splitContainerRef} className={`h-screen w-screen overflow-hidden bg-slate-950 flex flex-col md:flex-row relative select-none ${isDragging ? 'cursor-col-resize' : ''}`}>
      
      {/* 🚀 DRAG OVERLAY - prevents iframe from stealing mouse events while dragging */}
      {isDragging && <div className="fixed inset-0 z-[200]" style={{ cursor: 'col-resize' }} />}

      {showVideo && videoId && (
        <div
          className="bg-black relative z-[60] shadow-2xl flex flex-col w-full h-[35vh] md:h-full shrink-0"
          style={!isMobile ? { width: `${splitPercent}%` } : undefined}
        >
          <div className="w-full h-full flex items-center bg-black"><SecurePlayer videoId={videoId} /></div>
        </div>
      )}

      {/* 🚀 DRAGGABLE VERTICAL DIVIDER BAR */}
      {showVideo && videoId && !isMobile && (
        <div
          className={`hidden md:flex items-center justify-center shrink-0 z-[70] group transition-colors duration-200 ${isDragging ? 'bg-red-600/30' : 'bg-white/5 hover:bg-red-600/20'}`}
          style={{ width: '10px', cursor: 'col-resize' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className={`w-1 h-12 rounded-full transition-all duration-200 ${isDragging ? 'bg-red-500 h-20' : 'bg-white/20 group-hover:bg-red-500 group-hover:h-16'}`} />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative" ref={containerRef}>
        <div className="h-14 bg-black/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 shrink-0 z-50">
            {!showVideo && videoId && <button onClick={() => setShowVideo(true)} className="text-[10px] font-bold bg-white/10 text-white px-3 py-1.5 rounded-lg hover:bg-red-600">Show Video</button>}
            <div className="flex items-center gap-2">
                <button onClick={() => { zoomOut(); if (currentUserId) emitStudentActivity(socket, { role: 'student', id: currentUserId }, { page: 'Secure PDF', action: 'Zoomed Out PDF', detail: String(id), route: '/pdf-viewer', kind: 'content', contentId: id }); }} className="p-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 flex items-center justify-center transition-colors"><ZoomOut size={16}/></button>
                <div onClick={zoomReset} className="px-3 py-1 bg-slate-800 text-white hover:bg-slate-700 rounded text-xs font-bold cursor-pointer select-none min-w-[60px] text-center transition-colors" title="Reset Zoom">
                    {Math.round(pdfScale * 100)}%
                </div>
                <button onClick={() => { zoomIn(); if (currentUserId) emitStudentActivity(socket, { role: 'student', id: currentUserId }, { page: 'Secure PDF', action: 'Zoomed In PDF', detail: String(id), route: '/pdf-viewer', kind: 'content', contentId: id }); }} className="p-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 flex items-center justify-center transition-colors"><ZoomIn size={16}/></button>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-xs shadow-inner border ${isFreeMode ? 'bg-green-950 border-green-500 text-green-500' : 'bg-red-950 border-red-500 text-red-500'}`}>
                {isFreeMode ? "UNLIMITED" : formatTime(timeLeft)}
            </div>
        </div>

        {warningMsg && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-xl font-black shadow-2xl animate-bounce">{warningMsg}</div>}
        {isBlurred && <div className="absolute inset-0 z-[70] bg-black" />}

        {/* 🎨 THE RESTORED CANVAS ENGINE */}
        <div ref={pdfScrollRef} className={`flex-1 w-full bg-[#050608] overflow-auto relative py-8 flex flex-col ${shouldLeftAlign ? 'items-start' : 'items-center'} custom-scrollbar`} onScroll={handlePdfScroll}>
            {!pdfStreamUrl ? (
                <div className="flex flex-col items-center justify-center py-40 text-center z-10">
                    <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4 mx-auto" />
                    <h3 className="text-xl font-bold text-slate-300">Decrypting Vault Document...</h3>
                    <p className="text-sm text-slate-400 mt-2">Loading secure canvas...</p>
                </div>
            ) : (
                <div className={`flex flex-col ${shouldLeftAlign ? 'items-start' : 'items-center'} justify-start min-w-full py-4 md:py-8 overflow-x-auto custom-scrollbar`}>
                    <Document
                        file={pdfStreamUrl}
                        options={pdfOptions}
                        onLoadSuccess={({ numPages }) => { setNumPages(numPages); setIsPdfLoaded(true); }}
                        onLoadError={(error) => console.error("PDF Load Error:", error)}
                        loading={<Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto my-20" />}
                    className={`flex flex-col gap-6 md:gap-8 ${shouldLeftAlign ? 'items-start' : 'items-center'} w-full`}
                    >
                      {Array.from({ length: renderedPages }, (_, index) => (
                      <div key={`page_${index + 1}`} className={`relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white overflow-hidden border border-slate-700 transition-all duration-300 ${shouldLeftAlign ? 'mx-0' : 'mx-auto'}`} style={{ width: `${effectivePageWidth * pdfScale}px`, maxWidth: 'max-content' }}>
                            <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} width={effectivePageWidth} scale={pdfScale} className="w-full" />
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 rotate-[-30deg] z-10 overflow-hidden">
                                    <h1 className="text-3xl md:text-7xl font-black text-slate-900 whitespace-nowrap">SFT KING - STRICTLY CONFIDENTIAL</h1>
                                </div>
                            </div>
                        ))}
                    </Document>
                    {numPages && renderedPages < numPages && (
                      <div className="w-full max-w-md mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                          Loading remaining pages... {renderedPages}/{numPages}
                        </p>
                      </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

