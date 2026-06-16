'use client';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

const SecurePdfEngine = dynamic(() => import('./PdfCanvasRender'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 w-12 h-12 mb-4" />
      <p className="font-bold tracking-widest uppercase text-[10px] text-slate-400">
        Initializing Secure Engine...
      </p>
    </div>
  )
});

export default function PdfViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-red-600" /></div>}>
      <SecurePdfEngine />
    </Suspense>
  );
}