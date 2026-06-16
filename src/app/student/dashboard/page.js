'use client';
import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { socket } from '@/lib/socket'; 
import SecurePlayer from '@/components/shared/SecurePlayer';
import PaymentModal from '@/components/student/PaymentModal';
import PdfSmartButton from '@/components/student/PdfSmartButton'; 
import { emitStudentActivity } from '@/lib/studentActivity';
// 🚀 ADDED 'Trophy' TO IMPORTS!
import { 
    Radio, Lock, Activity, Loader2, 
    Crown, X, Send, Sparkles, User, Play, Mic, Phone, PhoneOff, Trophy, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [latestLive, setLatestLive] = useState(null);
    // ================= POSTER STATE =================
    const [activePoster, setActivePoster] = useState(null);
    const [showPosterPopup, setShowPosterPopup] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [nextExam, setNextExam] = useState(null);
    const [countdownNow, setCountdownNow] = useState(Date.now());
    const [showExamStartPopup, setShowExamStartPopup] = useState(false);
    const [pendingExamRoute, setPendingExamRoute] = useState('');

    const [showLivePlayer, setShowLivePlayer] = useState(false); 

    useEffect(() => {
        setShowLivePlayer(false);
    }, [latestLive?.id]);

    const handlePlayLiveClick = () => {
        setShowLivePlayer(true); 
        if (user && latestLive) {
            emitStudentActivity(socket, user, {
                page: `Watching Live: ${latestLive.title}`,
                action: 'Opened Live Stream',
                detail: latestLive.title,
                route: '/student/dashboard',
                kind: 'content',
                contentId: latestLive.id
            });
        }
    };



    const [showAI, setShowAI] = useState(false);
    const [aiMessage, setAiMessage] = useState("");
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    
    const [chatHistory, setChatHistory] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedChat = sessionStorage.getItem('sft_king_ai_memory');
            if (savedChat) return JSON.parse(savedChat);
        }
        return [{ role: "model", parts: [{ text: "Hello! I am the SFT King AI 👑. How can I help you with your studies today?" }] }];
    });

    const chatHistoryRef = useRef(chatHistory);
    useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
    const [isAILoading, setIsAILoading] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCountdownNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('sft_king_ai_memory', JSON.stringify(chatHistory));
        }
    }, [chatHistory]);

    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isAILoading]);

    const recognitionRef = useRef(null); 

    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Voice Input. Please use Google Chrome.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition; 
        recognition.lang = 'si-LK'; 
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setAiMessage(transcript);
            setIsListening(false); 
            if (handleSendAIRef.current) handleSendAIRef.current(null, transcript);
        };

        recognition.onerror = (event) => {
            if (event.error === 'not-allowed') {
                alert("🎤 Microphone access blocked! Please allow Microphone access and refresh.");
            }
            setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(text);
        const isSinhala = /[\u0D80-\u0DFF]/.test(text);
        utterance.lang = isSinhala ? 'si-LK' : 'en-GB';

        const voices = window.speechSynthesis.getVoices();
        if (!isSinhala) {
            const maleVoice = voices.find(v => 
                v.name.includes('Male') || v.name.includes('David') || v.name.includes('Guy') || v.name.includes('UK English Male')
            );
            if (maleVoice) utterance.voice = maleVoice;
        }

        utterance.pitch = 0.9; 
        utterance.rate = 1.0;

        utterance.onstart = () => setIsAISpeaking(true);
        
        utterance.onend = () => {
            setIsAISpeaking(false);
            if (document.querySelector('.call-screen-active')) {
                setTimeout(() => {
                    const micBtn = document.getElementById('jarvis-mic-btn');
                    if (micBtn && !micBtn.classList.contains('mic-is-hot')) micBtn.click();
                }, 800); 
            }
        };

        utterance.onerror = () => setIsAISpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const handleSendAIRef = useRef();

    const handleSendAI = async (e, voicePrompt = null) => {
        if (e) e.preventDefault();
        
        const currentPrompt = voicePrompt || aiMessage;
        if (!currentPrompt || !currentPrompt.trim() || isAILoading) return;

        setAiMessage(""); 
        setIsAILoading(true);

        const currentHistory = chatHistoryRef.current;
        const newHistory = [...currentHistory, { role: "user", parts: [{ text: currentPrompt }] }];
        setChatHistory(newHistory);

        try {
            const res = await axios.post('/student/ai-chat', { 
                prompt: currentPrompt, 
                history: currentHistory 
            });

            emitStudentActivity(socket, user, {
                page: 'Dashboard AI',
                action: 'Sent AI Prompt',
                detail: currentPrompt.slice(0, 120),
                route: '/student/dashboard',
                kind: 'ai'
            });

            const replyText = res.data.reply;
            setChatHistory([...newHistory, { role: "model", parts: [{ text: replyText }] }]);
        } catch (error) {
            const backendError = error.response?.data?.error || "⚠️ SYSTEM ERROR: The API is unreachable.";
            setChatHistory([...newHistory, { role: "model", parts: [{ text: backendError }] }]);
        } finally {
            setIsAILoading(false);
        }
    };

    useEffect(() => { handleSendAIRef.current = handleSendAI; });

    const load = async () => {
        if (!user) return;
        try {
            const [contentResult, nextExamResult] = await Promise.allSettled([
                axios.get('/student/content', { params: { batch: user.batch } }),
                axios.get('/student/next-exam'),
            ]);

            if (contentResult.status !== 'fulfilled') {
                throw contentResult.reason;
            }

            const res = contentResult.value;
            if (nextExamResult.status === 'fulfilled') {
                setNextExam(nextExamResult.value?.data?.nextExam || null);
            } else {
                setNextExam(null);
            }

            const lessons = Array.isArray(res.data.lessons) ? res.data.lessons : [];
            const contentList = Array.isArray(res.data.content) ? res.data.content : [];

            const activeStream = contentList
                .filter(c => c && (c.isStreamActive === true || c.isStreamActive === 1 || c.isStreamActive === "1"))
                .slice()
                .sort((a, b) => {
                    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
                    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                    return bTime - aTime;
                })[0];

            const nowMs = Date.now();
            const scheduledStream = contentList
                .filter(c => c && c.scheduleEnabled && c.startTime)
                .filter(c => {
                    const startMs = new Date(c.startTime).getTime();
                    return Number.isFinite(startMs) && startMs > nowMs;
                })
                .slice()
                .sort((a, b) => {
                    const aStart = new Date(a.startTime).getTime();
                    const bStart = new Date(b.startTime).getTime();
                    return aStart - bStart;
                })[0];

            const chosenLive = activeStream || scheduledStream || null;

            if (chosenLive) {
                const parentLesson = lessons.find(l => l.id === chosenLive.lessonId);
                const videoWithContext = {
                    ...chosenLive,
                    lesson: parentLesson || { name: "Live Session", price: "0" }
                };
                if (!videoWithContext.isSeparate && parentLesson) {
                    videoWithContext.isPaid = parentLesson.isPaid;
                }
                setLatestLive(videoWithContext);
            } else {
                setLatestLive(null);
            }
            setLoading(false);
        } catch (e) { setLoading(false); }
    };

    const nextExamStartMs = nextExam?.startTime
        ? new Date(nextExam.startTime).getTime()
        : null;
    const nextExamReadyMinutes = Number(nextExam?.readyTime || 0) || 0;
    const nextExamTimeLimitMinutes = Number(nextExam?.timeLimit || 60) || 60;
    const nextExamReadyEndMs = Number.isFinite(nextExamStartMs)
        ? nextExamStartMs + (nextExamReadyMinutes * 60000)
        : NaN;
    const nextExamEndMsFromServer = nextExam?.examEndTime ? new Date(nextExam.examEndTime).getTime() : NaN;
    const nextExamEndMs = Number.isFinite(nextExamEndMsFromServer)
        ? nextExamEndMsFromServer
        : (Number.isFinite(nextExamReadyEndMs) ? nextExamReadyEndMs + (nextExamTimeLimitMinutes * 60000) : NaN);

    let nextExamCountdownLabel = 'Start in';
    let nextExamRemainingMs = Number.isFinite(nextExamStartMs) ? Math.max(0, nextExamStartMs - countdownNow) : null;

    if (Number.isFinite(nextExamStartMs)) {
        if (countdownNow < nextExamStartMs) {
            nextExamCountdownLabel = 'Start in';
            nextExamRemainingMs = Math.max(0, nextExamStartMs - countdownNow);
        } else if (nextExamReadyMinutes > 0 && countdownNow < nextExamReadyEndMs) {
            nextExamCountdownLabel = 'Waiting...';
            nextExamRemainingMs = Math.max(0, nextExamReadyEndMs - countdownNow);
        } else if (Number.isFinite(nextExamEndMs) && countdownNow < nextExamEndMs) {
            nextExamCountdownLabel = 'Exam Remaining';
            nextExamRemainingMs = Math.max(0, nextExamEndMs - countdownNow);
        } else {
            nextExamCountdownLabel = 'Ended';
            nextExamRemainingMs = 0;
        }
    }

    const formatCountdown = (ms) => {
        if (!Number.isFinite(ms)) return '--:--:--';
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const nextExamTypeLabel = nextExam?.type === 'written' ? 'Written Paper' : 'MCQ Exam';

    const getExamRoute = (exam) => {
        if (!exam?.id || !exam?.type) return '';
        return exam.type === 'written'
            ? `/written-exam/${exam.id}`
            : `/mcq-exam/${exam.id}`;
    };

    const handleOpenNextExam = () => {
        if (!nextExam?.id || !nextExam?.type) return;
        const examRoute = getExamRoute(nextExam);
        if (!examRoute) return;

        if (Number.isFinite(nextExamStartMs) && countdownNow < nextExamStartMs) {
            setPendingExamRoute(examRoute);
            setShowExamStartPopup(true);

            emitStudentActivity(socket, user, {
                page: 'Dashboard',
                action: 'Opened Exam Start Countdown Popup',
                detail: `${nextExam.type}:${nextExam.id}`,
                route: '/student/dashboard',
                kind: 'navigation',
                quizId: nextExam.id,
            });
            return;
        }

        emitStudentActivity(socket, user, {
            page: 'Dashboard',
            action: 'Opened Next Exam From Countdown',
            detail: `${nextExam.type}:${nextExam.id}`,
            route: '/student/dashboard',
            kind: 'navigation',
            quizId: nextExam.id,
        });

        router.push(examRoute);
    };

    useEffect(() => {
        if (!showExamStartPopup) return;
        if (!pendingExamRoute) return;
        if (!Number.isFinite(nextExamStartMs)) return;
        if (countdownNow < nextExamStartMs) return;

        setShowExamStartPopup(false);

        emitStudentActivity(socket, user, {
            page: 'Dashboard',
            action: 'Auto Opened Next Exam At Start Time',
            detail: `${nextExam?.type || 'unknown'}:${nextExam?.id || 'unknown'}`,
            route: '/student/dashboard',
            kind: 'navigation',
            quizId: nextExam?.id,
        });

        router.push(pendingExamRoute);
    }, [showExamStartPopup, pendingExamRoute, nextExamStartMs, countdownNow, nextExam?.id, nextExam?.type, router, user]);

    useEffect(() => {
        if (!showExamStartPopup) return;
        if (!nextExam?.id || !nextExam?.type) {
            setShowExamStartPopup(false);
            setPendingExamRoute('');
        }
    }, [showExamStartPopup, nextExam]);

    useEffect(() => { 
        load(); 
        const handleRefresh = () => load();
        socket.on('notification', handleRefresh);
        socket.on('mcq_updated', handleRefresh);
        socket.on('written_updated', handleRefresh);
        axios.get('/settings/ai-chat').then(res => setIsAiEnabled(res.data.enabled)).catch(() => {});
        socket.on('ai_chat_update', (data) => {
            setIsAiEnabled(data.enabled);
            if (!data.enabled) setShowAI(false); 
        });
        socket.on('content_updated', handleRefresh); 
        return () => {
            socket.off('notification', handleRefresh);
            socket.off('mcq_updated', handleRefresh);
            socket.off('written_updated', handleRefresh);
            socket.off('content_updated', handleRefresh);
        };
    }, [user]);



    useEffect(() => {
        const fetchActivePoster = async () => {
            try {
                const res = await axios.get('/student/active-poster');
                if (res.data && res.data.poster) {
                    setActivePoster(res.data.poster);
                    setShowPosterPopup(true); // Forces popup to open
                }
            } catch (error) {
                console.error("Poster Error:", error);
            }
        };
        
        // Fetch immediately if user exists
        if (user) {
            fetchActivePoster();
        }
    }, [user]); 





    const getYTID = (url) => {
        if (!url) return "";
        const match = url.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)\??v?=?|(&v=)|(live\/))([^#&?]*).*/);
        return (match && match[9].length === 11) ? match[9] : "";
    };

    const liveNeedsPayment = !!latestLive && !!latestLive.isSeparate && !latestLive.isPaid;
    const liveScheduleEnabled = !!latestLive?.scheduleEnabled;
    const liveEndMs = liveScheduleEnabled && latestLive?.endTime
        ? new Date(latestLive.endTime).getTime()
        : NaN;
    const liveStartMs = liveScheduleEnabled && latestLive?.startTime
        ? new Date(latestLive.startTime).getTime()
        : NaN;
    const liveIsLive = !!latestLive?.isStreamActive;
    const liveIsUpcoming = liveScheduleEnabled && !liveIsLive && Number.isFinite(liveStartMs) && liveStartMs > countdownNow;
    const liveRemainingMs = liveScheduleEnabled && Number.isFinite(liveEndMs)
        ? Math.max(0, liveEndMs - countdownNow)
        : null;
    const liveRemainingLabel = liveRemainingMs !== null
        ? formatCountdown(liveRemainingMs)
        : '';
    const liveRemainingText = liveRemainingMs !== null
        ? (liveRemainingMs > 0 ? `Ends in ${liveRemainingLabel}` : 'Ending now')
        : '';
    const liveStartsInMs = liveIsUpcoming ? Math.max(0, liveStartMs - countdownNow) : null;
    const liveStartsInText = liveStartsInMs !== null
        ? (liveStartsInMs > 0 ? `Starts in ${formatCountdown(liveStartsInMs)}` : 'Starting now')
        : '';
    const liveSectionTitle = latestLive
        ? (liveIsLive ? 'Ongoing Live' : 'Upcoming Live')
        : 'Ongoing Live';

    return (
        <div className="space-y-8 font-sans pb-20 transition-colors duration-300">
            {/* ================= EVENT POSTER FULLSCREEN MATRIX POPUP ================= */}
            <AnimatePresence>
                {showPosterPopup && activePoster && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl"
                    >
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 40 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col items-center"
                        >
                            {/* Close Button */}
                            <button 
                                onClick={() => setShowPosterPopup(false)}
                                className="absolute -top-14 right-0 md:-right-14 p-3 bg-white/10 hover:bg-red-500 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-lg z-10 group"
                            >
                                <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>

                            {/* Image Container */}
                            <div 
                                className={`relative w-full bg-slate-950 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.7)] border border-white/20 ${
                                    activePoster.link ? 'cursor-pointer hover:ring-4 ring-purple-500/50 transition-all duration-300' : ''
                                }`}
                                onClick={() => {
                                    if (activePoster.link) {
                                        const url = activePoster.link.startsWith('http') ? activePoster.link : `https://${activePoster.link}`;
                                        window.open(url, '_blank');
                                    }
                                }}
                            >
                                {/* The Image */}
                                <img 
                                    src={(activePoster.imageUrl || '').replace('/api', '')} 
                                    onError={(e) => { 
                                        if (!e.target.dataset.retried) {
                                            e.target.dataset.retried = true;
                                            e.target.src = `/api${activePoster.imageUrl}`; 
                                        }
                                    }}
                                    alt={activePoster.title || 'Event Poster'}
                                    // slightly reduced max-h so the title bar fits on screen perfectly
                                    className="w-full h-auto object-contain max-h-[70vh] mx-auto bg-black" 
                                />
                                
                                {/* Title Bar - Now sitting BELOW the image, no longer overlapping */}
                                {activePoster.title && (
                                    <div className="w-full p-4 md:p-5 bg-slate-900 border-t border-white/10 shrink-0">
                                        <h2 className="text-white font-black text-xl md:text-2xl text-center shadow-black drop-shadow-lg">
                                            {activePoster.title}
                                        </h2>
                                        {activePoster.link && (
                                            <div className="flex justify-center mt-2">
                                                <span className="px-4 py-1.5 bg-purple-600 rounded-full text-white text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-purple-900/50">
                                                    Click Image to Open Link
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* WELCOME CARD */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[35px] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between transition-colors duration-300 gap-4">
                <div className="w-full">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white italic tracking-tighter transition-colors duration-300">Welcome, {user?.name}</h2>
                        <div className="md:hidden w-10 h-10 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center transition-colors duration-300 shrink-0">
                            <Activity size={20} />
                        </div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 mb-4">Batch: {user?.batch}</p>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-widest font-black">
                            <Timer size={12} />
                            {nextExam ? `${nextExamTypeLabel}` : 'No scheduled exam'}
                        </div>
                        {nextExam ? (
                            <button
                                type="button"
                                onClick={handleOpenNextExam}
                                className="inline-flex items-center rounded-full px-3 py-1 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] uppercase tracking-widest font-black hover:brightness-110 transition"
                            >
                                {nextExamCountdownLabel} {formatCountdown(nextExamRemainingMs)}
                            </button>
                        ) : null}
                    </div>
                    
                    {/* 🚀 THE NEW ACTION BUTTONS ROW */}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                        {/* 🏆 THE LEADERBOARD PORTAL BUTTON */}
                        <button 
                            onClick={() => router.push('/leaderboard')}
                            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <Trophy size={16} className="fill-slate-900" />
                            Global Leaderboard
                        </button>
                    </div>
                </div>
                
                <div className="hidden md:flex w-16 h-16 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full items-center justify-center transition-colors duration-300 shrink-0">
                    <Activity size={32} />
                </div>
            </div>

            {/* VIDEO SECTION */}
            <div>
                
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/30 animate-pulse"><Radio size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter transition-colors duration-300">{liveSectionTitle}</h3>
                            {latestLive && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{latestLive.lesson.name}</p>}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[35px] md:rounded-[40px] overflow-hidden shadow-xl border border-slate-100 dark:border-white/10 relative transition-colors duration-300">
                        {loading ? (
                            <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest transition-colors duration-300 min-h-[300px]">Loading...</div>
                        ) : latestLive ? (
                            !liveNeedsPayment ? (
                                <div className="w-full flex flex-col">
                                    <div className="aspect-video w-full bg-slate-950 relative flex items-center justify-center overflow-hidden shrink-0">
                                        {liveIsLive ? (
                                            showLivePlayer ? (
                                                <div className="absolute inset-0 w-full h-full animate-in fade-in duration-700">
                                                    <SecurePlayer
                                                        videoId={getYTID(latestLive.youtube_link)}
                                                        user={user}
                                                        trackingTitle={latestLive.title}
                                                        trackingType="live"
                                                        trackingRoute="/student/dashboard"
                                                        contentId={latestLive.id}
                                                    />
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={handlePlayLiveClick} 
                                                    className="absolute inset-0 w-full h-full cursor-pointer group bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 z-10"
                                                >
                                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.15),transparent_50%)] pointer-events-none"></div>
                                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(159,18,57,0.2),transparent_50%)] pointer-events-none group-hover:opacity-70 transition-opacity duration-500"></div>
                                                    <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

                                                    <div className="relative z-20 w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4 shadow-xl group-hover:bg-white/20 group-hover:scale-105 transition-transform duration-300 transform-gpu">
                                                        <Play className="text-white w-8 h-8 md:w-10 md:h-10 ml-1.5 opacity-90 group-hover:opacity-100 drop-shadow-md" fill="currentColor" />
                                                    </div>

                                                    <h3 className="relative z-20 text-white text-center font-black text-lg md:text-2xl uppercase tracking-widest leading-snug drop-shadow-2xl line-clamp-3 px-2 group-hover:-translate-y-1 transition-transform duration-300 transform-gpu">
                                                        {latestLive.title}
                                                    </h3>
                                                </div>
                                            )
                                        ) : (
                                            <div className="absolute inset-0 w-full h-full bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6 z-10">
                                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.12),transparent_50%)] pointer-events-none"></div>
                                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(159,18,57,0.16),transparent_50%)] pointer-events-none"></div>
                                                <div className="relative z-20 w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center mb-4 shadow-xl">
                                                    <Timer className="text-white w-8 h-8 md:w-10 md:h-10" />
                                                </div>

                                                <h3 className="relative z-20 text-white text-center font-black text-lg md:text-2xl uppercase tracking-widest leading-snug drop-shadow-2xl line-clamp-3 px-2">
                                                    {latestLive.title}
                                                </h3>

                                                {liveStartsInText && (
                                                    <div className="relative z-20 mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-widest">
                                                        <Timer size={14} />
                                                        {liveStartsInText}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 md:px-6 md:py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 transition-colors duration-300">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-black text-slate-800 dark:text-white uppercase italic text-base md:text-xl truncate transition-colors duration-300">
                                                    {latestLive.title}
                                                </h4>
                                                {liveIsLive ? (
                                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse mt-0.5">● Broadcasting Now</p>
                                                ) : (
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Scheduled Live</p>
                                                )}
                                                {liveIsLive && liveRemainingText && (
                                                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest">
                                                        <Timer size={12} />
                                                        {liveRemainingText}
                                                    </div>
                                                )}
                                                {!liveIsLive && liveStartsInText && (
                                                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest">
                                                        <Timer size={12} />
                                                        {liveStartsInText}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 w-full sm:w-auto">
                                                {liveIsLive && latestLive.zoomVisible && (
                                                    <button 
                                                        onClick={() => router.push(`/live-zoom/${latestLive.id}`)}
                                                        className="w-full sm:w-auto px-6 py-2.5 bg-[#0b5cff] hover:bg-[#094bdd] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 duration-300"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                            <path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                                                        </svg>
                                                        Join Zoom
                                                    </button>
                                                )}
                                                <PdfSmartButton item={latestLive} user={user} className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-white/5 shadow-sm transition-transform hover:scale-[1.02] duration-300 transform-gpu" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    className="w-full flex flex-col cursor-pointer group" 
                                    onClick={() => setSelectedItem(latestLive)}
                                >
                                    <div className="aspect-video w-full bg-slate-950 relative flex items-center justify-center overflow-hidden shrink-0">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.08)_0%,transparent_60%)] pointer-events-none"></div>

                                        <div className="relative z-20 w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-500/10 backdrop-blur-md border border-red-500/20 flex items-center justify-center mb-4 group-hover:bg-red-500/20 group-hover:scale-105 transition-transform duration-300 transform-gpu">
                                            <Lock className="text-red-500 w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
                                        </div>

                                        <h3 className="relative z-20 text-slate-400 text-center font-black text-sm md:text-xl uppercase tracking-widest leading-snug opacity-60 line-clamp-2 px-2 mb-3 group-hover:opacity-80 transition-opacity duration-300">
                                            {latestLive.lesson.name}
                                        </h3>

                                        {liveIsLive && liveRemainingText && (
                                            <div className="relative z-20 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest mb-3">
                                                <Timer size={12} />
                                                {liveRemainingText}
                                            </div>
                                        )}

                                        {!liveIsLive && liveStartsInText && (
                                            <div className="relative z-20 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest mb-3">
                                                <Timer size={12} />
                                                {liveStartsInText}
                                            </div>
                                        )}

                                        <span className="relative z-20 text-red-500 font-black uppercase text-[9px] md:text-[10px] tracking-[0.5em] bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20 shadow-inner">
                                            Click to Join
                                        </span>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 transition-colors duration-300 min-h-[300px]"><Radio size={48} className="mb-4 opacity-30 dark:opacity-50"/><p className="font-black uppercase tracking-widest text-sm">No Active Live Session</p></div>
                        )}
                    </div>
                </div>

            </div>
            
            {selectedItem && <PaymentModal item={selectedItem} user={user} onClose={() => setSelectedItem(null)} onSuccess={() => { setSelectedItem(null); load(); }} />}

            <AnimatePresence>
                {showExamStartPopup && nextExam ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ y: 20, scale: 0.98, opacity: 0 }}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            exit={{ y: 20, scale: 0.98, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Exam Countdown</p>
                                    <h3 className="text-xl font-black italic tracking-tight text-slate-900 dark:text-white mt-1">
                                        {nextExam.title || 'Upcoming Exam'}
                                    </h3>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                                        {nextExamTypeLabel}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowExamStartPopup(false);
                                        setPendingExamRoute('');
                                    }}
                                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors"
                                    aria-label="Close countdown popup"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 p-4 text-center">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 dark:text-slate-400">Remaining To Start</p>
                                <p className="mt-2 text-3xl font-black tracking-widest text-red-600 dark:text-red-400">
                                    {formatCountdown(nextExamRemainingMs)}
                                </p>
                            </div>

                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center font-semibold">
                                Keep this popup open. You will be redirected automatically when the exam starts.
                            </p>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {isAiEnabled && (
                <>
                <div className="fixed bottom-6 right-6 z-[60] md:bottom-10 md:right-10">
                    <button 
                        onClick={() => setShowAI(!showAI)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-110 active:scale-95 transition-all duration-300 ${
                            showAI 
                            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 rotate-90 shadow-none' 
                            : 'bg-gradient-to-tr from-yellow-600 to-yellow-400 text-white border-2 border-yellow-300/50'
                        }`}
                    >
                        {showAI ? <X size={24} /> : <Crown size={28} className="drop-shadow-lg" />}
                    </button>
                </div>

                

                <AnimatePresence>
                    {showAI && (
                        <motion.div 
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="fixed bottom-24 right-4 left-4 md:left-auto md:right-10 md:w-96 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-yellow-500/20 dark:border-yellow-500/10 p-0 rounded-[35px] shadow-2xl flex flex-col h-[65vh] overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-yellow-500/10 to-transparent shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-gradient-to-tr from-yellow-500 to-yellow-400 text-white rounded-xl shadow-lg shadow-yellow-500/20">
                                        <Sparkles size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase italic tracking-tighter text-lg leading-tight">SFT King AI</h4>
                                        <p className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Designed by MIS Computers</p>
                                    </div>
                                </div>
                                {/* Removed the Phone Button! */}
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 flex flex-col">
                                    {chatHistory.map((msg, idx) => (
                                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                                                msg.role === 'user' 
                                                ? 'bg-red-600 text-white rounded-br-sm shadow-md' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-bl-sm border border-slate-200 dark:border-slate-700'
                                            }`}>
                                                <p className="whitespace-pre-wrap font-medium leading-relaxed">{msg.parts[0].text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {isAILoading && (
                                        <div className="flex w-full justify-start">
                                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} className="h-1 w-full shrink-0"></div>
                                </div>
                                <form onSubmit={handleSendAI} className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900 shrink-0">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 focus-within:border-yellow-500 dark:focus-within:border-yellow-500 transition-colors">
                                        <button 
                                            type="button" 
                                            onClick={toggleListening}
                                            className={`p-3 rounded-xl transition-all shrink-0 flex items-center justify-center ${
                                                isListening 
                                                ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 dark:hover:text-red-400'
                                            }`}
                                        >
                                            <Mic size={18} className={isListening ? 'animate-bounce' : ''} />
                                        </button>
                                        <input 
                                            type="text" 
                                            value={aiMessage}
                                            onChange={(e) => setAiMessage(e.target.value)}
                                            placeholder={isListening ? "Listening... Speak now!" : "Ask SFT King AI..."}
                                            className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm text-slate-800 dark:text-white font-medium placeholder:text-slate-400"
                                            disabled={isAILoading}
                                        />
                                        <button 
                                            type="submit" 
                                            disabled={isAILoading || !aiMessage.trim()}
                                            className="p-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl transition-colors shrink-0"
                                        >
                                            <Send size={18} className={isAILoading ? 'opacity-0' : 'opacity-100'} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                </>
            )}
        </div>
    );
}