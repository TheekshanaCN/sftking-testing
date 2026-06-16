'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { socket } from '@/lib/socket'; 
import { emitStudentActivity } from '@/lib/studentActivity';
import VideoCard from '@/components/student/VideoCard';
import PaymentModal from '@/components/student/PaymentModal'; 
import { Search, Folder, ChevronLeft, Lock, Unlock, CreditCard, X, Copy, Building2, MapPin, Check, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RecordingsLibrary() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlFolderId = searchParams.get('f');
    
    // DATA STATE
    const [allLessons, setAllLessons] = useState([]); 
    const [allContent, setAllContent] = useState([]); 
    
    // NAVIGATION STATE (NESTED)
    const [path, setPath] = useState([]); 
    const activeFolder = path.length > 0 ? path[path.length - 1] : null;

    // VIEW STATE
    const [viewFolders, setViewFolders] = useState([]);
    const [viewVideos, setViewVideos] = useState([]);
    
    const [selectedItem, setSelectedItem] = useState(null); 
    const [search, setSearch] = useState("");
    const [showBankDetails, setShowBankDetails] = useState(false);
    
    // BANK STATE
    const [bankInfo, setBankInfo] = useState({ 
        bankName: "Loading...",
        accNum: "Loading...", 
        accName: "Loading...", 
        branch: "Loading..." 
    });

    const buildPathLabel = () => {
        if (!path || path.length === 0) return 'Root';
        return path.map((p) => p.name).join(' / ');
    };

    const load = async () => {
        if (!user) return;
        try {
            const res = await axios.get('/student/content'); 
            
            const filteredLessons = res.data.lessons.filter(l => {
                if (l.type !== 'Recordings') return false;
                const lessonBatches = typeof l.batches === 'string' 
                    ? JSON.parse(l.batches) 
                    : l.batches;
                return lessonBatches.includes("All") || lessonBatches.includes(user.batch);
            });

            setAllLessons(filteredLessons);
            setAllContent(res.data.content);

            try {
                const bankRes = await axios.get('/config/bank-details');
                if (bankRes.data) setBankInfo(bankRes.data);
            } catch(e) {
                setBankInfo({ bankName: "Bank of Ceylon", accNum: "123456789", accName: "MIS Holding (Pvt)Ltd", branch: "Monaragala" });
            }

        } catch (e) { console.error(e); }
    };

    useEffect(() => { 
        load(); 
        const handleRefresh = () => load();
        
        socket.on('notification', handleRefresh);
        socket.on('content_updated', handleRefresh); 

        return () => {
            socket.off('notification', handleRefresh);
            socket.off('content_updated', handleRefresh);
        };
    }, [user]);

    useEffect(() => {
        if (allLessons.length === 0) return; 

        if (!urlFolderId) {
            setPath([]); 
            return;
        }

        let current = allLessons.find(l => String(l.id) === String(urlFolderId));
        let newPath = [];

        while (current) {
            newPath.unshift(current); 
            current = current.parentId ? allLessons.find(l => String(l.id) === String(current.parentId)) : null;
        }

        setPath(newPath); 
    }, [urlFolderId, allLessons]);

    useEffect(() => {
        if (!activeFolder) {
            setViewFolders(allLessons.filter(l => !l.parentId && l.name.toLowerCase().includes(search.toLowerCase())));
            setViewVideos([]); 
        } else {
            setViewFolders(allLessons.filter(l => l.parentId === activeFolder.id && l.name.toLowerCase().includes(search.toLowerCase())));
            setViewVideos(allContent.filter(c => c.lessonId === activeFolder.id && c.title.toLowerCase().includes(search.toLowerCase())));
        }
    }, [path, allLessons, allContent, search]);

    useEffect(() => {
        if (user) {
            const pageName = activeFolder ? `Browsing: ${activeFolder.name}` : "Recordings Library";
            const pathLabel = buildPathLabel();
            emitStudentActivity(socket, user, {
                page: pageName,
                action: activeFolder ? 'Browsing Recording Folder' : 'Browsing Recording Library',
                detail: pathLabel,
                route: '/student/recordings',
                kind: 'navigation'
            });
        }
    }, [activeFolder, user]);

    const handleFolderClick = (lesson) => {
        const isFree = !lesson.price || lesson.price === "0";
        const isUnlocked = lesson.isPaid || isFree;
        
        if (isUnlocked) {
            const nextPath = [...path.map((p) => p.name), lesson.name].join(' / ');
            emitStudentActivity(socket, user, {
                page: `Browsing Recording Folder: ${lesson.name}`,
                action: 'Opened Recording Folder',
                detail: nextPath,
                route: '/student/recordings',
                kind: 'navigation'
            });
            router.push(`?f=${lesson.id}`);
            setSearch(""); 
        } else {
            setSelectedItem({ lesson: lesson });
        }
    };

    const handleBack = () => router.back(); 
    const handleHome = () => router.push('/student/recordings');

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied: " + text);
    };

    // --- BANK DETAILS POPUP (Dark Mode Ready) ---
    const BankDetailsModal = () => (
        <AnimatePresence>
            {showBankDetails && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setShowBankDetails(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        // 🚀 Dark Mode: Card background & border
                        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[30px] overflow-hidden shadow-2xl relative transition-colors duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30"><Building2 size={20} /></div>
                                <div><h3 className="text-lg font-black uppercase italic tracking-wider">Bank Details</h3><p className="text-[10px] text-red-100 opacity-80 font-bold uppercase tracking-widest">For Bank Transfers</p></div>
                            </div>
                            <button onClick={() => setShowBankDetails(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        
                        {/* 🚀 Dark Mode: Inner content background */}
                        <div className="p-6 space-y-4 bg-[#FFFBFB] dark:bg-slate-950 transition-colors duration-300">
                            {/* Bank Detail Rows */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/50 transition-colors">
                                <div><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Bank Name</p><p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{bankInfo.bankName}</p></div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/50 transition-colors">
                                <div><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Account Number</p><p className="text-xl font-mono font-black text-slate-800 dark:text-white tracking-wider">{bankInfo.accNum}</p></div>
                                <button onClick={() => handleCopy(bankInfo.accNum)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all border border-slate-100 dark:border-white/5"><Copy size={18} /></button>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/50 transition-colors">
                                <div><p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Account Holder</p><p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">{bankInfo.accName}</p></div>
                                <button onClick={() => handleCopy(bankInfo.accName)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all border border-slate-100 dark:border-white/5"><Copy size={18} /></button>
                            </div>
                            
                            <div className="flex items-center gap-3 px-2 py-2 bg-red-50/50 dark:bg-red-500/10 rounded-xl border border-red-100/50 dark:border-red-500/20">
                                <MapPin size={18} className="text-red-500" /><p className="text-xs font-bold text-slate-600 dark:text-slate-300"><span className="uppercase text-[10px] text-slate-400 dark:text-slate-500 mr-2 tracking-widest">Branch:</span> {bankInfo.branch}</p>
                            </div>
                        </div>
                        
                        {/* 🚀 Dark Mode: Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 text-center transition-colors duration-300">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Please upload slip with your <b className="dark:text-white">name</b> after transfer</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        // 🚀 Dark Mode: Main wrapper
        <div className="flex flex-col min-h-screen bg-[#FFFBFB] dark:bg-slate-950 relative pt-4 transition-colors duration-300">
            
            {/* 🚀 Dark Mode: Payment Button */}
            <motion.button 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                onClick={() => setShowBankDetails(true)} 
                className="fixed bottom-6 right-4 z-50 md:absolute md:top-8 md:right-8 md:bottom-auto flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-500 rounded-full shadow-xl md:shadow-sm hover:shadow-md hover:border-red-200 dark:hover:border-red-500/50 transition-all"
            >
                <CreditCard size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Payment Details</span>
            </motion.button>

            <BankDetailsModal />

            {/* HEADER AREA */}
            {/* 🚀 Dark Mode: Sticky Header backdrop */}
            <div className="shrink-0 pb-6 px-4 z-40 mt-2 sm:mt-0 sticky top-0 bg-[#FFFBFB]/95 dark:bg-slate-950/95 backdrop-blur-sm relative transition-colors duration-300">
                <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter mb-4 pt-8 sm:pt-0 transition-colors">Recordings Library</h2>
                </div>
                
                {/* BREADCRUMBS & NAVIGATION */}
                <div className="flex items-center gap-3 mb-4 overflow-x-auto max-w-full pb-2">
                    {activeFolder && (
                        // 🚀 Dark Mode: Back button
                        <button onClick={handleBack} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-white transition-colors shrink-0">
                            <ChevronLeft size={16}/>
                        </button>
                    )}
                    
                    {/* 🚀 Dark Mode: Home button */}
                    <button onClick={handleHome} className={`p-2 rounded-lg transition-colors shrink-0 ${!activeFolder ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                        <Home size={16}/>
                    </button>
                    
                    {path.map((folder, i) => (
                        <div key={folder.id} className="flex items-center gap-2 shrink-0">
                            {/* 🚀 Dark Mode: Separator */}
                            <span className="text-slate-300 dark:text-slate-600 text-xs">/</span>
                            {/* 🚀 Dark Mode: Path buttons */}
                            <button 
                                onClick={() => setPath(path.slice(0, i + 1))}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${i === path.length - 1 ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="max-w-md mx-auto relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                    {/* 🚀 Dark Mode: Search input */}
                    <input value={search} onChange={(e) => setSearch(e.target.value)} type="text" placeholder="Search current folder..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 dark:text-white py-3 pl-14 pr-6 rounded-full shadow-sm outline-none font-bold text-sm focus:border-red-200 dark:focus:border-red-500/50 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-500/10 transition-all" />
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 px-4 pb-20">
                
                {/* 1. FOLDERS */}
                {viewFolders.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {viewFolders.map(l => {
                            const isFree = !l.price || l.price === "0";
                            const isUnlocked = l.isPaid || isFree;
                            
                            const isRootFolder = !activeFolder;
                            const itemCount = isRootFolder
                                ? allLessons.filter(subLesson => String(subLesson.parentId) === String(l.id)).length 
                                : {
                                    folders: allLessons.filter(subLesson => String(subLesson.parentId) === String(l.id)).length, 
                                    videos: allContent.filter(c => c.lessonId === l.id).length 
                                  };
                            
                            return (
                                // 🚀 Dark Mode: Folder Cards
                                <div key={l.id} onClick={() => handleFolderClick(l)} className={`relative p-8 rounded-[35px] border shadow-sm transition-all duration-300 cursor-pointer group overflow-hidden ${isUnlocked ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10 hover:shadow-xl hover:scale-[1.02]' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/5 opacity-90 hover:opacity-100'}`}>
                                    <div className="absolute top-4 right-4">
                                        {isUnlocked ? <div className="bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 p-2 rounded-full shadow-sm transition-colors"><Unlock size={16}/></div> : <div className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 p-2 rounded-full shadow-sm transition-colors"><Lock size={16}/></div>}
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 shadow-inner transition-colors"><Folder size={28} /></div>
                                    {l.month && <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{l.month}</span>}
                                    <h3 className="font-black text-slate-800 dark:text-white text-xl italic tracking-tighter mb-1 line-clamp-1 transition-colors">{l.name}</h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{l.price && l.price !== "0" ? `LKR ${l.price}` : 'OPEN'}</p>
                                    {isRootFolder ? (
                                        itemCount > 0 && <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{itemCount} Folders</p>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                            {itemCount.folders > 0 && `${itemCount.folders} Folders`}
                                            {itemCount.folders > 0 && itemCount.videos > 0 && ', '}
                                            {itemCount.videos > 0 && `${itemCount.videos} Videos`}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 2. VIDEOS */}
                {viewVideos.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {viewVideos.map(item => (
                            <VideoCard
                                key={item.id}
                                item={item}
                                user={user}
                                activityRoute="/student/recordings"
                                onUnlock={() => item.isSeparate && setSelectedItem(item)}
                            />
                        ))}
                    </div>
                )}

                {/* EMPTY STATE */}
                {viewFolders.length === 0 && viewVideos.length === 0 && (
                    // 🚀 Dark Mode: Empty state
                    <div className="flex flex-col items-center justify-center h-64 text-slate-300 dark:text-slate-600 transition-colors">
                        <Folder size={48} className="mb-4 opacity-50"/>
                        <p className="font-black uppercase tracking-widest">Empty</p>
                    </div>
                )}
            </div>

            {selectedItem && <PaymentModal item={selectedItem} user={user} onClose={() => setSelectedItem(null)} onSuccess={() => { setSelectedItem(null); load(); }} />}
        </div>
    );
}