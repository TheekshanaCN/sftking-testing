'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from '@/lib/axios';
import { Folder, FileText, Trash2, ChevronRight, Home, Loader2, Save, FileQuestion, Users, Search, Award, CheckSquare, BarChart, Clock, ArrowLeft, Edit, Download, PenTool, Zap } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import GradingCanvas from '@/components/GradingCanvas';

const GREAT_VIBES_VFS_NAME = 'GreatVibes-Regular.ttf';
const GREAT_VIBES_FONT_NAME = 'GreatVibes';
let greatVibesBase64Promise = null;

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};

const ensureGreatVibesFont = async (doc) => {
    try {
        if (!greatVibesBase64Promise) {
            greatVibesBase64Promise = fetch('/fonts/GreatVibes-Regular.ttf', { cache: 'force-cache' })
                .then((res) => {
                    if (!res.ok) throw new Error('Font load failed');
                    return res.arrayBuffer();
                })
                .then(arrayBufferToBase64);
        }

        const fontBase64 = await greatVibesBase64Promise;

        try {
            doc.addFileToVFS(GREAT_VIBES_VFS_NAME, fontBase64);
        } catch (e) {}

        try {
            doc.addFont(GREAT_VIBES_VFS_NAME, GREAT_VIBES_FONT_NAME, 'normal');
        } catch (e) {}

        return true;
    } catch (e) {
        return false;
    }
};

