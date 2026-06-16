'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LegacyStudentZoomRecordingPage() {
    const router = useRouter();
    const params = useParams();
    const contentId = params?.id;

    useEffect(() => {
        if (!contentId) return;
        router.replace(`/zoom-recording/${contentId}`);
    }, [contentId, router]);

    return (
        <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/30 mb-6 animate-bounce shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                    <Loader2 className="animate-spin text-purple-500 w-8 h-8" />
                </div>
                <p className="font-black tracking-widest uppercase text-[10px] text-purple-400 animate-pulse">
                    Redirecting...
                </p>
            </div>
        </div>
    );
}
