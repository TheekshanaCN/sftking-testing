'use client';
import { motion } from 'framer-motion';
import { Check, X, FileImage, User, Banknote, FileText } from 'lucide-react'; 

export default function RequestRow({ req, onAction, isHistory = false }) {
    // ✅ SETUP: Determine the type of request to style it properly
    const isOnline = req.type === 'online';
    // 🚀 MAGIC FIX: Tell the row to treat Past Papers exactly like Video PDFs!
    const isPdf = req.type === 'PDF_ACCESS' || req.type === 'PASTPAPER_ACCESS';

    let iconBg = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500';
    let IconComponent = Banknote;
    let badgeBg = 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
    let badgeText = 'Hall Payment';

    if (isOnline) {
        iconBg = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500';
        IconComponent = FileImage;
        badgeBg = 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
        badgeText = 'Bank Slip';
    } else if (isPdf) {
        iconBg = 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500';
        IconComponent = FileText;
        badgeBg = 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400';
        badgeText = 'PDF Access';
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative bg-white dark:bg-slate-900 p-6 rounded-[24px] border flex flex-col md:flex-row justify-between items-center gap-6 transition-all duration-300 ${
                isHistory 
                ? 'border-slate-100 dark:border-white/5' 
                : 'border-slate-100 dark:border-white/10 shadow-sm hover:shadow-lg dark:hover:shadow-black/50 hover:border-red-100 dark:hover:border-red-500/30'
            }`}
        >
            {/* LEFT: INFO & IDENTITY */}
            <div className="flex gap-5 items-center w-full md:w-auto">
                {/* ✅ DYNAMIC ICON */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black shrink-0 transition-colors duration-300 ${iconBg}`}>
                    <IconComponent size={24}/>
                </div>
                
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {/* ✅ DYNAMIC BADGE */}
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-colors duration-300 ${badgeBg}`}>
                            {badgeText}
                        </span>
                        
                        {/* History Badge */}
                        {isHistory && (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-colors duration-300 ${
                                req.status === 'approved' 
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                                : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                            }`}>
                                {req.status}
                            </span>
                        )}
                    </div>
                    
                    <p className="font-black text-slate-800 dark:text-white text-lg italic uppercase truncate max-w-[200px] md:max-w-[300px] transition-colors duration-300">
                        {req.contentTitle || req.lessonName || "PDF Document"}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1">
                        <User size={12} className="text-slate-400 dark:text-slate-500"/>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors duration-300">
                            {req.studentName} 
                            <span className="text-slate-300 dark:text-slate-600 mx-1">|</span> 
                        </p>
                    </div>
                </div>
            </div>

            {/* RIGHT: ACTIONS (Always Visible) */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-50 dark:border-white/5 pt-4 md:pt-0 transition-colors duration-300">
                
                {/* View Slip */}
                {req.type === 'online' && req.proof_image && (
                    <a 
                        href={`/uploads/${req.proof_image}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-100 dark:border-slate-700 hover:bg-slate-900 dark:hover:bg-slate-700 hover:text-white transition-all mr-2"
                    >
                        <FileImage size={14}/> Proof
                    </a>
                )}

                {/* APPROVE (Disabled if already approved) */}
                <button 
                    onClick={() => onAction(req.id, 'approved')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        req.status === 'approved' 
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-500 cursor-default opacity-50' 
                        : 'bg-emerald-500 dark:bg-emerald-600 text-white shadow-lg dark:shadow-none hover:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-95'
                    }`}
                    disabled={req.status === 'approved'}
                >
                    <Check size={16} strokeWidth={3}/> {req.status === 'approved' ? 'Active' : 'Approve'}
                </button>
                
                {/* DECLINE (Disabled if already declined) */}
                <button 
                    onClick={() => onAction(req.id, 'declined')}
                    className={`p-2 rounded-xl border-2 transition-all active:scale-95 ${
                        req.status === 'declined'
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-300 dark:text-red-500/50 border-red-50 dark:border-red-500/10 cursor-default'
                        : 'bg-white dark:bg-slate-800 text-red-400 border-red-50 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-300'
                    }`}
                    disabled={req.status === 'declined'}
                    title="Decline"
                >
                    <X size={18} strokeWidth={3}/>
                </button>

            </div>
        </motion.div>
    );
}