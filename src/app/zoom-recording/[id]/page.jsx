'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { socket } from '@/lib/socket';
import { emitStudentActivity } from '@/lib/studentActivity';
import { rememberPostLoginRedirect } from '@/lib/postLoginRedirect';
import { Loader2, AlertOctagon, ArrowLeft } from 'lucide-react';

export default function ZoomRecordingPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const contentId = params?.id;
    const [recordingData, setRecordingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [playbackError, setPlaybackError] = useState(null);

    useEffect(() => {
        const fetchRecording = async () => {
            try {
                setLoading(true);
                if (!contentId) return;
                const res = await axios.get(`/student/zoom-recording/${contentId}`, { timeout: 15000 });
                setRecordingData(res.data);
            } catch (err) {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    const currentPath = typeof window !== 'undefined'
                        ? `${window.location.pathname}${window.location.search}`
                        : `/zoom-recording/${contentId}`;
                    rememberPostLoginRedirect(currentPath);
                    router.replace(`/auth?redirect=${encodeURIComponent(currentPath)}`);
                    return;
                }
                const msg = err?.response?.data?.message || err?.message || 'Failed to load recording';
                setError(msg);
                console.error('Recording Load Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecording();
    }, [contentId, router]);

    useEffect(() => {
        if (!user || user.role !== 'student' || !contentId || !recordingData?.title) return;

        const title = String(recordingData.title).trim() || 'Recording';
        try {
            window.sessionStorage.setItem('sft_recording_title', title);
        } catch {}

        const sendWatchingPing = () => {
            emitStudentActivity(socket, user, {
                page: `Watching Recording: ${title}`,
                action: `Watching Recording: ${title}`,
                detail: title,
                route: `/zoom-recording/${contentId}`,
                kind: 'content',
                contentId
            });
        };

        sendWatchingPing();
        const timer = setInterval(sendWatchingPing, 5000);
        return () => clearInterval(timer);
    }, [recordingData, user, contentId]);

    if (loading) {
        return (
            <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/30 mb-6 animate-bounce shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                        <Loader2 className="animate-spin text-purple-500 w-8 h-8" />
                    </div>
                    <p className="font-black tracking-widest uppercase text-[10px] text-purple-400 animate-pulse">
                        Loading Recording...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900/80 border border-red-500/30 p-8 md:p-10 rounded-3xl max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)]">
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                        <AlertOctagon size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white mb-3">
                        Access Denied
                    </h2>
                    <p className="text-sm text-slate-400 mb-8 leading-relaxed px-2">
                        {error}
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30"
                    >
                        <ArrowLeft size={18} /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!recordingData) {
        return (
            <div className="w-full h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900/80 border border-red-500/30 p-8 md:p-10 rounded-3xl max-w-md w-full text-center">
                    <h2 className="text-xl font-black uppercase tracking-widest text-white mb-3">
                        No Recording Found
                    </h2>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all mt-4"
                    >
                        <ArrowLeft size={18} /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col">
            <div className="bg-slate-900 border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Go Back"
                    >
                        <ArrowLeft size={24} className="text-slate-400 hover:text-white" />
                    </button>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recording</p>
                        <h1 className="text-lg md:text-2xl font-black uppercase tracking-tighter text-white line-clamp-1">
                            {recordingData.title}
                        </h1>
                    </div>
                </div>

                
            </div>

            <div className="flex-1 flex items-center justify-center bg-black p-4 md:p-8">
                <div className="w-full max-w-6xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
                    <video
                        key={recordingData.streamUrl}
                        controls
                        controlsList="nodownload noremoteplayback"
                        disablePictureInPicture
                        playsInline
                        preload="metadata"
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-full h-full"
                        poster={recordingData.thumbnailUrl || '/video-placeholder.jpg'}
                        src={recordingData.streamUrl}
                        onError={() => setPlaybackError('Unable to play this recording stream. The source may be blocked or expired.')}
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>

            <div className="bg-slate-950 border-t border-white/10 px-4 md:px-8 py-4">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                    Secure stream mode active. Download is disabled.
                </p>
            </div>
            {playbackError && (
                <div className="px-4 md:px-8 pb-4 bg-black">
                    <div className="max-w-6xl mx-auto bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-xs uppercase tracking-wider font-bold">
                        {playbackError}
                    </div>
                </div>
            )}
        </div>
    );
}
