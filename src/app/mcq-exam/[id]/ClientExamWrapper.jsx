'use client';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// 🚀 THE SSR ASSASSIN: Now safely inside a 'use client' file!
const ExamEngine = dynamic(() => import('./ExamEngine'), { 
    ssr: false,
    loading: () => (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
            <Loader2 className="animate-spin text-red-600 w-12 h-12 mb-4" />
            <p className="font-black tracking-widest uppercase text-xs text-red-500 animate-pulse">Booting Secure Matrix...</p>
        </div>
    )
});

export default function ClientExamWrapper({ id }) {
    return <ExamEngine id={id} />;
}