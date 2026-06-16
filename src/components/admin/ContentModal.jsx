'use client';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { X, Check, FileText, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ContentModal({ onClose, onSave, lessonId, item }) {
  const [loading, setLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [form, setForm] = useState({
    title: item?.title || '',
    youtube_link: item?.youtube_link || '',
    price: item?.price || '',
    isSeparate: item?.isSeparate || false,
    isStreamActive: item?.isStreamActive || false,
    lessonId: lessonId || item?.lessonId,
    pdfVisible: item?.pdfVisible ?? true,
  });

  useEffect(() => {
    setForm({
      title: item?.title || '',
      youtube_link: item?.youtube_link || '',
      price: item?.price || '',
      isSeparate: item?.isSeparate || false,
      isStreamActive: item?.isStreamActive || false,
      lessonId: lessonId || item?.lessonId,
      pdfVisible: item?.pdfVisible ?? true,
    });
  }, [item, lessonId]);

  const uploadPdfToVideo = async () => {
    if (!item?.id) return alert('Save video first.');
    if (!pdfFile) return alert('Choose a PDF first.');

    const fd = new FormData();
    fd.append('pdf', pdfFile);

    setPdfBusy(true);
    try {
      await axios.post(`/api/content/${item.id}/pdf`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('PDF attached successfully!');
      try {
        await axios.put(`/content/${item.id}`, { pdfVisible: true });
      } catch (e) {}
      onSave();
    } catch (e) {
      console.error(e);
      alert('PDF upload failed');
    } finally {
      setPdfBusy(false);
    }
  };

  const removePdfFromVideo = async () => {
    if (!item?.id) return;
    if (!confirm('Remove attached PDF?')) return;

    setPdfBusy(true);
    try {
      await axios.delete(`/api/content/${item.id}/pdf`);
      alert('PDF removed!');
      try {
        await axios.put(`/content/${item.id}`, { pdfVisible: true });
      } catch (e) {}
      onSave();
    } catch (e) {
      console.error(e);
      alert('Failed to remove PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.youtube_link) return alert('Fill title and link.');

    setLoading(true);
    try {
      if (item) {
        await axios.put(`/content/${item.id}`, form);
      } else {
        await axios.post('/content', form);
      }
      onSave();
    } catch (e) {
      console.error(e);
      alert('Error saving video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-colors duration-300">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-lg rounded-[40px] p-8 shadow-2xl transition-colors duration-300"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black uppercase italic text-red-600 dark:text-red-500">
            {item ? 'Edit Video' : 'Add Video'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-5">
          <input
            value={form.title}
            className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-500 transition-colors"
            placeholder="Video Title"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <input
            value={form.youtube_link}
            className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-500 transition-colors"
            placeholder="YouTube Link"
            onChange={(e) => setForm({ ...form, youtube_link: e.target.value })}
          />

          {/* PDF SECTION */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 space-y-3 transition-colors">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-red-600 dark:text-red-500" />
              <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Optional PDF</p>
            </div>

            <input
              type="file"
              accept="application/pdf"
              className="text-sm text-slate-500 dark:text-slate-400"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />

            <div className="flex gap-3">
              <button
                disabled={pdfBusy}
                onClick={uploadPdfToVideo}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-[10px] disabled:opacity-60 hover:bg-red-700 transition-colors"
              >
                {pdfBusy ? 'Uploading...' : 'Attach PDF'}
              </button>

              {item?.pdfFile && (
                <button
                  disabled={pdfBusy}
                  onClick={removePdfFromVideo}
                  className="py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white text-[10px] font-black flex items-center gap-2 disabled:opacity-60 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>

            {item?.pdfFile ? (
              <div className="mt-2 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-between transition-colors">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    PDF Attached
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">
                    {item.pdfFile}
                  </p>
                </div>
                <span className="shrink-0 ml-3 px-2 py-1 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                  Included
                </span>
              </div>
            ) : (
              <div className="mt-2 p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-transparent transition-colors">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  No PDF Attached
                </p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  You can attach notes PDF for this video.
                </p>
              </div>
            )}

            {/* PDF VISIBILITY TOGGLE */}
            {item?.pdfFile && (
            <div
                onClick={() => setForm({ ...form, pdfVisible: !form.pdfVisible })}
                className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border transition-colors ${
                form.pdfVisible ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/5"
                }`}
            >
                <div
                className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-colors ${
                    form.pdfVisible ? "bg-green-600 border-green-600" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                }`}
                >
                {form.pdfVisible && <Check size={16} className="text-white" />}
                </div>

                <div>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                    Show PDF to Students
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">
                    If OFF, students can’t see/open the PDF.
                </p>
                </div>

                <div className="ml-auto">
                <span
                    className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${
                    form.pdfVisible ? "bg-green-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                >
                    {form.pdfVisible ? "VISIBLE" : "HIDDEN"}
                </span>
                </div>
            </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs disabled:opacity-60 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Video'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}