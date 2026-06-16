'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket'; // Adjust the path if needed based on your folder structure!
import { useAuth } from '@/context/AuthContext';
import { Trophy, Crown, Zap, PenTool, Users, Globe, Loader2, ArrowLeft, User, Flame, TrendingUp, Plus, Lock, Timer, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { emitStudentActivity } from '@/lib/studentActivity';
import { normalizeAvatarPath } from '@/lib/utils';

// ── Reaction Constants ──────────────────────────────────────────────────────
const REACTIONS = [
    { id: 'fire',  icon: '🔥', name: 'Fire' },
    { id: 'love',  icon: '❤️', name: 'Love' },
    { id: 'laugh', icon: '😂', name: 'Haha' },
    { id: 'cold',  icon: '🥶', name: 'Cold' },
    { id: 'skull', icon: '💀', name: 'Brutal' },
    { id: 'crown', icon: '👑', name: 'King' },
];

// ── Animated score counter ──────────────────────────────────────────────────
function useCountUp(target, duration = 1200, trigger = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!trigger || target == null) return;
        setVal(0);
        let start = null;
        const raf = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(ease * target));
            if (p < 1) requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
    }, [target, trigger]);
    return val;
}

function ScoreCount({ value, trigger, className }) {
    const c = useCountUp(value, 1200, trigger);
    return <span className={className}>{trigger ? c : value}</span>;
}

