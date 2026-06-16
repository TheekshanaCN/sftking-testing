'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, LogOut, Lock, Terminal } from 'lucide-react';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket'; // Ensure this import works

export default function SuspendedPage() {
    useEffect(() => {
        // 1. Initial Cleanup (Standard Suspended Logic)
        localStorage.removeItem('sft_user');
        const clearCookie = async () => { 
            try { await axios.post('/logout'); } catch(e) { console.error("Logout failed", e); } 
        };
        clearCookie();

        // 2. LISTEN FOR DELETE EVENT (Fix for the redirection issue)
        // If admin deletes while user is here, go to /deleted
        const handleForceLogout = (data) => {
            if (data.reason === 'deleted') {
                window.location.replace('/deleted');
            }
        };

        socket.on('force_logout', handleForceLogout);

        return () => {
            socket.off('force_logout', handleForceLogout);
        };
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { 
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.3 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(185,28,28,0.07)_0%,_transparent_70%)]" />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            </div>

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 max-w-lg w-full"
            >
                <div className="bg-[#111113] border border-white/[0.05] rounded-2xl p-8 md:p-12 shadow-2xl shadow-black">
                    
                    <motion.div variants={itemVariants} className="flex justify-center mb-8">
                        <div className="relative">
                            <motion.div 
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="absolute inset-0 bg-red-600 blur-2xl rounded-full"
                            />
                            <div className="relative bg-red-600/10 border border-red-600/50 p-5 rounded-2xl">
                                <ShieldAlert className="text-red-500 w-10 h-10" />
                            </div>
                        </div>
                    </motion.div>

                    <div className="text-center space-y-4">
                        <motion.div variants={itemVariants}>
                            <span className="text-red-500 text-[10px] font-bold uppercase tracking-[0.4em] block mb-2">
                                System Status: Restricted
                            </span>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight uppercase">
                                Account <span className="text-red-600">Suspended</span>
                            </h1>
                        </motion.div>

                        <motion.div variants={itemVariants} className="h-px w-12 bg-white/10 mx-auto my-6" />

                        <motion.div variants={itemVariants} className="space-y-4 text-center">
                            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                                Your access to the <span className="text-white font-medium">SFT KING</span> platform has been formally revoked due to a security policy violation.
                            </p>
                            
                            <div className="bg-black/40 border border-white/[0.03] rounded-xl p-4 flex items-start gap-3 text-left">
                                <Terminal size={16} className="text-red-500 mt-1 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[11px] text-white/40 uppercase font-mono tracking-wider">Protocol Log</p>
                                    <p className="text-xs text-slate-300 font-mono">ERR_AUTH_REVOKED: SESSION_TERMINATED</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="mt-10">
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="group relative w-full flex items-center justify-center gap-3 py-4 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-red-600 hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-red-600/40"
                        >
                            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Return to Portal
                        </button>
                    </motion.div>
                </div>

                <motion.div 
                    variants={itemVariants}
                    className="mt-8 text-center flex items-center justify-center gap-6 opacity-30"
                >
                    <div className="flex items-center gap-2 text-[10px] text-white uppercase tracking-tighter">
                        <Lock size={10} /> Secure End-to-End
                    </div>
                    <div className="h-4 w-px bg-white/20" />
                    <div className="text-[10px] text-white uppercase tracking-tighter font-bold">
                        SFT KING Security
                    </div>
                </motion.div>
            </motion.div>

            <div className="fixed inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay bg-noise" />
            
            <style jsx global>{`
                @keyframes scan {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(100%); }
                }
                .bg-noise {
                    background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNuKSIvPjwvc3ZnPg==');
                }
            `}</style>
        </div>
    );
}