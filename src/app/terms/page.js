'use client';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, AlertTriangle, Copyright, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
    const router = useRouter();

    const sections = [
        {
            title: "1. ACADEMIC INTEGRITY & ACCOUNT USAGE",
            content: "Your SFT KING student account is strictly for personal educational use. Sharing login credentials (Mobile Number/Password), selling account access, or allowing others to view paid content through your account is prohibited. Our system monitors login patterns, and suspicious activity will lead to immediate account suspension."
        },
        {
            title: "2. INTELLECTUAL PROPERTY & BROADCAST RIGHTS",
            content: "All live sessions and recorded broadcasts are the exclusive intellectual property of SFT KING and Ishanka Shamal. Unauthorized screen recording, capturing, or redistribution of these sessions on any platform (Telegram, WhatsApp, etc.) is strictly prohibited and will result in immediate legal action and a permanent platform ban."
        },
        {
            title: "3. PAYMENTS & ENROLLMENT",
            content: "Access to all content is granted only upon successful verification of payment slips. Please ensure clear images of bank slips are uploaded containing the correct reference. Payments are non-transferable and non-refundable once access has been granted to the learning materials."
        },
        {
            title: "4. PROFESSIONAL STANDARDS & COMPLIANCE",
            content: "Students are expected to maintain the highest level of professionalism and decorum. By accessing this platform, you commit to upholding an elite learning environment that respects the educational process and the collective progress of the SFT KING community."
        }
    ];

    return (
        <div className="h-screen w-full bg-[#050505] text-slate-300 font-sans relative overflow-y-auto scroll-smooth selection:bg-red-500 selection:text-white">
            
            {/* Background Grid */}
            <div className="fixed inset-0 bg-[linear-gradient(rgba(20,0,0,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(20,0,0,0.2)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            
            {/* Ambient Red Glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-red-900/10 blur-[100px] pointer-events-none"></div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto relative z-10 p-6 md:p-20 pb-40"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <div className="flex items-center gap-3 text-red-600 mb-2">
                            <Scale size={28} />
                            <span className="font-black uppercase tracking-[0.3em] text-xs md:text-sm">Student Agreement</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                            Terms & Conditions
                        </h1>
                    </div>
                    <button 
                        onClick={() => router.back()}
                        className="group flex items-center gap-3 px-6 py-3 border border-slate-800 bg-slate-900/50 hover:bg-white hover:text-black rounded-full transition-all duration-300"
                    >
                        <ArrowLeft size={18} />
                        <span className="font-bold uppercase text-xs tracking-widest">Back</span>
                    </button>
                </div>

                {/* Document Container */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[30px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                    {/* Top Decorative Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-900 to-red-600 opacity-60"></div>

                    <div className="space-y-10">
                        {sections.map((sec, i) => (
                            <motion.div 
                                key={i} 
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="relative pl-6 border-l-2 border-slate-800 hover:border-red-500 transition-colors duration-300 group"
                            >
                                <h3 className="text-white font-black uppercase tracking-widest mb-3 flex items-center gap-3 text-sm md:text-base">
                                    <span className="text-red-600 text-xs font-mono">{`0${i+1}`}</span>
                                    {sec.title}
                                </h3>
                                <p className="text-sm leading-7 text-slate-400 group-hover:text-slate-200 transition-colors">
                                    {sec.content}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Footer Warning */}
                    <div className="mt-12 pt-8 border-t border-white/5 flex items-start gap-4">
                        <AlertTriangle className="text-red-500 shrink-0" size={24} />
                        <p className="text-[10px] sm:text-xs font-mono text-red-200/70 uppercase tracking-widest leading-relaxed">
                            By registering and accessing the SFT KING platform, you acknowledge that you have read, understood, and agreed to abide by these terms.
                        </p>
                    </div>
                </div>

                {/* Copyright Footer */}
                <div className="text-center mt-12 opacity-30 flex items-center justify-center gap-2 hover:opacity-50 transition-opacity">
                    <Copyright size={12}/>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                        {new Date().getFullYear()} SFT KING Education
                    </span>
                </div>

            </motion.div>
        </div>
    );
}