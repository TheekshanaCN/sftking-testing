'use client';
import { motion } from 'framer-motion';
import { Settings, ShieldAlert, Wifi, Server } from 'lucide-react';

export default function MaintenanceOverlay() {
    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            // Added overflow-y-auto for small landscape phones
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505] overflow-y-auto overflow-x-hidden p-4"
        >
            {/* --- ANIMATED BACKGROUND GRID --- */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-red-600 opacity-20 blur-[100px]"></div>
            </div>

            <motion.div 
                initial={{ scale: 0.95, y: 30 }} 
                animate={{ scale: 1, y: 0 }} 
                transition={{ type: "spring", duration: 0.8 }}
                // Reduced gap on mobile (gap-8), increased on desktop (md:gap-16)
                className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row items-center gap-8 md:gap-16"
            >
                
                {/* --- LEFT: ANIMATION / ILLUSTRATION --- */}
                <div className="w-full md:w-1/2 flex justify-center">
                    {/* Scaled down for mobile (w-52) to prevent badge clipping */}
                    <div className="relative w-52 h-52 sm:w-64 sm:h-64 md:w-80 md:h-80">
                        <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping delay-75"></div>
                        <div className="absolute inset-4 bg-red-600/40 rounded-full animate-ping"></div>
                        
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                           <div className="relative">
                                {/* Added inline style for slow spin if not in tailwind config */}
                                <Settings size={60} className="text-white animate-spin" style={{ animationDuration: '8s' }} />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <ShieldAlert size={28} className="text-red-500" />
                                </div>
                           </div>
                        </div>

                        {/* Status Badges - Scaled for mobile */}
                        <motion.div 
                            animate={{ y: [0, -10, 0] }} 
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-lg flex items-center gap-2"
                        >
                            <Server size={12} className="text-slate-400"/>
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-800">Updating...</span>
                        </motion.div>

                        <motion.div 
                            animate={{ y: [0, 10, 0] }} 
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute -bottom-2 -left-2 sm:-bottom-4 sm:-left-4 bg-red-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-2"
                        >
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-white">System Locked</span>
                        </motion.div>
                    </div>
                </div>

                {/* --- RIGHT: TEXT CONTENT --- */}
                <div className="w-full md:w-1/2 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-500/30 rounded-full mb-4 md:mb-6">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Maintenance Mode Active</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-[1000] text-white italic uppercase tracking-tighter mb-4 md:mb-6 leading-[0.9]">
                        System <br className="hidden sm:block"/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-800">Paused</span>
                    </h1>
                    
                    <p className="text-slate-400 font-medium text-xs sm:text-sm md:text-base leading-relaxed mb-6 md:mb-8 max-w-sm mx-auto md:mx-0">
                        The educational platform is currently undergoing scheduled upgrades to improve performance. Class access is temporarily suspended.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                        <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 w-full sm:w-auto">
                            <Wifi size={18} className="text-green-500" />
                            <div className="text-left">
                                <p className="text-[9px] text-slate-500 uppercase font-black">Connection</p>
                                <p className="text-xs font-bold text-white">Stable, Waiting...</p>
                            </div>
                        </div>
                    </div>
                    
                    <p className="mt-6 md:mt-8 text-[9px] sm:text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                        Estimated Return: As soon as admin unlocks.
                    </p>
                </div>

            </motion.div>
        </motion.div>
    );
}