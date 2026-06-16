'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation'; // Import Pathname
import axios from '@/lib/axios';
import { getClientOS } from '@/lib/studentActivity';

const SocketContext = createContext();

const readTrackingTitle = (key) => {
    if (typeof window === 'undefined') return '';
    try {
        return (window.sessionStorage.getItem(key) || '').trim();
    } catch {
        return '';
    }
};

const describePath = (pathname = '') => {
    if (pathname === '/student/dashboard') return ['Browsing Dashboard', 'Opened Dashboard'];
    if (pathname.startsWith('/student/exams')) return ['Browsing Exams', 'Opened Exams Library'];
    if (pathname.startsWith('/student/pastpapers')) return ['Browsing Past Papers', 'Opened Past Papers'];
    if (pathname.startsWith('/student/recordings')) {
        const recordingTitle = readTrackingTitle('sft_recording_title');
        if (recordingTitle) return [`Watching Recording: ${recordingTitle}`, `Watching Recording: ${recordingTitle}`, recordingTitle];
        return ['Browsing Recordings', 'Opened Recordings'];
    }
    if (pathname.startsWith('/student/live')) {
        const liveTitle = readTrackingTitle('sft_live_title');
        if (liveTitle) return [`Watching Live: ${liveTitle}`, `Watching Live: ${liveTitle}`, liveTitle];
        return ['Browsing Live Streams', 'Opened Live Classes'];
    }
    if (pathname.startsWith('/student/help')) return ['Browsing Support Desk', 'Opened Help Desk'];
    if (pathname.startsWith('/student/profile')) return ['Browsing Account Settings', 'Opened Profile'];
    if (pathname.startsWith('/leaderboard')) return ['Browsing Leaderboard', 'Opened Leaderboard'];
    if (pathname.startsWith('/mcq-exam/')) return ['Inside MCQ Exam', 'Opened MCQ Exam'];
    if (pathname.startsWith('/written-exam/')) return ['Inside Written Exam', 'Opened Written Exam'];
    if (pathname.startsWith('/pdf-viewer')) return ['Inside Secure PDF', 'Opened PDF Viewer'];
    if (pathname.startsWith('/live-zoom/')) {
        const liveTitle = readTrackingTitle('sft_live_title');
        if (liveTitle) return [`Watching Live: ${liveTitle}`, `Watching Live: ${liveTitle}`, liveTitle];
        return ['Inside Live Zoom', 'Opened Live Zoom', pathname];
    }
    if (pathname.startsWith('/zoom-recording/')) {
        const recordingTitle = readTrackingTitle('sft_recording_title');
        if (recordingTitle) return [`Watching Recording: ${recordingTitle}`, `Watching Recording: ${recordingTitle}`, recordingTitle];
        return ['Inside Zoom Recording', 'Opened Zoom Recording', pathname];
    }
    return ['Browsing Platform', 'Browsing Platform', pathname];
};

export const SocketProvider = ({ children }) => {
    const { user, logout } = useAuth(); // We need 'user' to check ID
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [onlineCount, setOnlineCount] = useState(0);
    const pathname = usePathname();

    const [siteName, setSiteName] = useState("");

    useEffect(() => {
        // --- 1. THE JAIL FUNCTION ---
        const forceExit = () => {
            console.log(">> 🚫 FORCE EXIT TRIGGERED");
            localStorage.removeItem('sft_user');
            if (window.location.pathname !== '/suspended') {
                window.location.href = '/suspended';
            }
        };

        // --- 2. SYNC FUNCTION ---
        const syncSystem = async () => {
            try {
                const mRes = await axios.get('/settings/maintenance');
                setMaintenanceMode(mRes.data.enabled);

                if (user && user.id) {
                    const statusRes = await axios.get(`/user/status/${user.id}`);
                    if (statusRes.data.status === 'deactivated') forceExit();
                }

                if (user?.role === 'admin') {
                    const sRes = await axios.get('/admin/stats');
                    setOnlineCount(sRes.data.onlineNow);
                }
            } catch (e) {}
        };

        // --- 3. SOCKET LISTENERS ---
        const handleCount = (n) => setOnlineCount(n);
        const handleMaintenance = (d) => setMaintenanceMode(d.enabled);
        const handleForceLogout = (d) => forceExit();
        const handleTheme = (data) => document.documentElement.style.setProperty('--primary-red', data.color);

        const sendHeartbeat = () => {
            if (!user || !user.id || !socket) return;
            const route = pathname || window.location.pathname || '';
            const [page, action, fallbackDetail] = describePath(route);
            socket.emit('session_heartbeat', {
                userId: user.id,
                role: user.role,
                sessionId: user.sessionId || user.sid || null,
                page,
                action,
                detail: fallbackDetail || route,
                route,
                os: getClientOS()
            });
        };

        // ✅ KEY FIX: ANNOUNCE PRESENCE ON CONNECT & RECONNECT (NOW WITH NAME!)
        const announcePresence = () => {
            if (user && user.id) {
                console.log("🔌 Socket Connected: Announcing Presence...");
                const route = pathname || window.location.pathname || '';
                const [page, action, fallbackDetail] = describePath(route);
                socket.emit("i_am_here", { 
                    userId: user.id, 
                    role: user.role,
                    sessionId: user.sessionId || user.sid || null,
                    name: user.name || user.fullName || user.firstName || user.username,
                    avatar: user.avatar || null,
                    page,
                    action,
                    detail: fallbackDetail || route,
                    route,
                    os: getClientOS()
                });
            }
        };

        // Attach Listeners
        socket.on('connect', announcePresence); // <--- RUNS ON EVERY RECONNECTION
        socket.on('online_count_update', handleCount);
        socket.on('maintenance_update', handleMaintenance);
        socket.on('force_logout', handleForceLogout);
        socket.on('theme_update', handleTheme);

        const heartbeatTimer = setInterval(() => {
            if (socket.connected) sendHeartbeat();
        }, 3000);

        const handlePageHide = () => {
            if (socket.connected) {
                sendHeartbeat();
            }
        };

        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('beforeunload', handlePageHide);

        // Initial Announce (in case already connected)
        if (socket.connected) announcePresence();
        else socket.connect();

        // Start Sync Loop
        syncSystem();
        const interval = setInterval(syncSystem, 2000);

        return () => {
            clearInterval(interval);
            clearInterval(heartbeatTimer);
            socket.off('connect', announcePresence); // Clean up
            socket.off('online_count_update');
            socket.off('maintenance_update');
            socket.off('force_logout');
            socket.off('theme_update');
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('beforeunload', handlePageHide);
        };
    }, [user, pathname]);

    return (
        <SocketContext.Provider value={{ maintenanceMode, onlineCount, siteName, socket }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);