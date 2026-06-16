'use client';
import { socket } from '@/lib/socket';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { normalizeAvatarPath } from '@/lib/utils';
import { 
    Shield, ShieldAlert, ShieldCheck, Clock, Users, Activity, 
    Radio, ActivitySquare, UserCircle, Bot, PowerOff, Pin, PinOff, Send, X,
    ImagePlus, Link as LinkIcon, ToggleLeft, ToggleRight, Type, Bell, Mail // 🚀 ADDED THESE
} from 'lucide-react';
import StatsCard from '@/components/admin/StatsCard';
import { motion, AnimatePresence } from 'framer-motion';

const PINNED_IDS_STORAGE_KEY = 'sft_radar_pinned_ids_v1';
const PINNED_SNAPSHOTS_STORAGE_KEY = 'sft_radar_pinned_snapshots_v1';
const ALERT_STATUS_TTL_MS = 120000;

export default function AdminDashboard() {
    const { user } = useAuth();
    const { maintenanceMode } = useSocket();
    const [stats, setStats] = useState({ total: 0, active: 0, pendingReqs: 0 });
    const [onlineCount, setOnlineCount] = useState(0); 
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);

    // ✅ NEW: Radar State
    const [activeSessions, setActiveSessions] = useState([]);
    const [pinnedIds, setPinnedIds] = useState([]);
    const [pinnedSnapshots, setPinnedSnapshots] = useState({});
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertPriority, setAlertPriority] = useState('high');
    const [sendingAlert, setSendingAlert] = useState(false);
    const [alertFeedback, setAlertFeedback] = useState({ type: '', text: '' });
    const [alertStatusByUser, setAlertStatusByUser] = useState({});

    const [notificationSettings, setNotificationSettings] = useState({ emailEnabled: true, pushEnabled: true });
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const [notificationBusy, setNotificationBusy] = useState(false);


    // ================= EVENT POSTER STATE =================
    const [posterFile, setPosterFile] = useState(null);
    const [posterTitle, setPosterTitle] = useState('');
    const [posterLink, setPosterLink] = useState('');
    const [posterBatch, setPosterBatch] = useState('All');
    const [availableBatches, setAvailableBatches] = useState(['All']);
    const [isUploadingPoster, setIsUploadingPoster] = useState(false);
    const [activePoster, setActivePoster] = useState(null);

    // Fetch poster and batches on load
    useEffect(() => {
        const fetchPosterData = async () => {
            try {
                // Fetch posters
                const res = await axios.get('/admin/event-posters');
                const posters = res.data;
                const active = posters.find(p => p.isActive);
                if (active) setActivePoster(active);

                // Fetch batches (Adjust the endpoint if your batch API route is different!)
                try {
                    const batchRes = await axios.get('/admin/batches'); 
                    if (batchRes.data && Array.isArray(batchRes.data)) {
                        setAvailableBatches(['All', ...batchRes.data.map(b => b.name || b.year || b)]);
                    }
                } catch (e) {
                    // Fallback dummy batches if API fails/doesn't exist yet
                    setAvailableBatches(['All', '2024', '2025', '2026']); 
                }
            } catch (error) {
                console.error("Poster fetch error:", error);
            }
        };
        fetchPosterData();
    }, []);

    const handleUploadPoster = async (e) => {
        e.preventDefault();
        if (!posterFile) return alert("Please select an image file!");
        setIsUploadingPoster(true);

        const formData = new FormData();
        formData.append('posterImage', posterFile);
        formData.append('title', posterTitle);
        formData.append('link', posterLink);
        formData.append('batch', posterBatch);
        formData.append('isActive', true); // Makes it instantly active

        try {
            const res = await axios.post('/admin/event-poster', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setActivePoster(res.data.poster);
            setPosterFile(null);
            setPosterTitle('');
            setPosterLink('');
            alert("Poster deployed successfully!");
        } catch (error) {
            console.error(error);
            alert("Upload failed. Check console.");
        } finally {
            setIsUploadingPoster(false);
        }
    };

    const togglePosterVisibility = async () => {
        if (!activePoster) return alert("No active poster to toggle!");
        try {
            const newStatus = !activePoster.isActive;
            await axios.put(`/admin/event-poster/${activePoster.id}/toggle`, { isActive: newStatus });
            setActivePoster({ ...activePoster, isActive: newStatus });
        } catch (error) {
            alert("Failed to toggle visibility.");
        }
    };

    // 👑 AI KILL SWITCH STATE
    const [aiEnabled, setAiEnabled] = useState(true);

    const toggleAiChat = async () => {
        if (!confirm(aiEnabled ? "⚠️ KILL SFT KING AI? This hides it from all students instantly!" : "👑 AWAKEN THE AI?")) return;
        try {
            const res = await axios.post('/settings/toggle-ai-chat');
            setAiEnabled(res.data.enabled);
        } catch (e) { console.error("Toggle Failed"); }
    };

    const refreshNotificationSettings = async () => {
        try {
            const res = await axios.get('/settings/notifications');
            setNotificationSettings({
                emailEnabled: !!res.data?.emailEnabled,
                pushEnabled: !!res.data?.pushEnabled
            });
        } catch (e) {}
    };

    const toggleNotificationSetting = async (mode) => {
        if (notificationBusy) return;
        setNotificationBusy(true);
        try {
            const res = await axios.post('/settings/notifications', { mode });
            setNotificationSettings({
                emailEnabled: !!res.data?.emailEnabled,
                pushEnabled: !!res.data?.pushEnabled
            });
        } catch (e) {
            alert("Failed to update notification settings");
        } finally {
            setNotificationBusy(false);
        }
    };

    useEffect(() => {
        try {
            const rawIds = window.localStorage.getItem(PINNED_IDS_STORAGE_KEY);
            const rawSnapshots = window.localStorage.getItem(PINNED_SNAPSHOTS_STORAGE_KEY);

            if (rawIds) {
                const parsed = JSON.parse(rawIds);
                if (Array.isArray(parsed)) {
                    setPinnedIds(parsed.map((id) => String(id)));
                }
            }

            if (rawSnapshots) {
                const parsed = JSON.parse(rawSnapshots);
                if (parsed && typeof parsed === 'object') {
                    setPinnedSnapshots(parsed);
                }
            }
        } catch (e) {
            console.warn('Failed to load radar pins:', e?.message || e);
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(PINNED_IDS_STORAGE_KEY, JSON.stringify(pinnedIds));
        } catch {}
    }, [pinnedIds]);

    useEffect(() => {
        try {
            window.localStorage.setItem(PINNED_SNAPSHOTS_STORAGE_KEY, JSON.stringify(pinnedSnapshots));
        } catch {}
    }, [pinnedSnapshots]);

    useEffect(() => {
        const cleanup = setInterval(() => {
            setAlertStatusByUser((prev) => {
                const now = Date.now();
                const next = Object.entries(prev).reduce((acc, [userId, status]) => {
                    const at = Number(status?.at || 0);
                    if (at && now - at <= ALERT_STATUS_TTL_MS) {
                        acc[userId] = status;
                    }
                    return acc;
                }, {});

                if (Object.keys(next).length === Object.keys(prev).length) return prev;
                return next;
            });
        }, 15000);

        return () => clearInterval(cleanup);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await axios.get('/admin/stats');
                setStats(res.data);
                setOnlineCount(res.data.onlineNow || 0); 
                setLoading(false);
            } catch (e) {}
        };
        loadData();
        
        // --- REAL-TIME LISTENERS ---
        const handleRefresh = () => loadData();
        
        socket.on('new_request_received', handleRefresh); 
        // Fetch AI Status on load
        axios.get('/settings/ai-chat').then(res => setAiEnabled(res.data.enabled)).catch(() => {});
        refreshNotificationSettings();
        // Listen for live AI toggle updates
        socket.on('ai_chat_update', (data) => setAiEnabled(data.enabled));
        socket.on('notifications_settings_update', (data) => {
            setNotificationSettings({
                emailEnabled: !!data?.emailEnabled,
                pushEnabled: !!data?.pushEnabled
            });
        });
        socket.on('student_list_updated', handleRefresh); 
        
        socket.on('online_count_update', (count) => {
            setOnlineCount(count); 
        });

        const handleGodAlertDispatch = (status) => {
            const targetId = String(status?.targetUserId || '');
            const senderAdmin = String(status?.adminId || '');
            const alertId = String(status?.alertId || '');
            if (!selectedStudent) return;
            if (senderAdmin && senderAdmin !== String(user?.id || '')) return;
            if (targetId !== String(selectedStudent.userId || '')) return;
            setSendingAlert(false);
            setAlertFeedback({ type: 'success', text: 'Alert delivered successfully.' });
            setAlertStatusByUser((prev) => ({
                ...prev,
                [targetId]: {
                    status: 'delivered',
                    alertId,
                    at: Date.now()
                }
            }));
            setTimeout(() => {
                setAlertModalOpen(false);
                setSelectedStudent(null);
                setAlertMessage('');
                setAlertFeedback({ type: '', text: '' });
            }, 500);
        };

        const handleGodAlertError = (err) => {
            setSendingAlert(false);
            setAlertFeedback({ type: 'error', text: err?.message || 'Failed to send alert.' });
        };

        const handleGodAlertSeen = (status) => {
            const targetId = String(status?.targetUserId || '');
            const alertId = String(status?.alertId || '');
            if (!targetId || !alertId) return;

            setAlertStatusByUser((prev) => {
                const current = prev[targetId];
                if (!current) return prev;
                if (current.alertId && current.alertId !== alertId) return prev;

                return {
                    ...prev,
                    [targetId]: {
                        status: 'seen',
                        alertId,
                        at: Date.now()
                    }
                };
            });
        };

        socket.on('god_alert_dispatch_status', handleGodAlertDispatch);
        socket.on('god_alert_error', handleGodAlertError);
        socket.on('god_alert_seen', handleGodAlertSeen);

        // ✅ NEW: Radar Listener
        socket.on('active_sessions_update', (sessions) => {
            // Keep server order stable so newly joined sessions appear at the bottom.
            const nextSessions = Array.isArray(sessions) ? sessions : [];
            setActiveSessions(nextSessions);

            setPinnedSnapshots((prev) => {
                const updated = { ...prev };
                let changed = false;

                for (const session of nextSessions) {
                    const userId = String(session?.userId || '');
                    if (!userId || !pinnedIds.includes(userId)) continue;
                    const snapshot = {
                        ...session,
                        userId,
                        offline: false,
                        lastSeen: session?.time || Date.now(),
                    };
                    updated[userId] = snapshot;
                    changed = true;
                }

                return changed ? updated : prev;
            });
        });

        // Request an immediate radar update when mounting
        socket.emit('i_am_here', { role: 'admin' });

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        return () => {
            clearInterval(timer);
            socket.off('new_request_received', handleRefresh);
            socket.off('student_list_updated', handleRefresh);
            socket.off('online_count_update');
            socket.off('active_sessions_update');
            socket.off('god_alert_dispatch_status', handleGodAlertDispatch);
            socket.off('god_alert_error', handleGodAlertError);
            socket.off('god_alert_seen', handleGodAlertSeen);
            socket.off('notifications_settings_update');
        };
    }, [pinnedIds, selectedStudent, user?.id]);

    const togglePinStudent = (session) => {
        const userId = String(session?.userId || '');
        if (!userId) return;

        const isAlreadyPinned = pinnedIds.includes(userId);
        if (isAlreadyPinned) {
            setPinnedIds((prev) => prev.filter((id) => id !== userId));
            setPinnedSnapshots((prev) => {
                const updated = { ...prev };
                delete updated[userId];
                return updated;
            });
            return;
        }

        setPinnedIds((prev) => [...prev, userId]);
        setPinnedSnapshots((prev) => ({
            ...prev,
            [userId]: {
                ...session,
                userId,
                offline: false,
                lastSeen: session?.time || Date.now(),
            },
        }));
    };

    const activeByUserId = new Map(
        activeSessions.map((session) => [String(session?.userId || ''), session])
    );

    const pinnedRows = pinnedIds
        .map((id) => {
            const live = activeByUserId.get(String(id));
            if (live) {
                return {
                    ...live,
                    userId: String(id),
                    pinned: true,
                    offline: false,
                    lastSeen: live?.time || Date.now(),
                };
            }

            const snapshot = pinnedSnapshots[String(id)] || {};
            return {
                ...snapshot,
                userId: String(id),
                sessionId: snapshot?.sessionId || `offline-${id}`,
                name: snapshot?.name || `Student #${id}`,
                pinned: true,
                offline: true,
                lastSeen: snapshot?.lastSeen || snapshot?.time || Date.now(),
                time: snapshot?.time || Date.now(),
            };
        })
        .filter(Boolean);

    const unpinnedLiveRows = activeSessions
        .filter((session) => !pinnedIds.includes(String(session?.userId || '')))
        .map((session) => ({ ...session, pinned: false, offline: false }));

    const radarRows = [...pinnedRows, ...unpinnedLiveRows];

    const toggleMaintenance = async () => {
        if (!confirm(maintenanceMode ? "Disable Maintenance?" : "ENABLE LOCKDOWN?")) return;
        await axios.post('/settings/toggle-maintenance');
    };

    const openAlertComposer = (session) => {
        setSelectedStudent(session);
        setAlertMessage('');
        setAlertPriority('high');
        setAlertFeedback({ type: '', text: '' });
        setAlertModalOpen(true);
    };

    const closeAlertComposer = () => {
        if (sendingAlert) return;
        setAlertModalOpen(false);
        setSelectedStudent(null);
        setAlertMessage('');
        setAlertFeedback({ type: '', text: '' });
    };

    const sendGodAlert = () => {
        const adminId = user?.id;
        const targetUserId = selectedStudent?.userId;
        const message = alertMessage.trim();

        if (!adminId || !targetUserId) {
            setAlertFeedback({ type: 'error', text: 'Missing admin or target student.' });
            return;
        }
        if (!message) {
            setAlertFeedback({ type: 'error', text: 'Please write a message first.' });
            return;
        }

        setSendingAlert(true);
        setAlertFeedback({ type: '', text: '' });
        setAlertStatusByUser((prev) => ({
            ...prev,
            [String(targetUserId)]: {
                status: 'pending',
                alertId: prev[String(targetUserId)]?.alertId || '',
                at: Date.now()
            }
        }));

        socket.emit('send_god_alert', {
            adminId,
            targetUserId,
            message,
            priority: alertPriority
        });

        setTimeout(() => {
            setSendingAlert((prev) => {
                if (!prev) return prev;
                setAlertFeedback({ type: 'error', text: 'No confirmation received. Please retry.' });
                setAlertStatusByUser((statusPrev) => ({
                    ...statusPrev,
                    [String(targetUserId)]: {
                        status: 'failed',
                        alertId: statusPrev[String(targetUserId)]?.alertId || '',
                        at: Date.now()
                    }
                }));
                return false;
            });
        }, 5000);
    };

    const notificationsAnyEnabled = notificationSettings.emailEnabled || notificationSettings.pushEnabled;
    const notificationsBothEnabled = notificationSettings.emailEnabled && notificationSettings.pushEnabled;

    return (
        <div className="space-y-8 font-sans pb-10 transition-colors duration-300">
            
            {/* Header */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className={`flex items-center gap-2 px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${!loading ? 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 text-green-600 dark:text-green-400' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500'}`}>
                    {loading ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>} 
                    {loading ? "Syncing..." : "Systems Optimized"}
                </div>
                <button
                    onClick={() => setNotificationModalOpen(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors duration-300 ${notificationsAnyEnabled ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}`}
                >
                    <Bell size={12} />
                    {notificationsAnyEnabled ? 'Notifications On' : 'Notifications Off'}
                    {notificationsAnyEnabled ? <ToggleRight size={16} className="animate-pulse" /> : <ToggleLeft size={16} />}
                </button>
                <div className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase shadow-sm transition-colors duration-300">
                    <Clock size={12} className="text-red-500 dark:text-red-400" /> 
                    <span className="font-mono tabular-nums">{currentTime.toLocaleTimeString()}</span>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. LIVE STUDENTS CARD */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[30px] border border-red-100 dark:border-red-900/30 shadow-xl shadow-red-50 dark:shadow-red-900/10 relative overflow-hidden group transition-colors duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5 group-hover:opacity-20 dark:group-hover:opacity-10 transition-opacity">
                        <Radio size={80} className="text-red-600 dark:text-red-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 animate-ping"></div>
                        <span className="text-[10px] font-black text-red-500 dark:text-red-400 uppercase tracking-widest">Live Now</span>
                    </div>
                    <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter mb-1 transition-colors duration-300">
                        {onlineCount}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide transition-colors duration-300">Students Online</p>
                </div>

                {/* 2. TOTAL STUDENTS */}
                <StatsCard 
                    label="Total Students" 
                    value={stats.total} 
                    icon={<Users size={24}/>}
                    subValue={`${stats.active} Active Accounts`}
                />

                {/* 3. PENDING REQUESTS */}
                <StatsCard 
                    label="Pending Approvals" 
                    value={stats.pendingReqs} 
                    icon={<Activity size={24}/>}
                    color="amber"
                />
            </div>

            {/* ✅ COMMAND CENTER ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT: THE RADAR (Spans 2 columns) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[30px] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-[400px] transition-colors duration-300">
                    {/* Radar Header */}
                    <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 flex items-center justify-between shrink-0 transition-colors duration-300">
                        <div className="flex items-center gap-3">
                            <ActivitySquare className="text-red-500 dark:text-red-500" size={20} />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">God-Mode Radar</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking Active Sessions</span>
                        </div>
                    </div>

                    {/* Radar Feed */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
                        {radarRows.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 dark:opacity-30">
                                <Radio size={48} className="text-slate-400 dark:text-slate-500 mb-3" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Radar is clear</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">No students currently online</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence>
                                    {radarRows.map((session) => {
                                        const telemetry = alertStatusByUser[String(session?.userId || '')] || null;
                                        const telemetryLabel = telemetry?.status === 'seen'
                                            ? 'Seen'
                                            : telemetry?.status === 'delivered'
                                                ? 'Delivered'
                                                : telemetry?.status === 'pending'
                                                    ? 'Sending'
                                                    : telemetry?.status === 'failed'
                                                        ? 'Failed'
                                                        : '';
                                        const telemetryClass = telemetry?.status === 'seen'
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                                            : telemetry?.status === 'delivered'
                                                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300'
                                                : telemetry?.status === 'pending'
                                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
                                                    : telemetry?.status === 'failed'
                                                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300'
                                                        : '';
                                        const telemetryAt = telemetry?.at ? new Date(telemetry.at).toLocaleTimeString() : '';
                                        const telemetryTitle = telemetryLabel
                                            ? `${telemetryLabel}${telemetryAt ? ` at ${telemetryAt}` : ''}`
                                            : '';

                                        return (
                                        <motion.div 
                                            key={session.sessionId || `${session.userId}-${session.socketId || 'offline'}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between group transition-colors duration-300 ${
                                                session.offline
                                                    ? 'bg-slate-100 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700/60'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 hover:border-red-200 dark:hover:border-red-500/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900/80 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-red-50 dark:group-hover:bg-red-500/10 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors shrink-0 overflow-hidden">
                                                    <UserCircle size={20} />
                                                    {session.avatar ? (
                                                        <img
                                                            src={normalizeAvatarPath(session.avatar)}
                                                            alt={session.name || 'Student Avatar'}
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 dark:text-white transition-colors duration-300 flex items-center gap-2">
                                                        {session.name}
                                                        {session.pinned ? (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 uppercase tracking-wider font-black">Pinned</span>
                                                        ) : null}
                                                        {session.offline ? (
                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 uppercase tracking-wider font-black">Offline</span>
                                                        ) : null}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400/80 flex items-center gap-1.5 mt-0.5 transition-colors duration-300">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${session.offline ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                                            Action: <span className="text-slate-600 dark:text-slate-300 truncate max-w-[150px] sm:max-w-[250px] transition-colors duration-300">{session.action || session.page}</span>
                                                    </span>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 mt-0.5 truncate max-w-[150px] sm:max-w-[250px] transition-colors duration-300">
                                                            Page: {session.page}{session.detail ? ` • ${session.detail}` : ''}
                                                        </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums shrink-0 ml-4 transition-colors duration-300">
                                                <button
                                                    onClick={() => openAlertComposer(session)}
                                                    className="px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 transition-colors"
                                                    title="Send God Alert"
                                                >
                                                    <Send size={12} />
                                                </button>
                                                <button
                                                    onClick={() => togglePinStudent(session)}
                                                    className={`px-2 py-1 rounded-md border transition-colors ${
                                                        session.pinned
                                                            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
                                                            : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                                                    }`}
                                                    title={session.pinned ? 'Unpin student' : 'Pin student'}
                                                >
                                                    {session.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                                                </button>
                                                <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                    {session.os || 'Unknown'}
                                                </span>
                                                {telemetryLabel ? (
                                                    <span title={telemetryTitle} className={`px-2 py-0.5 rounded-md border uppercase tracking-wide ${telemetryClass}`}>
                                                        {telemetryLabel}
                                                    </span>
                                                ) : null}
                                                <span>{new Date(session.time).toLocaleTimeString()}</span>
                                                {session.offline ? (
                                                    <span className="text-[9px] text-red-500 dark:text-red-400 uppercase tracking-wide">Last Seen {new Date(session.lastSeen || session.time).toLocaleTimeString()}</span>
                                                ) : null}
                                            </div>
                                        </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: MAINTENANCE & QUICK ACTIONS (1 column) */}
                <div className="flex flex-col gap-6">
                    {/* Lockdown Control */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[30px] border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm h-full transition-colors duration-300">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${maintenanceMode ? 'bg-red-600' : 'bg-green-500'} transition-colors duration-500`}></div>
                        
                        <div className={`p-5 rounded-full mb-4 transition-colors duration-500 ${maintenanceMode ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                            <Shield size={32} className={maintenanceMode ? 'animate-pulse' : ''} />
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic mb-1 transition-colors duration-300">
                            {maintenanceMode ? 'SYSTEM LOCKED' : 'SYSTEM LIVE'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 transition-colors duration-300">
                            {maintenanceMode ? 'Emergency protocols active' : 'Platform operational'}
                        </p>
                        
                        <button onClick={toggleMaintenance} className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md active:scale-95 ${maintenanceMode ? 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                            {maintenanceMode ? 'Restore Platform' : 'Enable Lockdown'}
                        </button>
                    </div>
                    {/* 👑 SFT KING AI - KILL SWITCH */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[30px] border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm h-full transition-colors duration-300">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${aiEnabled ? 'bg-amber-500' : 'bg-slate-500'} transition-colors duration-500`}></div>
                        
                        <div className={`p-5 rounded-full mb-4 transition-colors duration-500 ${aiEnabled ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {aiEnabled ? <Bot size={32} className="animate-pulse" /> : <PowerOff size={32} />}
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic mb-1 transition-colors duration-300">
                            {aiEnabled ? 'AI MATRIX: ONLINE' : 'AI MATRIX: OFFLINE'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 transition-colors duration-300">
                            {aiEnabled ? 'Students have full access to JARVIS' : 'AI is completely hidden from students'}
                        </p>
                        
                        <button onClick={toggleAiChat} className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md active:scale-95 ${aiEnabled ? 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30'}`}>
                            {aiEnabled ? 'Execute Kill Switch' : 'Awaken AI Matrix'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ================= EVENT POSTER MANAGEMENT ================= */}
            <div className="bg-white dark:bg-slate-900 rounded-[30px] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden transition-colors duration-300 p-6 lg:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
                            <ImagePlus size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Promo Poster Matrix</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deploy popup events to student dashboards</p>
                        </div>
                    </div>

                    {/* Visiblity Toggle */}
                    {activePoster && (
                        <button 
                            onClick={togglePosterVisibility}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 border ${
                                activePoster.isActive 
                                ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400' 
                                : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {activePoster.isActive ? <ToggleRight size={20} className="animate-pulse" /> : <ToggleLeft size={20} />}
                            {activePoster.isActive ? 'Poster is LIVE' : 'Poster is HIDDEN'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Upload Form */}
                    <form onSubmit={handleUploadPoster} className="space-y-4">
                        <div className="relative">
                            <Type size={16} className="absolute left-4 top-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Poster Title (e.g., Big Revision Event!)" 
                                value={posterTitle}
                                onChange={(e) => setPosterTitle(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>

                        <div className="relative">
                            <LinkIcon size={16} className="absolute left-4 top-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Click URL (Optional link when they click)" 
                                value={posterLink}
                                onChange={(e) => setPosterLink(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>

                        <div className="relative">
                            <Users size={16} className="absolute left-4 top-3.5 text-slate-400" />
                            <select 
                                value={posterBatch}
                                onChange={(e) => setPosterBatch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-purple-500 transition-colors appearance-none"
                            >
                                {availableBatches.map(batch => (
                                    <option key={batch} value={batch}>{batch} Batch</option>
                                ))}
                            </select>
                        </div>

                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setPosterFile(e.target.files[0])}
                            className="w-full file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-wider file:bg-purple-50 file:text-purple-600 hover:file:bg-purple-100 dark:file:bg-purple-500/20 dark:file:text-purple-400 text-sm font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-xl p-1 bg-slate-50 dark:bg-slate-950"
                        />

                        <button 
                            type="submit" 
                            disabled={isUploadingPoster}
                            className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                            {isUploadingPoster ? 'Deploying to Matrix...' : 'Upload & Deploy Poster'}
                        </button>
                    </form>

                    {/* Preview Section */}
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/5 p-4 flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden group">
                        {activePoster ? (
                            <>
                                <img src={activePoster.imageUrl} alt="Active Poster" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 blur-[2px] group-hover:blur-0" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent pointer-events-none"></div>
                                <div className="relative z-10 mt-auto text-center w-full">
                                    <span className="inline-block px-3 py-1 bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full mb-2">Target: {activePoster.batch}</span>
                                    <h4 className="text-white font-black text-lg shadow-sm">{activePoster.title || 'Untitled Event'}</h4>
                                </div>
                            </>
                        ) : (
                            <div className="text-center opacity-40">
                                <ImagePlus size={48} className="mx-auto mb-3 text-slate-400" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">No Active Poster</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {notificationModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center"
                        onClick={() => setNotificationModalOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-900 text-white flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-80">Notification Switch</p>
                                    <h3 className="text-lg font-black tracking-tight">Global Notifications</h3>
                                </div>
                                <button
                                    onClick={() => setNotificationModalOpen(false)}
                                    className="w-9 h-9 rounded-full border border-white/30 hover:bg-white/10 flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-6 space-y-3">
                                <button
                                    onClick={() => toggleNotificationSetting('email')}
                                    disabled={notificationBusy}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-colors ${notificationSettings.emailEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2"><Mail size={14} /> Emails</span>
                                    <span>{notificationSettings.emailEnabled ? 'ON' : 'OFF'}</span>
                                </button>

                                <button
                                    onClick={() => toggleNotificationSetting('push')}
                                    disabled={notificationBusy}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-colors ${notificationSettings.pushEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2"><Bell size={14} /> Push Notification</span>
                                    <span>{notificationSettings.pushEnabled ? 'ON' : 'OFF'}</span>
                                </button>

                                <button
                                    onClick={() => toggleNotificationSetting('both')}
                                    disabled={notificationBusy}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-colors ${notificationsBothEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                                >
                                    <span>Both</span>
                                    <span>{notificationsBothEnabled ? 'ON' : 'OFF'}</span>
                                </button>

                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">
                                    Changes apply to all email and push notifications.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {alertModalOpen && selectedStudent ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center"
                        onClick={closeAlertComposer}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-2xl rounded-3xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-90">God-Level Direct Alert</p>
                                    <h3 className="text-lg font-black tracking-tight">To: {selectedStudent.name || `Student #${selectedStudent.userId}`}</h3>
                                </div>
                                <button
                                    onClick={closeAlertComposer}
                                    className="w-9 h-9 rounded-full border border-white/30 hover:bg-white/10 flex items-center justify-center"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setAlertPriority('normal')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${alertPriority === 'normal' ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100' : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}
                                    >
                                        Normal
                                    </button>
                                    <button
                                        onClick={() => setAlertPriority('high')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${alertPriority === 'high' ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}
                                    >
                                        High
                                    </button>
                                    <button
                                        onClick={() => setAlertPriority('critical')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${alertPriority === 'critical' ? 'bg-red-600 text-white border-red-600' : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}
                                    >
                                        Critical
                                    </button>
                                </div>

                                <textarea
                                    value={alertMessage}
                                    onChange={(e) => setAlertMessage(e.target.value.slice(0, 320))}
                                    rows={5}
                                    placeholder="Write your command/message to this student..."
                                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                                />

                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{alertMessage.length}/320 chars</span>
                                    <button
                                        onClick={sendGodAlert}
                                        disabled={sendingAlert}
                                        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20"
                                    >
                                        {sendingAlert ? 'Sending...' : 'Send God Alert'}
                                    </button>
                                </div>

                                {alertFeedback.text ? (
                                    <p className={`text-xs font-bold ${alertFeedback.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                        {alertFeedback.text}
                                    </p>
                                ) : null}
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
            
        </div>
    );
}