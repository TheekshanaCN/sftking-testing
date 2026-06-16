'use client';
import { motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AccountDeleted() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans overflow-hidden relative">
            
            {/* Background Grid & Glow */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#050505_70%)]"></div>
            
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="max-w-lg w-full bg-slate-900/50 backdrop-blur-2xl border border-red-900/50 rounded-[40px] p-10 text-center shadow-[0_0_60px_rgba(220,38,38,0.15)] relative z-10"
            >
                {/* Icon */}
                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                    <ShieldAlert size={48} className="text-red-500" />
                </div>

                <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-red-500 drop-shadow-sm">
                    Access Terminated
                </h1>
                
                <div className="space-y-4 mb-10">
                    <p className="text-slate-400 text-sm font-medium leading-relaxed">
                        Your account has been permanently removed from the <span className="text-white font-bold">SFT KING</span> secure network by the administration.
                    </p>
                    <div className="bg-red-950/30 border border-red-900/30 p-4 rounded-xl flex items-start gap-3 text-left">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-[10px] text-red-200/70 font-mono leading-relaxed uppercase tracking-wide">
                            Error Code: 410_GONE<br/>
                            Reason: Administrative Action<br/>
                            Status: Irreversible
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => router.push('/auth')}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <Lock size={14} /> Return to Login
                    </button>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-4">
                        If you believe this is an error, contact support.
                    </p>
                </div>

            </motion.div>

            {/* Bottom Branding */}
            <div className="absolute bottom-8 text-center w-full opacity-20 pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">SFT KING SECURITY PROTOCOL</p>
            </div>
        </div>
    );
}