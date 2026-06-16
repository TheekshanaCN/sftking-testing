'use client';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext'; 
import { Loader2, Clock, CheckCircle, ArrowLeft, ZoomIn, ZoomOut, Maximize, Minimize, AlertOctagon, Download, Search, ShieldAlert } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { emitStudentActivity } from '@/lib/studentActivity';

const getPdfWorkerSrc = () => {
    try {
        return new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    } catch {
        return 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js';
    }
};

pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();

export default function ExamEngine({ id }) {
    const router = useRouter();
    const { user } = useAuth(); 
    
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    
    const answersRef = useRef({}); 
    useEffect(() => { answersRef.current = answers; }, [answers]);

    useEffect(() => {
        const usedSeconds = Number(result?.timeUsedSeconds);
        if (Number.isFinite(usedSeconds)) setTimeTaken(usedSeconds);
    }, [result]);

    const [timeLeft, setTimeLeft] = useState(0);
    const [timeTaken, setTimeTaken] = useState(0); 
    const [result, setResult] = useState(null);
    const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);

    const [isReadyPhase, setIsReadyPhase] = useState(false);
    const [readyTimeLeft, setReadyTimeLeft] = useState(0);
    const [readyEndTime, setReadyEndTime] = useState(null);
    const [readyPhaseTransitioned, setReadyPhaseTransitioned] = useState(false);

    const [status, setStatus] = useState('Securely Decrypting Exam Vault...');
    const [isExamReady, setIsExamReady] = useState(false); // 🚀 Replaced isPdfReady
    const [isTimedOut, setIsTimedOut] = useState(false);

    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [isPdfLoaded, setIsPdfLoaded] = useState(false);
    const [renderedPages, setRenderedPages] = useState(0);
    const [autoPreloadDone, setAutoPreloadDone] = useState(false);
    
    const [examEndTime, setExamEndTime] = useState(null);
    const [examStartTimeStamp, setExamStartTimeStamp] = useState(null);

    const [isMobile, setIsMobile] = useState(false);
    const [pageWidth, setPageWidth] = useState(800);

    const getServerNowMs = () => Date.now() + serverTimeOffsetMs;
    
    // 🚀 THE FIX: Smarter Zoom Increments for Mobile!
    const zoomIn = () => setPageWidth(prev => Math.min(prev + (isMobile ? 100 : 150), 2500));
    const zoomOut = () => setPageWidth(prev => Math.max(prev - (isMobile ? 100 : 150), 300));
    
    const [searchQuery, setSearchQuery] = useState("");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [splitRatio, setSplitRatio] = useState(60); 
    const pdfScrollRef = useRef(null);

    useEffect(() => {
        const checkDevice = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // 🚀 THE FIX: Only set initial mobile width, don't trap it on resize!
            setPageWidth(prev => prev === 800 ? (mobile ? window.innerWidth - 16 : 800) : prev);
        };
        checkDevice(); 
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    const startDrag = (e) => {
        const isTouch = e.type.includes('touch');
        const startPos = isMobile ? (isTouch ? e.touches[0].clientY : e.clientY) : (isTouch ? e.touches[0].clientX : e.clientX);
        const startRatio = splitRatio;

        const onDrag = (moveEvent) => {
            if (moveEvent.cancelable) moveEvent.preventDefault();
            const currentPos = isMobile ? (moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY) : (moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX);
            const delta = currentPos - startPos;
            const containerSize = isMobile ? window.innerHeight : window.innerWidth;
            const deltaRatio = (delta / containerSize) * 100;
            
            let newRatio = startRatio + deltaRatio;
            if (newRatio < 20) newRatio = 20; 
            if (newRatio > 80) newRatio = 80; 
            setSplitRatio(newRatio);
        };

        const onStop = () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('mouseup', onStop);
            document.removeEventListener('touchend', onStop);
        };

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false }); 
        document.addEventListener('mouseup', onStop);
        document.addEventListener('touchend', onStop);
    };

    const initializeExamTiming = (fetchedQuiz) => {
        const timing = fetchedQuiz?.timing || null;
        const serverNowMs = Number(timing?.serverNowMs);
        if (Number.isFinite(serverNowMs)) {
            setServerTimeOffsetMs(serverNowMs - Date.now());
        }

        if (!fetchedQuiz || fetchedQuiz.previousResult) return;

        const storageKey = `sft_exam_start_${id}_${user?.id}`;
        const scheduledStartMs = fetchedQuiz?.startTime ? new Date(fetchedQuiz.startTime).getTime() : null;
        const serverStartMs = fetchedQuiz?.personalStartTime ? new Date(fetchedQuiz.personalStartTime).getTime() : null;
        let savedStartTime = localStorage.getItem(storageKey);

        let startMs = Number(timing?.startMs);
        let readyEndMs = Number(timing?.readyEndMs);
        let examEndMs = Number(timing?.examEndMs);
        let writeStartMs = Number(timing?.writeStartMs);

        if (!Number.isFinite(startMs)) {
            if (fetchedQuiz?.status === 'scheduled' && Number.isFinite(scheduledStartMs) && scheduledStartMs > 0) {
                savedStartTime = String(scheduledStartMs);
            } else if (Number.isFinite(serverStartMs) && serverStartMs > 0) {
                savedStartTime = String(serverStartMs);
                localStorage.setItem(storageKey, savedStartTime);
            } else if (!savedStartTime) {
                const fallbackNow = Number.isFinite(serverNowMs) ? serverNowMs : Date.now();
                savedStartTime = fallbackNow.toString();
                localStorage.setItem(storageKey, savedStartTime);
            }
            startMs = parseInt(savedStartTime, 10);
        }

        const rt = Number(fetchedQuiz.readyTime || 0);
        const tl = Number(fetchedQuiz.timeLimit || 60);

        if (!Number.isFinite(readyEndMs) || !Number.isFinite(examEndMs)) {
            const safeStartMs = Number.isFinite(startMs) ? startMs : (Number.isFinite(serverNowMs) ? serverNowMs : Date.now());
            readyEndMs = safeStartMs + (rt * 60000);
            examEndMs = readyEndMs + (tl * 60000);
        }

        if (!Number.isFinite(writeStartMs)) {
            writeStartMs = readyEndMs;
        }

        const now = Number.isFinite(serverNowMs) ? serverNowMs : Date.now();
        const timeLimitSeconds = Number.isFinite(timing?.timeLimitMs)
            ? Math.floor(timing.timeLimitMs / 1000)
            : Math.max(0, Math.floor((examEndMs - readyEndMs) / 1000));

        setExamStartTimeStamp(writeStartMs);
        setReadyEndTime(readyEndMs);
        setExamEndTime(examEndMs);
        setReadyPhaseTransitioned(false);
        setIsTimedOut(false);

        if (now < readyEndMs) {
            setIsReadyPhase(true);
            setReadyTimeLeft(Math.max(0, Math.floor((readyEndMs - now) / 1000)));
            setTimeLeft(timeLimitSeconds);
        } else {
            setIsReadyPhase(false);
            setReadyPhaseTransitioned(true);
            setTimeLeft(Math.max(0, Math.floor((examEndMs - now) / 1000)));
        }
    };

    useEffect(() => {
        const loadExamSecurely = async () => {
            try {
                // Ensure every entry starts a fresh PDF bootstrap flow.
                setPdfBlobUrl(null);
                setIsPdfLoaded(false);
                setNumPages(null);
                setRenderedPages(0);
                setAutoPreloadDone(false);
                setIsExamReady(false);
                setStatus('Decrypting Exam Vault...');
                const res = await axios.get(`/student/mcq/view/${id}`);
                const fetchedQuiz = res.data;
                setQuiz(fetchedQuiz);
                setResult(fetchedQuiz.previousResult || null);

                const timing = fetchedQuiz?.timing || null;
                const serverNowMs = Number(timing?.serverNowMs);
                if (Number.isFinite(serverNowMs)) {
                    setServerTimeOffsetMs(serverNowMs - Date.now());
                }

                initializeExamTiming(fetchedQuiz);
                setIsExamReady(true);
                setStatus('');

                // Keep the secure PDF loading in the background while the ready overlay can show.
                const fileName = String(fetchedQuiz.pdfFile || '').trim();
                if (!fileName) {
                    setStatus('Exam PDF is missing or invalid. Please contact support.');
                    setIsExamReady(false);
                    return;
                }

                const encodedFileName = encodeURIComponent(fileName);
                const pdfCandidates = [
                    `secure-vault/${encodedFileName}`
                ];

                let pdfLoaded = false;
                for (const url of pdfCandidates) {
                    try {
                        const pdfRes = await axios.get(url, { responseType: 'blob', timeout: 20000 });
                        const blob = pdfRes?.data;
                        const blobType = String(blob?.type || '').toLowerCase();
                        const isLikelyPdf = blobType.includes('pdf') || blobType.includes('octet-stream');
                        if (!blob || !isLikelyPdf) {
                            throw new Error('Invalid secure PDF response');
                        }
                        setPdfBlobUrl(URL.createObjectURL(pdfRes.data));
                        pdfLoaded = true;
                        break;
                    } catch {
                        // Try next vault path silently.
                    }
                }

                if (!pdfLoaded) {
                    setStatus('Failed to load secure PDF. Please refresh and try again.');
                    setIsExamReady(false);
                    return;
                }

            } catch (error) {
                alert(`Matrix Error: ${error.message}`);
                router.push('/student/exams');
            }
        };
        if (user) loadExamSecurely();
    }, [id, router, user]);

    // 🚀 THE FIX: This function fires ONLY when the PDF is 100% visible on screen!
    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setIsPdfLoaded(true);
        setRenderedPages(Math.min(isMobile ? 1 : 2, numPages));
        setAutoPreloadDone(false);
    };

    useEffect(() => {
        if (!numPages || autoPreloadDone) return;

        const preloadTarget = Math.min(numPages, isReadyPhase ? (isMobile ? 5 : 10) : (isMobile ? 3 : 6));
        if (renderedPages >= preloadTarget) {
            setAutoPreloadDone(true);
            return;
        }

        const step = isMobile ? 1 : 2;
        const delay = isMobile ? 420 : 220;

        const t = setTimeout(() => {
            setRenderedPages(prev => Math.min(preloadTarget, prev + step));
        }, delay);

        return () => clearTimeout(t);
    }, [renderedPages, numPages, isMobile, autoPreloadDone, isReadyPhase]);

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

    useEffect(() => { return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); }; }, [pdfBlobUrl]);

    useEffect(() => {
        if (!quiz || result || !isExamReady || isTimedOut || !examEndTime || !readyEndTime) return; 

        const timer = setInterval(() => {
            const now = getServerNowMs();

            if (now < readyEndTime) {
                // Still in ready phase - show countdown
                setIsReadyPhase(true);
                setReadyTimeLeft(Math.floor((readyEndTime - now) / 1000));
            } else if (now < examEndTime) {
                // Transition to exam phase (only once)
                if (isReadyPhase) {
                    setIsReadyPhase(false);
                    setReadyPhaseTransitioned(true);
                }
                // Calculate exact remaining exam time for proper resumption
                setTimeLeft(Math.max(0, Math.floor((examEndTime - now) / 1000)));
            } else {
                // Time's up!
                clearInterval(timer);
                setIsReadyPhase(false);
                setReadyPhaseTransitioned(true);
                setIsTimedOut(true);
                setTimeLeft(0);
                setStatus('TIME IS UP! AUTO-SUBMITTING...');
                submitExam(true); 
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [quiz, result, isExamReady, isTimedOut, examEndTime, readyEndTime, isReadyPhase, serverTimeOffsetMs]);

    const toggleFullscreen = () => {
        const element = document.getElementById('sft-exam-layout');
        if (!element) return;
        if (!isFullscreen) { if (element.requestFullscreen) element.requestFullscreen(); setIsFullscreen(true); } 
        else { if (document.exitFullscreen) document.exitFullscreen(); setIsFullscreen(false); }
    };

    const handleAnswer = (qNum, opt) => {
        if (result || isTimedOut || isReadyPhase) return;
        setAnswers(prev => {
            emitStudentActivity(socket, user, {
                page: 'MCQ Exam',
                action: 'Answered Question',
                detail: `Q${qNum} -> ${opt}`,
                route: `/mcq-exam/${id}`,
                kind: 'exam',
                quizId: id
            });
            if (String(prev[qNum]) === String(opt)) {
                const newAns = { ...prev };
                delete newAns[qNum]; 
                return newAns;
            }
            return { ...prev, [qNum]: String(opt) };
        });
    };

    const jumpToUnanswered = () => {
        if (!quiz || isReadyPhase) return;
        
        for (let i = 1; i <= quiz.totalQuestions; i++) {
            if (!answers[i]) {
                const element = document.getElementById(`q-row-${i}`);
                const container = document.getElementById('questions-container'); 
                
                if (element && container) {
                    container.scrollTo({ top: element.offsetTop - container.offsetTop - 20, behavior: 'smooth' });
                    element.classList.add('bg-red-500/20', 'border-red-500/50', 'shadow-[0_0_20px_rgba(220,38,38,0.3)]');
                    setTimeout(() => element.classList.remove('bg-red-500/20', 'border-red-500/50', 'shadow-[0_0_20px_rgba(220,38,38,0.3)]'), 1500);
                    return; 
                }
            }
        }
        emitStudentActivity(socket, user, {
            page: 'MCQ Exam',
            action: 'Checked Unanswered Questions',
            detail: 'Jumped through unanswered questions',
            route: `/mcq-exam/${id}`,
            kind: 'exam',
            quizId: id
        });
        alert("🔥 All questions answered! You are ready to submit the exam!");
    };

    const submitExam = async (isAutoSubmit = false) => {
        if (!isAutoSubmit && !confirm("Are you sure you want to submit your final answers?")) return;
        setStatus('Grading your answers...');
        
        const timeSpentSeconds = examStartTimeStamp ? Math.max(0, Math.floor((getServerNowMs() - examStartTimeStamp) / 1000)) : 0;
        setTimeTaken(timeSpentSeconds);

        const finalPayload = isAutoSubmit ? answersRef.current : answers;

        try {
            const res = await axios.post('/student/mcq/submit', { quizId: id, studentAnswers: finalPayload });
            emitStudentActivity(socket, user, {
                page: 'MCQ Exam',
                action: isAutoSubmit ? 'Auto Submitted MCQ Exam' : 'Submitted MCQ Exam',
                detail: quiz?.title || `Quiz ${id}`,
                route: `/mcq-exam/${id}`,
                kind: 'exam',
                quizId: id
            });
            setResult(res.data); 
            const usedSeconds = Number(res?.data?.timeUsedSeconds);
            if (Number.isFinite(usedSeconds)) setTimeTaken(usedSeconds);
            setStatus('');
            
            // 🧹 CLEANUP: Wipe the local storage cheat prevention since they legally finished!
            localStorage.removeItem(`sft_exam_start_${id}_${user?.id}`);

            if (isAutoSubmit) alert("⏳ TIME IS UP! Your answers were automatically submitted. This exam is now locked.");
        } catch(e) {
            const errorCode = e?.response?.data?.code;
            if (errorCode === 'MCQ_TIME_EXPIRED') {
                setIsTimedOut(true);
                setStatus('TIME IS UP! Exam locked.');
                alert("Time limit expired. This exam is now locked.");
                router.push('/student/exams');
                return;
            }
            alert("Failed to submit exam!");
            setStatus('');
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const formattedH = h.toString().padStart(2, '0');
        const formattedM = m.toString().padStart(2, '0');
        const formattedS = s.toString().padStart(2, '0');
        if (h > 0) return `${formattedH}:${formattedM}:${formattedS}`;
        return `${formattedM}:${formattedS}`;
    };

    const generatePDF = () => {
        if (!result || !quiz || !user) return;
        const doc = new jsPDF();
        const studentName = user.name || 'Student';
        const formattedTime = formatTime(timeTaken);
        const percentage = Math.round((result.score / result.totalQuestions) * 100);

        doc.setFontSize(22);
        doc.setTextColor(220, 38, 38); 
        doc.setFont("helvetica", "bold");
        doc.text("SFT KING - EXAM REPORT", 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`Exam: ${quiz.title}`, 20, 35);
        doc.text(`Student Name: ${studentName}`, 20, 42);
        doc.text(`Time Taken: ${formattedTime}`, 20, 49); 
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(percentage >= 50 ? 22 : 220, percentage >= 50 ? 163 : 38, percentage >= 50 ? 74 : 38); 
        doc.text(`Final Score: ${result.score} / ${result.totalQuestions} (${percentage}%)`, 20, 56);

        const tableColumn = ["Question", "Your Answer", "Status"];
        const tableRows = [];

        for (let i = 1; i <= result.totalQuestions; i++) {
            const studentAns = result.studentAnswers[i] || "Skipped";
            const statusText = studentAns === "Skipped" ? "Skipped" : "Answered";
            tableRows.push([`Q${i}`, studentAns, statusText]);
        }

        autoTable(doc, {
            startY: 65, head: [tableColumn], body: tableRows, theme: 'grid',
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    if (data.cell.raw === 'Answered') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
                    else { data.cell.styles.textColor = [100, 100, 100]; }
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 30;
        doc.setFont("times", "italic");
        doc.setFontSize(24);
        doc.setTextColor(0, 0, 0); 
        doc.text("Ishanka Shamal", 190, finalY, { align: 'right' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Lead Instructor & Administrator", 190, finalY + 5, { align: 'right' });

        doc.save(`SFT_KING_Report_${studentName}_${quiz.title}.pdf`);
    };

    return (
        <div id="sft-exam-layout" className="fixed inset-0 flex flex-col md:flex-row w-full h-[100dvh] bg-[#020617] text-white overflow-hidden m-0 p-0 font-sans relative">
            
            {(!isExamReady || status) && result === null && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md text-white m-0 p-0">
                    {isTimedOut ? <AlertOctagon className="text-red-600 w-16 h-16 mb-4 animate-bounce" /> : <Loader2 className="animate-spin text-red-600 w-12 h-12 mb-4" />}
                    <p className="font-black tracking-widest uppercase text-xs text-red-500 animate-pulse">{status || 'Loading...'}</p>
                </div>
            )}

            {isReadyPhase && !result && !readyPhaseTransitioned && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-3xl text-white m-0 p-0 overflow-hidden">
                    <div className="w-full max-w-2xl text-center px-6 space-y-8 animate-in fade-in zoom-in duration-1000">
                        <div className="inline-flex items-center justify-center p-5 bg-amber-500/10 rounded-full border border-amber-500/30 mb-2 animate-pulse shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                            <ShieldAlert className="w-16 h-16 text-amber-500" />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 uppercase tracking-[0.2em]">
                            Environment Locked
                        </h1>
                        <p className="text-slate-400 text-sm md:text-base font-medium max-w-lg mx-auto leading-relaxed border border-slate-800 bg-slate-900/50 p-4 rounded-2xl">
                            The encrypted Image Matrix is currently rendering into your device memory to ensure zero lag during your exam. Please wait. The vault will open automatically.
                        </p>
                        <div className="py-8">
                            <div className="text-sm font-bold text-amber-500 tracking-widest uppercase mb-2">Vault Opens In</div>
                            <div className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(245,158,11,0.5)] tabular-nums tracking-tighter">
                                {formatTime(readyTimeLeft)}
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Synchronizing Global Clock...
                        </div>
                    </div>
                </div>
            )}

            <div 
                style={{ [isMobile ? 'height' : 'width']: `${splitRatio}%` }} 
                className="relative bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col overflow-hidden shrink-0"
            >
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-[60]">
                    <button onClick={zoomIn} className="bg-slate-800/90 hover:bg-blue-600 text-white p-3 rounded-xl backdrop-blur-md shadow-lg border border-slate-700 transition-colors"><ZoomIn size={20} /></button>
                    <button onClick={zoomOut} className="bg-slate-800/90 hover:bg-blue-600 text-white p-3 rounded-xl backdrop-blur-md shadow-lg border border-slate-700 transition-colors"><ZoomOut size={20} /></button>
                    {!isMobile && <button onClick={toggleFullscreen} className="bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-xl backdrop-blur-md shadow-lg border border-slate-700 mt-4">{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>}
                </div>

                <div className="absolute top-4 left-4 z-[60]">
                    <button onClick={() => router.push('/student/exams')} className="bg-slate-800/90 hover:bg-red-600 text-white p-3 rounded-xl backdrop-blur-md shadow-lg border border-slate-700 transition-colors"><ArrowLeft size={20} /></button>
                </div>

                <div 
                    ref={pdfScrollRef}
                    className="w-full h-full overflow-auto custom-scrollbar select-none relative"
                    onContextMenu={(e) => e.preventDefault()} 
                    onDragStart={(e) => e.preventDefault()}
                    onScroll={handlePdfScroll}
                >
                    {/* 🚀 THE FIX: Changed to 'w-max min-w-full' so it can grow larger than the screen for panning! */}
                    <div className="flex flex-col items-center py-10 px-2 w-max min-w-full">
                        {isExamReady && pdfBlobUrl ? (
                            <div className={`transition-opacity duration-500 flex flex-col items-center pb-20 ${isPdfLoaded ? 'opacity-100' : 'opacity-0'}`} style={{ touchAction: 'pan-x pan-y' }}>
                                <Document
                                    file={pdfBlobUrl}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    loading={<Loader2 className="animate-spin text-red-500 w-12 h-12 my-20" />}
                                    className="flex flex-col gap-6 md:gap-8 items-center"
                                >
                                    {Array.from({ length: renderedPages }, (_, index) => (
                                        <div 
                                            key={`page_${index + 1}`} 
                                            // 🚀 THE FIX: Use pageWidth directly, no hardcoded mobile locks!
                                            className="relative shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-slate-700 bg-white transition-all duration-300 mx-auto" 
                                            style={{ width: `${pageWidth}px` }} 
                                        >
                                            {/* 🚀 THE FIX: Pass pageWidth directly to react-pdf! */}
                                            <Page 
                                                pageNumber={index + 1} 
                                                renderTextLayer={false} 
                                                renderAnnotationLayer={false} 
                                                width={pageWidth} 
                                            />
                                            
                                            {/* Anti-Cheating Watermark */}
                                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-[0.07] rotate-[-30deg] z-10 overflow-hidden select-none">
                                                <h1 className="text-3xl md:text-6xl font-black text-slate-900 whitespace-nowrap">SFT KING - SECURE</h1>
                                                <h2 className="text-xl md:text-4xl font-bold text-slate-900 whitespace-nowrap mt-2">{user?.mobile} • {user?.name}</h2>
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
                        ) : (
                            <div className="mt-20 flex flex-col items-center justify-center sticky left-1/2 -translate-x-1/2">
                                <Loader2 className="animate-spin text-slate-500 w-10 h-10 mb-4" />
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Decrypting PDF Blob...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div 
                onMouseDown={startDrag}
                onTouchStart={startDrag}
                className={`shrink-0 touch-none flex items-center justify-center bg-slate-800 z-50 transition-colors hover:bg-red-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isMobile ? 'h-4 w-full cursor-row-resize' : 'w-3 h-full cursor-col-resize'}`}
            >
                <div className={`bg-slate-500 rounded-full ${isMobile ? 'w-12 h-1' : 'h-12 w-1'}`}></div>
            </div>

            {quiz && (
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-950 relative">
                    <div className="p-3 md:p-5 border-b border-slate-800 bg-slate-900 flex flex-col md:flex-row justify-between items-start md:items-center shadow-md z-10 shrink-0 gap-3">
                        <div className="flex justify-between items-center w-full md:w-auto">
                            <div className="shrink-0 max-w-[60%] md:max-w-none">
                                <h2 className="font-bold text-sm md:text-lg text-red-500 truncate w-full md:w-48">{quiz.title}</h2>
                                <p className="text-[10px] md:text-xs text-slate-400 mt-0.5">{quiz.totalQuestions} Qs</p>
                            </div>
                            <div className="md:hidden shrink-0">
                                {!result ? (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[11px] border border-red-500/50 ${timeLeft < 300 && !isReadyPhase ? 'bg-red-600/20 text-red-500 animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                                        <Clock size={14} /> {isPdfLoaded ? formatTime(timeLeft) : '--:--'}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-black text-[10px] bg-green-500/20 text-green-500 border border-green-500/50">
                                        <CheckCircle size={14} /> GRADED
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="w-full md:flex-1 md:max-w-xs md:mx-4">
                            <div className="relative flex items-center w-full">
                                <Search className="absolute left-3 text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Find Q#..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-9 pr-3 text-xs md:text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                        
                        <div className="hidden md:block shrink-0">
                            {!result ? (
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-lg border border-red-500/50 ${timeLeft < 300 && !isReadyPhase ? 'bg-red-600/20 text-red-500 animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                                    <Clock size={20} /> {isPdfLoaded ? formatTime(timeLeft) : '--:--'}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm bg-green-500/20 text-green-500 border border-green-500/50">
                                    <CheckCircle size={18} /> GRADED
                                </div>
                            )}
                        </div>
                    </div>

                    <div id="questions-container" className="flex-1 overflow-y-auto p-3 md:p-6 custom-scrollbar bg-slate-950/50 min-h-0 relative">
                        {result ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-in fade-in zoom-in duration-500 pb-20">
                                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Exam Results</h3>
                                
                                <div className="w-40 h-40 rounded-full border-[12px] border-slate-800 flex items-center justify-center relative shadow-[0_0_50px_rgba(220,38,38,0.2)] mb-2">
                                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="44" fill="transparent" stroke="#dc2626" strokeWidth="12" strokeDasharray={`${(result.score / result.totalQuestions) * 276} 276`} className="transition-all duration-[2000ms] ease-out drop-shadow-lg" />
                                    </svg>
                                    <div className="text-center z-10">
                                        <span className="text-4xl font-black text-white">{result.score}</span>
                                        <span className="text-slate-400 text-sm font-bold block border-t border-slate-700 mt-1 pt-1">/ {result.totalQuestions}</span>
                                    </div>
                                </div>
                                
                                <p className="text-slate-400 text-center px-4 text-sm mb-4">Completed in {formatTime(timeTaken)}</p>

                                <button onClick={() => router.push('/student/exams')} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold uppercase tracking-wider transition-all w-full max-w-xs border border-slate-700 hover:border-slate-500">
                                    Return to Library
                                </button>

                                <button onClick={generatePDF} className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black uppercase tracking-wider transition-all w-full max-w-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:-translate-y-1">
                                    <Download size={20} /> Download Report
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2.5 pb-20">
                                {Array.from({ length: quiz.totalQuestions }, (_, i) => i + 1)
                                    .filter((qNum) => qNum.toString().includes(searchQuery))
                                    .map((qNum) => (
                                        <div 
                                            key={qNum} 
                                            id={`q-row-${qNum}`}
                                            className="flex flex-row items-center justify-between bg-slate-900/50 p-2 md:p-3 rounded-xl hover:bg-slate-800 transition-all duration-500 border border-slate-800/50 gap-2 md:gap-3"
                                        >
                                            <span className="w-7 md:w-10 text-left md:text-center font-black text-slate-500 shrink-0 text-[11px] md:text-base">Q{qNum}</span>
                                            <div className="flex gap-1.5 sm:gap-2 md:gap-3 flex-1 justify-end overflow-x-auto custom-scrollbar pb-1 pt-1 w-full max-w-full">
                                                {[1, 2, 3, 4, 5].map(opt => (
                                                    <label key={opt} className={`w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 shrink-0 rounded-full flex items-center justify-center cursor-pointer font-bold text-[11px] md:text-base transition-all ${String(answers[qNum]) === String(opt) ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] scale-110' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                                                        <input type="radio" className="hidden" name={`student_q_${qNum}`} value={opt} checked={String(answers[qNum]) === String(opt)} onChange={() => handleAnswer(qNum, opt)} />
                                                        {opt}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {!result && !isReadyPhase && (
                        <div className="p-3 md:p-5 border-t border-slate-800 bg-slate-900 z-10 shrink-0 flex gap-2 sm:gap-3 pb-safe">
                            <button 
                                onClick={jumpToUnanswered} 
                                className="flex-1 py-3 md:py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-[10px] md:text-sm uppercase tracking-widest border border-slate-700 transition-all truncate"
                            >
                                Jump <span className="hidden sm:inline">to Unanswered</span>
                            </button>

                            <button 
                                onClick={() => submitExam(false)} 
                                className="flex-1 py-3 md:py-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-xl font-black text-[10px] md:text-sm uppercase tracking-widest shadow-lg shadow-red-600/25 transition-all transform hover:-translate-y-1 truncate"
                            >
                                Submit <span className="hidden sm:inline">Exam</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; } .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }`}} />
        </div>
    );
}