// ── Confetti burst ──────────────────────────────────────────────────────────
function Confetti({ show }) {
    const pieces = useMemo(() => Array.from({ length: 55 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.9}s`,
        dur: `${1.6 + Math.random() * 2}s`,
        color: ['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#fff','#fb923c'][i % 7],
        size: `${6 + Math.random() * 8}px`,
        rotate: Math.random() * 360,
    })), []);
    if (!show) return null;
    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {pieces.map(p => (
                <div key={p.id} style={{
                    position:'absolute', left:p.left, top:'-20px',
                    width:p.size, height:p.size, backgroundColor:p.color,
                    borderRadius:'2px', transform:`rotate(${p.rotate}deg)`,
                    animation:`confettiFall ${p.dur} ${p.delay} linear forwards`,
                }} />
            ))}
        </div>
    );
}

// ── Avatar helper ───────────────────────────────────────────────────────────
function Avatar({ src, size = 'md' }) {
    const iconSize = size === 'lg' ? 40 : size === 'sm' ? 14 : 24;
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [src]);

    if (!src || hasError) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                <User size={iconSize} className="text-slate-500" />
            </div>
        );
    }

    return (
        <img
            src={src}
            className="w-full h-full object-cover"
            alt=""
            onError={() => setHasError(true)}
        />
    );
}

function formatCountdownParts(targetDate) {
    const end = targetDate ? new Date(targetDate) : null;
    if (!end || Number.isNaN(end.getTime())) {
        return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const total = Math.max(0, end.getTime() - Date.now());
    return {
        total,
        days: Math.floor(total / 86400000),
        hours: Math.floor((total % 86400000) / 3600000),
        minutes: Math.floor((total % 3600000) / 60000),
        seconds: Math.floor((total % 60000) / 1000),
    };
}

function BigCountdown({ targetDate, title, subtitle }) {
    const [parts, setParts] = useState(() => formatCountdownParts(targetDate));

    useEffect(() => {
        setParts(formatCountdownParts(targetDate));
        const timer = setInterval(() => setParts(formatCountdownParts(targetDate)), 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    const tiles = [
        { label: 'Days', value: String(parts.days).padStart(2, '0') },
        { label: 'Hours', value: String(parts.hours).padStart(2, '0') },
        { label: 'Mins', value: String(parts.minutes).padStart(2, '0') },
        { label: 'Secs', value: String(parts.seconds).padStart(2, '0') },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-slate-950/80 shadow-[0_0_80px_rgba(34,211,238,0.12)]"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.15),_transparent_35%)]" />
            <div className="absolute inset-0 opacity-30 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] animate-pulse" />
            <div className="relative p-5 md:p-8">
                <div className="flex items-center gap-3 text-cyan-300 uppercase tracking-[0.3em] text-[10px] font-black">
                    <Lock size={14} />
                    Live Unlock Panel
                </div>
                <h3 className="mt-3 text-2xl md:text-4xl font-black uppercase tracking-tight text-white">
                    {title}
                </h3>
                <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                    {subtitle}
                </p>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {tiles.map((tile) => (
                        <div key={tile.label} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
                            <div className="text-3xl md:text-5xl font-black text-white tabular-nums tracking-tight">{tile.value}</div>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.35em] text-slate-400 font-bold">{tile.label}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs font-bold text-cyan-200/80">
                    <Timer size={14} />
                    <span>{parts.total > 0 ? 'Counting down in real time' : 'Waiting for final unlock'}</span>
                    <Sparkles size={14} className="ml-auto text-fuchsia-300" />
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function LeaderboardPage() {
    const { user } = useAuth();
    const router  = useRouter();

    const [activeEngine,    setActiveEngine]    = useState('mcq');
    const [filterMode,      setFilterMode]      = useState('global');
    const [quizzes,         setQuizzes]         = useState([]);
    const [selectedQuizId,  setSelectedQuizId]  = useState(null);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [selfEntry,       setSelfEntry]       = useState(null);
    const [leaderboardMeta, setLeaderboardMeta] = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [resultsLoading,  setResultsLoading]  = useState(false);
    const [showConfetti,    setShowConfetti]    = useState(false);
    const [animateScores,   setAnimateScores]   = useState(false);
    const [nowTick,         setNowTick]         = useState(Date.now());

    // 🚀 Reaction System States
    const [activeReactionMenu, setActiveReactionMenu] = useState(null);
    const [reactionMenuAnchor, setReactionMenuAnchor] = useState(null);
    const [localReactions, setLocalReactions] = useState({});
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const unlockRefreshRef = useRef(false);

    useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 🚀 REAL-TIME REACTION ENGINE (USING MASTER SOCKET)
    useEffect(() => {
        // Listen for the 'reaction_updated' event from your backend
        const handleReactionUpdate = (data) => {
            setLocalReactions(prev => {
                const current = prev[data.attemptId] || { myReaction: null, counts: {} };
                
                return {
                    ...prev,
                    [data.attemptId]: {
                        ...current,
                        // Instantly sync the global counts with the server's truth
                        counts: data.counts 
                    }
                };
            });
        };

        // Attach the listener using your master socket
        socket.on('reaction_updated', handleReactionUpdate);

        // Cleanup the listener when the component unmounts
        return () => {
            socket.off('reaction_updated', handleReactionUpdate);
        };
    }, []);

    // Keep the reaction tray open long enough for a real click.
    const closeTimeoutRef = useRef(null);

    const handleMenuLeave = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(() => {
            setActiveReactionMenu(null);
            setReactionMenuAnchor(null);
        }, 1200); 
    };

    const openReactionMenu = (entryId, event) => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

        if (event?.currentTarget?.getBoundingClientRect) {
            const rect = event.currentTarget.getBoundingClientRect();
            setReactionMenuAnchor({
                x: rect.left + rect.width / 2,
                y: rect.top - 12,
            });
        }

        setActiveReactionMenu(entryId);
    };

    const toggleReactionMenu = (entryId, event) => {
        if (activeReactionMenu === entryId) {
            setActiveReactionMenu(null);
            setReactionMenuAnchor(null);
            return;
        }

        openReactionMenu(entryId, event);
    };

    // Fetch quiz list
    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setSelectedQuizId(null); 
            try {
                const res = await axios.get(`/student/leaderboards/quizzes/${activeEngine}`);
                setQuizzes(res.data);
                if (res.data.length > 0) setSelectedQuizId(res.data[0].id);
                else {
                    setLeaderboardData([]);
                    setSelfEntry(null);
                    setLeaderboardMeta(null);
                }
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        run();
    }, [activeEngine]);

    // Fetch leaderboard
    useEffect(() => {
        if (!selectedQuizId) return;
        const run = async () => {
            setResultsLoading(true);
            setAnimateScores(false);
            setShowConfetti(false);
            try {
                const res = await axios.get(`/student/leaderboards/results/${activeEngine}/${selectedQuizId}`);
                const payload = res.data;
                const publicRows = Array.isArray(payload) ? payload : (payload?.publicRows || []);
                const privateSelf = Array.isArray(payload)
                    ? publicRows.find((entry) => String(entry.studentId) === String(user?.id)) || null
                    : (payload?.selfRow || null);

                setLeaderboardData(publicRows);
                setSelfEntry(privateSelf);
                setLeaderboardMeta(Array.isArray(payload) ? null : (payload?.meta || null));
                
                // 🚀 REAL DATABASE REACTIONS IMPORT
                const realReactions = {};
                publicRows.forEach(entry => {
                    if (entry.reactions) {
                        realReactions[entry.id] = {
                            myReaction: entry.reactions.myReaction,
                            counts: entry.reactions.counts || {}
                        };
                    } else {
                        realReactions[entry.id] = { myReaction: null, counts: {} };
                    }
                });
                setLocalReactions(realReactions);

                if (publicRows && publicRows.length > 0) {
                    setTimeout(() => {
                        setShowConfetti(true);
                        setAnimateScores(true);
                        setTimeout(() => setShowConfetti(false), 3200);
                    }, 350);
                }
            } catch (e) { console.error(e); }
            setResultsLoading(false);
        };
        run();
    }, [selectedQuizId, activeEngine]);

    const displayData = useMemo(() =>
        leaderboardData.filter(e => filterMode === 'global' || e.studentBatch === user?.batch),
    [leaderboardData, filterMode, user]);

    const totalParticipants = useMemo(() => {
        const metaTotal = Number(leaderboardMeta?.totalRanked);
        if (Number.isFinite(metaTotal) && metaTotal >= 0) return metaTotal;
        return displayData.length;
    }, [leaderboardMeta, displayData.length]);

    const rankedDisplayData = useMemo(() => {
        let currentRank = 0;
        let previousScore = null;
        return displayData.map((entry, idx) => {
            const numericScore = Number(entry.score) || 0;
            if (previousScore === null || numericScore < previousScore) {
                currentRank += 1;
                previousScore = numericScore;
            }
            return {
                ...entry,
                displayRank: currentRank
            };
        });
    }, [displayData]);

    const topThree = rankedDisplayData.slice(0, 3);
    const theRest  = rankedDisplayData.slice(3);

    const myPublicRank = rankedDisplayData.findIndex(e => String(e.studentId) === String(user?.id));
    const myPublicEntry = myPublicRank !== -1 ? rankedDisplayData[myPublicRank] : null;
    const myEntry = selfEntry;

    const isMe       = (entry) => String(entry.studentId) === String(user?.id) || entry.studentName === user?.name;
    const selectedQ  = quizzes.find(q => q.id === selectedQuizId);
    const maxScore   = activeEngine === 'written' ? selectedQ?.totalMarks : selectedQ?.totalQuestions;
    const isPerfect  = (score) => maxScore && score >= maxScore;
    const leaderboardUnlockAt = leaderboardMeta?.unlockAt ? new Date(leaderboardMeta.unlockAt) : null;
    const leaderboardLocked = activeEngine === 'mcq' && Boolean(leaderboardMeta?.isLocked) && leaderboardUnlockAt && nowTick < leaderboardUnlockAt.getTime();
    const remainingMs = leaderboardUnlockAt ? Math.max(0, leaderboardUnlockAt.getTime() - nowTick) : 0;
    const selectedQuizLabel = selectedQ?.title || 'Selected exam';

    useEffect(() => {
        unlockRefreshRef.current = false;
    }, [selectedQuizId, activeEngine]);

    useEffect(() => {
        if (!leaderboardLocked || !leaderboardUnlockAt) return;
        if (remainingMs > 0) return;
        if (unlockRefreshRef.current) return;

        unlockRefreshRef.current = true;
        const reload = async () => {
            try {
                setResultsLoading(true);
                const res = await axios.get(`/student/leaderboards/results/${activeEngine}/${selectedQuizId}`);
                const payload = res.data;
                const publicRows = Array.isArray(payload) ? payload : (payload?.publicRows || []);
                const privateSelf = Array.isArray(payload)
                    ? publicRows.find((entry) => String(entry.studentId) === String(user?.id)) || null
                    : (payload?.selfRow || null);
                setLeaderboardData(publicRows);
                setSelfEntry(privateSelf);
                setLeaderboardMeta(Array.isArray(payload) ? null : (payload?.meta || null));
            } catch (e) {
                console.error(e);
            } finally {
                setResultsLoading(false);
            }
        };

        reload();
    }, [leaderboardLocked, leaderboardUnlockAt, remainingMs, selectedQuizId, activeEngine, user?.id]);

    const scrollToMyRank = () => {
        const el = document.getElementById('my-leaderboard-entry');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalBg = el.style.backgroundColor;
            el.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
            setTimeout(() => { el.style.backgroundColor = originalBg; }, 1500);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // 🚀 REACTION ENGINE LOGIC
    const handleReact = (entryId, reactionId, e) => {
        e.stopPropagation();
        
        const rect = e.currentTarget.getBoundingClientRect();
        const emojiData = REACTIONS.find(r => r.id === reactionId);
        const newFloating = {
            id: Date.now(),
            icon: emojiData.icon,
            x: rect.left + rect.width / 2,
            y: rect.top
        };
        setFloatingEmojis(prev => [...prev, newFloating]);
        setTimeout(() => setFloatingEmojis(prev => prev.filter(f => f.id !== newFloating.id)), 1000);

        setLocalReactions(prev => {
            const current = prev[entryId] || { myReaction: null, counts: {} };
            const newCounts = { ...current.counts };
            let newMyReaction = reactionId;

            if (current.myReaction === reactionId) {
                newMyReaction = null;
                newCounts[reactionId] = Math.max(0, (newCounts[reactionId] || 1) - 1);
            } else {
                if (current.myReaction) {
                    newCounts[current.myReaction] = Math.max(0, (newCounts[current.myReaction] || 1) - 1);
                }
                newCounts[reactionId] = (newCounts[reactionId] || 0) + 1;
            }

            Object.keys(newCounts).forEach(k => { if (newCounts[k] === 0) delete newCounts[k] });

            return { ...prev, [entryId]: { myReaction: newMyReaction, counts: newCounts } };
        });

        setActiveReactionMenu(null);
        setReactionMenuAnchor(null);

        emitStudentActivity(socket, user, {
            page: 'Leaderboard',
            action: 'Reacted on Leaderboard',
            detail: `${reactionId} on ${entryId}`,
            route: '/leaderboard',
            kind: 'social'
        });

        axios.post(`/student/leaderboards/react`, { 
            attemptId: entryId, 
            engineType: activeEngine, 
            reactionId: reactionId 
        }).catch(err => console.error("Failed to save reaction:", err));
    };

    const renderReactionSummary = (entryId) => {
        const data = localReactions[entryId];
        if (!data || !data.counts || Object.keys(data.counts).length === 0) return null;

        const ordered = Object.entries(data.counts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);
        const withMine = data.myReaction && !ordered.includes(data.myReaction)
            ? [...ordered, data.myReaction]
            : ordered;
        const visibleReactions = withMine
            .slice(0, REACTIONS.length)
            .map((id) => REACTIONS.find((r) => r.id === id)?.icon)
            .filter(Boolean);

        const totalCount = Object.values(data.counts).reduce((a, b) => a + b, 0);

        return (
            <div className="absolute -bottom-3 right-4 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 flex items-center gap-1 shadow-lg z-20 hover:scale-110 transition-transform cursor-pointer" onClick={(e) => toggleReactionMenu(entryId, e)}>
                <div className="flex -space-x-1">
                    {visibleReactions.map((icon, i) => (
                        <span key={i} className="text-[10px] md:text-xs drop-shadow-md bg-slate-800 rounded-full">{icon}</span>
                    ))}
                </div>
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 ml-1">{totalCount}</span>
            </div>
        );
    };

    // 🚀 THE FACEBOOK-STYLE BUBBLE MENU (ULTRA-MOBILE SAFE GRID)
    // ── Podium card factory (🚀 CLEAN UI + MOBILE OVERFLOW FIX) ──
    const renderPodiumCard = (entry, rank, delay) => {
        const isFirst  = rank === 1;
        const me       = isMe(entry);
        
        const ringColor = me
            ? 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)]'
            : rank === 1 ? 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.4)]'
            : rank === 2 ? 'border-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.2)]'
            : 'border-orange-700 shadow-[0_0_20px_rgba(194,65,12,0.2)]';
            
        const badgeBg   = rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-slate-900 w-8 h-8 md:w-10 md:h-10 text-base md:text-lg border-2 md:border-4'
                        : rank === 2 ? 'bg-slate-200 text-slate-900 w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm border-2'
                        : 'bg-orange-700 text-white w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm border-2';
                        
        const avatarSz  = isFirst ? 'w-20 h-20 md:w-28 md:h-28' : 'w-14 h-14 md:w-20 md:h-20';
        
        const scoreClr  = isFirst ? 'text-3xl md:text-5xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                        : rank === 2 ? 'text-xl md:text-3xl text-slate-300' 
                        : 'text-xl md:text-3xl text-orange-400';

        // Reverting to the clean backgrounds
        const bgClass = isFirst 
            ? 'bg-gradient-to-b from-yellow-500/20 to-slate-900 border-yellow-500/50 shadow-[0_0_40px_rgba(245,158,11,0.15)]'
            : me 
                ? 'bg-blue-900/30 border-blue-500/40'
                : 'bg-slate-800/80 border-slate-700/50';

        return (
            <motion.div
                id={me ? 'my-leaderboard-entry' : undefined}
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay }} 
                // 🔥 FIX: Dynamically jump to z-[100] when the menu is active so adjacent cards don't steal the mouse!
                className={`flex flex-col items-center w-full relative ${activeReactionMenu === entry.id ? 'z-[100]' : 'z-10'}`}
            >
                <div className="relative mb-3 md:mb-4 cursor-pointer z-30" onClick={(e) => toggleReactionMenu(entry.id, e)}>
                    {isFirst && <Crown className="absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 text-yellow-400 w-10 h-10 md:w-12 md:h-12 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] z-20" />}
                    
                    <div className={`${avatarSz} rounded-full border-[3px] md:border-4 bg-slate-800 overflow-hidden relative z-10 ${ringColor}`}>
                        <Avatar src={normalizeAvatarPath(entry.avatar)} size={isFirst ? 'lg' : 'md'} />
                    </div>
                    
                    <div className={`absolute -bottom-2 -right-2 md:-bottom-3 md:-right-3 rounded-full flex items-center justify-center font-black border-slate-900 shadow-xl z-20 ${badgeBg}`}>{rank}</div>
                </div>

                {/* Container structure kept intact to prevent mobile clipping */}
                <div className="w-full text-center relative p-3 md:p-5 md:pb-8">
                    
                    {/* The Background Layer */}
                    <div className={`absolute inset-0 rounded-2xl md:rounded-t-3xl md:rounded-b-xl border overflow-hidden pointer-events-none ${bgClass}`}>
                        {isFirst && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />}
                    </div>

                    <div className="relative z-20 pointer-events-none">
                        <h3 className={`font-black truncate px-1 md:px-2 ${isFirst ? (me ? 'text-blue-400 text-lg md:text-xl' : 'text-yellow-500 text-lg md:text-xl') : me ? 'text-blue-300 text-sm md:text-base' : 'text-white text-sm md:text-base'}`}>
                            {me ? 'You' : entry.studentName}
                        </h3>
                        <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-1 mb-2 md:mb-3 ${isFirst ? 'text-yellow-500/70' : 'text-slate-400'}`}>
                            {entry.studentBatch}
                        </p>
                        <ScoreCount value={entry.score} trigger={animateScores} className={`font-black drop-shadow-md block ${scoreClr}`} />
                        {isPerfect(entry.score) && <div className="mt-1 md:mt-2 text-[9px] md:text-xs font-black text-orange-400 flex items-center justify-center gap-1">🔥 PERFECT</div>}
                    </div>
                    
                    {renderReactionSummary(entry.id)}
                </div>
            </motion.div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="h-[100dvh] w-full bg-[#020617] text-white font-sans flex flex-col overflow-hidden relative">
            <Confetti show={showConfetti} />

            {floatingEmojis.map(emoji => (
                <motion.div
                    key={emoji.id}
                    initial={{ opacity: 1, y: 0, scale: 0.5, x: '-50%' }}
                    animate={{ opacity: 0, y: -150, scale: 2, x: '-50%' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="fixed pointer-events-none z-[100] text-4xl drop-shadow-2xl"
                    style={{ left: emoji.x, top: emoji.y }}
                >
                    {emoji.icon}
                </motion.div>
            ))}

            {/* HEADER */}
            <div className="p-4 md:p-6 lg:px-10 border-b border-slate-800 bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 z-50 shadow-2xl shrink-0">
                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
                    <button onClick={() => router.push('/student/dashboard')} className="p-2.5 md:p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all shrink-0">
                        <ArrowLeft size={18} className="text-slate-400" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl md:text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 flex items-center gap-2 md:gap-3 truncate">
                            <Trophy className="text-amber-500 shrink-0" size={24} /> Leaderboard
                        </h1>
                        <p className="text-slate-400 text-[10px] md:text-sm mt-0.5 md:mt-1 font-medium tracking-wide truncate">Compete with the best. Secure your crown.</p>
                    </div>
                </div>
                
                <div className="flex bg-slate-900 p-1.5 rounded-xl md:rounded-2xl border border-slate-800 shadow-inner w-full md:w-auto overflow-x-auto shrink-0 custom-scrollbar hide-scroll-mobile">
                    <button onClick={() => { setActiveEngine('mcq'); emitStudentActivity(socket, user, { page: 'Leaderboard', action: 'Switched Leaderboard Engine', detail: 'MCQ', route: '/leaderboard', kind: 'navigation' }); }} className={`flex-1 flex justify-center items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black transition-all text-[10px] md:text-xs uppercase tracking-widest whitespace-nowrap ${activeEngine === 'mcq' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                        <Zap size={14} /> MCQ Matrix
                    </button>
                    <button onClick={() => { setActiveEngine('written'); emitStudentActivity(socket, user, { page: 'Leaderboard', action: 'Switched Leaderboard Engine', detail: 'Written', route: '/leaderboard', kind: 'navigation' }); }} className={`flex-1 flex justify-center items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black transition-all text-[10px] md:text-xs uppercase tracking-widest whitespace-nowrap ${activeEngine === 'written' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                        <PenTool size={14} /> Written Papers
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

                {/* LEFT PANEL / EXAM STRIP */}
                <div className="w-full lg:w-80 bg-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0 z-40 backdrop-blur-sm shadow-xl overflow-hidden">
                    <div className="hidden lg:block p-5 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Select Exam</h3>
                                        {totalParticipants > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <Users size={12} className="text-amber-500" />
                                                <span className="text-[11px] text-amber-500/70 font-bold">{totalParticipants} participants</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-y-auto custom-scrollbar p-3 lg:p-4 gap-3 w-full lg:flex-1">
                        {loading ? (
                            <div className="flex justify-center w-full py-6 lg:py-10"><Loader2 className="animate-spin text-amber-500 w-6 h-6 lg:w-8 lg:h-8" /></div>
                        ) : quizzes.length === 0 ? (
                            <p className="text-center text-slate-600 text-xs lg:text-sm py-6 lg:py-10 font-medium italic w-full">No exams found.</p>
                        ) : quizzes.map(quiz => (
                            <button key={quiz.id} onClick={() => setSelectedQuizId(quiz.id)}
                                className={`min-w-[160px] sm:min-w-[200px] lg:min-w-0 lg:max-w-none w-full text-left p-3 lg:p-4 rounded-xl transition-all flex items-center justify-between border shrink-0 ${
                                    selectedQuizId === quiz.id
                                    ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                                    : 'bg-slate-900/50 border-transparent hover:bg-slate-800'
                                }`}
                            >
                                <div className="truncate pr-2 w-full">
                                    <p className={`font-black text-xs lg:text-sm truncate ${selectedQuizId === quiz.id ? 'text-amber-500' : 'text-slate-300'}`}>{quiz.title}</p>
                                    <p className="text-[9px] lg:text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
                                        {activeEngine === 'mcq' ? `${quiz.totalQuestions} Qs` : `${quiz.totalMarks} Marks`}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT PANEL - LEADERBOARD */}
                <div className="flex-1 bg-slate-900 relative overflow-y-auto custom-scrollbar flex flex-col w-full">

                    {/* FILTER TOGGLE STICKY */}
                    <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 p-3 md:p-4 flex justify-center">
                        <div className="flex bg-slate-950 p-1.5 rounded-full border border-slate-800 shadow-inner">
                            <button onClick={() => { setFilterMode('global'); emitStudentActivity(socket, user, { page: 'Leaderboard', action: 'Changed Leaderboard Filter', detail: 'Global', route: '/leaderboard', kind: 'navigation' }); }} className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest ${filterMode === 'global' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-500 hover:text-white'}`}>
                                <Globe size={14} /> Global
                            </button>
                            <button onClick={() => { setFilterMode('batch'); emitStudentActivity(socket, user, { page: 'Leaderboard', action: 'Changed Leaderboard Filter', detail: 'Batch', route: '/leaderboard', kind: 'navigation' }); }} className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all text-[10px] md:text-xs uppercase tracking-widest ${filterMode === 'batch' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>
                                <Users size={14} /> My Batch
                            </button>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 lg:p-10 max-w-5xl mx-auto w-full flex-1 pb-40">
                        {leaderboardLocked ? (
                            <div className="space-y-5 md:space-y-6">
                                <BigCountdown
                                    targetDate={leaderboardUnlockAt}
                                    title={selectedQuizLabel}
                                    subtitle="Results stay hidden until the exam is fully over. The board unlocks automatically the moment the timer reaches zero."
                                />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                                        <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300 font-black">Status</p>
                                        <p className="mt-2 text-2xl font-black text-white">Locked</p>
                                        <p className="mt-1 text-sm text-slate-300">Only the countdown is visible until unlock.</p>
                                    </motion.div>
                                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                                        <p className="text-[10px] uppercase tracking-[0.35em] text-fuchsia-300 font-black">Unlock Time</p>
                                        <p className="mt-2 text-2xl font-black text-white">{leaderboardUnlockAt ? leaderboardUnlockAt.toLocaleString() : 'Pending'}</p>
                                        <p className="mt-1 text-sm text-slate-300">Controlled by the server exam end time.</p>
                                    </motion.div>
                                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                                        <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300 font-black">Refresh</p>
                                        <p className="mt-2 text-2xl font-black text-white">Auto</p>
                                        <p className="mt-1 text-sm text-slate-300">It refreshes itself when the lock expires.</p>
                                    </motion.div>
                                </div>
                            </div>
                        ) : resultsLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 lg:py-40 h-full">
                                <Loader2 className="animate-spin text-amber-500 w-12 h-12 lg:w-16 lg:h-16 mb-4" />
                                <p className="text-amber-500/50 font-bold uppercase tracking-widest text-xs lg:text-sm animate-pulse">Calculating Matrix...</p>
                            </div>
                        ) : displayData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 lg:py-40 h-full text-slate-600">
                                <Trophy size={48} className="mb-4 opacity-20 lg:w-16 lg:h-16" />
                                <p className="font-bold uppercase tracking-widest text-xs lg:text-sm">No scores recorded yet.</p>
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 md:space-y-12 pb-10">

                                {/* ── RESPONSIVE PODIUM ── */}
                                <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-4 md:gap-6 pt-6 md:pt-10">
                                    <div className="w-full max-w-[260px] md:max-w-none md:w-1/3 order-1 md:order-2 z-10 md:-translate-y-8">
                                        {topThree[0] && renderPodiumCard(topThree[0], topThree[0].displayRank, 0.1)}
                                    </div>
                                    <div className="w-full flex flex-row md:contents gap-4 order-2 md:order-none justify-center px-2">
                                        <div className="w-1/2 max-w-[160px] md:max-w-none md:w-1/3 order-2 md:order-1">
                                            {topThree[1] ? renderPodiumCard(topThree[1], topThree[1].displayRank, 0.2) : <div className="hidden md:block h-32" />}
                                        </div>
                                        <div className="w-1/2 max-w-[160px] md:max-w-none md:w-1/3 order-3">
                                            {topThree[2] ? renderPodiumCard(topThree[2], topThree[2].displayRank, 0.3) : <div className="hidden md:block h-32" />}
                                        </div>
                                    </div>
                                </div>

                                {/* ── REST OF THE LIST (4th+) ── */}
                                {theRest.length > 0 && (
                                    <div className="space-y-3 mt-8 md:mt-10">
                                        <div className="flex items-center gap-3 mb-4 md:mb-5">
                                            <div className="flex-1 h-px bg-slate-800" />
                                            <span className="text-slate-600 text-[10px] md:text-xs font-bold uppercase tracking-widest">{leaderboardMeta?.label || 'Top 10'}</span>
                                            <div className="flex-1 h-px bg-slate-800" />
                                        </div>
                                        {theRest.map((entry, idx) => (
                                            <motion.div
                                                key={entry.id}
                                                id={isMe(entry) ? 'my-leaderboard-entry' : undefined}
                                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + idx * 0.04 }}
                                                // 🔥 FIX: Added dynamic z-[100] here too!
                                                className={`relative flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-500 overflow-visible ${activeReactionMenu === entry.id ? 'z-[100]' : 'z-10'} ${
                                                    isMe(entry) ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.15)]'
                                                                : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 md:gap-5 min-w-0 pr-2">
                                                    <div className={`w-8 md:w-10 text-center font-black text-sm md:text-lg shrink-0 ${isMe(entry) ? 'text-blue-400' : 'text-slate-500'}`}>#{entry.displayRank}</div>
                                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden shrink-0 border ${isMe(entry) ? 'border-blue-500/50' : 'border-slate-700'}`}>
                                                        <Avatar src={normalizeAvatarPath(entry.avatar)} size="sm" />
                                                    </div>
                                                    <div className="truncate">
                                                        <h4 className={`font-bold text-sm md:text-base flex items-center gap-2 truncate ${isMe(entry) ? 'text-blue-400' : 'text-slate-200'}`}>
                                                            {isMe(entry) ? 'You' : entry.studentName}
                                                            {isMe(entry) && <span className="hidden sm:inline-flex text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">You</span>}
                                                        </h4>
                                                        <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{entry.studentBatch}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 md:gap-4 shrink-0 pl-2">
                                                    
                                                    {/* Reaction Button (Mobile Tap / Desktop Hover) */}
                                                    <button onClick={(e) => toggleReactionMenu(entry.id, e)} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors">
                                                        {localReactions[entry.id]?.myReaction ? (
                                                            <span className="text-sm md:text-lg">{REACTIONS.find(r => r.id === localReactions[entry.id].myReaction)?.icon}</span>
                                                        ) : (
                                                            <Plus size={16} className="text-slate-400" />
                                                        )}
                                                    </button>
                                                    
                                                    {isPerfect(entry.score) && <Flame size={14} className="text-orange-400 hidden sm:block" />}
                                                    <div className={`text-xl md:text-2xl font-black w-10 text-right ${isMe(entry) ? 'text-blue-300' : 'text-white'}`}>{entry.score}</div>
                                                </div>

                                                {renderReactionSummary(entry.id)}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {activeReactionMenu && reactionMenuAnchor && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    <motion.div
                        key={activeReactionMenu}
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="fixed z-[99999]"
                        style={{ left: reactionMenuAnchor.x, top: reactionMenuAnchor.y, transform: 'translate(-50%, -100%)' }}
                        onMouseEnter={() => {
                            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                        }}
                        onMouseLeave={handleMenuLeave}
                    >
                        <div className="bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl md:rounded-full p-2 grid grid-cols-3 md:flex md:flex-nowrap gap-1 md:gap-2 w-max pointer-events-auto">
                            {REACTIONS.map((reaction, i) => (
                                <motion.button
                                    key={reaction.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    onClick={(e) => handleReact(activeReactionMenu, reaction.id, e)}
                                    className={`w-8 h-8 md:w-10 md:h-10 text-lg md:text-2xl hover:scale-125 origin-bottom transition-transform duration-200 relative group flex justify-center items-center ${localReactions[activeReactionMenu]?.myReaction === reaction.id ? 'scale-110 bg-slate-800 rounded-full' : ''}`}
                                >
                                    {reaction.icon}
                                    <span className="absolute -top-8 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                        {reaction.name}
                                    </span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}

            {/* ── YOUR RANK STICKY FOOTER ── */}
            {myEntry && !resultsLoading && (
                <motion.div
                    initial={{ y: 80 }} animate={{ y: 0 }}
                    onClick={scrollToMyRank}
                    className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/95 backdrop-blur-xl border-t border-blue-500/30 p-3 shadow-[0_-10px_40px_rgba(37,99,235,0.15)] cursor-pointer hover:bg-slate-900 transition-colors"
                >
                    <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 md:gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-blue-400 shrink-0" />
                            <span className="text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-widest">Your Standing</span>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-500/40"><Avatar src={normalizeAvatarPath(myEntry.avatar)} size="sm" /></div>
                                <span className="text-white font-bold text-xs md:text-sm">You</span>
                            </div>
                            <div className="bg-blue-500/20 border border-blue-500/40 px-3 md:px-4 py-1 md:py-1.5 rounded-full">
                                <span className="text-blue-300 font-black text-xs md:text-sm">#{myEntry.rank || '-'}</span>
                            </div>
                            <div className="text-white font-black text-base md:text-lg">{myEntry.score}</div>
                            {!leaderboardMeta?.selfIsPublic && <div className="text-slate-400 text-[10px] md:text-xs font-bold hidden md:block">Private view: below public cutoff</div>}
                            {myEntry.rank === 1 && <div className="text-amber-400 text-[10px] md:text-xs font-black">👑 TOP OF THE BOARD</div>}
                            {myPublicEntry && myPublicRank > 0 && <div className="text-slate-400 text-[10px] md:text-xs font-bold hidden md:block">{rankedDisplayData[myPublicRank - 1].score - myPublicEntry.score} pts to reach #{myPublicEntry.displayRank - 1}</div>}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Reverted CSS block without the liquid animations */}
            <style dangerouslySetInnerHTML={{__html:`
                .custom-scrollbar::-webkit-scrollbar{width:6px; height:6px;}
                .custom-scrollbar::-webkit-scrollbar-track{background:transparent}
                .custom-scrollbar::-webkit-scrollbar-thumb{background:#1e293b;border-radius:10px}
                .custom-scrollbar::-webkit-scrollbar-thumb:hover{background:#dc2626}
                .hide-scroll-mobile::-webkit-scrollbar{display:none;}
                .hide-scroll-mobile { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes confettiFall{ 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(105vh) rotate(720deg);opacity:0} }
            `}} />
        </div>
    );
}