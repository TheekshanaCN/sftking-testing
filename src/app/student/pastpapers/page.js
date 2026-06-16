'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { socket } from '@/lib/socket'; 
import axios from '@/lib/axios';
import { 
    Folder, FileText, ChevronRight, Loader2, 
    Search, Home, BookOpen, Lock, Unlock, ShieldAlert 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { emitStudentActivity } from '@/lib/studentActivity';

export default function StudentPastPapers() {
    const { user } = useAuth();
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlPathString = searchParams.get('p');

    const [path, setPath] = useState([{ id: null, name: 'Root' }]);
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(''); 
    
    // Security States
    const [selectedFile, setSelectedFile] = useState(null);
    const [requesting, setRequesting] = useState(false);

    const currentFolder = path[path.length - 1];

    const fetchData = async () => {
        setLoading(true);
        try {
            const folderRes = await axios.get(`/pastpapers/folders?parentId=${currentFolder.id}`);
            setFolders(folderRes.data);

            if (currentFolder.id !== null) {
                const fileRes = await axios.get(`/pastpapers/files?folderId=${currentFolder.id}`);
                setFiles(fileRes.data);
            } else {
                setFiles([]);
            }
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        if (user) { fetchData(); }
        setSearchQuery(''); 
    }, [currentFolder.id, user]);

    useEffect(() => {
        if (urlPathString) {
            try {
                const parsedPath = JSON.parse(decodeURIComponent(urlPathString));
                setPath(parsedPath);
            } catch (e) {
                setPath([{ id: null, name: 'Root' }]);
            }
        } else {
            setPath([{ id: null, name: 'Root' }]);
        }
    }, [urlPathString]);

    useEffect(() => {
        if (user) {
            const pageName = currentFolder.id !== null ? `Browsing: ${currentFolder.name} (Library)` : "Library & Past Papers";
            emitStudentActivity(socket, user, {
                page: pageName,
                action: currentFolder.id !== null ? 'Browsing Past Paper Folder' : 'Browsing Past Papers',
                detail: currentFolder.name,
                route: '/student/pastpapers',
                kind: 'navigation'
            });
        }
    }, [currentFolder, user]);

    // ✅ REAL-TIME UNLOCK LISTENER (MAGIC!)
    useEffect(() => {
        if (!user) return;
        
        const handleRequestUpdate = (data) => {
            // If this socket event is for ME, and it's a PAST PAPER...
            if (data.studentId === user.id && data.type === 'PASTPAPER_ACCESS') {
                if (data.status === 'approved') {
                    // 🚀 The Admin just clicked approve! Instantly refresh the folders to turn the lock green!
                    fetchData();
                }
            }
        };

        socket.on('request_updated', handleRequestUpdate);
        
        return () => {
            socket.off('request_updated', handleRequestUpdate);
        };
    }, [user, currentFolder.id]);

    const navigateInto = (folder) => {
        const newPath = [...path, { id: folder.id, name: folder.name }];
        router.push(`?p=${encodeURIComponent(JSON.stringify(newPath))}`);
        emitStudentActivity(socket, user, {
            page: 'Library & Past Papers',
            action: 'Opened Folder',
            detail: folder.name,
            route: '/student/pastpapers',
            kind: 'navigation'
        });
        setSearchQuery('');
    };

    const navigateUpTo = (index) => {
        const newPath = path.slice(0, index + 1);
        if (index === 0) {
            router.push('/student/pastpapers');
        } else {
            router.push(`?p=${encodeURIComponent(JSON.stringify(newPath))}`);
        }
        emitStudentActivity(socket, user, {
            page: 'Library & Past Papers',
            action: 'Changed Breadcrumb',
            detail: newPath.map(p => p.name).join(' / '),
            route: '/student/pastpapers',
            kind: 'navigation'
        });
        setSearchQuery('');
    };

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredFiles = files.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));

    
    // ✅ SECURE FILE CLICK HANDLER (FULL SCREEN NEW TAB)
    const handleFileClick = (file) => {
        const isFreeFile = file.isFree === true || file.isFree === 1 || String(file.isFree) === 'true';

        if (file.isUnlocked || isFreeFile) {
            // 🚀 Removed "/student" from the URL. This breaks it out of the sidebar!
            emitStudentActivity(socket, user, {
                page: 'Past Papers',
                action: 'Opened Past Paper',
                detail: file.title,
                route: '/pdf-viewer',
                kind: 'content',
                contentId: file.id
            });
            window.open(`/pdf-viewer?id=${file.id}&type=pastpaper`, '_blank');
        } else {
            setSelectedFile(file);
        }
    };

    // ✅ SUBMIT ACCESS REQUEST
    const handleRequestAccess = async () => {
        setRequesting(true);
        try {
            const fd = new FormData();
            fd.append('studentId', user.id);
            fd.append('contentId', selectedFile.id);
            fd.append('type', 'PASTPAPER_ACCESS');

            await axios.post('/student/request', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            emitStudentActivity(socket, user, {
                page: 'Past Papers',
                action: 'Requested Past Paper Access',
                detail: selectedFile.title,
                route: '/student/pastpapers',
                kind: 'request',
                contentId: selectedFile.id
            });
            
            alert("Request sent successfully! The admin has been notified.");
            setSelectedFile(null);
            fetchData(); 
        } catch (e) {
            console.error("Request Error:", e);
            alert("Failed to send request. Check console for details.");
        } finally {
            setRequesting(false);
        }
    };

    return (
        // 🚀 Dark Mode: Main Background
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20 font-sans selection:bg-red-500 selection:text-white transition-colors duration-300">
            
            {/* 💎 PREMIUM STICKY HEADER */}
            {/* 🚀 Dark Mode: Header Background & Borders */}
            <div className="sticky top-0 z-[40] bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/10 shadow-sm w-full transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    
                    <div className="flex flex-col gap-2">
                        {/* 🚀 Dark Mode: Title Text */}
                        <h1 className="text-2xl font-[1000] text-slate-900 dark:text-white uppercase italic tracking-tighter flex items-center gap-3 transition-colors">
                            <BookOpen className="text-red-600 fill-red-100 dark:fill-red-900/30" size={28} />
                            Library & Past Papers
                        </h1>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {path.map((crumb, index) => (
                                <div key={index} className="flex items-center gap-1.5">
                                    {/* 🚀 Dark Mode: Breadcrumbs */}
                                    <button 
                                        onClick={() => navigateUpTo(index)} 
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            index === path.length - 1 
                                            ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md' 
                                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'
                                        }`}
                                    >
                                        {index === 0 && <Home size={12} />}
                                        {crumb.name === 'Root' ? 'Library' : crumb.name}
                                    </button>
                                    {index < path.length - 1 && <ChevronRight size={14} className="text-slate-400 dark:text-slate-600" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative group w-full md:w-80 shrink-0">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-red-500 transition-colors" />
                        {/* 🚀 Dark Mode: Search Bar */}
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search library..."
                            className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 pl-11 pr-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-red-500 dark:focus:border-red-500/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-32">
                        <Loader2 className="animate-spin text-red-600" size={48} />
                    </div>
                ) : (
                    <div className="space-y-10">
                        
                        {/* FOLDERS GRID */}
                        {filteredFolders.length > 0 && (
                            <div>
                                <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Folder size={14}/> Folders ({filteredFolders.length})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredFolders.map(folder => (
                                        // 🚀 Dark Mode: Folder Cards
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                                            key={folder.id} 
                                            onClick={() => navigateInto(folder)} 
                                            className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-5 rounded-2xl hover:border-red-400 dark:hover:border-red-500/50 hover:shadow-xl hover:shadow-red-500/10 transition-all duration-300 relative overflow-hidden"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl group-hover:bg-red-50 dark:group-hover:bg-red-500/10 transition-colors">
                                                    <Folder size={24} className="text-slate-400 dark:text-slate-500 group-hover:text-red-500 transition-colors" />
                                                </div>
                                                <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors mt-2" />
                                            </div>
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm truncate pr-4 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                                {folder.name}
                                            </h3>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILES GRID */}
                        {filteredFiles.length > 0 && (
                            <div>
                                <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <FileText size={14}/> Documents ({filteredFiles.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredFiles.map(file => {
                                        const hasAccess = file.isUnlocked || file.isFree;

                                        return (
                                            // 🚀 Dark Mode: Document Cards
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} 
                                                key={file.id} 
                                                className={`group relative bg-white dark:bg-slate-900 border p-4 rounded-2xl transition-all duration-300 ${hasAccess ? 'border-slate-200 dark:border-white/10 hover:border-red-400 dark:hover:border-red-500/50 hover:shadow-xl hover:shadow-red-500/10' : 'border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 opacity-90'}`}
                                            >
                                                <div className="absolute top-3 right-3">
                                                    {hasAccess ? (
                                                        <div className="bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 p-1.5 rounded-full shadow-sm transition-colors"><Unlock size={14} strokeWidth={3} /></div>
                                                    ) : (
                                                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-1.5 rounded-full shadow-sm transition-colors"><Lock size={14} strokeWidth={3} /></div>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={() => handleFileClick(file)}
                                                    className="w-full text-left flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-4 overflow-hidden pr-8">
                                                        <div className={`p-3 rounded-xl shrink-0 transition-colors ${hasAccess ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 group-hover:bg-red-600 dark:group-hover:bg-red-500 group-hover:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                                            <FileText size={20} />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`font-bold text-sm truncate transition-colors ${hasAccess ? 'text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white' : 'text-slate-500 dark:text-slate-500'}`}>
                                                                {file.title}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase transition-colors">
                                                                {file.isFree ? "Free Document" : `Locked (${file.timeLimit || 60}m Time Limit)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 🚀 Dark Mode: Empty State */}
                        {!loading && folders.length === 0 && files.length === 0 && !searchQuery && (
                            <div className="text-center py-24 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 border-dashed rounded-[2rem] transition-colors">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                                    <BookOpen size={32} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2 transition-colors">Folder is Empty</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm transition-colors">Check back later for new study materials.</p>
                            </div>
                        )}

                        {/* 🚀 Dark Mode: No Search Results State */}
                        {!loading && (folders.length > 0 || files.length > 0) && filteredFolders.length === 0 && filteredFiles.length === 0 && (
                            <div className="text-center py-24 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 border-dashed rounded-[2rem] transition-colors">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                                    <Search size={32} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2 transition-colors">No Results Found</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm transition-colors">We couldn't find anything matching "{searchQuery}"</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* 🚀 Dark Mode: Request Access Modal */}
            <AnimatePresence>
                {selectedFile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }} 
                            className="bg-white dark:bg-slate-900 border dark:border-white/10 w-full max-w-md rounded-[30px] p-8 shadow-2xl relative transition-colors duration-300"
                        >
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto transition-colors">
                                <ShieldAlert size={32} className="text-red-600 dark:text-red-500" />
                            </div>
                            
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white text-center uppercase tracking-tighter italic mb-2 transition-colors">Restricted Access</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-center text-sm font-medium mb-6 transition-colors">
                                You need permission to view <b className="text-slate-800 dark:text-slate-200">{selectedFile.title}</b>. This document has a strict time limit of <b className="text-red-600 dark:text-red-400">{selectedFile.timeLimit || 60} minutes</b> once opened.
                            </p>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setSelectedFile(null)} 
                                    className="flex-1 py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleRequestAccess} 
                                    disabled={requesting}
                                    className="flex-1 flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold uppercase text-xs tracking-widest bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30 dark:shadow-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {requesting ? <Loader2 size={16} className="animate-spin" /> : "Request Unlock"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}