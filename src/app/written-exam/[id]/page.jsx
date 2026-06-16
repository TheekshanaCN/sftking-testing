'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ShieldAlert, PenTool, UploadCloud, Lock, CheckCircle, Camera, FileUp, X, AlertTriangle, Zap, ZoomIn, ZoomOut, Download } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import { emitStudentActivity } from '@/lib/studentActivity';
import { socket } from '@/lib/socket';

// 🚀 RESTORED: The God-Tier Canvas PDF Renderer
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const getPdfWorkerSrc = () => {
    try {
        return new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    } catch {
        return 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js';
    }
};

pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();

export default function WrittenExamRoom() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('loading'); 
    const [readyPhaseTransitioned, setReadyPhaseTransitioned] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileInputRef = useRef(null);

    const [isMobile, setIsMobile] = useState(false);
    
    // 🚀 NEW: Secure PDF Blob States
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pdfWidth, setPdfWidth] = useState(800);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [renderedPages, setRenderedPages] = useState(0);
    const [autoPreloadDone, setAutoPreloadDone] = useState(false);
    const pdfViewportRef = useRef(null);
    const pinchStateRef = useRef({ active: false, startDistance: 0, startWidth: 800 });

    const getMinPdfWidth = (vw) => Math.max(280, vw - 80);
    const getMaxPdfWidth = (vw) => Math.max(2500, vw * 4);
    const clampPdfWidth = (value, vw = viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 900)) => {
        const min = getMinPdfWidth(vw);
        const max = getMaxPdfWidth(vw);
        return Math.min(max, Math.max(min, value));
    };

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const res = await axios.get(`/student/written/view/${params.id}`);
                setQuiz(res.data);
            } catch (error) {
                alert("Vault access denied or exam not found.");
                router.push('/student/exams');
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [params.id, router]);

    useEffect(() => {
        if (!quiz || quiz.previousResult) return; 
        if (quiz.status === 'live' && !quiz.personalStartTime) { setPhase('ignition'); return; }

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const baseStartString = quiz.status === 'live' ? quiz.personalStartTime : quiz.startTime;
            const startTime = new Date(baseStartString).getTime();
            
            const readyMs = (quiz.readyTime || 0) * 60000;
            const writeMs = (quiz.timeLimit || 120) * 60000;
            const uploadMs = (quiz.uploadGraceTime || 10) * 60000;

            const readyEnd = startTime + readyMs;
            const writeEnd = readyEnd + writeMs;
            const uploadEnd = writeEnd + uploadMs;

            let currentPhase = ''; let targetTime = 0;

            if (now < startTime) { currentPhase = 'early'; targetTime = startTime; } 
            else if (now >= startTime && now < readyEnd) { currentPhase = 'ready'; targetTime = readyEnd; } 
            else if (now >= readyEnd && now < writeEnd) { currentPhase = 'writing'; targetTime = writeEnd; } 
            else if (now >= writeEnd && now < uploadEnd) { currentPhase = 'upload'; targetTime = uploadEnd; } 
            else { currentPhase = 'ended'; targetTime = 0; }

            setPhase(prevPhase => {
                if (prevPhase === 'completed') return 'completed';
                
                // Detect transition from ready to writing (or skip ready entirely)
                if ((prevPhase === 'ready' || prevPhase === 'loading' || prevPhase === 'ignition') && currentPhase === 'writing') {
                    setReadyPhaseTransitioned(true);
                }
                
                // If now is past ready phase already, mark transition immediately
                if ((prevPhase === 'loading' || prevPhase === 'ignition') && (currentPhase === 'writing' || currentPhase === 'upload' || currentPhase === 'ended')) {
                    setReadyPhaseTransitioned(true);
                }
                
                return currentPhase;
            });

            if (targetTime > 0) {
                const diff = targetTime - now;
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                setTimeLeft(`${h}:${m}:${s}`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [quiz]);

    useEffect(() => { if (quiz?.previousResult) setPhase('completed'); }, [quiz]);

    useEffect(() => {
        const updateWidth = () => {
            if (typeof window !== 'undefined') {
                const vw = window.innerWidth;
                setViewportWidth(vw);
                setIsMobile(vw < 768);
                setPdfWidth(prev => {
                    if (prev === 800) {
                        return Math.max(300, vw < 900 ? vw - 32 : 900);
                    }
                    return clampPdfWidth(prev, vw);
                });
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // 🚀 THE FIX: Fetch raw PDF Blob securely!
    useEffect(() => {
        if ((phase === 'writing' || phase === 'ready' || phase === 'completed') && quiz?.pdfFile && !pdfBlobUrl) {
            const fetchSecurePdf = async () => {
                try {
                    const fileKey = String(quiz.pdfFile || '').trim();
                    if (!fileKey) {
                        console.warn('Missing or invalid written exam PDF key.');
                        return;
                    }

                    const encodedFileName = encodeURIComponent(fileKey);
                    const pdfCandidates = [
                        `secure-vault/${encodedFileName}`
                    ];

                    let loaded = false;
                    for (const url of pdfCandidates) {
                        try {
                            const res = await axios.get(url, { responseType: 'blob', timeout: 20000 });
                            const blob = res?.data;
                            const blobType = String(blob?.type || '').toLowerCase();
                            const isLikelyPdf = blobType.includes('pdf') || blobType.includes('octet-stream');
                            if (!blob || !isLikelyPdf) {
                                throw new Error('Invalid secure PDF response');
                            }

                            setPdfBlobUrl(URL.createObjectURL(blob));
                            setRenderedPages(0);
                            setAutoPreloadDone(false);
                            loaded = true;
                            break;
                        } catch {
                            // Try next vault path silently.
                        }
                    }

                    if (!loaded) {
                        console.warn('Failed to load secure written exam PDF from all candidate paths.');
                    }
                } catch {
                    console.warn('PDF Decryption failed.');
                }
            };
            fetchSecurePdf();
        }
    }, [phase, quiz, pdfBlobUrl]);

    // 🚀 CLEANUP BLOB MEMORY
    useEffect(() => {
        return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
    }, [pdfBlobUrl]);

    // 🚀 NEW: The Canvas Zoom Handlers!
    const zoomIn = () => setPdfWidth(prev => clampPdfWidth(prev + 200));
    const zoomOut = () => setPdfWidth(prev => clampPdfWidth(prev - 200));

    useEffect(() => {
        const el = pdfViewportRef.current;
        if (!el) return;

        const getDistance = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        const onTouchStart = (e) => {
            if (e.touches.length !== 2) return;
            const dist = getDistance(e.touches[0], e.touches[1]);
            pinchStateRef.current = {
                active: true,
                startDistance: dist,
                startWidth: pdfWidth,
            };
        };

        const onTouchMove = (e) => {
            if (!pinchStateRef.current.active || e.touches.length !== 2) return;
            const dist = getDistance(e.touches[0], e.touches[1]);
            const { startDistance, startWidth } = pinchStateRef.current;
            if (!startDistance) return;

            const scale = dist / startDistance;
            const nextWidth = clampPdfWidth(startWidth * scale);
            setPdfWidth(nextWidth);
            e.preventDefault();
        };

        const onTouchEnd = () => {
            pinchStateRef.current.active = false;
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [pdfWidth, viewportWidth]);

    useEffect(() => {
        if (!numPages) return;

        if (renderedPages === 0) {
            setRenderedPages(Math.min(isMobile ? 1 : 2, numPages));
            return;
        }

        if (autoPreloadDone) return;

        const preloadTarget = Math.min(numPages, phase === 'ready' ? (isMobile ? 5 : 10) : (isMobile ? 3 : 6));
        if (renderedPages >= preloadTarget) {
            setAutoPreloadDone(true);
            return;
        }

        const step = isMobile ? 1 : 2;
        const delay = isMobile ? 420 : 240;
        const t = setTimeout(() => {
            setRenderedPages(prev => Math.min(preloadTarget, prev + step));
        }, delay);
        return () => clearTimeout(t);
    }, [numPages, renderedPages, isMobile, autoPreloadDone, phase]);

    const loadMorePages = (boost) => {
        if (!numPages || renderedPages >= numPages) return;
        setRenderedPages(prev => Math.min(numPages, prev + boost));
    };

    const handlePdfScroll = (e) => {
        if (!numPages || renderedPages >= numPages) return;
        const el = e.currentTarget;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 500) {
            const boost = isMobile ? 2 : 4;
            loadMorePages(boost);
        }
    };

    const handleIgniteEngine = async () => {
        if (!confirm("Are you ready? The timer cannot be paused once started!")) return;
        setIsUploading(true);
        try {
            const res = await axios.post(`/student/written/ignite`, { quizId: quiz.id });
            emitStudentActivity(socket, user, {
                page: 'Written Exam',
                action: 'Ignited Written Exam Timer',
                detail: quiz.title,
                route: `/written-exam/${params.id}`,
                kind: 'exam',
                quizId: quiz.id
            });
            setQuiz(prev => ({ ...prev, personalStartTime: res.data.personalStartTime }));
        } catch (error) { alert("Matrix error: Could not start the exam. Try again."); }
        setIsUploading(false);
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length + selectedFiles.length > 30) return alert("Maximum 30 files allowed!");

        const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };

        try {
            const compressedFiles = [];
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const compressedBlob = await imageCompression(file, options);
                compressedFiles.push(new File([compressedBlob], file.name, { type: compressedBlob.type }));
            }
            setSelectedFiles(prev => [...prev, ...compressedFiles]);
            emitStudentActivity(socket, user, {
                page: 'Written Exam',
                action: 'Added Answer Images',
                detail: `${compressedFiles.length} file(s)`,
                route: `/written-exam/${params.id}`,
                kind: 'exam',
                quizId: quiz?.id
            });
        } catch (error) { alert("Glitch: Failed to compress images."); }
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        emitStudentActivity(socket, user, {
            page: 'Written Exam',
            action: 'Removed Answer Image',
            detail: `Index ${index + 1}`,
            route: `/written-exam/${params.id}`,
            kind: 'exam',
            quizId: quiz?.id
        });
    };

    const handleSubmitExam = async () => {
        if (selectedFiles.length === 0) return alert("Upload at least one photo!");
        if (!confirm("Are you sure? Once you submit, the vault locks permanently!")) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('quizId', quiz.id);
        selectedFiles.forEach(file => formData.append('answers', file));

        try {
            await axios.post('/student/written/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            emitStudentActivity(socket, user, {
                page: 'Written Exam',
                action: 'Submitted Written Exam',
                detail: quiz.title,
                route: `/written-exam/${params.id}`,
                kind: 'exam',
                quizId: quiz?.id
            });
            setPhase('completed');
            setQuiz(prev => ({ ...prev, previousResult: { status: 'pending', fileUrls: '[]' } }));
        } catch (error) { alert("Upload failed! Please try again quickly!"); }
        setIsUploading(false);
    };

    const downloadAndNuke = async () => {
        setIsDownloading(true);
        try {
            const imageUrls = JSON.parse(quiz.previousResult.fileUrls || '[]');
            if (imageUrls.length === 0) {
                alert("No images left to download! They were already nuked.");
                setIsDownloading(false);
                return;
            }

            const doc = new jsPDF('p', 'mm', 'a4');
            
            for (let i = 0; i < imageUrls.length; i++) {
                const filename = imageUrls[i].split('/').pop();
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://sftking.lk/api";
                const finalUrl = `${apiUrl.replace(/\/$/, '')}/written-answers/${filename}`;
                
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = finalUrl;
                
                await new Promise((resolve) => {
                    img.onload = () => {
                        const pdfWidth = doc.internal.pageSize.getWidth();
                        const pdfHeight = (img.height * pdfWidth) / img.width;
                        if (i > 0) doc.addPage();
                        doc.addImage(img, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                        resolve();
                    };
                    img.onerror = resolve; 
                });
            }
            
            doc.save(`SFT_KING_Graded_${quiz.title.replace(/\s+/g, '_')}.pdf`);
            await axios.delete(`/student/written/nuke-images/${quiz.id}`);
            emitStudentActivity(socket, user, {
                page: 'Written Exam',
                action: 'Downloaded Graded Paper',
                detail: quiz.title,
                route: `/written-exam/${params.id}`,
                kind: 'exam',
                quizId: quiz?.id
            });
            
            setQuiz(prev => ({
                ...prev, 
                previousResult: { ...prev.previousResult, fileUrls: '[]' }
            }));
            
            alert("✅ Download complete! The images have been permanently wiped from the server to save space.");
            
        } catch (e) {
            console.error(e);
            alert("Matrix Glitch: Failed to generate PDF.");
        }
        setIsDownloading(false);
    };

    if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-16 h-16" /></div>;
    if (phase === 'early') return <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center"><h1 className="text-2xl font-bold">This exam hasn't started yet!</h1></div>;

    if (phase === 'ignition') return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-500">
             <div className="w-32 h-32 rounded-full border-4 border-green-500/30 flex items-center justify-center mb-8 relative shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
                  <Zap size={48} className="text-green-500 animate-pulse" />
             </div>
             <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Ignite Your Engine</h2>
             <p className="text-slate-400 max-w-lg mx-auto text-lg mb-8">This is an On-Demand Exam. The moment you click start, your personal <span className="text-white font-bold">{quiz.timeLimit}-minute</span> timer will begin. It cannot be paused or reversed.</p>
             <button onClick={handleIgniteEngine} disabled={isUploading} className="bg-green-600 hover:bg-green-500 text-white font-black text-lg py-4 px-8 md:px-12 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all uppercase tracking-widest flex items-center gap-3 disabled:opacity-50">
                 {isUploading ? <Loader2 className="animate-spin" /> : <Zap />}
                 Start Personal Timer Now
             </button>
        </div>
    );

    const effectivePageWidth = Math.round(clampPdfWidth(pdfWidth));

    return (
        <div className="h-[100dvh] bg-[#020617] text-white font-sans flex flex-col overflow-hidden">
            
            {/* HEADER */}
            <div className={`p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl transition-colors duration-1000 shrink-0 z-50 ${
                phase === 'ready' ? 'bg-amber-950/40 border-amber-500/30' :
                phase === 'writing' ? 'bg-slate-950 border-blue-500/30' :
                phase === 'upload' ? 'bg-red-950/40 border-red-500/50' :
                'bg-slate-950 border-slate-800'
            }`}>
                <div>
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-slate-100">{quiz.title}</h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1 font-bold">Total Marks: {quiz.totalMarks} | Max Uploads: 30 Files</p>
                </div>

                <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border ${
                    phase === 'ready' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                    phase === 'writing' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]' :
                    phase === 'upload' ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse' :
                    'bg-green-500/10 border-green-500/50 text-green-500'
                }`}>
                    {phase === 'ready' && <><ShieldAlert className="animate-pulse" /> <span className="font-bold tracking-widest uppercase text-sm">Vault Opens:</span> <span className="font-mono font-black text-2xl">{timeLeft}</span></>}
                    {phase === 'writing' && <><PenTool /> <span className="font-bold tracking-widest uppercase text-sm">Time Remaining:</span> <span className="font-mono font-black text-2xl">{timeLeft}</span></>}
                    {phase === 'upload' && <><UploadCloud /> <span className="font-black tracking-widest uppercase text-sm">UPLOAD CLOSES IN:</span> <span className="font-mono font-black text-2xl">{timeLeft}</span></>}
                    {phase === 'completed' && <><CheckCircle /> <span className="font-bold tracking-widest uppercase text-sm">Script Submitted</span></>}
                    {phase === 'ended' && <><Lock /> <span className="font-bold tracking-widest uppercase text-sm">Vault Locked</span></>}
                </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative" onScroll={handlePdfScroll}>
                
                {/* 🚀 THE RESTORED CANVAS ENGINE */}
                {(phase === 'ready' || phase === 'writing') && (
                    <div className="p-2 md:p-6 min-h-full block animate-in fade-in duration-1000">
                        
                        {phase === 'writing' && (
                            <div className="fixed bottom-6 right-6 hidden md:flex flex-col gap-3 z-[60]">
                            <button onClick={zoomIn} className="bg-slate-800/90 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-md shadow-2xl border border-slate-700 transition-colors"><ZoomIn size={24} /></button>
                            <button onClick={zoomOut} className="bg-slate-800/90 hover:bg-blue-600 text-white p-4 rounded-full backdrop-blur-md shadow-2xl border border-slate-700 transition-colors"><ZoomOut size={24} /></button>
                            </div>
                        )}

                        <div className="relative w-full bg-slate-900 md:rounded-3xl border border-slate-800 shadow-2xl block" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                            {!pdfBlobUrl ? (
                                <div className="flex flex-col items-center justify-center py-40 text-center z-10">
                                    <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4 mx-auto" />
                                    <h3 className="text-xl font-bold text-slate-300">Decrypting Vault Document...</h3>
                                    <p className="text-sm text-slate-400 mt-2">Loading secure canvas...</p>
                                </div>
                            ) : (
                                <div ref={pdfViewportRef} className="flex flex-col items-center justify-start min-w-full py-4 md:py-8 overflow-x-auto custom-scrollbar" style={{ touchAction: 'pan-x pan-y' }}>
                                    <Document
                                        file={pdfBlobUrl}
                                        onLoadSuccess={({ numPages }) => {
                                            setNumPages(numPages);
                                        }}
                                        loading={<Loader2 className="animate-spin text-blue-500 w-12 h-12 mx-auto my-20" />}
                                        className="flex flex-col gap-6 md:gap-8 items-center w-full"
                                    >
                                        {Array.from({ length: renderedPages }, (_, index) => (
                                            <div key={`page_${index + 1}`} className="relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white overflow-hidden border border-slate-700 mx-auto transition-all duration-300" style={{ width: `${effectivePageWidth}px` }}>
                                                <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} width={effectivePageWidth} className="w-full" />
                                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 rotate-[-30deg] z-10 overflow-hidden">
                                                    <h1 className="text-3xl md:text-7xl font-black text-slate-900 whitespace-nowrap">SFT KING - STRICTLY CONFIDENTIAL</h1>
                                                </div>
                                            </div>
                                        ))}
                                    </Document>
                                    {numPages && renderedPages < numPages && (
                                        <div className="w-full max-w-md mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center space-y-2">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                                Loading remaining pages... {renderedPages}/{numPages}
                                            </p>
                                            <button
                                                onClick={() => loadMorePages(isMobile ? 2 : 4)}
                                                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-black uppercase tracking-wider text-slate-200 py-2 rounded-lg transition-colors"
                                            >
                                                Load More Pages
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {phase === 'ready' && (
                                <div className="absolute inset-0 z-20 min-h-full flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-500 bg-slate-950/85 backdrop-blur-sm" style={{ display: readyPhaseTransitioned ? 'none' : 'flex' }}>
                                    <div className="w-32 h-32 rounded-full border-4 border-amber-500/30 flex items-center justify-center mb-8 relative">
                                        <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                                        <ShieldAlert size={48} className="text-amber-500 animate-pulse" />
                                    </div>
                                    <h2 className="text-3xl font-black text-amber-500 uppercase tracking-widest mb-4">Securing Connection</h2>
                                    <p className="text-slate-300 max-w-md mx-auto text-lg">The PDF is being pre-rendered during ready time. It will open instantly when writing starts.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {phase === 'upload' && (
                    <div className="min-h-full flex flex-col items-center justify-center p-6 animate-in zoom-in slide-in-from-bottom-10 duration-500">
                        <div className="w-full max-w-3xl bg-red-950/20 border border-red-500/30 rounded-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(239,68,68,0.1)] text-center">
                            <AlertTriangle size={64} className="text-red-500 mx-auto mb-6 animate-bounce" />
                            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest mb-4">Pens Down!</h2>
                            <p className="text-red-400 text-lg md:text-xl font-bold mb-8">The writing time is over. You now have <span className="text-white underline">{quiz.uploadGraceTime} minutes</span> to take photos and upload them.</p>

                            <div className="bg-slate-900 border-2 border-dashed border-slate-700 hover:border-red-500 transition-colors rounded-2xl p-10 cursor-pointer relative" onClick={() => fileInputRef.current.click()}>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />
                                <Camera size={48} className="text-slate-500 mx-auto mb-4" />
                                <p className="text-white font-bold text-lg">Tap to open Camera / Gallery</p>
                                <p className="text-slate-500 text-sm mt-2">Select all pages at once (Max 30 files)</p>
                            </div>

                            {selectedFiles.length > 0 && (
                                <div className="mt-8 text-left">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Selected Pages ({selectedFiles.length}/30)</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        {selectedFiles.map((file, idx) => (
                                            <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-center justify-between group">
                                                <div className="truncate flex-1">
                                                    <p className="text-xs font-bold text-slate-300 truncate">{file.name}</p>
                                                </div>
                                                <button onClick={() => removeFile(idx)} className="text-slate-500 hover:text-red-500 transition-colors ml-2"><X size={16} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleSubmitExam} disabled={isUploading} className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                                        {isUploading ? <><Loader2 className="animate-spin" /> PACKAGING VAULT DATA...</> : <><FileUp /> SUBMIT ANSWER SCRIPT FOR GRADING</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {(phase === 'completed' || phase === 'ended') && (
                    <div className="min-h-full flex flex-col items-center justify-start p-6 text-center animate-in zoom-in duration-500 pb-20">
                        
                        {(!quiz?.previousResult || quiz.previousResult.status !== 'published') && (
                            <div className="mt-20 flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-6">
                                    {phase === 'completed' ? <CheckCircle size={40} className="text-green-500" /> : <Lock size={40} className="text-slate-500" />}
                                </div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-4">
                                    {phase === 'completed' ? 'Answers Secured' : 'Vault Locked'}
                                </h2>
                                <p className="text-slate-400 max-w-md mx-auto text-lg mb-8">
                                    {phase === 'completed' ? 'Your answer script has been uploaded successfully and is awaiting review by SFT Admin. Check back later for your grades!' : 'The upload window has expired and this exam is completely locked.'}
                                </p>
                                <button onClick={() => router.push('/student/exams')} className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-all border border-slate-700">Return to Library</button>
                            </div>
                        )}

                        {quiz?.previousResult?.status === 'published' && (
                            <div className="w-full max-w-3xl bg-slate-900/50 border border-green-500/30 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(34,197,94,0.1)] mt-10">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <CheckCircle className="text-green-500 w-8 h-8" />
                                    <h2 className="text-3xl font-black text-white uppercase tracking-widest">Exam Graded</h2>
                                </div>
                                
                                <div className="flex flex-col md:flex-row items-center justify-center gap-6 my-8 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-inner">
                                    <div className="text-center shrink-0">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Final Score</p>
                                        <div className="text-5xl font-black text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">{quiz.previousResult.score} <span className="text-xl text-slate-500">/ {quiz.totalMarks}</span></div>
                                    </div>
                                    <div className="w-full h-px md:w-px md:h-20 bg-slate-800"></div>
                                    <div className="text-center md:text-left flex-1">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Teacher's Feedback</p>
                                        <p className="text-amber-500 font-medium italic text-lg leading-relaxed">{quiz.previousResult.feedback || "No additional comments provided."}</p>
                                    </div>
                                </div>

                                {JSON.parse(quiz.previousResult.fileUrls || '[]').length > 0 ? (
                                    <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center">
                                        <Download className="text-blue-500 w-12 h-12 mx-auto mb-4 animate-bounce" />
                                        <h3 className="text-xl font-bold text-white mb-2">Download Your Graded Paper</h3>
                                        <p className="text-slate-400 mb-6 text-sm">To save data and server space, we have compiled your pages into a single PDF. Downloading this will instantly wipe the images from our server.</p>
                                        
                                        <button onClick={downloadAndNuke} disabled={isDownloading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 mx-auto">
                                            {isDownloading ? <><Loader2 className="animate-spin" /> Compiling PDF...</> : <><Download /> Download </>}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center">
                                        <p className="text-slate-500 italic">You have already downloaded this paper. The server has been nuked.</p>
                                    </div>
                                )}
                                
                                <button onClick={() => router.push('/student/exams')} className="w-full md:w-auto mt-8 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-all border border-slate-700">
                                    Return to Library
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }`}} />
        </div>
    );
}