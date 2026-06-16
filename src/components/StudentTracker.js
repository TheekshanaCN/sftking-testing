'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext'; 
import { emitStudentActivity } from '@/lib/studentActivity';

const readTrackingTitle = (key) => {
    if (typeof window === 'undefined') return '';
    try {
        return (window.sessionStorage.getItem(key) || '').trim();
    } catch {
        return '';
    }
};

const describePath = (pathname) => {
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

export default function StudentTracker() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { socket } = useSocket(); 
    const lastSentRef = useRef('');

    useEffect(() => {
        if (!user || user.role !== 'student' || !socket) return;

        const [page, action, fallbackDetail] = describePath(pathname || '');
        const sessionKey = user.sessionId || user.sid || user.id;
        const signature = `${sessionKey}:${pathname || ''}:${page}:${action}`;

        const sendSnapshot = () => {
            if (lastSentRef.current === signature) return;
            lastSentRef.current = signature;
            emitStudentActivity(socket, user, {
                page,
                action,
                route: pathname,
                detail: fallbackDetail || pathname,
                kind: 'navigation'
            });
        };

        if (socket.connected) {
            sendSnapshot();
        } else {
            socket.once('connect', sendSnapshot);
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') sendSnapshot();
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            socket.off('connect', sendSnapshot);
        };
    }, [pathname, user, socket]); 

    return null; 
}