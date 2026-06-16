'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { Folder, FileText, ChevronRight, Home, Loader2, CheckCircle, Clock, Lock, ShieldAlert, PenTool, UploadCloud, Zap, CheckSquare, X } from 'lucide-react';
import io from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { emitStudentActivity } from '@/lib/studentActivity';
import { socket } from '@/lib/socket';

const ExamCountdown = ({ targetDate, onFinish }) => {
    const [timeLeft, setTimeLeft] = useState("");
    const finishedLock = useRef(false);

    useEffect(() => {
        if (!targetDate) return; // 🚀 THE FIX: Safety check for null dates
        finishedLock.current = false;

        const calculateTime = () => {
            const difference = new Date(targetDate) - new Date();
            if (difference <= 0) {
                if (!finishedLock.current) {
                    finishedLock.current = true;
                    setTimeout(() => { if (onFinish) onFinish(); }, 0);
                }
                return "00:00:00";
            }

            const d = Math.floor(difference / (1000 * 60 * 60 * 24));
            const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const m = Math.floor((difference / 1000 / 60) % 60);
            const s = Math.floor((difference / 1000) % 60);

            let str = "";
            if (d > 0) str += `${d}d `;
            str += `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return str;
        };

        setTimeLeft(calculateTime());
        const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    return <span className="font-mono tabular-nums font-black">{timeLeft}</span>;
};

const ExamStartPopup = ({ open, title, typeLabel, startTime, onClose, onAutoEnter }) => {
    if (!open || !startTime) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-2xl modal-pop">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest font-black text-red-500">Exam Countdown</p>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1 line-clamp-2">{title || 'Upcoming Exam'}</h3>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{typeLabel}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close countdown popup"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-500 font-black">Remaining To Start</p>
                    <p className="text-3xl mt-2 text-red-500">
                        <ExamCountdown targetDate={startTime} onFinish={onAutoEnter} />
                    </p>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-400 mt-4 text-center font-semibold">
                    Stay on this popup. You will be redirected automatically when the exam starts.
                </p>
            </div>
        </div>
    );
};

// ==========================================
// 🚜 STAGE 2: THE WRITTEN VAULT
// ==========================================
function WrittenLibrary() {
    const router = useRouter();
    const { user } = useAuth();
    const [folders, setFolders] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startPopup, setStartPopup] = useState({ open: false, title: '', startTime: null, route: '', quizId: null });

    useEffect(() => { loadData(); }, [currentFolder]);

    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const socket = io(socketUrl, { transports: ["websocket", "polling"] });
        socket.on("written_updated", () => { loadData(); });
        return () => socket.disconnect(); 
    }, [currentFolder]); 

    const loadData = async () => {
        setLoading(true);
        try {
            const folderRes = await axios.get(`/written/folders?parentId=${currentFolder || 'null'}`);
            setFolders(folderRes.data);
            const quizRes = await axios.get(`/written/quizzes?folderId=${currentFolder || 'null'}`);
            setQuizzes(quizRes.data);
        } catch (e) { console.error("Failed to load Written data", e); }
        setLoading(false);
    };

    const enterFolder = (folder) => {
        emitStudentActivity(socket, user, {
            page: 'Written Exam Library',
            action: 'Opened Written Exam Folder',
            detail: folder.name,
            route: '/student/exams',
            kind: 'navigation'
        });
        setBreadcrumbs([...breadcrumbs, folder]);
        setCurrentFolder(folder.id);
    };
    const navigateToBreadcrumb = (index) => {
        const target = index === -1 ? 'Home' : breadcrumbs[index]?.name || 'Folder';
        emitStudentActivity(socket, user, {
            page: 'Written Exam Library',
            action: 'Changed Written Breadcrumb',
            detail: target,
            route: '/student/exams',
            kind: 'navigation'
        });
        if (index === -1) { setBreadcrumbs([]); setCurrentFolder(null); } 
        else { setBreadcrumbs(breadcrumbs.slice(0, index + 1)); setCurrentFolder(breadcrumbs[index].id); }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-6 bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto whitespace-nowrap shadow-inner">
                <button onClick={() => navigateToBreadcrumb(-1)} className="text-amber-500 hover:text-amber-400 flex items-center gap-1 font-bold"><Home size={16} />Home</button>
                {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.id} className="flex items-center gap-2">
                        <ChevronRight size={14} className="text-slate-800 dark:text-slate-600" />
                        <button onClick={() => navigateToBreadcrumb(index)} className="text-amber-500 hover:text-amber-400 font-bold">{crumb.name}</button>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map(folder => (
                        <div key={`folder-${folder.id}`} onClick={() => enterFolder(folder)} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all cursor-pointer flex flex-col justify-between h-36 relative overflow-hidden group shadow-lg">
                            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                            <div>
                                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Folder size={24} /></div>
                                <h3 className="font-bold text-lg truncate text-slate-700 dark:text-slate-200">{folder.name}</h3>
                            </div>
                        </div>
                    ))}

                    {quizzes.map(quiz => {
                        const now = new Date();
                        // 🚀 THE FIX: Safely parse the start time, fallback to NOW if missing to prevent 1970 epoch
                        const startTime = quiz.startTime ? new Date(quiz.startTime) : now;
                        
                        const readyTimeMs = (quiz.readyTime || 0) * 60000;
                        const timeLimitMs = (quiz.timeLimit || 120) * 60000;
                        const uploadGraceMs = (quiz.uploadGraceTime || 10) * 60000;
                        
                        const readyEndTime = new Date(startTime.getTime() + readyTimeMs);
                        const writeEndTime = new Date(readyEndTime.getTime() + timeLimitMs);
                        const uploadEndTime = new Date(writeEndTime.getTime() + uploadGraceMs);

                        const isLiveOpen = quiz.status === 'live'; 
                        const isScheduled = quiz.status === 'scheduled' && now < startTime; 
                        const isReadyPhase = quiz.status === 'scheduled' && now >= startTime && now < readyEndTime;
                        const isWritingPhase = quiz.status === 'scheduled' && now >= readyEndTime && now < writeEndTime;
                        const isUploadPhase = quiz.status === 'scheduled' && now >= writeEndTime && now < uploadEndTime;
                        const isEnded = quiz.status === 'ended' || (quiz.status === 'scheduled' && now >= uploadEndTime);

                        const handleTimerFinish = () => setQuizzes(prev => [...prev]); 

                        const handleQuizClick = () => {
                            // 🚀 THE FIX: If they finished it, ALWAYS let them in to see their grade!
                            if (quiz.isCompleted) {
                                emitStudentActivity(socket, user, {
                                    page: 'Written Exam Library',
                                    action: 'Opened Completed Written Exam',
                                    detail: quiz.title,
                                    route: `/written-exam/${quiz.id}`,
                                    kind: 'exam',
                                    quizId: quiz.id
                                });
                                return router.push(`/written-exam/${quiz.id}`);
                            }
                            if (isScheduled) {
                                setStartPopup({
                                    open: true,
                                    title: quiz.title,
                                    startTime,
                                    route: `/written-exam/${quiz.id}`,
                                    quizId: quiz.id,
                                });
                                emitStudentActivity(socket, user, {
                                    page: 'Written Exam Library',
                                    action: 'Opened Prestart Countdown Popup',
                                    detail: quiz.title,
                                    route: '/student/exams',
                                    kind: 'exam',
                                    quizId: quiz.id,
                                });
                                return;
                            }
                            if (isEnded && !quiz.isCompleted) return alert("The vault is closed. The upload window has expired.");
                            emitStudentActivity(socket, user, {
                                page: 'Written Exam Library',
                                action: 'Started Written Exam',
                                detail: quiz.title,
                                route: `/written-exam/${quiz.id}`,
                                kind: 'exam',
                                quizId: quiz.id
                            });
                            router.push(`/written-exam/${quiz.id}`);
                        };

                        return (
                            <div key={`quiz-${quiz.id}`} onClick={handleQuizClick} className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 transition-all flex flex-col justify-between min-h-[150px] relative overflow-hidden group shadow-lg ${
                                quiz.isCompleted ? 'border-green-500/30 hover:border-green-500 cursor-pointer' : 
                                isScheduled ? 'border-slate-300 dark:border-slate-800/80 cursor-not-allowed' : 
                                isLiveOpen ? 'border-green-500/50 hover:border-green-500 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
                                isReadyPhase ? 'border-amber-500/50 hover:border-amber-500 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)]' :
                                isWritingPhase ? 'border-blue-500/50 hover:border-blue-600 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                                isUploadPhase ? 'border-red-500/50 hover:border-red-600 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' :
                                isEnded ? 'border-slate-300 dark:border-slate-800 opacity-60 cursor-not-allowed' : 
                                'border-slate-300 dark:border-slate-800 hover:border-amber-500 cursor-pointer'
                            }`}>
                                <div className={`absolute top-0 left-0 w-full h-1 ${
                                    quiz.isCompleted ? 'bg-green-500' : 
                                    isScheduled ? 'bg-slate-600' : 
                                    isLiveOpen ? 'bg-green-500' :
                                    isReadyPhase ? 'bg-amber-500' :
                                    isWritingPhase ? 'bg-blue-500' :
                                    isUploadPhase ? 'bg-red-500' :
                                    isEnded ? 'bg-slate-100 dark:bg-slate-800' : 
                                    'bg-amber-600'
                                }`}></div>
                                
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform ${
                                            quiz.isCompleted ? 'bg-green-500/10 text-green-400 group-hover:scale-110' : 
                                            isScheduled ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400' : 
                                            isLiveOpen ? 'bg-green-500/20 text-green-500 group-hover:scale-110' :
                                            isReadyPhase ? 'bg-amber-500/20 text-amber-500 group-hover:scale-110' : 
                                            isWritingPhase ? 'bg-blue-500/20 text-blue-500 group-hover:scale-110' : 
                                            isUploadPhase ? 'bg-red-500/20 text-red-500 group-hover:scale-110' : 
                                            isEnded ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-600' : 
                                            'bg-amber-500/10 text-amber-500 group-hover:scale-110'
                                        }`}>
                                            {isScheduled ? <Clock size={24} /> : 
                                            isLiveOpen ? <Zap size={24} className="animate-pulse" /> :
                                            isReadyPhase ? <ShieldAlert size={24} className="animate-pulse" /> :
                                            isWritingPhase ? <PenTool size={24} /> :
                                            isUploadPhase ? <UploadCloud size={24} className="animate-bounce" /> :
                                            isEnded ? <Lock size={24} /> : 
                                            <FileText size={24} />}
                                        </div>
                                        {quiz.isCompleted && <CheckCircle size={20} className="text-green-500" />}
                                    </div>
                                    
                                    <h3 className={`font-bold text-lg leading-tight line-clamp-2 ${isEnded && !quiz.isCompleted ? 'text-slate-700 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{quiz.title}</h3>
            
                                    {quiz.publishedScore !== null ? (
                                        <p className="text-xs text-green-400 mt-2 font-black bg-green-500/10 border border-green-500/30 inline-block px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                                            PUBLISHED: {quiz.publishedScore} / {quiz.totalMarks}
                                        </p>
                                    ) : quiz.isCompleted ? (
                                        <p className="text-xs text-amber-500 mt-2 font-bold bg-amber-500/10 border border-amber-500/30 inline-block px-3 py-1.5 rounded-lg">Pending Review</p>
                                    ) : isLiveOpen ? (
                                        <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                                            <p className="text-xs text-green-500 flex items-center gap-1 font-bold">LIVE OPEN • Start Anytime</p>
                                        </div>
                                    ) : isScheduled ? (
                                        <div className="mt-2 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <p className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 flex items-center gap-1 font-bold">Starts in: <ExamCountdown targetDate={startTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isReadyPhase ? (
                                        <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>
                                            <p className="text-xs text-amber-500 flex items-center gap-1 font-bold">Vault Opens: <ExamCountdown targetDate={readyEndTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isWritingPhase ? (
                                        <div className="mt-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                            <p className="text-xs text-blue-400 flex items-center gap-1 font-bold">Writing Ends: <ExamCountdown targetDate={writeEndTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isUploadPhase ? (
                                        <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                            <p className="text-xs text-red-500 flex items-center gap-1 font-black">UPLOAD CLOSES: <ExamCountdown targetDate={uploadEndTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isEnded ? (
                                        <p className="text-xs text-slate-700 dark:text-slate-500 mt-2 font-bold">Vault Locked</p>
                                    ) : (
                                        <p className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 mt-2">{quiz.timeLimit} Mins Write • {quiz.totalMarks} Marks</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ExamStartPopup
                open={startPopup.open}
                title={startPopup.title}
                typeLabel="Written Paper"
                startTime={startPopup.startTime}
                onClose={() => setStartPopup({ open: false, title: '', startTime: null, route: '', quizId: null })}
                onAutoEnter={() => {
                    if (!startPopup.route) return;
                    emitStudentActivity(socket, user, {
                        page: 'Written Exam Library',
                        action: 'Auto Opened Written Exam At Start Time',
                        detail: startPopup.title || 'Unknown Written Exam',
                        route: startPopup.route,
                        kind: 'exam',
                        quizId: startPopup.quizId,
                    });
                    const targetRoute = startPopup.route;
                    setStartPopup({ open: false, title: '', startTime: null, route: '', quizId: null });
                    router.push(targetRoute);
                }}
            />
        </div>
    );
}

// ==========================================
// 🏎️ STAGE 1: THE MCQ ENGINE
// ==========================================
function McqLibrary() {
    const router = useRouter();
    const { user } = useAuth();
    const [folders, setFolders] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [marksModal, setMarksModal] = useState({ open: false, loading: false, quizTitle: '', score: null, totalQuestions: null, percentage: null, hasAttempt: false, timeToFinish: null, rows: [] });
    const [participationModal, setParticipationModal] = useState({ open: false, quizTitle: '' });
    const [startPopup, setStartPopup] = useState({ open: false, title: '', startTime: null, route: '', quizId: null });

    const formatDuration = (totalSeconds) => {
        const safe = Math.max(0, Number(totalSeconds || 0));
        const h = Math.floor(safe / 3600);
        const m = Math.floor((safe % 3600) / 60);
        const s = safe % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    useEffect(() => { loadData(); }, [currentFolder]);

    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const socket = io(socketUrl, { transports: ["websocket", "polling"] });
        socket.on("mcq_updated", () => { loadData(); });
        return () => socket.disconnect(); 
    }, [currentFolder]); 

    const loadData = async () => {
        setLoading(true);
        try {
            const folderRes = await axios.get(`/mcq/folders?parentId=${currentFolder || 'null'}`);
            setFolders(folderRes.data);
            const quizRes = await axios.get(`/mcq/quizzes?folderId=${currentFolder || 'null'}`);
            setQuizzes(quizRes.data);
        } catch (e) { console.error("Failed to load MCQ data", e); }
        setLoading(false);
    };

    const enterFolder = (folder) => {
        emitStudentActivity(socket, user, {
            page: 'MCQ Exam Library',
            action: 'Opened MCQ Exam Folder',
            detail: folder.name,
            route: '/student/exams',
            kind: 'navigation'
        });
        setBreadcrumbs([...breadcrumbs, folder]);
        setCurrentFolder(folder.id);
    };
    const navigateToBreadcrumb = (index) => {
        const target = index === -1 ? 'Home' : breadcrumbs[index]?.name || 'Folder';
        emitStudentActivity(socket, user, {
            page: 'MCQ Exam Library',
            action: 'Changed MCQ Breadcrumb',
            detail: target,
            route: '/student/exams',
            kind: 'navigation'
        });
        if (index === -1) { setBreadcrumbs([]); setCurrentFolder(null); } 
        else { setBreadcrumbs(breadcrumbs.slice(0, index + 1)); setCurrentFolder(breadcrumbs[index].id); }
    };

    const openMarksPopup = async (event, quiz) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

        setMarksModal({
            open: true,
            loading: true,
            quizTitle: quiz.title,
            score: null,
            totalQuestions: null,
            percentage: null,
            hasAttempt: false,
            timeToFinish: null,
            rows: [],
        });

        try {
            const res = await axios.get(`/student/mcq/view/${quiz.id}`);
            const previous = res?.data?.previousResult || null;
            const totalQuestions = Number(previous?.totalQuestions || res?.data?.totalQuestions || quiz.totalQuestions || 0);
            const score = previous ? Number(previous.score || 0) : null;
            const percentage = previous && totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : null;

            const timeToFinish = previous?.timeUsedSeconds !== null && previous?.timeUsedSeconds !== undefined
                ? formatDuration(previous.timeUsedSeconds)
                : null;

            const rows = [];
            if (previous) {
                const studentAnswers = previous.studentAnswers || {};
                const correctAnswers = previous.correctAnswers || {};
                for (let i = 1; i <= totalQuestions; i++) {
                    const studentAns = studentAnswers[i] ?? 'Skipped';
                    const rawCorrect = correctAnswers[i];
                    const correctAns = rawCorrect === undefined || rawCorrect === null || rawCorrect === '' ? 'All (Bonus)' : rawCorrect;

                    let status = 'Incorrect';
                    if (correctAns === 'All (Bonus)' || String(studentAns) === String(rawCorrect)) status = 'Correct';
                    if (studentAns === 'Skipped' && correctAns !== 'All (Bonus)') status = 'Skipped';

                    rows.push({
                        q: `Q${i}`,
                        studentAnswer: String(studentAns),
                        correctAnswer: String(correctAns),
                        status,
                    });
                }
            }

            setMarksModal({
                open: true,
                loading: false,
                quizTitle: quiz.title,
                score,
                totalQuestions: totalQuestions || null,
                percentage,
                hasAttempt: !!previous,
                timeToFinish,
                rows,
            });

            emitStudentActivity(socket, user, {
                page: 'MCQ Exam Library',
                action: 'Viewed Closed Exam Marks',
                detail: quiz.title,
                route: '/student/exams',
                kind: 'exam',
                quizId: quiz.id,
            });
        } catch (e) {
            setMarksModal({
                open: true,
                loading: false,
                quizTitle: quiz.title,
                score: null,
                totalQuestions: null,
                percentage: null,
                hasAttempt: false,
                timeToFinish: null,
                rows: [],
            });
        }
    };

    const openNotParticipatedPopup = (event, quiz) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        setParticipationModal({ open: true, quizTitle: quiz?.title || '' });

        emitStudentActivity(socket, user, {
            page: 'MCQ Exam Library',
            action: "Saw Didn't Participate Notice",
            detail: quiz?.title || 'Unknown Exam',
            route: '/student/exams',
            kind: 'exam',
            quizId: quiz?.id,
        });
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-6 bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto whitespace-nowrap shadow-inner">
                <button onClick={() => navigateToBreadcrumb(-1)} className="text-red-500 hover:text-red-400 flex items-center gap-1 font-bold"><Home size={16} />Home</button>
                {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.id} className="flex items-center gap-2">
                        <ChevronRight size={14} className="text-slate-800 dark:text-slate-600" />
                        <button onClick={() => navigateToBreadcrumb(index)} className="text-red-500 hover:text-red-400 font-bold">{crumb.name}</button>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {folders.map(folder => (
                        <div key={`folder-${folder.id}`} onClick={() => enterFolder(folder)} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-red-600/50 transition-all cursor-pointer flex flex-col justify-between h-36 relative overflow-hidden group shadow-lg">
                            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
                            <div>
                                <div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Folder size={24} /></div>
                                <h3 className="font-bold text-lg truncate text-slate-700 dark:text-slate-200">{folder.name}</h3>
                            </div>
                        </div>
                    ))}

                    {quizzes.map(quiz => {
                        const now = new Date();
                        // 🚀 THE FIX: Safety parse for Live exams
                        const startTime = quiz.startTime ? new Date(quiz.startTime) : now;
                        
                        const readyTimeMs = (quiz.readyTime || 0) * 60000;
                        const timeLimitMs = (quiz.timeLimit || 60) * 60000;
                        
                        const readyEndTime = new Date(startTime.getTime() + readyTimeMs);
                        const examEndTime = new Date(readyEndTime.getTime() + timeLimitMs);

                        const isLiveOpen = quiz.status === 'live';
                        const isScheduled = quiz.status === 'scheduled' && now < startTime;
                        const isReadyPhase = quiz.status === 'scheduled' && now >= startTime && now < readyEndTime;
                        const isAutoLive = quiz.status === 'scheduled' && now >= readyEndTime && now < examEndTime;
                        const isEnded = quiz.status === 'ended' || (quiz.status === 'scheduled' && now >= examEndTime);

                        const handleTimerFinish = () => setQuizzes(prev => [...prev]); 

                        const handleQuizClick = () => {
                            if (quiz.isCompleted) {
                                return openMarksPopup(null, quiz);
                            }
                            if (isScheduled) {
                                setStartPopup({
                                    open: true,
                                    title: quiz.title,
                                    startTime,
                                    route: `/mcq-exam/${quiz.id}`,
                                    quizId: quiz.id,
                                });
                                emitStudentActivity(socket, user, {
                                    page: 'MCQ Exam Library',
                                    action: 'Opened Prestart Countdown Popup',
                                    detail: quiz.title,
                                    route: '/student/exams',
                                    kind: 'exam',
                                    quizId: quiz.id,
                                });
                                return;
                            }
                            if (isEnded && !quiz.isCompleted) return openNotParticipatedPopup(null, quiz);
                            emitStudentActivity(socket, user, {
                                page: 'MCQ Exam Library',
                                action: 'Started MCQ Exam',
                                detail: quiz.title,
                                route: `/mcq-exam/${quiz.id}`,
                                kind: 'exam',
                                quizId: quiz.id
                            });
                            router.push(`/mcq-exam/${quiz.id}`); 
                        };

                        return (
                            <div key={`quiz-${quiz.id}`} onClick={handleQuizClick} className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 transition-all flex flex-col justify-between min-h-[150px] relative overflow-hidden group shadow-lg ${
                                quiz.isCompleted ? 'border-green-500/30 hover:border-green-500 cursor-pointer' : 
                                isScheduled ? 'border-slate-300 dark:border-slate-800/80 cursor-not-allowed' : 
                                isLiveOpen ? 'border-red-500/50 hover:border-red-600 cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.1)]' :
                                isReadyPhase ? 'border-amber-500/50 hover:border-amber-500 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)]' :
                                isAutoLive ? 'border-red-500/50 hover:border-red-600 cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.1)]' :
                                isEnded ? 'border-slate-300 dark:border-slate-800 opacity-60 cursor-not-allowed' : 
                                'border-slate-300 dark:border-slate-800 hover:border-red-600 cursor-pointer'
                            }`}>
                                <div className={`absolute top-0 left-0 w-full h-1 ${
                                    quiz.isCompleted ? 'bg-green-500' : 
                                    isScheduled ? 'bg-slate-600' : 
                                    isReadyPhase ? 'bg-amber-500' :
                                    isEnded ? 'bg-slate-100 dark:bg-slate-800' : 
                                    'bg-red-600'
                                }`}></div>
                                
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform ${
                                            quiz.isCompleted ? 'bg-green-500/10 text-green-400 group-hover:scale-110' : 
                                            isScheduled ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400' : 
                                            isLiveOpen ? 'bg-red-600/10 text-red-500 group-hover:scale-110' :
                                            isReadyPhase ? 'bg-amber-500/20 text-amber-500 group-hover:scale-110' : 
                                            isEnded ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-600' : 
                                            'bg-red-600/10 text-red-500 group-hover:scale-110'
                                        }`}>
                                            {isScheduled ? <Clock size={24} /> : 
                                             isLiveOpen ? <Zap size={24} className="animate-pulse" /> :
                                             isReadyPhase ? <ShieldAlert size={24} className="animate-pulse" /> :
                                             isEnded ? <Lock size={24} /> : 
                                             <FileText size={24} />}
                                        </div>
                                        {quiz.isCompleted && <CheckCircle size={20} className="text-green-500" />}
                                    </div>
                                    
                                    <h3 className={`font-bold text-lg leading-tight line-clamp-2 ${isEnded && !quiz.isCompleted ? 'text-slate-700 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{quiz.title}</h3>
                                    
                                    {quiz.isCompleted ? (
                                        <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                            <p className="text-xs text-green-500 flex items-center gap-1 font-black uppercase tracking-wider">View Marks</p>
                                        </div>
                                    ) : isLiveOpen ? (
                                        <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                                            <p className="text-xs text-red-500 flex items-center gap-1 font-bold">LIVE OPEN • Start Anytime</p>
                                        </div>
                                    ) : isScheduled ? (
                                        <div className="mt-2 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <p className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 flex items-center gap-1 font-bold">Starts in: <ExamCountdown targetDate={startTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isReadyPhase ? (
                                        <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>
                                            <p className="text-xs text-amber-500 flex items-center gap-1 font-bold">Vault Opens: <ExamCountdown targetDate={readyEndTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isAutoLive ? (
                                        <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 w-max">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                            <p className="text-xs text-red-500 flex items-center gap-1 font-bold">Closes in: <ExamCountdown targetDate={examEndTime} onFinish={handleTimerFinish} /></p>
                                        </div>
                                    ) : isEnded ? (
                                        <p className="text-xs text-slate-700 dark:text-slate-500 mt-2 font-bold">Exam Closed</p>
                                    ) : (
                                        <p className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 mt-2">{quiz.timeLimit} Mins Exam</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {marksModal.open && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar modal-pop">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Exam Marks</h3>
                            <button
                                onClick={() => setMarksModal((prev) => ({ ...prev, open: false }))}
                                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">{marksModal.quizTitle}</p>

                        {marksModal.loading ? (
                            <div className="py-8 flex justify-center">
                                <Loader2 className="animate-spin text-red-500 w-8 h-8" />
                            </div>
                        ) : marksModal.hasAttempt ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-4">
                                        <p className="text-xs uppercase tracking-widest text-slate-700 dark:text-slate-500">Your Marks</p>
                                        <p className="text-2xl font-black text-red-500 mt-1">{marksModal.score} / {marksModal.totalQuestions}</p>
                                    </div>
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                        <p className="text-xs uppercase tracking-widest text-green-600">Percentage</p>
                                        <p className="text-xl font-black text-green-500 mt-1">{marksModal.percentage}%</p>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                        <p className="text-xs uppercase tracking-widest text-blue-600">Time to Finish</p>
                                        <p className="text-xl font-black text-blue-500 mt-1">{marksModal.timeToFinish || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden">
                                    <div className="grid grid-cols-4 bg-red-600 text-white text-xs font-black uppercase tracking-wider">
                                        <div className="px-3 py-2">Question</div>
                                        <div className="px-3 py-2">Student Answer</div>
                                        <div className="px-3 py-2">Correct Answer</div>
                                        <div className="px-3 py-2">Status</div>
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {marksModal.rows.map((row) => (
                                            <div key={row.q} className="grid grid-cols-4 text-xs border-t border-slate-200 dark:border-slate-800">
                                                <div className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{row.q}</div>
                                                <div className="px-3 py-2 text-slate-700 dark:text-slate-400">{row.studentAnswer}</div>
                                                <div className="px-3 py-2 text-slate-700 dark:text-slate-400">{row.correctAnswer}</div>
                                                <div className={`px-3 py-2 font-bold ${row.status === 'Correct' ? 'text-green-500' : row.status === 'Skipped' ? 'text-amber-500' : 'text-red-500'}`}>{row.status}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-500 font-bold">
                                No submitted attempt was found for this exam.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {participationModal.open && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-2xl modal-pop">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Exam Closed</h3>
                            <button
                                onClick={() => setParticipationModal({ open: false, quizTitle: '' })}
                                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-5 font-semibold">{participationModal.quizTitle}</p>
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500 font-bold text-sm">
                            You Didn't Participate to the Exam
                        </div>
                        <div className="flex justify-end mt-5">
                            <button
                                onClick={() => setParticipationModal({ open: false, quizTitle: '' })}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ExamStartPopup
                open={startPopup.open}
                title={startPopup.title}
                typeLabel="MCQ Exam"
                startTime={startPopup.startTime}
                onClose={() => setStartPopup({ open: false, title: '', startTime: null, route: '', quizId: null })}
                onAutoEnter={() => {
                    if (!startPopup.route) return;
                    emitStudentActivity(socket, user, {
                        page: 'MCQ Exam Library',
                        action: 'Auto Opened MCQ Exam At Start Time',
                        detail: startPopup.title || 'Unknown MCQ Exam',
                        route: startPopup.route,
                        kind: 'exam',
                        quizId: startPopup.quizId,
                    });
                    const targetRoute = startPopup.route;
                    setStartPopup({ open: false, title: '', startTime: null, route: '', quizId: null });
                    router.push(targetRoute);
                }}
            />
        </div>
    );
}

// ==========================================
// 👑 THE MASTER WRAPPER
// ==========================================
export default function StudentExamPortal() {
    const [masterTab, setMasterTab] = useState('mcq');
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-white flex flex-col font-sans transition-colors duration-300">
            
            <div className="p-6 md:px-10 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-0 z-40 shadow-xl">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500 flex items-center gap-3">
                        <CheckSquare className="text-red-500" size={32} />
                        SFT King Exam Center
                    </h1>
                    <p className="text-slate-800 dark:text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-1">Select your battleground. Digital MCQs or Heavy-Duty Papers.</p>
                </div>
                
                <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner w-full md:w-auto overflow-x-auto">
                    <button 
                        onClick={() => { setMasterTab('mcq'); emitStudentActivity(socket, user, { page: 'Exam Center', action: 'Switched Exam Engine', detail: 'MCQ', route: '/student/exams', kind: 'navigation' }); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap ${
                            masterTab === 'mcq' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Zap size={18} /> MCQ Engine
                    </button>
                    <button 
                        onClick={() => { setMasterTab('written'); emitStudentActivity(socket, user, { page: 'Exam Center', action: 'Switched Exam Engine', detail: 'Written', route: '/student/exams', kind: 'navigation' }); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap ${
                            masterTab === 'written' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <PenTool size={18} /> Written Papers
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 md:p-10 overflow-auto">
                {masterTab === 'mcq' ? <McqLibrary /> : <WrittenLibrary />}
            </div>

            <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; } .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } .modal-pop { animation: modalPopIn 260ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: center; } @keyframes modalPopIn { 0% { opacity: 0; transform: translateY(18px) scale(0.94); filter: blur(2px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }`}} />
        </div>
    );
}