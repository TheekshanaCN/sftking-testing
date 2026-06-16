'use client';
import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios';
import { 
    Folder, FileText, ChevronRight, Trash2, UploadCloud, 
    Edit3, Loader2, X, Search, FolderPlus, Home 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

// ✅ VAULT POPUP COMPONENT
function MediaPickerModal({ onClose, onSelect }) {
    const [files, setFiles] = useState([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        axios.get('/admin/vault/files')
            .then(res => { if (res.data.success) setFiles(res.data.files); })
            .catch(console.error);
    }, []);

    const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-4xl h-[80vh] rounded-[30px] p-8 shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase text-slate-800 dark:text-white flex items-center gap-3 transition-colors duration-300">
                        <FolderPlus className="text-red-600 dark:text-red-500" /> Select From Vault
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="mb-6 relative">
                    <Search className="absolute left-4 top-3 text-slate-400 dark:text-slate-500" size={18} />
                    <input 
                        autoFocus
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 rounded-xl py-3 pl-12 pr-4 font-bold text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-500 dark:focus:border-red-500 transition-colors duration-300"
                        placeholder="Search filenames..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
                    {filtered.map(file => {
                        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                        const displayName = file.name.split('_').slice(1).join('_') || file.name;

                        return (
                            <div 
                                key={file.name}
                                onClick={() => onSelect(file.name)}
                                className="group cursor-pointer bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl p-3 hover:border-red-500 dark:hover:border-red-500/50 hover:shadow-xl transition-all"
                            >
                                <div className="h-24 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center mb-3 text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors">
                                    <FileText size={32}/> 
                                </div>
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate mb-1 transition-colors" title={displayName}>{displayName}</p>
                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded transition-colors">{sizeMB} MB</span>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <div className="col-span-full text-center py-20 opacity-30 font-black dark:text-white">No Files Found</div>}
                </div>
            </div>
        </div>
    );
}

export default function AdminPastPapers() {
    const { user } = useAuth(); 

    // --- STATE ---
    const [path, setPath] = useState([{ id: null, name: 'Root' }]);
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showFileModal, setShowFileModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
    // File Upload/Edit State
    const [editingFileId, setEditingFileId] = useState(null); 
    const [pdfTitle, setPdfTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [isFree, setIsFree] = useState(false);
    const [timeLimit, setTimeLimit] = useState(60);
    const fileInputRef = useRef(null);

    // Vault States
    const [pdfTab, setPdfTab] = useState('upload');
    const [libraryFiles, setLibraryFiles] = useState([]);
    const [selectedLibraryFile, setSelectedLibraryFile] = useState(null);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    // Folder Edit State
    const [editMode, setEditMode] = useState({ type: null, id: null });
    const [editName, setEditName] = useState('');

    const currentFolder = path[path.length - 1];

    // --- FETCH DATA ---
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

    // Fetch Media Library Files
    useEffect(() => {
        if (showFileModal && pdfTab === 'library') {
            axios.get('/admin/vault/files').then(res => {
                setLibraryFiles(res.data.files);
            }).catch(e => console.error("Vault fetch error", e));
        }
    }, [showFileModal, pdfTab]);

    // --- NAVIGATION ---
    const navigateInto = (folder) => setPath([...path, { id: folder.id, name: folder.name }]);
    const navigateUpTo = (index) => setPath(path.slice(0, index + 1));

    // --- ACTIONS ---
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return alert("Enter a folder name");
        try {
            await axios.post('/admin/pastpapers/folders', { name: newFolderName, parentId: currentFolder.id });
            setNewFolderName(''); setShowFolderModal(false); fetchData();
        } catch (e) { alert("Failed to create folder"); }
    };

    const handleLibrarySelect = (filename) => {
        setSelectedLibraryFile(filename);
        if (!pdfTitle) {
            const cleanTitle = filename.split('_').slice(1).join('_').split('.').slice(0, -1).join('.') || filename;
            setPdfTitle(cleanTitle); 
        }
        setShowMediaPicker(false);
    };

    const resetFileModal = () => {
        setShowFileModal(false); 
        setSelectedFile(null); 
        setSelectedLibraryFile(null); 
        setPdfTitle(''); 
        setIsFree(false); 
        setTimeLimit(60);
        setEditingFileId(null);
        setPdfTab('upload');
    };

    const handleUploadPdf = async () => {
        if (!pdfTitle.trim()) return alert("Enter a title");

        setUploading(true);
        try {
            let filenameToSave = null;

            if (pdfTab === 'upload' && selectedFile) {
                const ext = selectedFile.name.split('.').pop() || 'pdf';
                const safeTitle = pdfTitle.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
                const renamedFile = new File([selectedFile], `${safeTitle}.${ext}`, { type: selectedFile.type });

                const fd = new FormData();
                fd.append("file", renamedFile);
                
                const uploadRes = await axios.post('/admin/vault/upload', fd, { 
                    headers: { 'Content-Type': 'multipart/form-data' } 
                });
                
                if (!uploadRes.data.success) throw new Error("Vault upload failed");
                filenameToSave = uploadRes.data.filename;

            } else if (pdfTab === 'library' && selectedLibraryFile) {
                filenameToSave = selectedLibraryFile;
            } else if (!editingFileId) {
                return alert("Select a file to attach");
            }

            if (editingFileId) {
                await axios.put(`/admin/pastpapers/files/${editingFileId}`, {
                    title: pdfTitle,
                    filename: filenameToSave, 
                    isFree: isFree,
                    timeLimit: timeLimit
                });
            } else {
                await axios.post('/admin/pastpapers/files', {
                    title: pdfTitle,
                    folderId: currentFolder.id,
                    filename: filenameToSave,
                    isFree: isFree,
                    timeLimit: timeLimit
                });
            }

            resetFileModal();
            fetchData();
        } catch (e) { 
            alert(`Save failed: ${e.message}`); 
        } finally { 
            setUploading(false); 
        }
    };

    const handleDeleteFolder = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Delete this folder? This will also delete EVERYTHING inside it!")) return;
        try { await axios.delete(`/admin/pastpapers/folders/${id}`); fetchData(); } catch (e) { alert("Delete failed"); }
    };

    const handleDeleteFile = async (id) => {
        if (!confirm("Delete this PDF?")) return;
        try { await axios.delete(`/admin/pastpapers/files/${id}`); fetchData(); } catch (e) { alert("Delete failed"); }
    };

    const openEditModal = (e, type, item) => {
        if(e) e.stopPropagation();

        if (type === 'folder') {
            setEditMode({ type, id: item.id });
            setEditName(item.name);
        } else {
            setPdfTitle(item.title);
            setIsFree(item.isFree === true || item.isFree === 1);
            setTimeLimit(item.timeLimit || 60);
            setEditingFileId(item.id);
            setSelectedLibraryFile(item.pdfFile);
            setPdfTab('library');
            setShowFileModal(true);
        }
    };

    const handleEditSubmit = async () => {
        if (!editName.trim()) return alert("Name cannot be empty");
        try {
            await axios.put(`/admin/pastpapers/folders/${editMode.id}`, { name: editName });
            setEditMode({ type: null, id: null }); setEditName(''); fetchData();
        } catch (e) { alert("Edit failed"); }
    };

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredFiles = files.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-transparent pb-20 font-sans selection:bg-red-500 selection:text-white transition-colors duration-300">
            
            {/* 💎 PREMIUM STICKY HEADER */}
            <div className="sticky top-0 z-[40] bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 w-full transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-5">
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-2xl font-[1000] text-slate-900 dark:text-white uppercase italic tracking-tighter flex items-center gap-3 transition-colors duration-300">
                                <Folder className="text-red-600 dark:text-red-500 fill-red-100 dark:fill-red-900/30 transition-colors" size={28} />
                                Past Papers Manager
                            </h1>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {path.map((crumb, index) => (
                                    <div key={index} className="flex items-center gap-1.5">
                                        <button 
                                            onClick={() => navigateUpTo(index)} 
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                                                index === path.length - 1 
                                                ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md' 
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            {index === 0 && <Home size={12} />}
                                            {crumb.name}
                                        </button>
                                        {index < path.length - 1 && <ChevronRight size={14} className="text-slate-400 dark:text-slate-600 transition-colors" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={() => setShowFolderModal(true)} className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm hover:shadow">
                                <FolderPlus size={16} className="text-slate-500 dark:text-slate-400" /> New Folder
                            </button>
                            {currentFolder.id !== null && (
                                <button 
                                    onClick={() => { resetFileModal(); setShowFileModal(true); }}
                                    className="flex items-center justify-center gap-2 bg-red-600 dark:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 dark:hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 hover:-translate-y-0.5"
                                >
                                    <FileText size={16} /> Add PDF
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative group w-full max-w-2xl">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-red-500 dark:group-focus-within:text-red-500 transition-colors" />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search folders & documents..." className="w-full bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 pl-11 pr-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-red-500/10 dark:focus:ring-red-500/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-32"><Loader2 className="animate-spin text-red-600 dark:text-red-500" size={48} /></div>
                ) : (
                    <div className="space-y-10">
                        {/* FOLDERS */}
                        {filteredFolders.length > 0 && (
                            <div>
                                <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 transition-colors duration-300"><Folder size={14}/> Folders ({filteredFolders.length})</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredFolders.map(folder => (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={folder.id} onClick={() => navigateInto(folder)} className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-5 rounded-2xl hover:border-red-400 dark:hover:border-red-500/30 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl group-hover:bg-red-50 dark:group-hover:bg-red-500/10 transition-colors"><Folder size={24} className="text-slate-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400" /></div>
                                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-sm border border-slate-100 dark:border-white/5 p-1">
                                                    <button onClick={(e) => openEditModal(e, 'folder', folder)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors"><Edit3 size={14} /></button>
                                                    <button onClick={(e) => handleDeleteFolder(e, folder.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm truncate pr-4 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{folder.name}</h3>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILES */}
                        {filteredFiles.length > 0 && (
                            <div>
                                <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 transition-colors duration-300"><FileText size={14}/> Documents ({filteredFiles.length})</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredFiles.map(file => (
                                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} key={file.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-300">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-xl shrink-0 transition-colors"><FileText size={20} className="text-red-600 dark:text-red-500" /></div>
                                                <div className="flex flex-col min-w-0">
                                                    <a href={`/api/secure-vault/${file.pdfFile}`} target="_blank" rel="noopener noreferrer" className="font-bold text-sm text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 truncate transition-colors">{file.title}</a>
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase transition-colors">
                                                        {file.isFree ? "Free PDF" : `Locked (${file.timeLimit || 60}m)`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0 ml-2">
                                                <button onClick={(e) => openEditModal(e, 'file', file)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDeleteFile(file.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* EMPTY STATES */}
                        {!loading && folders.length === 0 && files.length === 0 && !searchQuery && (
                            <div className="text-center py-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-dashed rounded-[2rem] transition-colors duration-300">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors"><FolderPlus size={32} className="text-slate-300 dark:text-slate-600" /></div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2 transition-colors">Folder is Empty</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm transition-colors">Create a new folder or upload a PDF to get started.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MODALS */}
            
            {/* 1. FOLDER MODAL */}
            <AnimatePresence>
                {showFolderModal && (
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-colors duration-300">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative transition-colors duration-300">
                            <button onClick={() => setShowFolderModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"><X size={20}/></button>
                            <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white mb-6 flex items-center gap-2 transition-colors duration-300"><FolderPlus className="text-slate-400 dark:text-slate-500"/> New Folder</h3>
                            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g. 2024 Past Papers" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-xl font-bold text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-800 dark:focus:border-white mb-6 transition-all duration-300" />
                            <button onClick={handleCreateFolder} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-black dark:hover:bg-slate-200 transition-colors shadow-lg">Create Folder</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 2. UPLOAD / EDIT FILE MODAL */}
            <AnimatePresence>
                {showFileModal && (
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-colors duration-300">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="font-black text-lg uppercase tracking-tight text-red-600 dark:text-red-500 flex items-center gap-2 transition-colors">
                                    <FileText/> {editingFileId ? 'Edit Document' : 'Attach Secure PDF'}
                                </h3>
                                <button onClick={resetFileModal} className="text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"><X size={20}/></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4 space-y-6">
                                {/* TITLE */}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 ml-1 transition-colors">Document Display Title</p>
                                    <input value={pdfTitle} onChange={e => setPdfTitle(e.target.value)} placeholder="e.g. 2024 Model Paper 1" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-xl font-bold text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-red-500 dark:focus:border-red-500 transition-all duration-300" />
                                </div>

                                {/* SECURITY SETTINGS */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-4 mb-6 transition-colors duration-300">
                                    <h4 className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-4 tracking-widest transition-colors">Access Controls</h4>
                                    <div className={`flex items-center justify-between ${!isFree ? 'mb-4 pb-4 border-b border-slate-200 dark:border-white/10' : ''} transition-colors`}>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200 transition-colors">Requires Access Request</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium transition-colors">If enabled, students must ask permission.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input type="checkbox" className="sr-only peer" checked={!isFree} onChange={(e) => setIsFree(!e.target.checked)} />
                                            <div className="w-11 h-6 bg-green-500 dark:bg-green-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 dark:peer-checked:bg-red-600 shadow-inner"></div>
                                        </label>
                                    </div>
                                    {!isFree && (
                                        <div className="flex items-center justify-between mt-2">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200 transition-colors">Viewing Time Limit</p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium transition-colors">Minutes before the PDF locks again.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-2 text-center font-bold text-sm focus:border-red-500 dark:focus:border-red-500 outline-none shadow-sm transition-colors" min="1" />
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors">Mins</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FILE SELECTION */}
                                <div>
                                    <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-xl mb-4 transition-colors duration-300">
                                        <button onClick={() => setPdfTab('upload')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${pdfTab === 'upload' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-500 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Upload New</button>
                                        <button onClick={() => { setPdfTab('library'); setShowMediaPicker(true); }} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${pdfTab === 'library' ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-500 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Select Library</button>
                                    </div>

                                    {pdfTab === 'upload' ? (
                                        <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col justify-center items-center min-h-[160px] ${selectedFile ? 'border-red-500 bg-red-50/50 dark:bg-red-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <UploadCloud className={`mx-auto mb-4 ${selectedFile ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`} size={40} />
                                            {selectedFile ? (
                                                <p className="font-bold text-red-600 dark:text-red-500 text-sm truncate px-4 w-full">{selectedFile.name}</p>
                                            ) : (
                                                <>
                                                    <p className="font-black text-slate-700 dark:text-slate-300 uppercase text-sm mb-1">Click to browse PDF</p>
                                                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Max file size: 50MB</p>
                                                </>
                                            )}
                                            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={e => setSelectedFile(e.target.files[0])} />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10 rounded-2xl min-h-[160px] transition-colors">
                                            {selectedLibraryFile ? (
                                                <>
                                                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mb-3 shadow-sm text-red-500 dark:text-red-500"><FileText size={24} /></div>
                                                    <p className="text-[10px] font-black uppercase text-red-500 dark:text-red-400 tracking-widest mb-1">Vault File Selected</p>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-center break-all w-full text-sm">{selectedLibraryFile.split('_').slice(1).join('_') || selectedLibraryFile}</p>
                                                    <button onClick={() => setShowMediaPicker(true)} className="mt-3 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 uppercase bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow-md">Change File</button>
                                                </>
                                            ) : (
                                                <>
                                                    <FolderPlus className="text-slate-300 dark:text-slate-600 mb-3" size={36} />
                                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">No file selected from the vault yet.</p>
                                                    <button onClick={() => setShowMediaPicker(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-black dark:hover:bg-slate-200 transition-colors shadow-lg">Open Vault</button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <button onClick={handleUploadPdf} disabled={uploading} className="w-full shrink-0 flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-800 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-black dark:hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:hover:translate-y-0 mt-2">
                                {uploading ? <Loader2 className="animate-spin" size={18} /> : (editingFileId ? 'Save Changes' : 'Save Document')}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 3. FOLDER RENAME MODAL */}
            <AnimatePresence>
                {editMode.id !== null && editMode.type === 'folder' && (
                    <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-colors duration-300">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative transition-colors duration-300">
                            <button onClick={() => setEditMode({ type: null, id: null })} className="absolute top-5 right-5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors"><X size={20}/></button>
                            <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white mb-6 flex items-center gap-2 transition-colors duration-300"><Edit3 className="text-blue-500 dark:text-blue-400"/> Rename Folder</h3>
                            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 mb-6 transition-all duration-300" />
                            <button onClick={handleEditSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors shadow-lg">Save Changes</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 4. MEDIA PICKER MODAL */}
            <AnimatePresence>
                {showMediaPicker && <MediaPickerModal onClose={() => setShowMediaPicker(false)} onSelect={handleLibrarySelect} />}
            </AnimatePresence>
        </div>
    );
}