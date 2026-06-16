'use client';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function AdminAbout() {
    const [appName, setAppName] = useState("SFT KING");

    useEffect(() => {
        axios.get('/config/site-name')
            .then(res => { if(res.data.name) setAppName(res.data.name); })
            .catch(() => {});
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-4xl mx-auto space-y-10 pb-20 font-sans"
        >
            {/* MAIN BRAND CARD */}
            <div className="bg-white p-12 rounded-[60px] shadow-sm border border-red-50 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
                
                <h1 className="text-5xl md:text-7xl font-[1000] text-slate-900 tracking-tighter uppercase italic mb-2 drop-shadow-sm">
                    {appName}
                </h1>
                <p className="text-red-600 font-bold uppercase tracking-[0.4em] text-[10px] mb-12">
                    Universal Learning Ecosystem
                </p>
                
                <div className="max-w-2xl mx-auto text-slate-500 leading-relaxed font-medium text-sm md:text-base">
                    Welcome to the official {appName} platform. This system is engineered to provide 
                    Advanced Level Science for Technology students with a seamless, high-security, 
                    and real-time learning experience. From live streaming to persistent archives, 
                    every module is optimized for academic excellence.
                </div>
            </div>

            {/* CREDITS GRID */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* POWERED BY CARD - MIS COMPUTERS */}
                <div className="bg-slate-900 p-8 rounded-[40px] border border-white/5 flex items-center gap-6 group hover:shadow-2xl transition-all duration-500">
                    <div className="bg-white/5 p-5 rounded-[25px] text-blue-500 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Activity size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            System Powered By
                        </p>
                        <h4 className="text-xl font-black text-white italic uppercase">
                            MIS Computers
                        </h4>
                    </div>
                </div>
            </div>

            {/* COPYRIGHT FOOTER */}
            <div className="text-center pt-10">
                <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-100 rounded-full border border-slate-200">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        © 2026 {appName} • All Rights Reserved
                    </span>
                </div>
                <p className="text-[9px] text-slate-400 mt-4 uppercase font-bold tracking-[0.2em] opacity-40">
                    Unauthorized distribution of content is strictly prohibited by digital security laws.
                </p>
            </div>
        </motion.div>
    );
}