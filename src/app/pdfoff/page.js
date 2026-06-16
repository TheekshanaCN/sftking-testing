'use client';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PdfOffPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="bg-red-950/30 border border-red-500/30 p-10 rounded-[40px] max-w-lg w-full backdrop-blur-md">
        <ShieldAlert className="w-24 h-24 text-red-500 mx-auto mb-6 animate-pulse" />
        
        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-4">
          Session Terminated
        </h1>
        
        <p className="text-red-200/70 font-bold text-sm leading-relaxed mb-8">
          Your secure PDF viewing session has expired, or a security violation (like attempting to screenshot, print, or save) was detected.
        </p>

        <button 
          onClick={() => router.push('/dashboard')} // Change this to your student dashboard route
          className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-3 w-full"
        >
          <ArrowLeft size={16} /> Return to Dashboard
        </button>
      </div>
    </div>
  );
}