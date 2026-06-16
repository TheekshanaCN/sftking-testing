'use client';

import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function AboutPage() {
    const [appName, setAppName] = useState('SFT KING');

    useEffect(() => {
        axios.get('/config/site-name')
            .then(res => {
                if (res.data?.name) setAppName(res.data.name);
            })
            .catch(() => {});
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            // 🚀 Dark Mode: Added transition-colors
            className="relative max-w-5xl mx-auto px-4 md:px-0 pb-24 space-y-16 font-sans transition-colors duration-300"
        >

            {/* SUBTLE FUTURISTIC BACKGROUND */}
            {/* 🚀 Dark Mode: Increased opacity slightly for dark mode glow */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.15),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.25),transparent_60%)] transition-colors duration-1000"></div>

            {/* MAIN BRAND SECTION */}
            {/* 🚀 Dark Mode: Deep slate glassmorphism & darker shadow */}
            <div className="relative rounded-[48px] border border-white/10 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_30px_120px_-30px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_120px_-30px_rgba(0,0,0,0.6)] p-12 md:p-16 text-center overflow-hidden transition-colors duration-300">

                {/* TOP LASER LINE */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>

                {/* 🚀 Dark Mode: Text color inverted */}
                <h1 className="text-5xl md:text-7xl font-black tracking-tight uppercase italic text-slate-900 dark:text-white drop-shadow-sm transition-colors duration-300">
                    {appName}
                </h1>

                {/* 🚀 Dark Mode: Accent color adjustment */}
                <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.45em] text-red-600 dark:text-red-500 transition-colors duration-300">
                    Universal Learning Ecosystem
                </p>

                {/* 🚀 Dark Mode: Body text adjustment */}
                <p className="mt-12 max-w-3xl mx-auto text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium transition-colors duration-300">
                    Welcome to the official <span className="font-bold text-slate-800 dark:text-slate-200 transition-colors duration-300">{appName}</span> platform.
                    This system is engineered to deliver a secure, real-time, and high-performance learning
                    experience for Advanced Level Science for Technology students. From ultra-low-latency live
                    streaming to permanent digital archives, every component is built for academic precision
                    and future scalability.
                </p>
            </div>

            {/* CREDIT CARDS */}
            <div className="grid grid-cols-1 gap-8">

                {/* POWERED BY - MIS COMPUTERS */}
                <motion.div
                    whileHover={{ y: -6 }}
                    // 🚀 Dark Mode: Swapped from slate-900 to slate-800 in dark mode to pop against the 950 background
                    className="group rounded-[36px] border border-white/10 dark:border-white/5 bg-slate-900 dark:bg-slate-800 p-8 flex items-center gap-6 transition-all duration-500 shadow-lg hover:shadow-2xl"
                >
                    <div className="rounded-[24px] p-5 bg-white/10 text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-inner">
                        <Activity size={32} />
                    </div>

                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 transition-colors duration-300">
                            System Powered By
                        </p>
                        <h4 className="text-xl font-black uppercase italic text-white">
                            MIS Computers
                        </h4>
                    </div>
                </motion.div>
            </div>

            {/* FOOTER */}
            <div className="pt-12 text-center space-y-4">
                {/* 🚀 Dark Mode: Footer Badge */}
                <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-300">
                    <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 animate-pulse transition-colors duration-300"></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors duration-300">
                        © 2026 {appName} • All Rights Reserved
                    </span>
                </div>

                <p className="text-[9px] uppercase font-bold tracking-[0.25em] text-slate-400 dark:text-slate-500 opacity-60 dark:opacity-40 max-w-xl mx-auto transition-colors duration-300">
                    Unauthorized duplication, redistribution, or exploitation of digital content is strictly
                    prohibited under international digital security regulations.
                </p>
            </div>
        </motion.div>
    );
}