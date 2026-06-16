'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios'; 
import OpenIntro from '@/components/shared/OpenIntro';
import { 
  BookOpen, 
  Phone, 
  GraduationCap, 
  Laptop, 
  TrendingUp,
  PlayCircle,
  MessageCircle,
  Quote,
  ChevronRight,
  Crown,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Building2,
  X,
  Copy,
  MapPin,
  Landmark
} from 'lucide-react';

export default function LandingPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth(); // 🚀 GRAB THE USER

    // 🚀 THE TELEPORTATION SPELL
    useEffect(() => {
        if (!authLoading && user) {
            // They are already logged in! Teleport them!
            if (user.role === "admin") {
                router.push("/admin/dashboard");
            } else {
                router.push("/student/dashboard");
            }
        }
    }, [user, authLoading, router]);

    const scrollRef = useRef(null); 
    const videoSectionRef = useRef(null); 
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    
    // State for Bank Details - ADDED bankName here
    const [bankInfo, setBankInfo] = useState({
        bankName: "Loading...",
        accNum: "Loading...",
        accName: "Loading...",
        branch: "Loading..."
    });

    // --- SCROLL DETECTION & DATA FETCHING ---
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (container.scrollTop > 400) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }

            if (container.scrollTop > 50) {
                setShowScrollDown(false);
            } else {
                setShowScrollDown(true);
            }
        };

        container.addEventListener('scroll', handleScroll);
        
        // Fetch Bank Details
        const fetchBankDetails = async () => {
            try {
                const res = await axios.get('/config/bank-details');
                if (res.data) {
                    setBankInfo(res.data);
                }
            } catch (e) {
                // Fallback data if API fails
                setBankInfo({ 
                    bankName: "Commercial Bank",
                    accNum: "123456789", 
                    accName: "MIS Holding (Pvt)Ltd", 
                    branch: "Monaragala" 
                });
            }
        };
        fetchBankDetails();

        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // --- SMOOTH SCROLL FUNCTIONS ---
    const scrollToTop = () => {
        const container = scrollRef.current;
        if (!container) return;
        
        const start = container.scrollTop;
        const startTime = performance.now();
        const duration = 500; 
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const animateScroll = (currentTime) => {
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = easeOutQuart(progress);
            container.scrollTop = start * (1 - ease);
            if (timeElapsed < duration) {
                requestAnimationFrame(animateScroll);
            }
        };
        requestAnimationFrame(animateScroll);
    };

    const scrollToVideo = () => {
        videoSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied: " + text);
    };

    const testimonials = [
        {
            name: "සසිනි ප්‍රමෝද්‍යා",
            text: "මම සශිනි ප්‍රමොද්‍යා. 2022 අ.පො.ස. උසස්පෙල විභහගයේ ජෛව පද්ධති විෂයමාලාවේ මොණරාගල දිස්‍ත්‍රික්කයෙන්ම පලවෙනි ස්තානය මගේ ප්‍රතිපලය A3ක්. ලංකාවේන්ම 34 වෙනියා. මම මේ ප්‍රථිපලයට යද්දි මගේ SFT ගුරුවරයා උනේ ඉෂංඛ ශාමල් ගුරුතුමා. සර් මට මේ ප්‍රතිපලය ලබාගන්න ගොඩක් උදව් උනා."
        },
        {
            name: "උදීෂ් ජයේන්ද්‍ර",
            text: "2022 උසස්පෙල විභහගයේ මොණරාගල දිස්ත්‍රික්කයේ ඉංජිනේරුතාක්ෂණවේදය අංශයේ පලවෙනි ස්ථානය මම මගේ නම උදීෂ් ජයේන්ද්‍ර. අයේ Island Rank එක 18. මගේ SFT ගුරුවරයා උනේ ඉෂංඛ ශාමල් සර්."
        },
        {
            name: "චමෝද් කෞෂල්‍ය",
            text: "මම චමෝද් කෞෂල්‍ය. 2022 ඉංජිනේරු තාක්ෂනවේදය විෂයධාරාවෙන් ද්ස්ත්‍රික් 03වෙනියා. මට SFT වලට A එකක් ගන්න ඉෂංඛ ශාමල් සර් ගොඩක් උදව් උනා."
        }
    ];

    // --- PAYMENT MODAL COMPONENT ---
    const PaymentModal = () => (
        <AnimatePresence>
            {showPaymentModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    onClick={() => setShowPaymentModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                        className="w-full max-w-md bg-slate-950 border border-white/10 rounded-[30px] overflow-hidden shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-900/40 to-slate-900/40 p-6 flex justify-between items-center border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Bank Details</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">For Transfers</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-3">
                            
                            {/* 1. BANK NAME (Added Back) */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:border-red-500/30 transition-colors">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Bank Name</p>
                                    <p className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                                        <Landmark size={16} className="text-red-500" />
                                        {bankInfo.bankName}
                                    </p>
                                </div>
                            </div>

                            {/* 2. Account Number */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:border-red-500/30 transition-colors">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Account Number</p>
                                    <p className="text-xl font-mono font-bold text-white tracking-wider">
                                        {bankInfo.accNum}
                                    </p>
                                </div>
                                <button onClick={() => handleCopy(bankInfo.accNum)} className="p-2.5 rounded-xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-400 transition-all">
                                    <Copy size={18} />
                                </button>
                            </div>

                            {/* 3. Account Name */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:border-red-500/30 transition-colors">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Account Holder</p>
                                    <p className="text-sm sm:text-base font-bold text-white">
                                        {bankInfo.accName}
                                    </p>
                                </div>
                                <button onClick={() => handleCopy(bankInfo.accName)} className="p-2.5 rounded-xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-400 transition-all">
                                    <Copy size={18} />
                                </button>
                            </div>

                            {/* 4. Branch */}
                            <div className="flex items-center gap-3 px-2 py-1">
                                <MapPin size={16} className="text-red-500" />
                                <p className="text-xs font-bold text-slate-400">
                                    <span className="uppercase text-[10px] text-slate-500 mr-2 tracking-widest">Branch:</span> 
                                    {bankInfo.branch}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Please upload slip after registration</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // 🚀 ANTI-FLASH SHIELD: Hide the landing page while checking the cookie
    if (user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                {/* You can use a simple loading text or spinner here if you want! */}
            </div>
        );
    }

    return (
        <>
            <OpenIntro />

            {/* MAIN WRAPPER */}
            <div
                ref={scrollRef}
                className="fixed inset-0 overflow-y-auto bg-slate-950 text-white font-sans selection:bg-red-500 selection:text-white scroll-smooth"
            >
            
            {/* =========================================
                PAYMENT DETAILS BUTTON (TOP LEFT)
               ========================================= */}
            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPaymentModal(true)}
                className="absolute top-4 left-4 md:top-6 md:left-6 z-50 flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-red-500/30 text-red-400 rounded-full shadow-lg backdrop-blur-md hover:bg-red-950/50 hover:border-red-500/60 transition-all cursor-pointer"
            >
                <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider hidden sm:inline">Payment Details</span>
            </motion.button>

            {/* RENDER MODAL */}
            <PaymentModal />

            {/* =========================================
                SCROLL TO TOP BUTTON
               ========================================= */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0, y: 50 }}
                        whileHover={{ scale: 1.15, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={scrollToTop}
                        className="fixed bottom-8 right-8 z-[100] group"
                    >
                        <div className="absolute inset-0 bg-red-600 rounded-full blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-200"></div>
                        <div className="relative w-12 h-12 md:w-14 md:h-14 bg-slate-900/90 border border-red-500/50 rounded-full flex items-center justify-center text-red-400 shadow-2xl backdrop-blur-md group-hover:bg-red-600 group-hover:text-white group-hover:border-red-400 transition-all duration-200">
                            <ChevronUp className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} />
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* =========================================
                SECTION 1: HERO
               ========================================= */}
            <div className="relative min-h-screen w-full flex flex-col items-center justify-center py-12 md:py-20 overflow-hidden px-4">
                
                {/* BACKGROUND GRADIENTS */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#dc2626_0%,_transparent_40%)] opacity-20 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_#991b1b_0%,_transparent_40%)] opacity-20 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:2rem_2rem] md:bg-[size:4rem_4rem] opacity-10 pointer-events-none"></div>
                
                {/* Floating Orbs */}
                <motion.div 
                    className="hidden md:block absolute top-20 right-20 w-96 h-96 bg-gradient-to-br from-red-600/10 to-rose-600/10 rounded-full blur-3xl pointer-events-none"
                    animate={{ y: [0, 40, 0], x: [0, 30, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* --- TOP RIGHT ICONS & NUMBER --- */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex flex-col items-end gap-2"
                >
                    <div className="flex items-center gap-2 md:gap-3">
                        <a href="https://www.facebook.com/ishankashamal.sandaruwan" target="_blank" rel="noopener noreferrer" className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-900/90 border border-red-900/40 flex items-center justify-center hover:scale-110 transition-transform hover:border-red-600">
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-400 hover:text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </a>
                        <a href="https://www.tiktok.com/@sft.king1" target="_blank" rel="noopener noreferrer" className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-900/90 border border-red-900/40 flex items-center justify-center hover:scale-110 transition-transform hover:border-red-600">
                            <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-400 hover:text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"/></svg>
                        </a>
                        <a href="tel:+94705370470" className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-red-950/90 border border-red-800/50 flex items-center justify-center hover:scale-110 transition-transform hover:border-red-500">
                            <Phone className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                        </a>
                    </div>
                    {/* Professionally displayed mobile number */}
                    <a 
                        href="tel:+94705370470" 
                        className="text-[10px] md:text-xs font-bold text-slate-400 hover:text-white transition-colors tracking-widest bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm"
                    >
                        070 5 370 470
                    </a>
                </motion.div>

                {/* Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto text-center flex flex-col items-center justify-center h-full">
                    
                    {/* BADGE */}
                    <motion.div 
                        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.7 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2.5 rounded-full border border-red-500/30 bg-red-950/30 text-red-300 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-6 md:mb-10 backdrop-blur-md"
                    >
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                        Advanced Level Education Platform
                    </motion.div>

                    {/* MAIN HEADING WITH CROWN */}
                    <div className="relative inline-block mb-4 md:mb-8 pt-10 md:pt-16"> 
                        <motion.div
                            initial={{ y: -20, opacity: 0, rotate: -20 }}
                            animate={{ y: 0, opacity: 1, rotate: -15 }}
                            transition={{ duration: 1, delay: 0.5, type: "spring" }}
                            className="absolute -top-4 -left-4 md:-top-9 md:-left-8 z-20"
                        >
                            <motion.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="relative"
                            >
                                <Crown 
                                    strokeWidth={2}
                                    className="w-16 h-16 md:w-32 md:h-32 text-yellow-400 drop-shadow-[0_4px_15px_rgba(250,204,21,0.6)]" 
                                    fill="rgba(250, 204, 21, 0.15)"
                                />
                                <div className="absolute top-2 right-2 w-1.5 h-1.5 md:w-3 md:h-3 bg-white rounded-full blur-[1px] opacity-90 animate-pulse" />
                            </motion.div>
                        </motion.div>

                        <motion.h1 
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight relative z-10"
                        >
                            <span className="text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]">
                                SFT
                            </span>
                            <span className="ml-3 bg-clip-text text-transparent bg-gradient-to-b from-red-500 via-red-600 to-red-900 drop-shadow-[0_0_35px_rgba(220,38,38,0.7)]">
                                KING
                            </span>
                        </motion.h1>
                    </div>
                    
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="max-w-xs sm:max-w-2xl mx-auto text-slate-300 text-sm sm:text-lg md:text-xl mb-8 md:mb-12 leading-relaxed px-4"
                    >
                        පුළුල් ඩිජිටල් ඉගෙනුම් වේදිකාවක් සමඟින් <span className="text-white font-semibold"> තාක්ෂණවේදය සඳහා විද්‍යාව</span> සිසුන් සවිබල ගැන්වීම.
                    </motion.p>

                    <div className="flex flex-col items-center gap-6">
                        <motion.button 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                boxShadow: [
                                    '0 8px 24px rgba(220,38,38,0.30)',
                                    '0 14px 36px rgba(220,38,38,0.55)',
                                    '0 8px 24px rgba(220,38,38,0.30)'
                                ]
                            }}

                            
                            transition={{
                                opacity: { duration: 0.8, delay: 0.6 },
                                y: { duration: 0.8, delay: 0.6 },
                                boxShadow: { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }
                            }}
                            whileHover={{ scale: 1.045, y: -3 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => router.push('/auth')}
                            className="group relative isolate overflow-hidden px-10 py-3.5 md:px-14 md:py-4.5 rounded-full font-black text-white text-sm md:text-base tracking-[0.12em] uppercase flex items-center gap-3 mx-auto border border-red-300/25 bg-gradient-to-r from-red-700 via-red-600 to-rose-600"
                        >
                            <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.45),transparent_42%)] opacity-80" />
                            <motion.span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent skew-x-[-22deg] blur-[1px]"
                                animate={{ x: ['-10%', '280%'] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <span className="relative z-10 text-white">Enter</span>
                            <motion.span
                                className="relative z-10 flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm"
                                animate={{ x: [0, 2, 0] }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <ChevronRight className="w-4 h-4 md:w-4.5 md:h-4.5" />
                            </motion.span>
                            <span className="absolute -inset-px rounded-full border border-white/10 pointer-events-none" />
                        </motion.button>

                        {/* --- SCROLL DOWN ARROW BUTTON --- */}
                        <AnimatePresence>
                            {showScrollDown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="cursor-pointer text-slate-500 hover:text-red-500 transition-colors"
                                    onClick={scrollToVideo}
                                >
                                    <motion.div
                                        animate={{ y: [0, 8, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="flex flex-col items-center -space-y-4"
                                    >
                                        <ChevronDown className="w-8 h-8 md:w-10 md:h-10" strokeWidth={2.5} />
                                        <ChevronDown className="w-8 h-8 md:w-10 md:h-10 opacity-50" strokeWidth={2.5} />
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* =========================================
                SECTION 2: FEATURES & VIDEO (RESPONSIVE FIX)
               ========================================= */}
            <div ref={videoSectionRef} className="relative py-16 md:py-20 w-full bg-slate-950 border-t border-red-900/10">
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    
                    {/* --- VIDEO CONTAINER --- */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="relative w-full overflow-hidden shadow-2xl bg-black border border-red-900/30 mx-auto max-w-5xl group mb-16 h-[500px] md:h-auto md:aspect-video rounded-[1.5rem] md:rounded-[2rem]"
                    >
                        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                            <iframe
                                className="absolute inset-0 w-full h-full object-cover opacity-60"
                                src="https://www.youtube.com/embed/XDGm-7zuF88?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playlist=XDGm-7zuF88&playsinline=1"
                                title="YouTube background video"
                                frameBorder="0"
                                allow="autoplay; encrypted-media"
                                allowFullScreen={false}
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                        </div>
                        
                        {/* --- RESPONSIVE OVERLAY CONTENT --- */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                whileInView={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="w-full max-w-2xl px-2"
                            >
                                <span className="inline-block px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 text-[10px] md:text-xs font-bold mb-3 md:mb-4 backdrop-blur-sm tracking-wide uppercase">
                                    ★ නවීන අධ්‍යාපන ක්‍රමවේදය
                                </span>
                                
                                <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-2 md:mb-4 drop-shadow-xl flex items-center justify-center gap-2 flex-wrap leading-tight">
                                    ඇයි අපි විශේෂ <span className="text-red-600 text-4xl sm:text-5xl md:text-7xl drop-shadow-2xl">🛑</span> ?
                                </h2>
                                
                                <p className="text-slate-200 text-sm md:text-xl font-medium mb-6 md:mb-8 drop-shadow-md leading-relaxed px-2">
                                    ඔබේ අධ්‍යාපනික අනාගතය වෙනස් කරන නවීනතම මාර්ගය
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center w-full px-4 sm:px-0">
                                    <button 
                                        onClick={() => router.push('/auth')}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white px-6 py-3 rounded-xl font-bold text-sm md:text-base transition-all transform hover:scale-105 shadow-lg"
                                    >
                                        <BookOpen className="w-4 h-4" /> Login
                                    </button>
                                    <a 
                                        href="https://www.youtube.com/@sftking8044" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-500 hover:border-white text-white px-6 py-3 rounded-xl font-bold text-sm md:text-base backdrop-blur-md transition-all transform hover:scale-105"
                                    >
                                        <PlayCircle className="w-4 h-4" /> Go YouTube
                                    </a>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* --- INFO CARDS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-16">
                        {[
                            { icon: <GraduationCap />, title: "විශේෂිත උපදේශනය", text: "අපගේ පුද්ගලීකරණය කරන ලද උපදේශන ක්‍රමවේදය ඔබගේ අධ්‍යාපනික අවශ්‍යතා සම්පූර්ණයෙන්ම සපුරාලයි." },
                            { icon: <Laptop />, title: "තාක්ෂණික ප්‍රගතිය", text: "නවීනතම තාක්ෂණය භාවිතා කරමින් අන්තර්ක්‍රියාකාරී හා රසවත් ඉගෙනුම් අත්දැකීම්." },
                            { icon: <TrendingUp />, title: "සාර්ථකත්වයේ සහතිකය", text: "අපගේ ශිෂ්‍යයන්ගෙන් 95% කට ඔවුන්ගේ ඉලක්ක සපුරා ගැනීමට හැකි වී ඇත." }
                        ].map((card, i) => (
                            <motion.div 
                                key={i}
                                initial={{ y: 20, opacity: 0 }}
                                whileInView={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-slate-900/40 backdrop-blur-md border border-red-900/20 rounded-2xl md:rounded-3xl p-6 md:p-8 text-center hover:bg-slate-900/60 transition-all shadow-xl group"
                            >
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:scale-110 transition-transform group-hover:border-red-500/50">
                                    <div className="w-8 h-8 md:w-10 md:h-10 text-red-400 [&>svg]:w-full [&>svg]:h-full">
                                        {card.icon}
                                    </div>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3 group-hover:text-red-300 transition-colors">{card.title}</h3>
                                <p className="text-slate-400 text-xs md:text-sm leading-7 font-medium">
                                    {card.text}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* --- STATS STRIP --- */}
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-slate-900 to-slate-900/50 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-red-900/20 shadow-2xl"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center divide-x divide-slate-800/50">
                            {[
                                { val: "10,000+", lbl: "සුහද සිසු පිරිසක්" },
                                { val: "98%", lbl: "විශ්වවිද්‍යාල වරම්" },
                                { val: "90%", lbl: "සමත් ප්‍රතිශතය" },
                                { val: "24/7", lbl: "පහසු සේවය" }
                            ].map((stat, i) => (
                                <div key={i} className="px-2">
                                    <h4 className="text-2xl md:text-5xl font-extrabold text-white mb-1 md:mb-2">{stat.val}</h4>
                                    <p className="text-red-400 text-[10px] md:text-sm font-medium uppercase tracking-wide">{stat.lbl}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* --- STUDENT THOUGHTS --- */}
                    <div className="mt-16 md:mt-24 mb-10 text-center">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            className="text-2xl md:text-5xl font-bold text-white mb-8 md:mb-12 flex items-center justify-center gap-2 md:gap-4"
                        >
                            සිසුන්ගේ අදහස් <span className="text-2xl md:text-4xl">😍</span>
                        </motion.h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                            {testimonials.map((item, index) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-slate-900/60 backdrop-blur-xl border border-red-900/20 p-6 md:p-8 rounded-2xl md:rounded-3xl text-left hover:border-red-600/40 transition-colors relative"
                                >
                                    <div className="w-12 h-12 md:w-14 md:h-14 bg-red-900/20 rounded-xl flex items-center justify-center mb-4 md:mb-6">
                                        <Quote className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                                    </div>
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-4">{item.name}</h3>
                                    <p className="text-slate-400 text-xs md:text-sm leading-6 md:leading-7">
                                        {item.text}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* FOOTER */}
            <footer className="bg-black py-8 md:py-10 border-t border-slate-900 relative z-10">
                <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center">
                    <h3 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-rose-600 mb-2 md:mb-4">SFT KING</h3>
                    <p className="text-slate-600 text-xs md:text-sm">
                        © {new Date().getFullYear()} SFT KING. All rights reserved. Empowering the next generation.
                    </p>
                </div>
            </footer>
            </div>
        </>
    );
}
