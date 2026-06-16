'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '@/lib/axios';
import {
  FolderPlus, Radio, Search, Trash2, Edit2, X, Loader2, Check, ChevronLeft,
  Youtube, Eye, EyeOff, GripVertical, Folder, Home, CheckSquare, Square, Copy,
  Video, FileText, UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LessonModal from '@/components/admin/LessonModal';
import { socket } from '@/lib/socket';

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- SUB COMPONENTS ---


function SortableFolderItem({ l, openFolder, handleOpenModal, isSelected, toggleSelect, tab }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: l.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.3 : 1,
    position: 'relative',
    touchAction: 'none'
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full touch-none group">
      <div
        className={`rounded-[30px] p-6 shadow-sm border transition-all duration-300 relative overflow-hidden h-full cursor-pointer ${isSelected
            ? 'bg-red-50 dark:bg-red-500/10 border-red-500 dark:border-red-500/50 shadow-md'
            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10 hover:shadow-2xl hover:border-red-100 dark:hover:border-red-500/30'
          }`}
        onClick={() => openFolder(l)}
      >
        <div
          className="absolute top-4 right-4 z-20 cursor-pointer p-2"
          onClick={(e) => { e.stopPropagation(); toggleSelect(l.id, 'folder'); }}
        >
          {isSelected
            ? <CheckSquare className="text-red-600 dark:text-red-500 fill-red-100 dark:fill-red-900/30" size={24} />
            : <Square className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors" size={24} />
          }
        </div>

        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div
              className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 p-2 -ml-2 rounded hover:bg-slate-50 dark:hover:bg-white/5 touch-none transition-colors"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={24} />
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${tab === 'Live' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
              }`}>
              {tab === 'Live' ? <Radio size={24} /> : <Folder size={24} className="text-slate-500 dark:text-slate-400" />}
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter mb-1 line-clamp-1 transition-colors">{l.name}</h3>
        <div className="flex flex-col gap-1 mb-3">
          {l.month && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{l.month}</span>}
          <span className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider transition-colors">{l.price && l.price !== "0" ? `LKR ${l.price}` : 'FREE ACCESS'}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); handleOpenModal(l); }}
          className="absolute bottom-4 right-4 p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-100 dark:border-white/5"
        >
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  );
}

function DragOverlayCard({ l, tab }) {
  if (!l) return null;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[30px] p-6 shadow-2xl border-2 border-red-500 scale-105 cursor-grabbing opacity-90 w-full max-w-[300px]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="text-slate-500 dark:text-slate-400"><GripVertical size={24} /></div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tab === 'Live' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>
            {tab === 'Live' ? <Radio size={24} /> : <Folder size={24} />}
          </div>
        </div>
      </div>
      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter mb-1">{l.name}</h3>
    </div>
  );
}

// ✅ NEW: MEDIA PICKER MODAL COMPONENT
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
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-[30px] p-8 shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300 border border-transparent dark:border-white/10">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black uppercase text-slate-800 dark:text-white flex items-center gap-3 transition-colors duration-300">
            <FolderPlus className="text-red-600 dark:text-red-500" /> Select From Vault
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 rounded-full transition-colors"><X size={24} /></button>
        </div>

        {/* Search */}
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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
          {filtered.map(file => {
            const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            const displayName = file.name.split('_').slice(1).join('_') || file.name;

            return (
              <div
                key={file.name}
                onClick={() => onSelect(file.name)}
                className="group cursor-pointer bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl p-3 hover:border-red-500 dark:hover:border-red-500/50 hover:shadow-xl transition-all"
              >
                <div className="h-24 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center mb-3 text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors">
                  {isImage ? <FileText size={32} /> : <FileText size={32} />}
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

// --- MAIN COMPONENT ---

export default function AdminContents() {
  const [tab, setTab] = useState('Recordings');
  const [search, setSearch] = useState("");
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [hallClasses, setHallClasses] = useState([]);

  // MEDIA PICKER STATE
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // NAVIGATION
  const [path, setPath] = useState([]);
  const activeFolder = path.length > 0 ? path[path.length - 1] : null;

  // VIEW DATA
  const [currentViewFolders, setCurrentViewFolders] = useState([]);
  const [currentViewVideos, setCurrentViewVideos] = useState([]);

  // SELECTION & CLIPBOARD
  const [selectedItems, setSelectedItems] = useState({ folders: [], videos: [] });
  const [clipboard, setClipboard] = useState(null);
  const [isPasting, setIsPasting] = useState(false);

  // MODALS
  const [showModal, setShowModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  const [showPdfNamePrompt, setShowPdfNamePrompt] = useState(false);
  const [pendingPdfName, setPendingPdfName] = useState('');
  const fileInputRef = useRef(null);

  // 🚀 PHASE 2: ADDED ZOOM SECRETS TO FORM STATE
  const [videoForm, setVideoForm] = useState({
    title: '',
    youtube_link: '',
    zoomId: '',       // 👈 NEW!
    zoomPasscode: '', // 👈 NEW!
    zoomVisible: false,
    recordingLink: '', // 👈 RECORDING LINK
    recordingVisible: false, // 👈 RECORDING TOGGLE
    price: '',
    batches: [],
    isSeparate: false,
    isStreamActive: false,
    pdfVisible: true,
    pdfTimeLimit: 60,
    isPdfFree: false,
    scheduleEnabled: false,
    startTime: '',
    endTime: '',
    audienceMode: 'all',
    audienceCity: '',
    lockAfterEnd: false,
    lockPrice: '',
  });

  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadData = useCallback(async () => {
    try {
      const t = Date.now();
      const [lRes, cRes] = await Promise.all([
        axios.get(`/lessons?t=${t}`),
        axios.get(`/content/all?t=${t}`)
      ]);

      setAllLessons(lRes.data || []);

      if (activeFolder) {
        const videos = (cRes.data || []).filter(c => String(c.lessonId) === String(activeFolder.id));
        setCurrentViewVideos(videos);
      } else {
        setCurrentViewVideos([]);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    loadData();
    axios.get('/batches').then(res => setBatches(res.data || [])).catch(() => setBatches([]));
    axios.get('/hall-classes').then(res => setHallClasses(res.data || [])).catch(() => setHallClasses([]));
    const handleRefresh = () => loadData();
    socket.on('content_updated', handleRefresh);
    return () => socket.off('content_updated', handleRefresh);
  }, [loadData]);

  useEffect(() => {
    if (!allLessons) return;

    let folders = [];
    if (!activeFolder) {
      folders = allLessons.filter(l => l.type === tab && (!l.parentId));
    } else {
      folders = allLessons.filter(l => String(l.parentId) === String(activeFolder.id));
    }

    if (search) folders = folders.filter(l => (l.name || '').toLowerCase().includes(search.toLowerCase()));
    folders.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    setCurrentViewFolders(folders);

    if (activeFolder) {
      axios.get(`/content/all?t=${Date.now()}`).then(res => {
        const vids = (res.data || []).filter(c => String(c.lessonId) === String(activeFolder.id));
        if (search) setCurrentViewVideos(vids.filter(v => (v.title || '').toLowerCase().includes(search.toLowerCase())));
        else setCurrentViewVideos(vids);
      }).catch(() => setCurrentViewVideos([]));
    } else {
      setCurrentViewVideos([]);
    }
  }, [allLessons, path, tab, search, activeFolder]);

  const toggleSelect = (id, type) => {
    const list = type === 'folder' ? selectedItems.folders : selectedItems.videos;
    const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
    setSelectedItems(prev => ({ ...prev, [type === 'folder' ? 'folders' : 'videos']: newList }));
  };
  const clearSelection = () => setSelectedItems({ folders: [], videos: [] });

  const handleBulkDelete = async () => {
    const count = selectedItems.folders.length + selectedItems.videos.length;
    if (!confirm(`Delete ${count} items permanently?`)) return;
    try {
      await axios.post('/bulk-delete', {
        folderIds: selectedItems.folders,
        videoIds: selectedItems.videos
      });
      clearSelection();
      loadData();
      alert("Deleted Successfully.");
    } catch (e) {
      alert("Delete Failed.");
    }
  };

  const handleCopy = () => {
    setClipboard(selectedItems);
    clearSelection();
    alert("Copied! Navigate to destination and Paste.");
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    if (!confirm("Paste items here?")) return;
    setIsPasting(true);
    try {
      await axios.post('/paste-items', {
        targetParentId: activeFolder ? activeFolder.id : null,
        itemsToPaste: clipboard
      });
      setClipboard(null);
      loadData();
    } catch (e) {
      alert("Paste Failed");
    } finally {
      setIsPasting(false);
    }
  };

  const handleDragStart = (event) => setActiveDragId(event.active.id);
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = currentViewFolders.findIndex(i => i.id === active.id);
      const newIndex = currentViewFolders.findIndex(i => i.id === over.id);
      const newOrder = arrayMove(currentViewFolders, oldIndex, newIndex);

      setCurrentViewFolders(newOrder);
      await axios.post('/lessons/reorder', { items: newOrder.map(l => ({ id: l.id })) });
      loadData();
    }
  };

  const enterFolder = (f) => { setPath([...path, f]); setSearch(""); };
  const goHome = () => setPath([]);
  const handleBack = () => setPath(path.slice(0, -1));

  const handleOpenModal = (item = null) => {
    if (item) setEditItem(item);
    else setEditItem(null);
    setShowModal(true);
  };

  const handleFolderSave = () => { setShowModal(false); loadData(); };

  const toLocalInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const toIsoStringOrNull = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const openVideoModal = (item = null) => {
    setPdfFile(null);
    if (item) {
      setEditItem(item);
      setVideoForm({
        title: item.title || '',
        youtube_link: item.youtube_link || '',
        zoomId: item.zoomId || '',             // 👈 NEW!
        zoomPasscode: item.zoomPasscode || '', // 👈 NEW!
        zoomVisible: !!item.zoomVisible,
        recordingLink: item.recordingLink || '', // 👈 RECORDING LINK
        recordingVisible: !!item.recordingVisible, // 👈 RECORDING TOGGLE
        price: item.price || '0',
        batches: item.batches ? (Array.isArray(item.batches) ? item.batches : [item.batches]) : (item.batch ? [item.batch] : []),
        isSeparate: !!item.isSeparate,
        isStreamActive: !!item.isStreamActive,
        pdfVisible: item.pdfVisible ?? true,
        pdfTimeLimit: item.pdfTimeLimit || 60,
        isPdfFree: !!item.isPdfFree,
        scheduleEnabled: !!item.scheduleEnabled,
        startTime: toLocalInputValue(item.startTime),
        endTime: toLocalInputValue(item.endTime),
        audienceMode: item.audienceMode || 'all',
        audienceCity: item.audienceCity || '',
        lockAfterEnd: !!item.lockAfterEnd,
        lockPrice: item.lockPrice || '',
      });
    } else {
      setEditItem(null);
      setVideoForm({
        title: '',
        youtube_link: '',
        zoomId: '',       // 👈 NEW!
        zoomPasscode: '', // 👈 NEW!
        zoomVisible: false,
        recordingLink: '', // 👈 RECORDING LINK
        recordingVisible: false, // 👈 RECORDING TOGGLE
        price: '0',
        batches: [],
        isSeparate: false,
        isStreamActive: false,
        pdfVisible: true,
        pdfTimeLimit: 60,
        isPdfFree: false,
        scheduleEnabled: false,
        startTime: '',
        endTime: '',
        audienceMode: 'all',
        audienceCity: '',
        lockAfterEnd: false,
        lockPrice: '',
      });
    }
    setShowVideoModal(true);
  };

  const handleLibrarySelect = (filename) => {
    setPdfFile({ name: filename, isLinked: true });
    setShowMediaPicker(false);
  };

  const submitVideo = async () => {
    if (!activeFolder?.id) return alert("Open a folder first.");
    if (!videoForm.title || !videoForm.youtube_link) return alert("Title + YouTube link required.");
    if (videoForm.recordingVisible && videoForm.recordingLink) {
      const recordingUrl = String(videoForm.recordingLink).trim();
      const isDirectRecording = /\.(mp4|m3u8)(\?|#|$)/i.test(recordingUrl);
      const isZoomShare = /(^https?:\/\/)?([a-z0-9-]+\.)?zoom\.us\/rec\/share\//i.test(recordingUrl);
      if (!isDirectRecording && !isZoomShare) {
        return alert("Use a direct .mp4/.m3u8 link or a Zoom share link (zoom.us/rec/share/...).");
      }
    }

    const scheduleEnabled = tab === 'Live' && !!videoForm.scheduleEnabled;
    const scheduleStart = scheduleEnabled ? toIsoStringOrNull(videoForm.startTime) : null;
    const scheduleEnd = scheduleEnabled ? toIsoStringOrNull(videoForm.endTime) : null;

    const audienceMode = tab === 'Live' ? (videoForm.audienceMode || 'all') : 'all';
    const audienceCity = audienceMode === 'city' ? String(videoForm.audienceCity || '').trim() : '';

    const lockAfterEnd = scheduleEnabled && !!videoForm.lockAfterEnd;
    const lockPriceRaw = String(videoForm.lockPrice || '').trim();
    const fallbackPriceRaw = String(videoForm.price || '').trim();
    const resolvedLockPrice = lockAfterEnd ? (lockPriceRaw || fallbackPriceRaw) : '';

    if (tab === 'Live' && audienceMode === 'city' && !audienceCity) {
      return alert("Select a Hall Class city for physical audience.");
    }

    if (lockAfterEnd) {
      const lockValue = Number(resolvedLockPrice);
      if (!resolvedLockPrice || !Number.isFinite(lockValue) || lockValue <= 0) {
        return alert("Lock price must be greater than 0.");
      }
    }

    if (scheduleEnabled) {
      if (!scheduleStart || !scheduleEnd) {
        return alert("Start and end time are required when scheduling is enabled.");
      }
      if (new Date(scheduleStart).getTime() >= new Date(scheduleEnd).getTime()) {
        return alert("End time must be after start time.");
      }
    }

    setIsSubmitting(true);
    try {
      const safeBatches = videoForm.batches.length > 0 ? videoForm.batches : ["All"];

      const payload = {
        ...videoForm,
        scheduleEnabled,
        startTime: scheduleStart,
        endTime: scheduleEnd,
        audienceMode,
        audienceCity,
        lockAfterEnd,
        lockPrice: lockAfterEnd ? resolvedLockPrice : null,
        lessonId: activeFolder.id,
        type: tab,
        month: activeFolder.month,
        batches: safeBatches
      };

      const res = editItem
        ? await axios.put(`/content/${editItem.id}`, payload)
        : await axios.post('/content', payload);

      const contentId = editItem?.id || res?.data?.id;

      if (pdfFile && contentId) {
        let filenameToLink = pdfFile.name;

        if (!pdfFile.isLinked) {
          const fd = new FormData();
          fd.append("file", pdfFile);

          setPdfUploading(true);

          const uploadRes = await axios.post('/admin/vault/upload', fd, {
            headers: { "Content-Type": "multipart/form-data" }
          });

          if (uploadRes.data.success) {
            filenameToLink = uploadRes.data.filename;
          } else {
            throw new Error("Vault Upload Failed");
          }
        }

        await axios.put(`/content/${contentId}/link-pdf`, { filename: filenameToLink });
      }

      setShowVideoModal(false);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Save Failed";
      alert(`Error: ${msg}`);
      console.error(e);
    } finally {
      setIsSubmitting(false);
      setPdfUploading(false);
    }
  };

  const removePdf = async () => {
    if (!editItem?.id) return;
    if (!confirm("Remove attached PDF?")) return;
    try {
      await axios.delete(`/content/${editItem.id}/pdf`);
      loadData();
      setPdfFile(null);
      setEditItem(prev => ({ ...prev, pdfFile: null }));
      alert("PDF removed");
    } catch (e) {
      const status = e?.response?.status;
      alert(`Failed to remove PDF${status ? ` (HTTP ${status})` : ''}`);
    }
  };

  const handleDeleteSingle = async (id, type) => {
    if (!confirm("Delete?")) return;
    try {
      if (type === 'folder') await axios.delete(`/lessons/${id}`);
      else await axios.delete(`/content/${id}`);
      loadData();
    } catch (e) { alert("Failed"); }
  };

  const toggleBatch = (bName, e) => {
    if (e) e.preventDefault();
    setVideoForm(prev => {
      const list = prev.batches.includes(bName)
        ? prev.batches.filter(b => b !== bName)
        : [...prev.batches, bName];
      return { ...prev, batches: list };
    });
  };

  const currentDragFolder = activeDragId ? allLessons.find(l => l.id === activeDragId) : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen relative transition-colors duration-300">

      {/* SELECTION BAR */}
      {(selectedItems.folders.length > 0 || selectedItems.videos.length > 0 || clipboard) && (
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 border border-transparent dark:border-white/10 transition-colors duration-300">
          {clipboard ? (
            <>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {clipboard.folders.length + clipboard.videos.length} Copied
              </span>
              <button onClick={handlePaste} disabled={isPasting}
                className="bg-white dark:bg-slate-700 text-black dark:text-white px-6 py-2 rounded-xl font-black uppercase text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                {isPasting ? 'Pasting...' : 'Paste Here'}
              </button>
              <button onClick={() => setClipboard(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={16} /></button>
            </>
          ) : (
            <>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {selectedItems.folders.length + selectedItems.videos.length} Selected
              </span>
              <div className="h-6 w-px bg-white/20"></div>
              <button onClick={handleCopy} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                <Copy size={18} /> <span className="text-xs font-bold uppercase">Copy</span>
              </button>
              <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:text-red-500 transition-colors">
                <Trash2 size={18} /> <span className="text-xs font-bold uppercase">Delete</span>
              </button>
              <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-lg ml-2"><X size={16} /></button>
            </>
          )}
        </motion.div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2">
            {activeFolder && (
              <button onClick={handleBack} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0">
                <ChevronLeft size={16} />
              </button>
            )}
            <button onClick={goHome} className={`p-2 rounded-lg transition-colors shrink-0 ${!activeFolder ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}>
              <Home size={16} />
            </button>

            {path.map((folder, i) => (
              <div key={folder.id} className="flex items-center gap-2 shrink-0">
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <button
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase whitespace-nowrap transition-colors duration-300 ${i === path.length - 1 ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {!activeFolder && (
              <div className="flex bg-slate-900/5 dark:bg-white/5 p-1 rounded-xl transition-colors duration-300">
                {['Recordings', 'Live'].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors duration-300 ${tab === t ? 'bg-white dark:bg-slate-800 shadow-sm text-red-600 dark:text-red-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => handleOpenModal()} className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
              <FolderPlus size={14} /> New Folder
            </button>
            {activeFolder && (
              <button onClick={() => openVideoModal()} className="bg-red-600 dark:bg-red-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-red-700 transition-colors">
                <Video size={14} /> New Video
              </button>
            )}
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 rounded-2xl py-3 pl-10 pr-4 font-bold text-sm outline-none focus:border-red-500/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-300"
          />
        </div>
      </div>

      <div className="space-y-8 pb-20">
        {loading ? (
          <div className="flex justify-center"><Loader2 className="animate-spin text-red-600" /></div>
        ) : currentViewFolders.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={currentViewFolders.map(l => l.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentViewFolders.map(l => (
                  <SortableFolderItem
                    key={l.id}
                    l={l}
                    openFolder={enterFolder}
                    handleOpenModal={handleOpenModal}
                    tab={tab}
                    isSelected={selectedItems.folders.includes(l.id)}
                    toggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragId ? <DragOverlayCard l={currentDragFolder} tab={tab} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {currentViewVideos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentViewVideos.map(c => (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-300 ${selectedItems.videos.includes(c.id)
                    ? "border-red-500 bg-red-50 dark:bg-red-500/10 dark:border-red-500/50"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10 hover:shadow-lg hover:border-red-100 dark:hover:border-red-500/30"
                  }`}
                onClick={() => toggleSelect(c.id, "video")}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedItems.videos.includes(c.id) ? "bg-red-500 border-red-500 text-white" : "border-slate-300 dark:border-slate-600"
                    }`}>
                    {selectedItems.videos.includes(c.id) && <Check size={12} />}
                  </div>

                  <div className="w-12 h-12 bg-slate-900 dark:bg-slate-800 rounded-lg flex items-center justify-center text-red-500 shrink-0">
                    <Youtube size={20} />
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1 line-clamp-1">{c.title}</h4>

                    {(c.pdfFile) && (
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <FileText size={12} /> {String(c.pdfFile).split('/').pop()}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                      {c.isSeparate && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-bold rounded uppercase">
                          Paid
                        </span>
                      )}

                      {c.isStreamActive && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-[8px] font-bold rounded uppercase flex items-center gap-1">
                          <Radio size={8} /> LIVE
                        </span>
                      )}

                      {c.pdfFile && (
                        <span className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${c.pdfVisible === false ? "bg-slate-800 dark:bg-slate-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}>
                          {c.pdfVisible === false ? "PDF Hidden" : "PDF Included"}
                        </span>
                      )}

                      {c.pdfFile && c.isPdfFree && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold rounded uppercase flex items-center gap-1">
                          FREE PDF
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openVideoModal(c)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteSingle(c.id, "video")} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentViewFolders.length === 0 && currentViewVideos.length === 0 && !loading && (
          <div className="text-center py-20 opacity-30 font-black text-xl uppercase text-slate-400 dark:text-white">Empty</div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <LessonModal
            onClose={() => setShowModal(false)}
            onSave={handleFolderSave}
            batches={batches}
            type={tab}
            item={editItem}
            parentId={activeFolder ? activeFolder.id : null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[30px] p-8 shadow-2xl border border-transparent dark:border-white/10 relative custom-scrollbar transition-colors duration-300">
              <button onClick={() => setShowVideoModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 dark:hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black uppercase text-red-600 dark:text-red-500 mb-6">{editItem ? 'Edit' : 'Add'} Video</h2>

              <div className="space-y-4">
                <input
                  value={videoForm.title}
                  onChange={e => setVideoForm({ ...videoForm, title: e.target.value })}
                  placeholder="Title"
                  className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl font-bold text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-red-500 border border-transparent dark:border-white/5 transition-colors"
                />
                <input
                  value={videoForm.youtube_link}
                  onChange={e => setVideoForm({ ...videoForm, youtube_link: e.target.value })}
                  placeholder="YouTube Link"
                  className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl font-mono text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-red-500 border border-transparent dark:border-white/5 transition-colors"
                />

                {/* 🚀 PHASE 3: ZOOM SECRETS & THE MASTER TOGGLE */}
                {tab === 'Live' && (
                  <div className="space-y-4">
                    {/* ZOOM SECTION */}
                    <div className="space-y-4 p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-500/20 transition-colors">

                      {/* The Master Switch */}
                      <div className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setVideoForm(p => ({ ...p, zoomVisible: !p.zoomVisible }))}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${videoForm.zoomVisible ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                          }`}>
                          {videoForm.zoomVisible && <Check size={12} />}
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase text-blue-900 dark:text-blue-200">Show Zoom Button to Students?</span>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">If OFF, the glowing button is completely erased from their screen.</p>
                        </div>
                      </div>

                      {/* The Secrets (Only show if the button is active, or keep them visible so you can prep them early!) */}
                      <div className="flex gap-4">
                        <input
                          value={videoForm.zoomId}
                          onChange={e => setVideoForm({ ...videoForm, zoomId: e.target.value })}
                          placeholder="Zoom Meeting ID (Optional)"
                          className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl font-mono text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 border border-transparent dark:border-white/5 transition-colors shadow-sm"
                        />
                        <input
                          value={videoForm.zoomPasscode}
                          onChange={e => setVideoForm({ ...videoForm, zoomPasscode: e.target.value })}
                          placeholder="Zoom Passcode (Optional)"
                          className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl font-mono text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 border border-transparent dark:border-white/5 transition-colors shadow-sm"
                        />
                      </div>
                    </div>

                    {/* RECORDING SECTION */}
                    <div className="space-y-4 p-4 bg-purple-50/30 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-500/20 transition-colors">

                      {/* Recording Toggle */}
                      <div className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setVideoForm(p => ({ ...p, recordingVisible: !p.recordingVisible }))}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${videoForm.recordingVisible ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                          }`}>
                          {videoForm.recordingVisible && <Check size={12} />}
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase text-purple-900 dark:text-purple-200">Show Zoom Recording to Students?</span>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">If OFF, the recording button is hidden from their screen.</p>
                        </div>
                      </div>

                      {/* Recording Link Input */}
                      <input
                        value={videoForm.recordingLink}
                        onChange={e => setVideoForm({ ...videoForm, recordingLink: e.target.value })}
                        placeholder="Zoom Cloud Recording URL (Optional)"
                        className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl font-mono text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-purple-500 border border-transparent dark:border-white/5 transition-colors shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {/* PDF SECTION */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-3 transition-colors duration-300">
                  <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                    <FileText size={14} /> Attach PDF (Upload New or Select from Library)
                  </p>

                  {/* ATTACHED FILE DISPLAY */}
                  {(editItem?.pdfFile || pdfFile) && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3 py-2 rounded-lg shadow-sm transition-colors duration-300">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-red-50 dark:bg-red-500/10 rounded flex items-center justify-center text-red-500"><FileText size={16} /></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-green-600 dark:text-green-500">Attached</span>
                          <span className="text-[11px] font-bold truncate max-w-[180px] text-slate-700 dark:text-slate-300">
                            {pdfFile ? pdfFile.name : String(editItem.pdfFile).split('/').pop()}
                          </span>
                        </div>
                      </div>
                      <button onClick={removePdf} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Remove PDF">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  {!pdfFile && !editItem?.pdfFile && (
                    <div className="grid grid-cols-2 gap-3">
                      {/* 1. UPLOAD NEW */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowPdfNamePrompt(true);
                          setPendingPdfName('');
                        }}
                        className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50/10 dark:hover:bg-red-500/10 rounded-xl py-6 transition-all group w-full"
                      >
                        <UploadCloud size={24} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-500">Upload New</span>
                      </button>

                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.type !== "application/pdf") return alert("Only PDF allowed");
                          if (f.size > 50 * 1024 * 1024) return alert("Max 50MB PDF");

                          const ext = f.name.split('.').pop() || 'pdf';
                          const safeTitle = pendingPdfName.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_') || 'Unnamed_Document';
                          const renamedFile = new File([f], `${safeTitle}.${ext}`, { type: f.type });

                          setPdfFile(renamedFile);
                          setShowPdfNamePrompt(false);
                          setPendingPdfName('');
                        }}
                      />

                      {/* 2. SELECT FROM LIBRARY */}
                      <button
                        onClick={() => setShowMediaPicker(true)}
                        className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-500/10 rounded-xl py-6 transition-all group"
                      >
                        <FolderPlus size={24} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">Select from Vault</span>
                      </button>
                    </div>
                  )}

                  {/* TOGGLES */}
                  {(editItem?.pdfFile || pdfFile) && (
                    <>
                      <div
                        onClick={() => setVideoForm({ ...videoForm, pdfVisible: !videoForm.pdfVisible })}
                        className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border transition-colors ${videoForm.pdfVisible ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/5"
                          }`}
                      >
                        <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-colors ${videoForm.pdfVisible ? "bg-green-600 border-green-600" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                          }`}>
                          {videoForm.pdfVisible && <Check size={16} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Show PDF to Students</p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">If OFF, students can’t see/open the PDF.</p>
                        </div>
                      </div>

                      <div
                        onClick={() => setVideoForm({ ...videoForm, isPdfFree: !videoForm.isPdfFree })}
                        className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border transition-colors ${videoForm.isPdfFree ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/5"
                          }`}
                      >
                        <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-colors ${videoForm.isPdfFree ? "bg-blue-600 border-blue-600" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                          }`}>
                          {videoForm.isPdfFree && <Check size={16} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Free PDF Access</p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">Students can open this instantly without requesting access.</p>
                        </div>
                        <div className="ml-auto">
                          <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${videoForm.isPdfFree ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}>
                            {videoForm.isPdfFree ? "FREE" : "LOCKED"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2">PDF Time Limit (Minutes)</p>
                        <input
                          type="number"
                          min="1"
                          value={videoForm.pdfTimeLimit}
                          onChange={e => setVideoForm({ ...videoForm, pdfTimeLimit: parseInt(e.target.value) || 1 })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg font-bold text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                          placeholder="e.g. 60"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer transition-colors"
                  onClick={() => setVideoForm(p => ({ ...p, isSeparate: !p.isSeparate }))}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${videoForm.isSeparate ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                    }`}>
                    {videoForm.isSeparate && <Check size={12} />}
                  </div>
                  <span className="text-xs font-bold uppercase dark:text-slate-200">Separate Payment?</span>
                </div>

                {videoForm.isSeparate && (
                  <input
                    value={videoForm.price}
                    onChange={e => setVideoForm({ ...videoForm, price: e.target.value })}
                    placeholder="Price"
                    type="number"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 p-4 rounded-xl font-bold text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                  />
                )}

                {tab === 'Live' && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer transition-colors"
                    onClick={() => {
                      if (videoForm.scheduleEnabled) return;
                      setVideoForm(p => ({ ...p, isStreamActive: !p.isStreamActive }));
                    }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${videoForm.isStreamActive ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                      {videoForm.isStreamActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold uppercase ${videoForm.scheduleEnabled ? 'text-slate-400 dark:text-slate-500' : 'dark:text-slate-200'}`}>
                        Force Show on Dashboard
                      </div>
                      {videoForm.scheduleEnabled && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">Auto-controlled by schedule.</p>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'Live' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 p-4 rounded-xl transition-colors space-y-3">
                    <div
                      onClick={() => setVideoForm((p) => {
                        const nextEnabled = !p.scheduleEnabled;
                        if (!nextEnabled) {
                          return { ...p, scheduleEnabled: false, lockAfterEnd: false, lockPrice: '' };
                        }
                        return { ...p, scheduleEnabled: true };
                      })}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${videoForm.scheduleEnabled ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                        }`}>
                        {videoForm.scheduleEnabled && <Check size={12} />}
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase dark:text-slate-200">Set Time</span>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">Auto-show on dashboard between start and end.</p>
                      </div>
                    </div>

                    {videoForm.scheduleEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Start Time</p>
                          <input
                            type="datetime-local"
                            value={videoForm.startTime}
                            onChange={(e) => setVideoForm({ ...videoForm, startTime: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">End Time</p>
                          <input
                            type="datetime-local"
                            value={videoForm.endTime}
                            onChange={(e) => setVideoForm({ ...videoForm, endTime: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    {videoForm.scheduleEnabled && (
                      <div className="space-y-3">
                        <div
                          onClick={() => setVideoForm((p) => ({ ...p, lockAfterEnd: !p.lockAfterEnd }))}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${videoForm.lockAfterEnd ? 'bg-slate-900 dark:bg-red-600 border-transparent text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                            }`}>
                            {videoForm.lockAfterEnd && <Check size={12} />}
                          </div>
                          <div>
                            <span className="text-xs font-bold uppercase dark:text-slate-200">Auto-lock after end</span>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400">Switch to separate payment when timer ends.</p>
                          </div>
                        </div>

                        {videoForm.lockAfterEnd && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Lock Price (LKR)</p>
                            <input
                              type="number"
                              min="1"
                              value={videoForm.lockPrice}
                              onChange={(e) => setVideoForm((p) => ({ ...p, lockPrice: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                              placeholder="e.g. 1500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'Live' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 p-4 rounded-xl transition-colors space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Audience</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'all', label: 'All Students' },
                        { key: 'online', label: 'Online Only' },
                        { key: 'city', label: 'Physical City' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={(e) => {
                            e.preventDefault();
                            setVideoForm((prev) => ({
                              ...prev,
                              audienceMode: item.key,
                              audienceCity: item.key === 'city' ? prev.audienceCity : ''
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border transition-colors ${videoForm.audienceMode === item.key
                              ? 'bg-slate-900 dark:bg-red-600 text-white border-transparent'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {videoForm.audienceMode === 'city' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Hall City</p>
                        <select
                          value={videoForm.audienceCity}
                          onChange={(e) => setVideoForm((prev) => ({ ...prev, audienceCity: e.target.value }))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-3 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-slate-900 dark:text-white transition-colors"
                        >
                          <option value="">Select Hall City</option>
                          {hallClasses.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 p-4 rounded-xl transition-colors">
                  <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2">Batches</p>
                  <div className="flex flex-wrap gap-2">
                    {batches.map(b => (
                      <button
                        key={b.id}
                        onClick={(e) => toggleBatch(b.name, e)}
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-colors ${videoForm.batches.includes(b.name) ? 'bg-slate-900 dark:bg-red-600 text-white border-transparent' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={submitVideo}
                  disabled={isSubmitting || pdfUploading}
                  className="w-full bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors py-4 rounded-xl font-black uppercase text-xs shadow-lg border border-transparent dark:border-white/10"
                >
                  {(isSubmitting || pdfUploading) ? <Loader2 className="animate-spin mx-auto" /> : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMediaPicker && (
          <MediaPickerModal
            onClose={() => setShowMediaPicker(false)}
            onSelect={handleLibrarySelect}
          />
        )}
      </AnimatePresence>

      {/* PDF NAMING PROMPT MODAL */}
      <AnimatePresence>
        {showPdfNamePrompt && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-transparent dark:border-white/10 relative transition-colors">
              <button onClick={() => setShowPdfNamePrompt(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-600 dark:hover:text-red-500">
                <X size={20} />
              </button>

              <h3 className="text-lg font-black uppercase text-slate-800 dark:text-white mb-2">Name Your PDF</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 leading-relaxed">
                This name will be used to save the file cleanly in your Secure Media Vault.
              </p>

              <input
                autoFocus
                value={pendingPdfName}
                onChange={e => setPendingPdfName(e.target.value)}
                placeholder="e.g. 2024 Revision Note 1"
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/10 p-4 rounded-xl font-bold text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white placeholder:text-slate-400 transition-colors mb-6"
              />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (!pendingPdfName.trim()) return alert("Please enter a name first.");
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-colors"
              >
                <FolderPlus size={16} /> Select PDF File
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}