// ==========================================
// 🚜 STAGE 2: THE WRITTEN ENGINE (STRUCTURE + ESSAY)
// ==========================================
function WrittenEngine() {
    const [activeTab, setActiveTab] = useState('manager'); 
    const [availableBatches, setAvailableBatches] = useState([]);
    const [folders, setFolders] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [vaultFiles, setVaultFiles] = useState([]); 
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isFolderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [folderName, setFolderName] = useState('');
    
    const [isQuizModalOpen, setQuizModalOpen] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [quizForm, setQuizForm] = useState({ 
        title: '', pdfFile: '', readyTime: 5, timeLimit: 120, uploadGraceTime: 10, totalMarks: 100, batches: ['All'], startTime: '', endTime: '', status: 'scheduled' 
    });
    
    const [isPdfPickerOpen, setPdfPickerOpen] = useState(false);
    const [pdfSearch, setPdfSearch] = useState('');
    const [showAllPdfResults, setShowAllPdfResults] = useState(false);

    // 👑 CEO GRADING DESK STATES
    const [allQuizzes, setAllQuizzes] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState(null);
    const [writtenResults, setWrittenResults] = useState([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const canvasSnapshotRef = useRef(null);

    useEffect(() => {
        if (activeTab === 'manager') { loadData(); loadVaultFiles(); } 
        else if (activeTab === 'results') { loadAllQuizzes(); }
    }, [activeTab, currentFolder]);

    const loadData = async () => {
        setLoading(true);
        try {
            const folderRes = await axios.get(`/written/folders?parentId=${currentFolder || 'null'}`);
            setFolders(folderRes.data);
            const quizRes = await axios.get(`/written/quizzes?folderId=${currentFolder || 'null'}`);
            setQuizzes(quizRes.data);
            const batchRes = await axios.get('/batches');
            setAvailableBatches(batchRes.data.map(b => b.name));
        } catch (e) { console.error("Failed to load Written data"); }
        setLoading(false);
    };

    const loadVaultFiles = async () => {
        try {
            const res = await axios.get('/admin/vault/files');
            setVaultFiles(res.data.files.filter(f => f.name.endsWith('.pdf')));
        } catch (e) {}
    };

    const openNewFolderModal = () => { setEditingFolderId(null); setFolderName(''); setFolderModalOpen(true); };
    const openEditFolderModal = (folder) => { setEditingFolderId(folder.id); setFolderName(folder.name); setFolderModalOpen(true); };
    const handleSaveFolder = async (e) => {
        e.preventDefault();
        try {
            if (editingFolderId) await axios.put(`/admin/written/folders/${editingFolderId}`, { name: folderName });
            else await axios.post('/admin/written/folders', { name: folderName, parentId: currentFolder });
            setFolderModalOpen(false); loadData();
        } catch (e) { alert("Error saving folder"); }
    };
    
    const handleDeleteFolder = async (id) => {
        if(!confirm("DELETE THIS FOLDER AND ALL EXAMS INSIDE?")) return;
        await axios.delete(`/admin/written/folders/${id}`); loadData();
    };

    const enterFolder = (folder) => { setBreadcrumbs([...breadcrumbs, folder]); setCurrentFolder(folder.id); };
    const navigateToBreadcrumb = (index) => {
        if (index === -1) { setBreadcrumbs([]); setCurrentFolder(null); } 
        else { setBreadcrumbs(breadcrumbs.slice(0, index + 1)); setCurrentFolder(breadcrumbs[index].id); }
    };

    const openNewQuizModal = () => {
        setEditingQuizId(null);
        setQuizForm({ title: '', pdfFile: '', readyTime: 5, timeLimit: 120, uploadGraceTime: 10, totalMarks: 100, batches: ['All'], startTime: '', endTime: '', status: 'scheduled' });
        setQuizModalOpen(true);
    };

    const openEditQuizModal = (quiz) => {
        setEditingQuizId(quiz.id);
        let parsedBatches = ['All'];
        try { parsedBatches = quiz.batches ? JSON.parse(quiz.batches) : ['All']; } catch(e){}
        const formattedDate = quiz.startTime ? new Date(quiz.startTime).toISOString().slice(0, 16) : '';
        const formattedEndTime = quiz.endTime ? new Date(quiz.endTime).toISOString().slice(0, 16) : '';
        setQuizForm({ 
            title: quiz.title, pdfFile: quiz.pdfFile, readyTime: quiz.readyTime ?? 5, timeLimit: quiz.timeLimit ?? 120, uploadGraceTime: quiz.uploadGraceTime ?? 10,
            totalMarks: quiz.totalMarks ?? 100, batches: parsedBatches, startTime: formattedDate, endTime: formattedEndTime, status: quiz.status || 'live'
        });
        setQuizModalOpen(true);
    };

    const selectVaultPdf = (fileName) => {
        setQuizForm(prev => ({ ...prev, pdfFile: fileName }));
        setPdfPickerOpen(false);
    };

    const filteredVaultPdfFiles = useMemo(() => {
        const q = pdfSearch.trim().toLowerCase();
        if (!q) return vaultFiles;
        return vaultFiles.filter(f => f.name.toLowerCase().includes(q));
    }, [vaultFiles, pdfSearch]);

    const visibleVaultPdfFiles = useMemo(() => {
        if (showAllPdfResults) return filteredVaultPdfFiles;
        return filteredVaultPdfFiles.slice(0, 80);
    }, [filteredVaultPdfFiles, showAllPdfResults]);

    const hasMorePdfResults = filteredVaultPdfFiles.length > visibleVaultPdfFiles.length;

    const handleSaveQuiz = async (e) => {
        e.preventDefault();
        if (!quizForm.pdfFile) return alert("Please select a PDF from the Vault!");
        const payload = {
            title: quizForm.title, folderId: currentFolder, pdfFile: quizForm.pdfFile,
            readyTime: quizForm.readyTime, timeLimit: quizForm.timeLimit, uploadGraceTime: quizForm.uploadGraceTime, 
            totalMarks: quizForm.totalMarks, batches: quizForm.batches,
            startTime: quizForm.startTime ? new Date(quizForm.startTime).toISOString() : null,
            endTime: quizForm.endTime ? new Date(quizForm.endTime).toISOString() : null,
            status: quizForm.status
        };
        try {
            if (editingQuizId) await axios.put(`/admin/written/quizzes/${editingQuizId}`, payload);
            else await axios.post('/admin/written/quizzes', payload);
            setQuizModalOpen(false); loadData();
        } catch (e) { alert("Error saving Exam!"); }
    };

    const handleDeleteQuiz = async (id) => {
        if(!confirm("Delete this heavy-duty exam and all student uploads for it?")) return;
        await axios.delete(`/admin/written/quizzes/${id}`); loadData();
    };

    const loadAllQuizzes = async () => {
        setLoading(true);
        try {
            const resAll = await axios.get('/admin/written/all-quizzes'); 
            setAllQuizzes(resAll.data || []);
        } catch (e) {
            console.error("Failed to load all quizzes for the grading desk:", e);
            setAllQuizzes([]); 
        }
        setLoading(false);
    };

    const fetchWrittenResults = async (quizId) => {
        setSelectedQuizId(quizId); setResultsLoading(true); setSelectedSubmission(null);
        try {
            const res = await axios.get(`/admin/written/results/${quizId}`);
            setWrittenResults(res.data);
        } catch (e) {}
        setResultsLoading(false);
    };

    const handleSelectSubmission = (sub) => {
        setSelectedSubmission(sub);
        setGradeForm({ score: sub.score || '', feedback: sub.feedback || '' });
        setCurrentImageIndex(0);
    };

    const handleSaveGrade = async (status) => {
        try {
            const gradedImageBase64 = canvasSnapshotRef.current ? canvasSnapshotRef.current.exportGradedImage() : null;
            await axios.put(`/admin/written/results/${selectedSubmission.id}`, {
                score: parseInt(gradeForm.score) || 0,
                feedback: gradeForm.feedback,
                gradingStatus: status,
                gradedImageBase64: gradedImageBase64,
                gradedImageIndex: currentImageIndex 
            });
            alert(`Paper marked as: ${status.toUpperCase()}`);
            fetchWrittenResults(selectedQuizId);
            setSelectedSubmission(null);
        } catch (e) { alert("Failed to save grade!"); }
    };

    const handlePublishAll = async () => {
        if (!confirm("This will instantly reveal grades to ALL students who have been marked. Proceed?")) return;
        try {
            await axios.put(`/admin/written/quizzes/${selectedQuizId}/publish`);
            alert("ALL GRADES PUBLISHED TO STUDENTS!");
            fetchWrittenResults(selectedQuizId);
        } catch (e) { alert("Failed to publish!"); }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-slate-300 dark:border-slate-800 pb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2"><PenTool className="text-amber-500"/> Written Vault Control</h2>
                    <p className="text-slate-700 dark:text-slate-500 text-xs mt-1">Manage heavy-duty Structure & Essay exams with physical uploads.</p>
                </div>
                <div className="flex bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800">
                    <button onClick={() => setActiveTab('manager')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${activeTab === 'manager' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'}`}>
                        <Folder size={16} /> Deploy Papers
                    </button>
                    <button onClick={() => { setActiveTab('results'); loadAllQuizzes(); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${activeTab === 'results' ? 'bg-amber-700 text-white shadow-lg' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'}`}>
                        <CheckSquare size={16} /> Grading Desk
                    </button>
                </div>
            </div>

            {activeTab === 'manager' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="flex justify-end mb-6 gap-3">
                        <button onClick={openNewFolderModal} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700"><Folder size={16} /> New Folder</button>
                        {currentFolder && (
                            <button onClick={openNewQuizModal} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-600/20"><FileText size={16} /> Deploy Exam</button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mb-6 bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto whitespace-nowrap">
                        <button onClick={() => navigateToBreadcrumb(-1)} className="text-amber-500 hover:text-amber-400 flex items-center gap-1"><Home size={16} /> Home</button>
                        {breadcrumbs.map((crumb, index) => (
                            <div key={crumb.id} className="flex items-center gap-2">
                                <ChevronRight size={14} className="text-slate-800 dark:text-slate-600" />
                                <button onClick={() => navigateToBreadcrumb(index)} className="text-amber-500 hover:text-amber-400 font-semibold">{crumb.name}</button>
                            </div>
                        ))}
                    </div>
                    
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-600 w-10 h-10" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {folders.map(folder => (
                                <div key={`folder-${folder.id}`} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all group flex flex-col justify-between h-36 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-600"></div>
                                    <div className="cursor-pointer flex-1" onClick={() => enterFolder(folder)}>
                                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-3"><Folder size={24} /></div>
                                        <h3 className="font-bold text-lg truncate">{folder.name}</h3>
                                    </div>
                                    <div className="absolute bottom-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); openEditFolderModal(folder); }} className="text-slate-700 dark:text-slate-500 hover:text-blue-500"><Edit size={18} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-slate-700 dark:text-slate-500 hover:text-red-500"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                            {quizzes.map(quiz => (
                                <div key={`quiz-${quiz.id}`} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all group flex flex-col justify-between h-36 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                                    <div className="flex-1">
                                        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-3"><PenTool size={24} /></div>
                                        <h3 className="font-bold text-lg truncate">{quiz.title}</h3>
                                        <p className="text-xs text-slate-700 dark:text-slate-500 mt-1">{quiz.timeLimit} Mins Write • {quiz.totalMarks} Marks</p>
                                    </div>
                                    <div className="absolute bottom-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditQuizModal(quiz)} className="text-slate-700 dark:text-slate-500 hover:text-blue-500"><Edit size={18} /></button>
                                        <button onClick={() => handleDeleteQuiz(quiz.id)} className="text-slate-700 dark:text-slate-500 hover:text-red-500"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CEO GRADING DESK */}
            {activeTab === 'results' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col lg:flex-row gap-6 h-[75vh]">
                    <div className="w-full lg:w-1/3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-amber-500 uppercase tracking-widest text-sm flex items-center gap-2 mb-3"><Search size={16}/> Submission Radar</h3>
                            <select onChange={(e) => fetchWrittenResults(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500">
                                <option value="">-- Select Exam to Grade --</option>
                                {allQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                            </select>
                            {selectedQuizId && (
                                <button onClick={handlePublishAll} className="w-full mt-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 rounded-lg uppercase tracking-widest transition-all">
                                    🚨 Publish All Graded
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                            {resultsLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-500 w-8 h-8" /></div>
                            ) : writtenResults.length === 0 && selectedQuizId ? (
                                <p className="text-center text-slate-700 dark:text-slate-500 py-10 text-sm">No submissions yet.</p>
                            ) : (
                                writtenResults.map(res => (
                                    <button key={res.id} onClick={() => handleSelectSubmission(res)} className={`w-full text-left p-4 rounded-xl mb-2 transition-all flex items-center justify-between border ${selectedSubmission?.id === res.id ? 'bg-amber-600/20 border-amber-500/50' : 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 hover:border-amber-500/30'}`}>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{res.User?.name || res.user?.name || 'Unknown'}</div>
                                            <div className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 mt-1">{res.User?.mobile || res.user?.mobile}</div>
                                            <div className="mt-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                                {res.gradingStatus === 'pending' && <span className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded">Needs Grading</span>}
                                                {res.gradingStatus === 'graded' && <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">Graded (Hidden)</span>}
                                                {res.gradingStatus === 'published' && <span className="text-green-500 bg-green-500/10 px-2 py-0.5 rounded">Published: {res.score}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-800 dark:text-slate-600" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="w-full lg:w-2/3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden relative">
                        {selectedSubmission ? (() => {
                            const images = JSON.parse(selectedSubmission.fileUrls || selectedSubmission.answers || '[]');
                            const activeQuiz = allQuizzes.find(q => q.id === parseInt(selectedQuizId));
                            
                            const rawPath = images[currentImageIndex] || '';
                            const filename = rawPath.split('/').pop(); 
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://sftking.lk/api";
                            const cleanBase = apiUrl.replace(/\/$/, '');
                            const finalUrl = `${cleanBase}/written-answers/${filename}`;
                            
                            return (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center relative p-4 overflow-hidden">
                                        <div className="absolute top-4 left-4 bg-black/80 px-4 py-2 rounded-xl text-white font-bold text-sm z-10 border border-slate-300 dark:border-slate-800">
                                            Page {currentImageIndex + 1} of {images.length || 0}
                                        </div>
                                        
                                        <div className="w-full h-full flex flex-col items-center justify-start overflow-auto custom-scrollbar pt-10">
                                            {images.length > 0 ? (
                                                <GradingCanvas 
                                                    key={`canvas-${selectedSubmission.id}-${currentImageIndex}`}
                                                    ref={canvasSnapshotRef}
                                                    imageUrl={finalUrl} 
                                                />
                                            ) : (
                                                <p className="text-slate-700 dark:text-slate-500">Student uploaded no images or corrupted data.</p>
                                            )}
                                        </div>

                                        <div className="absolute bottom-4 flex gap-4 z-10">
                                            <button onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))} disabled={currentImageIndex === 0} className="bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 text-white p-3 rounded-full disabled:opacity-30 transition-colors shadow-lg"><ArrowLeft size={20} /></button>
                                            <button onClick={() => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))} disabled={currentImageIndex === images.length - 1} className="bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 text-white p-3 rounded-full disabled:opacity-30 transition-colors shadow-lg"><ArrowLeft size={20} className="rotate-180" /></button>
                                        </div>
                                    </div>

                                    <div className="h-auto md:h-48 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4 md:gap-6">
                                        <div className="w-full md:w-1/3">
                                            <label className="block text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Assign Score</label>
                                            <div className="relative">
                                                <input type="number" value={gradeForm.score} onChange={(e) => setGradeForm({...gradeForm, score: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-3xl font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500" />
                                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-700 dark:text-slate-500 font-bold">/ {activeQuiz?.totalMarks || 100}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">Teacher's Feedback</label>
                                            <textarea value={gradeForm.feedback} onChange={(e) => setGradeForm({...gradeForm, feedback: e.target.value})} placeholder="E.g. Great job on question 2..." className="flex-1 w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none custom-scrollbar min-h-[80px] md:min-h-0" />
                                        </div>
                                        <div className="flex flex-row md:flex-col gap-2 w-full md:w-40">
                                            <button onClick={() => handleSaveGrade('graded')} className="flex-1 py-3 md:py-0 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all uppercase tracking-widest">💾 Save (Hidden)</button>
                                            <button onClick={() => handleSaveGrade('published')} className="flex-1 py-3 md:py-0 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all uppercase tracking-widest">🚀 Publish Now</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 dark:text-slate-500 p-6 text-center">
                                <CheckSquare size={64} className="mb-4 opacity-10" />
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400">Select a Submission</h2>
                                <p className="text-sm mt-2 max-w-sm">Click a student's name on the left to view their answer script and assign a grade.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODALS */}
            {isFolderModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 border-t-4 border-t-amber-500">
                        <h2 className="text-xl font-bold mb-6">Deploy Written Folder</h2>
                        <form onSubmit={handleSaveFolder}>
                            <input autoFocus type="text" required placeholder="E.g. 2024 Essay Papers" className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 mb-6" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setFolderModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20">{editingFolderId ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isQuizModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar border-t-4 border-t-amber-500">
                        <h2 className="text-2xl font-black mb-6 border-b border-slate-300 dark:border-slate-800 pb-4 text-amber-500">{editingQuizId ? 'Edit Written Paper' : 'Deploy Written Paper'}</h2>
                        <form onSubmit={handleSaveQuiz} className="space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Paper Title</label>
                                    <input required type="text" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} placeholder="E.g. 2025 Model Essay" className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Vault PDF</label>
                                    <div className="flex gap-2 items-center">
                                        <button type="button" onClick={() => { setPdfSearch(''); setPdfPickerOpen(true); }} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-left hover:border-amber-500 transition-all">
                                            {quizForm.pdfFile ? quizForm.pdfFile : 'Click to select PDF from media vault'}
                                        </button>
                                    </div>
                                    {!quizForm.pdfFile && <p className="text-rose-400 text-xs mt-2">Required: choose a PDF file.</p>}
                                </div>
                            </div>

                            <div className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-5 rounded-2xl shadow-inner">
                                <h3 className="text-xs font-black text-slate-700 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-300 dark:border-slate-800 pb-2">The 3-Stage Rocket Timers</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Stage 1: Ready Buffer (Mins)</label>
                                        <input type="number" value={quizForm.readyTime ?? 5} onChange={e => setQuizForm({...quizForm, readyTime: parseInt(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-amber-500/30 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Stage 2: Writing Time (Mins)</label>
                                        <input type="number" value={quizForm.timeLimit ?? 120} onChange={e => setQuizForm({...quizForm, timeLimit: parseInt(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-blue-500/30 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Stage 3: Grace Upload (Mins)</label>
                                        <input type="number" value={quizForm.uploadGraceTime ?? 10} onChange={e => setQuizForm({...quizForm, uploadGraceTime: parseInt(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-red-500/30 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-100/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-300 dark:border-slate-800/50">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Total Marks</label>
                                    <input type="number" value={quizForm.totalMarks ?? 100} onChange={e => setQuizForm({...quizForm, totalMarks: parseInt(e.target.value) || 0})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Target Batches</label>
                                    <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                                        <button 
                                            type="button"
                                            onClick={() => setQuizForm(prev => ({ ...prev, batches: ['All'] }))}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                quizForm.batches.includes('All') 
                                                ? 'bg-amber-600/20 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-700 dark:text-slate-200'
                                            }`}
                                        >
                                            {quizForm.batches.includes('All') ? '✓ All Batches' : 'All Batches'}
                                        </button>
                                        {availableBatches.map(batch => (
                                            <button 
                                                key={batch}
                                                type="button"
                                                onClick={() => {
                                                    setQuizForm(prev => {
                                                        const currentSpecifics = prev.batches.filter(b => b !== 'All');
                                                        const newBatches = currentSpecifics.includes(batch) 
                                                            ? currentSpecifics.filter(b => b !== batch) 
                                                            : [...currentSpecifics, batch];
                                                        return { ...prev, batches: newBatches.length > 0 ? newBatches : ['All'] };
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    quizForm.batches.includes(batch) 
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-700 dark:text-slate-200'
                                                }`}
                                            >
                                                {quizForm.batches.includes(batch) ? `✓ ${batch}` : batch}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Exam Status</label>
                                    <select value={quizForm.status} onChange={e => setQuizForm({...quizForm, status: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500">
                                        <option value="scheduled">⏱️ Scheduled (Countdown)</option>
                                        <option value="live">🟢 Live (Open Now)</option>
                                        <option value="ended">🔴 Ended (Locked & Closed)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Start Time (Critical for Auto-Lock)</label>
                                    <input type="datetime-local" value={quizForm.startTime} onChange={e => setQuizForm({...quizForm, startTime: e.target.value})} disabled={quizForm.status !== 'scheduled'} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 disabled:opacity-30 disabled:cursor-not-allowed" />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-300 dark:border-slate-800">
                                <button type="button" onClick={() => setQuizModalOpen(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20">
                                    <Save size={18} /> {editingQuizId ? 'Update Exam' : 'Deploy Paper to Vault'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPdfPickerOpen && (
                <div className="fixed inset-0 z-[110] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Select PDF from Media Vault</h3>
                            <button onClick={() => setPdfPickerOpen(false)} className="text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white text-sm">Cancel</button>
                        </div>
                        <input type="text" value={pdfSearch} onChange={e => setPdfSearch(e.target.value)} placeholder="Search PDF filename..." className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white mb-4 focus:outline-none focus:border-amber-500" />
                        <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1">
                            {visibleVaultPdfFiles.length === 0 ? (
                                <div className="text-slate-700 dark:text-slate-500 text-sm text-center py-8">No matching PDFs found.</div>
                            ) : (
                                visibleVaultPdfFiles.map(file => (
                                    <button key={file.name} onClick={() => selectVaultPdf(file.name)} type="button" className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 hover:bg-amber-600/20 text-slate-900 dark:text-white transition-all">
                                        {file.name}
                                    </button>
                                ))
                            )}
                        </div>
                        {hasMorePdfResults && (
                            <div className="mt-2 text-center">
                                <button type="button" onClick={() => setShowAllPdfResults(true)} className="text-xs text-amber-400 hover:text-amber-200">Show all {filteredVaultPdfFiles.length} results</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 🏎️ STAGE 1: THE MCQ ENGINE (FLAWLESS & UNTOUCHED)
// ==========================================
function McqEngine() {
    const [activeTab, setActiveTab] = useState('manager'); 
    const [availableBatches, setAvailableBatches] = useState([]);

    const [folders, setFolders] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [vaultFiles, setVaultFiles] = useState([]); 
    const [currentFolder, setCurrentFolder] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [isFolderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [folderName, setFolderName] = useState('');
    
    const [isQuizModalOpen, setQuizModalOpen] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [quizForm, setQuizForm] = useState({ 
        title: '', pdfFile: '', timeLimit: 60, readyTime: 0, totalQuestions: 10, batches: ['All'], startTime: '', endTime: '', status: 'scheduled' 
    });
    const [isPdfPickerOpen, setPdfPickerOpen] = useState(false);
    const [pdfSearch, setPdfSearch] = useState('');
    const [showAllPdfResults, setShowAllPdfResults] = useState(false);
    const [answerKey, setAnswerKey] = useState({});

    const [allQuizzes, setAllQuizzes] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState(null);
    const [quizResults, setQuizResults] = useState([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isReportOptionsOpen, setReportOptionsOpen] = useState(false);
    const [reportQuiz, setReportQuiz] = useState(null);

    useEffect(() => {
        if (activeTab === 'manager') { loadData(); loadVaultFiles(); } 
        else if (activeTab === 'results') { loadAllQuizzes(); }
    }, [activeTab, currentFolder]);

    const loadData = async () => {
        setLoading(true);
        try {
            const folderRes = await axios.get(`/mcq/folders?parentId=${currentFolder || 'null'}`);
            setFolders(folderRes.data);
            const quizRes = await axios.get(`/mcq/quizzes?folderId=${currentFolder || 'null'}`);
            setQuizzes(quizRes.data);
            const batchRes = await axios.get('/batches');
            setAvailableBatches(batchRes.data.map(b => b.name));
        } catch (e) { console.error("Failed to load MCQ data", e); }
        setLoading(false);
    };

    const loadVaultFiles = async () => {
        try {
            const res = await axios.get('/admin/vault/files');
            setVaultFiles(res.data.files.filter(f => f.name.endsWith('.pdf')));
        } catch (e) { console.error("Failed to load Vault Files", e); }
    };

    const openNewFolderModal = () => { setEditingFolderId(null); setFolderName(''); setFolderModalOpen(true); };
    const openEditFolderModal = (folder) => { setEditingFolderId(folder.id); setFolderName(folder.name); setFolderModalOpen(true); };

    const handleSaveFolder = async (e) => {
        e.preventDefault();
        try {
            if (editingFolderId) await axios.put(`/admin/mcq/folders/${editingFolderId}`, { name: folderName });
            else await axios.post('/admin/mcq/folders', { name: folderName, parentId: currentFolder });
            setFolderModalOpen(false); loadData();
        } catch (e) { alert("Error saving folder"); }
    };

    const handleDeleteFolder = async (id) => {
        if(!confirm("DELETE THIS FOLDER AND ALL QUIZZES INSIDE?")) return;
        await axios.delete(`/admin/mcq/folders/${id}`); loadData();
    };

    const enterFolder = (folder) => { setBreadcrumbs([...breadcrumbs, folder]); setCurrentFolder(folder.id); };
    const navigateToBreadcrumb = (index) => {
        if (index === -1) { setBreadcrumbs([]); setCurrentFolder(null); } 
        else { setBreadcrumbs(breadcrumbs.slice(0, index + 1)); setCurrentFolder(breadcrumbs[index].id); }
    };

    const openNewQuizModal = () => {
        setEditingQuizId(null);
        setQuizForm({ title: '', pdfFile: '', timeLimit: 60, readyTime: 0, totalQuestions: 10, batches: ['All'], startTime: '', endTime: '', status: 'scheduled' });
        setAnswerKey({}); setQuizModalOpen(true);
    };

    const openEditQuizModal = (quiz) => {
        setEditingQuizId(quiz.id);
        
        let parsedKeys = {};
        try { parsedKeys = quiz.answerKey ? JSON.parse(quiz.answerKey) : {}; } catch(e) { parsedKeys = {}; }

        let parsedBatches = ['All'];
        try { parsedBatches = quiz.batches ? JSON.parse(quiz.batches) : ['All']; } catch(e){}
        
        const formattedDate = quiz.startTime ? new Date(quiz.startTime).toISOString().slice(0, 16) : '';
        const formattedEndTime = quiz.endTime ? new Date(quiz.endTime).toISOString().slice(0, 16) : '';

        setQuizForm({ 
            title: quiz.title, pdfFile: quiz.pdfFile, timeLimit: quiz.timeLimit, 
            readyTime: quiz.readyTime || 0, totalQuestions: quiz.totalQuestions || Object.keys(parsedKeys).length || 10,
            batches: parsedBatches, startTime: formattedDate, endTime: formattedEndTime, status: quiz.status || 'live'
        });
        setAnswerKey(parsedKeys); setQuizModalOpen(true);
    };

    const selectVaultPdf = (fileName) => {
        setQuizForm(prev => ({ ...prev, pdfFile: fileName }));
        setPdfPickerOpen(false);
    };

    const filteredVaultPdfFiles = useMemo(() => {
        const q = pdfSearch.trim().toLowerCase();
        if (!q) return vaultFiles;
        return vaultFiles.filter(f => f.name.toLowerCase().includes(q));
    }, [vaultFiles, pdfSearch]);

    const visibleVaultPdfFiles = useMemo(() => {
        if (showAllPdfResults) return filteredVaultPdfFiles;
        return filteredVaultPdfFiles.slice(0, 80);
    }, [filteredVaultPdfFiles, showAllPdfResults]);

    const hasMorePdfResults = filteredVaultPdfFiles.length > visibleVaultPdfFiles.length;

    const handleAnswerChange = (qNum, option) => {
        setAnswerKey(prev => {
            if (String(prev[qNum]) === String(option)) {
                const newKeys = { ...prev };
                newKeys[qNum] = ""; 
                return newKeys;
            }
            return { ...prev, [qNum]: String(option) };
        });
    };

    const handleSaveQuiz = async (e) => {
        e.preventDefault();
        if (!quizForm.pdfFile) return alert("Please select a PDF from the Vault!");
        
        const finalAnswerKey = {};
        for (let i = 1; i <= quizForm.totalQuestions; i++) {
            finalAnswerKey[i] = answerKey[i] || ""; 
        }

        const payload = {
            title: quizForm.title, folderId: currentFolder, pdfFile: quizForm.pdfFile,
            answerKey: finalAnswerKey, timeLimit: quizForm.timeLimit, readyTime: quizForm.readyTime, 
            totalQuestions: quizForm.totalQuestions, batches: quizForm.batches,
            startTime: quizForm.startTime ? new Date(quizForm.startTime).toISOString() : null,
            endTime: quizForm.endTime ? new Date(quizForm.endTime).toISOString() : null,
            status: quizForm.status
        };

        try {
            if (editingQuizId) await axios.put(`/admin/mcq/quizzes/${editingQuizId}`, payload);
            else await axios.post('/admin/mcq/quizzes', payload);
            setQuizModalOpen(false); loadData();
        } catch (e) { alert("Error saving Quiz!"); }
    };

    const handleDeleteQuiz = async (id) => {
        if(!confirm("Delete this quiz and all student results for it?")) return;
        await axios.delete(`/admin/mcq/quizzes/${id}`); loadData();
    };

    const loadAllQuizzes = async () => {
        setLoading(true);
        try {
            const resAll = await axios.get('/admin/mcq/all-quizzes'); 
            setAllQuizzes(resAll.data || []);
        } catch (e) {
            console.error("Failed to load all quizzes for the grading desk:", e);
            setAllQuizzes([]); 
        }
        setLoading(false);
    };

    const fetchResults = async (quizId) => {
        setSelectedQuizId(quizId); setResultsLoading(true); setSearchQuery(''); setSelectedStudent(null); 
        try {
            const res = await axios.get(`/admin/mcq/results/${quizId}`);
            setQuizResults(res.data);
        } catch (e) { console.error("Failed to fetch results", e); }
        setResultsLoading(false);
    };

    const groupedStudentsMap = quizResults.reduce((acc, res) => {
        const sId = res.studentId || res.User?.mobile || res.user?.mobile || 'unknown';
        if (!acc[sId]) {
            acc[sId] = {
                id: sId, name: res.User?.name || res.user?.name || 'Unknown Student',
                mobile: res.User?.mobile || res.user?.mobile || 'No Mobile Data',
                attempts: [], bestScore: 0, totalQuestions: res.totalQuestions
            };
        }
        acc[sId].attempts.push(res);
        if (res.score > acc[sId].bestScore) acc[sId].bestScore = res.score;
        return acc;
    }, {});

    const uniqueStudents = Object.values(groupedStudentsMap);
    const filteredStudents = uniqueStudents.filter(student => {
        const query = searchQuery.toLowerCase();
        return student.name.toLowerCase().includes(query) || student.mobile.toLowerCase().includes(query);
    });

    const formatExamDate = (quiz) => {
        const source = quiz?.startTime || quiz?.createdAt || null;
        if (!source) return 'N/A';
        const d = new Date(source);
        if (Number.isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString();
    };

    const openReportOptions = (e, quiz) => {
        e.stopPropagation();
        setReportQuiz(quiz);
        setReportOptionsOpen(true);
    };

    const getUsedTimeLabel = (attempt, timeLimitMins) => {
        const reportedSeconds = Number(attempt?.timeUsedSeconds);
        if (Number.isFinite(reportedSeconds)) {
            const safeSeconds = Math.max(0, Math.floor(reportedSeconds));
            const usedHours = Math.floor(safeSeconds / 3600);
            const usedMinutes = Math.floor((safeSeconds % 3600) / 60);
            const usedSeconds = safeSeconds % 60;
            return `${String(usedHours).padStart(2, '0')}:${String(usedMinutes).padStart(2, '0')}:${String(usedSeconds).padStart(2, '0')}`;
        }

        const totalLimitMins = Number(timeLimitMins || 0);
        let usedMs = 0;

        const startedAt = attempt?.attemptStartedAt ? new Date(attempt.attemptStartedAt).getTime() : NaN;
        const submittedAt = attempt?.createdAt ? new Date(attempt.createdAt).getTime() : NaN;
        if (!Number.isNaN(startedAt) && !Number.isNaN(submittedAt) && submittedAt >= startedAt) {
            usedMs = submittedAt - startedAt;
        }

        const maxMs = Math.max(0, totalLimitMins * 60 * 1000);
        if (maxMs > 0) usedMs = Math.min(usedMs, maxMs);

        const usedTotalSeconds = Math.max(0, Math.floor(usedMs / 1000));
        const usedHours = Math.floor(usedTotalSeconds / 3600);
        const usedMinutes = Math.floor((usedTotalSeconds % 3600) / 60);
        const usedSeconds = usedTotalSeconds % 60;

        return `${String(usedHours).padStart(2, '0')}:${String(usedMinutes).padStart(2, '0')}:${String(usedSeconds).padStart(2, '0')}`;
    };

    const appendStudentReportPage = (doc, quiz, studentName, attempt, addPage = false) => {
        if (addPage) doc.addPage();

        const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
        const correctAnswers = JSON.parse(quiz.answerKey || '{}');
        const studentAnswers = attempt.studentAnswers ? JSON.parse(attempt.studentAnswers) : {};
        const usedLabel = getUsedTimeLabel(attempt, quiz.timeLimit);

        doc.setFontSize(22);
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        doc.text("SFT KING - ADMIN EXAM REPORT", 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`Exam: ${quiz.title}`, 20, 35);
        doc.text(`Student Name: ${studentName}`, 20, 42);
        doc.text(`Time Used: ${usedLabel} out of ${quiz.timeLimit} Mins`, 20, 49);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(percentage >= 50 ? 22 : 220, percentage >= 50 ? 163 : 38, percentage >= 50 ? 74 : 38);
        doc.text(`Final Score: ${attempt.score} / ${attempt.totalQuestions} (${percentage}%)`, 20, 56);

        const tableColumn = ["Question", "Student's Answer", "Correct Answer", "Status"];
        const tableRows = [];

        for (let i = 1; i <= attempt.totalQuestions; i++) {
            const studentAns = studentAnswers[i] || "Skipped";
            const correctAnsRaw = correctAnswers[i];
            const correctAnsDisplay = (!correctAnsRaw || correctAnsRaw === "") ? "All (Bonus)" : correctAnsRaw;

            let statusText = "Incorrect";
            if (!correctAnsRaw || correctAnsRaw === "" || String(studentAns) === String(correctAnsRaw)) {
                statusText = "Correct";
            } else if (studentAns === "Skipped") {
                statusText = "Skipped";
            }
            tableRows.push([`Q${i}`, studentAns, correctAnsDisplay, statusText]);
        }

        autoTable(doc, {
            startY: 65,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' }
        });
    };

    const downloadFullExamReport = async (quiz) => {
        const targetQuiz = quiz || allQuizzes.find(q => q.id === selectedQuizId);
        if (!targetQuiz) return alert("Select an exam first.");

        try {
            let allAttempts = [];
            if (selectedQuizId === targetQuiz.id && quizResults.length > 0) {
                allAttempts = quizResults;
            } else {
                const res = await axios.get(`/admin/mcq/results/${targetQuiz.id}`);
                allAttempts = res.data || [];
            }

            if (!allAttempts.length) {
                return alert("No student attempts found for this exam.");
            }

            // Keep the latest attempt per student for the full exam export.
            const latestByStudent = new Map();
            for (const row of allAttempts) {
                const sid = String(row.studentId || row.User?.mobile || row.user?.mobile || row.id || 'unknown');
                const existing = latestByStudent.get(sid);
                if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
                    latestByStudent.set(sid, row);
                }
            }

            const finalRows = Array.from(latestByStudent.values()).sort((a, b) => {
                const aName = (a.User?.name || a.user?.name || '').toLowerCase();
                const bName = (b.User?.name || b.user?.name || '').toLowerCase();
                return aName.localeCompare(bName);
            });

            const doc = new jsPDF();
            finalRows.forEach((attempt, idx) => {
                const studentName = attempt.User?.name || attempt.user?.name || `Student #${attempt.studentId}`;
                appendStudentReportPage(doc, targetQuiz, studentName, attempt, idx > 0);
            });

            doc.save(`Admin_Full_Report_${targetQuiz.title}.pdf`);
        } catch (err) {
            console.error('Failed to generate full exam report:', err);
            alert('Failed to generate full exam report.');
        }
    };

    const downloadSummaryReport = async (quiz) => {
        const targetQuiz = quiz || allQuizzes.find(q => q.id === selectedQuizId);
        if (!targetQuiz) return alert("Select an exam first.");

        try {
            let allAttempts = [];
            if (selectedQuizId === targetQuiz.id && quizResults.length > 0) {
                allAttempts = quizResults;
            } else {
                const res = await axios.get(`/admin/mcq/results/${targetQuiz.id}`);
                allAttempts = res.data || [];
            }

            if (!allAttempts.length) {
                return alert("No student attempts found for this exam.");
            }

            const latestByStudent = new Map();
            for (const row of allAttempts) {
                const sid = String(row.studentId || row.User?.mobile || row.user?.mobile || row.id || 'unknown');
                const existing = latestByStudent.get(sid);
                if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
                    latestByStudent.set(sid, row);
                }
            }

            const rows = Array.from(latestByStudent.values()).sort((a, b) => {
                const aName = (a.User?.name || a.user?.name || '').toLowerCase();
                const bName = (b.User?.name || b.user?.name || '').toLowerCase();
                return aName.localeCompare(bName);
            });

            const doc = new jsPDF();
            const hasGreatVibes = await ensureGreatVibesFont(doc);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(220, 38, 38);
            doc.setFontSize(22);
            doc.text(targetQuiz.title || 'Exam', 20, 20);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(12);
            doc.text("SFT KING - FULL SUMMARY REPORT", 20, 28);
            doc.text(`Exam Date: ${formatExamDate(targetQuiz)}`, 20, 35);
            doc.text(`Total Students: ${rows.length}`, 20, 42);
            doc.text(`Generated On: ${new Date().toLocaleString()}`, 20, 49);

            const tableRows = rows.map((attempt) => {
                const name = attempt.User?.name || attempt.user?.name || `Student #${attempt.studentId}`;
                const finishTime = getUsedTimeLabel(attempt, targetQuiz.timeLimit);
                const marks = `${attempt.score} / ${attempt.totalQuestions}`;
                return [name, finishTime, marks];
            });

            autoTable(doc, {
                startY: 58,
                head: [["Student Name", "Finish Time", "Marks"]],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' }
            });

            const pageHeight = doc.internal.pageSize.getHeight();
            let sigY = (doc.lastAutoTable?.finalY || 70) + 18;
            if (sigY > pageHeight - 30) {
                doc.addPage();
                sigY = 35;
            }

            doc.setDrawColor(60, 60, 60);
            doc.line(20, sigY + 2, 85, sigY + 2);
            doc.setFont(hasGreatVibes ? GREAT_VIBES_FONT_NAME : "times", hasGreatVibes ? "normal" : "italic");
            doc.setFontSize(24);
            doc.setTextColor(40, 40, 40);
            doc.text("Ishanka Shamal", 20, sigY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text("Authorized Signature", 20, sigY + 8);

            doc.save(`Admin_Full_Summary_Report_${targetQuiz.title}.pdf`);
        } catch (err) {
            console.error('Failed to generate summary report:', err);
            alert('Failed to generate summary report.');
        }
    };

    const downloadAdminReport = (e, studentName, attempt) => {
        e.stopPropagation(); 
        const quiz = allQuizzes.find(q => q.id === selectedQuizId);
        if (!quiz || !attempt) return alert("Missing data for PDF!");

        const doc = new jsPDF();
        appendStudentReportPage(doc, quiz, studentName, attempt, false);

        doc.save(`Admin_Report_${studentName}_${quiz.title}.pdf`);
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-slate-300 dark:border-slate-800 pb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2"><Zap className="text-red-500"/> MCQ Matrix Control</h2>
                    <p className="text-slate-700 dark:text-slate-500 text-xs mt-1">Manage lightning-fast auto-graded multiple choice exams.</p>
                </div>
                <div className="flex bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800">
                    <button onClick={() => setActiveTab('manager')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${activeTab === 'manager' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'}`}>
                        <Folder size={16} /> Library
                    </button>
                    <button onClick={() => setActiveTab('results')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase tracking-widest ${activeTab === 'results' ? 'bg-red-700 text-white shadow-lg' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'}`}>
                        <BarChart size={16} /> Results
                    </button>
                </div>
            </div>

            {/* FOLDERS & QUIZZES TAB */}
            {activeTab === 'manager' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-end mb-6 gap-3">
                        <button onClick={openNewFolderModal} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700"><Folder size={16} /> New Folder</button>
                        {currentFolder && (
                            <button onClick={openNewQuizModal} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-600/20"><FileQuestion size={16} /> New Quiz</button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-6 bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto whitespace-nowrap">
                        <button onClick={() => navigateToBreadcrumb(-1)} className="text-red-500 hover:text-red-400 flex items-center gap-1"><Home size={16} /> Home</button>
                        {breadcrumbs.map((crumb, index) => (
                            <div key={crumb.id} className="flex items-center gap-2">
                                <ChevronRight size={14} className="text-slate-800 dark:text-slate-600" />
                                <button onClick={() => navigateToBreadcrumb(index)} className="text-red-500 hover:text-red-400 font-semibold">{crumb.name}</button>
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {folders.map(folder => (
                                <div key={`folder-${folder.id}`} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500/50 transition-all group flex flex-col justify-between h-36 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
                                    <div className="cursor-pointer flex-1" onClick={() => enterFolder(folder)}>
                                        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center mb-3"><Folder size={24} /></div>
                                        <h3 className="font-bold text-lg truncate">{folder.name}</h3>
                                    </div>
                                    <div className="absolute bottom-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); openEditFolderModal(folder); }} className="text-slate-700 dark:text-slate-500 hover:text-blue-500"><Edit size={18} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-slate-700 dark:text-slate-500 hover:text-red-500"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                            {quizzes.map(quiz => (
                                <div key={`quiz-${quiz.id}`} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500/50 transition-all group flex flex-col justify-between h-36 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-red-700"></div>
                                    <div className="flex-1">
                                        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center mb-3"><FileText size={24} /></div>
                                        <h3 className="font-bold text-lg truncate">{quiz.title}</h3>
                                        <p className="text-xs text-slate-700 dark:text-slate-500 mt-1">{quiz.timeLimit} Mins • {quiz.totalQuestions || Object.keys(JSON.parse(quiz.answerKey || '{}')).length} Qs</p>
                                    </div>
                                    <div className="absolute bottom-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditQuizModal(quiz)} className="text-slate-700 dark:text-slate-500 hover:text-blue-500"><Edit size={18} /></button>
                                        <button onClick={() => handleDeleteQuiz(quiz.id)} className="text-slate-700 dark:text-slate-500 hover:text-red-500"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* RESULTS TAB */}
            {activeTab === 'results' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col lg:flex-row gap-6 h-[65vh]">
                    <div className="w-full lg:w-1/3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 flex items-center gap-3">
                            <Search className="text-slate-800 dark:text-slate-600 dark:text-slate-400" size={18} />
                            <h3 className="font-bold text-slate-300 uppercase tracking-widest text-sm">Select Exam</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-red-600 w-8 h-8" /></div>
                            ) : allQuizzes.length === 0 ? (
                                <p className="text-center text-slate-700 dark:text-slate-500 py-10 text-sm">No exams created yet.</p>
                            ) : (
                                allQuizzes.map(quiz => (
                                    <div
                                        key={quiz.id}
                                        onClick={() => fetchResults(quiz.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') fetchResults(quiz.id);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        className={`w-full text-left p-4 rounded-xl mb-2 transition-all flex items-center justify-between cursor-pointer ${selectedQuizId === quiz.id ? 'bg-red-600/20 border border-red-500/50 text-red-500' : 'bg-transparent border border-transparent hover:bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                                    >
                                        <div className="truncate pr-4">
                                            <div className="font-bold truncate">{quiz.title}</div>
                                            <div className="text-xs opacity-70 mt-1 flex items-center gap-2"><Clock size={12} /> {quiz.timeLimit} Mins</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => openReportOptions(e, quiz)}
                                                className="bg-slate-100 dark:bg-slate-900 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                                                title="Download Exam Reports"
                                            >
                                                <Download size={15} />
                                            </button>
                                            <ChevronRight size={18} className={selectedQuizId === quiz.id ? 'text-red-500' : 'text-slate-800 dark:text-slate-600'} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="w-full lg:w-2/3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden relative">
                        {selectedQuizId ? (
                            <>
                                <div className="p-6 border-b border-slate-300 dark:border-slate-800 bg-gradient-to-r from-slate-900 to-red-900/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    {selectedStudent ? (
                                        <div className="flex items-center gap-4 w-full">
                                            <button onClick={() => setSelectedStudent(null)} className="bg-slate-100 dark:bg-slate-800 hover:bg-red-600 text-white p-2.5 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 shrink-0"><ArrowLeft size={18} /></button>
                                            <div>
                                                <h2 className="text-xl font-black text-white">{selectedStudent.name}'s Attempts</h2>
                                                <p className="text-sm text-slate-800 dark:text-slate-600 dark:text-slate-400">{selectedStudent.mobile} • {selectedStudent.attempts.length} Total Attempts</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <h2 className="text-2xl font-black text-white flex items-center gap-3"><Users className="text-red-500" /> Unique Students</h2>
                                            </div>
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-700 dark:text-slate-500" size={16} />
                                                <input type="text" placeholder="Search name or mobile..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-slate-100/50 dark:bg-slate-950/50">
                                    {resultsLoading ? (
                                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div>
                                    ) : quizResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-700 dark:text-slate-500"><Award size={48} className="mb-4 opacity-20" /><p>No students have taken this exam yet.</p></div>
                                    ) : selectedStudent ? (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                                            {selectedStudent.attempts.map((attempt, index) => {
                                                const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
                                                return (
                                                    <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-xl hover:border-red-500/30 transition-colors gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400 shrink-0 font-black">#{index + 1}</div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white">Attempt {index + 1}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 sm:w-1/3 justify-end">
                                                            <div className="text-right hidden sm:block">
                                                                <div className="font-black text-red-500 text-xl">{attempt.score} <span className="text-sm text-slate-700 dark:text-slate-500">/ {attempt.totalQuestions}</span></div>
                                                            </div>
                                                            <div className="relative w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-slate-950 shrink-0">
                                                                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36"><path className="text-red-600" strokeDasharray={`${percentage}, 100`} stroke="currentColor" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /></svg>
                                                                <span className="text-xs font-bold text-white z-10">{percentage}%</span>
                                                            </div>
                                                            <button onClick={(e) => downloadAdminReport(e, selectedStudent.name, attempt)} className="ml-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-white p-3 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 shadow-md"><Download size={18} /></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                                            {filteredStudents.map((student) => {
                                                const bestPercentage = Math.round((student.bestScore / student.totalQuestions) * 100);
                                                const latestAttempt = [...student.attempts].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                                                return (
                                                    <div key={student.id} onClick={() => setSelectedStudent(student)} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 rounded-xl hover:border-red-500/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer transition-all gap-4 group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400 shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors"><Users size={18} /></div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-lg">{student.name}</div>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-xs text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-widest">{student.mobile}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 sm:w-1/3 justify-end">
                                                            <div className="text-right hidden sm:block">
                                                                <div className="font-black text-red-500 text-xl leading-none">{student.bestScore}</div>
                                                            </div>
                                                            <button onClick={(e) => downloadAdminReport(e, student.name, latestAttempt)} className="ml-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-white p-3 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 shadow-md"><Download size={18} /></button>
                                                            <ChevronRight size={20} className="text-slate-800 dark:text-slate-600 group-hover:text-red-500 transition-colors hidden sm:block ml-1" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-950/50 p-6 text-center">
                                <CheckSquare size={64} className="mb-4 opacity-10" />
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400">Select an Exam</h2>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isReportOptionsOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-md p-6">
                        <h2 className="text-xl font-black mb-2">Download Report Options</h2>
                        <p className="text-sm text-slate-700 dark:text-slate-500 mb-6">
                            {reportQuiz?.title || 'Selected Exam'}
                        </p>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    await downloadFullExamReport(reportQuiz);
                                    setReportOptionsOpen(false);
                                }}
                                className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            >
                                Full Report with Exact Marks
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await downloadSummaryReport(reportQuiz);
                                    setReportOptionsOpen(false);
                                }}
                                className="w-full py-3 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                                Full Summary Report
                            </button>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                type="button"
                                onClick={() => setReportOptionsOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            {isFolderModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-6">{editingFolderId ? 'Edit Folder' : 'Create MCQ Folder'}</h2>
                        <form onSubmit={handleSaveFolder}>
                            <input autoFocus type="text" required placeholder="E.g. Term Test Papers" className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 mb-6" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setFolderModalOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20">{editingFolderId ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isQuizModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 md:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h2 className="text-2xl font-black mb-6 border-b border-slate-300 dark:border-slate-800 pb-4">{editingQuizId ? 'Edit Quiz' : 'Build New Quiz'}</h2>
                        <form onSubmit={handleSaveQuiz} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Quiz Title</label>
                                        <input required type="text" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Vault PDF</label>
                                        <div className="flex gap-2 items-center">
                                            <button type="button" onClick={() => { setPdfSearch(''); setPdfPickerOpen(true); }} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-left hover:border-red-500 transition-all">
                                                {quizForm.pdfFile ? quizForm.pdfFile : 'Click to select PDF from media vault'}
                                            </button>
                                        </div>
                                        {!quizForm.pdfFile && <p className="text-rose-400 text-xs mt-2">Required: choose a PDF file.</p>}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Time Limit (Mins)</label>
                                            <input type="number" value={quizForm.timeLimit ?? 60} onChange={e => setQuizForm({...quizForm, timeLimit: parseInt(e.target.value) || 0})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-inner" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Ready Time (Mins)</label>
                                            <input type="number" value={quizForm.readyTime ?? 0} onChange={e => setQuizForm({...quizForm, readyTime: parseInt(e.target.value) || 0})} className="w-full bg-slate-100 dark:bg-slate-950 border border-amber-500/30 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Total Questions</label>
                                            <input type="number" value={quizForm.totalQuestions ?? 10} onChange={e => setQuizForm({...quizForm, totalQuestions: parseInt(e.target.value) || 0})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-inner" />
                                        </div>
                                    </div>
                                    <div className="mt-6 border-t border-slate-300 dark:border-slate-800/50 pt-4 bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-2xl">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Exam Status</label>
                                                <select value={quizForm.status} onChange={e => setQuizForm({...quizForm, status: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500">
                                                    <option value="scheduled">⏱️ Scheduled (Countdown)</option>
                                                    <option value="live">🟢 Live (Open Now)</option>
                                                    <option value="ended">🔴 Ended (Closed)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Target Batches</label>
                                                <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                                                    {/* Always offer 'All' */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => setQuizForm(prev => ({
                                                            ...prev,
                                                            batches: prev.batches.includes('All') ? prev.batches.filter(b => b !== 'All') : [...prev.batches, 'All']
                                                        }))}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                            quizForm.batches.includes('All') 
                                                            ? 'bg-red-600/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(220,38,38,0.2)]' 
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-700 dark:text-slate-200'
                                                        }`}
                                                    >
                                                        {quizForm.batches.includes('All') ? '✓ All Batches' : 'All Batches'}
                                                    </button>
                                                    
                                                    {/* Map dynamically fetched DB batches */}
                                                    {availableBatches.map(batch => (
                                                        <button 
                                                            key={batch}
                                                            type="button"
                                                            onClick={() => {
                                                                setQuizForm(prev => {
                                                                    const currentSpecifics = prev.batches.filter(b => b !== 'All');
                                                                    const newBatches = currentSpecifics.includes(batch) 
                                                                        ? currentSpecifics.filter(b => b !== batch) 
                                                                        : [...currentSpecifics, batch];
                                                                    return { ...prev, batches: newBatches.length > 0 ? newBatches : ['All'] };
                                                                });
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                                quizForm.batches.includes(batch) 
                                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:border-slate-500 hover:text-slate-700 dark:text-slate-200'
                                                            }`}
                                                        >
                                                            {quizForm.batches.includes(batch) ? `✓ ${batch}` : batch}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Start Time</label>
                                            <input type="datetime-local" value={quizForm.startTime} onChange={e => setQuizForm({...quizForm, startTime: e.target.value})} disabled={quizForm.status !== 'scheduled'} className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-red-500 disabled:opacity-30 disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 h-[500px] overflow-y-auto custom-scrollbar shadow-inner">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 sticky top-0 bg-slate-100 dark:bg-slate-950 pb-2 border-b border-slate-300 dark:border-slate-800/50 z-10">Answer Key Matrix (Leave blank for "All Correct")</h3>
                                    <div className="space-y-3">
                                        {Array.from({ length: quizForm.totalQuestions || 10 }).map((_, i) => {
                                            const qNum = i + 1;
                                            return (
                                                <div key={qNum} className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors border border-slate-300 dark:border-slate-800/30">
                                                    <span className="w-8 text-center font-bold text-red-500">Q{qNum}</span>
                                                    <div className="flex gap-2 flex-1 justify-between">
                                                        {[1, 2, 3, 4, 5].map(opt => (
                                                            <label key={opt} className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center cursor-pointer font-bold transition-all ${String(answerKey[qNum]) === String(opt) ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:bg-slate-700'}`}>
                                                                <input type="radio" className="hidden" name={`q_${qNum}`} value={opt} checked={String(answerKey[qNum]) === String(opt)} onChange={() => handleAnswerChange(qNum, opt)} />
                                                                {opt}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-300 dark:border-slate-800">
                                <button type="button" onClick={() => setQuizModalOpen(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white">Cancel</button>
                                <button type="submit" className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20">
                                    <Save size={18} /> {editingQuizId ? 'Update Matrix' : 'Initialize Quiz'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPdfPickerOpen && (
                <div className="fixed inset-0 z-[110] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Select PDF from Media Vault</h3>
                            <button onClick={() => setPdfPickerOpen(false)} className="text-slate-800 dark:text-slate-600 dark:text-slate-400 hover:text-white text-sm">Cancel</button>
                        </div>
                        <input type="text" value={pdfSearch} onChange={e => setPdfSearch(e.target.value)} placeholder="Search PDF filename..." className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white mb-4 focus:outline-none focus:border-amber-500" />
                        <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1">
                            {visibleVaultPdfFiles.length === 0 ? (
                                <div className="text-slate-700 dark:text-slate-500 text-sm text-center py-8">No matching PDFs found.</div>
                            ) : (
                                visibleVaultPdfFiles.map(file => (
                                    <button key={file.name} onClick={() => selectVaultPdf(file.name)} type="button" className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 hover:bg-red-600/20 text-slate-900 dark:text-white transition-all">
                                        {file.name}
                                    </button>
                                ))
                            )}
                        </div>
                        {hasMorePdfResults && (
                            <div className="mt-2 text-center">
                                <button type="button" onClick={() => setShowAllPdfResults(true)} className="text-xs text-amber-400 hover:text-amber-200">Show all {filteredVaultPdfFiles.length} results</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 👑 THE MASTER WRAPPER (DEFAULT EXPORT)
// ==========================================
export default function ExamCentralManager() {
    const [masterTab, setMasterTab] = useState('mcq'); // 'mcq' or 'written'

    return (
        <div className="min-h-screen bg-white text-slate-900 dark:bg-[#020617] dark:text-white flex flex-col font-sans">
            
            {/* 🚀 THE MASTER SWITCH HEADER */}
            <div className="p-6 md:px-10 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sticky top-0 z-40 shadow-xl">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500 flex items-center gap-3">
                        <CheckSquare className="text-red-500" size={32} />
                        SFT King Exam Central
                    </h1>
                    <p className="text-slate-800 dark:text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-1">Master Control Room for Digital Assessments</p>
                </div>
                
                <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner w-full sm:w-auto overflow-x-auto">
                    <button 
                        onClick={() => setMasterTab('mcq')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap ${
                            masterTab === 'mcq' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'
                        }`}
                    >
                        <Zap size={18} /> MCQ Engine
                    </button>
                    <button 
                        onClick={() => setMasterTab('written')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap ${
                            masterTab === 'written' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-700 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:bg-slate-800'
                        }`}
                    >
                        <PenTool size={18} /> Written Papers
                    </button>
                </div>
            </div>

            {/* 🚀 THE RENDERER */}
            <div className="flex-1 p-6 md:p-10 overflow-auto">
                {masterTab === 'mcq' ? <McqEngine /> : <WrittenEngine />}
            </div>

            <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }`}} />
        </div>
    );
}