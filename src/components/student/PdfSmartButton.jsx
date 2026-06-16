'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket';
import { Lock, FileText, Loader2, PlayCircle, CheckCircle } from 'lucide-react';
import { emitStudentActivity } from '@/lib/studentActivity';

export default function PdfSmartButton({ item, user, className }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [accessState, setAccessState] = useState('loading'); // 'free', 'approved', 'pending', 'locked'

  // ✅ SUPER AGGRESSIVE STATUS CHECKER
  useEffect(() => {
    if (!user || !item) return;

    const determineAccess = async () => {
      // 1. IF ADMIN SAYS FREE -> FORCE OPEN
      if (item.isPdfFree) {
        setAccessState('free');
        return;
      }

      // 2. IF VIDEO IS NOT PAID -> FORCE LOCK
      if (!item.isPaid) {
         setAccessState('locked'); 
         return;
      }

      // 3. OTHERWISE CHECK DATABASE (For previous requests)
      try {
        const res = await axios.get(`/student/pdf-status/${item.id}`);
        const s = res.data.status; 
        
        if (s === 'approved') setAccessState('approved');
        else if (s === 'pending') setAccessState('pending');
        else setAccessState('locked'); // Default to locked if not free/approved
        
      } catch (e) {
        setAccessState('locked');
      }
    };

    determineAccess();

    // ✅ LISTEN FOR APPROVALS WHILE WATCHING
    const handleRequestUpdate = (data) => {
      if (data.studentId === user.id && data.contentId === item.id && data.type === 'PDF_ACCESS') {
        if (data.status === 'approved') setAccessState('approved');
      }
    };

    socket.on('request_updated', handleRequestUpdate);
    return () => socket.off('request_updated', handleRequestUpdate);

  }, [item, user, item?.isPdfFree]); // ⚡️ WATCH 'isPdfFree' TO UPDATE INSTANTLY

  const handleClick = async (e) => {
    if (e) e.stopPropagation();

    // OPEN IF FREE OR APPROVED
    if (accessState === 'free' || accessState === 'approved') {
      // 🚀 MAGIC FIX: Uses ?id= to avoid the 404, AND opens in a new full-screen tab!
      emitStudentActivity(socket, user, {
        page: 'Secure PDF',
        action: 'Opened PDF Viewer',
        detail: item.title || `Content #${item.id}`,
        route: `/pdf-viewer?id=${item.id}`,
        kind: 'content',
        contentId: item.id
      });
      window.open(`/pdf-viewer?id=${item.id}`, '_blank');
      return;
    }

    // REQUEST IF LOCKED
    if (accessState === 'locked') {
      setRequesting(true);
      try {
        await axios.post('/student/request', {
          studentId: user.id,
          contentId: item.id,
          type: 'PDF_ACCESS'
        });
        emitStudentActivity(socket, user, {
          page: 'Secure PDF',
          action: 'Requested PDF Access',
          detail: item.title || `Content #${item.id}`,
          route: `/student/request`,
          kind: 'request',
          contentId: item.id
        });
        setAccessState('pending');
      } catch (e) {
        alert("Request Failed");
      } finally {
        setRequesting(false);
      }
    }
  };

  // HIDE IF NO PDF
  if (!item.pdfFile || item.pdfVisible === false) return null;

  return (
    <button
      onClick={handleClick}
      disabled={accessState === 'pending' || requesting || !item.isPaid}
      className={`${className} flex items-center justify-center gap-2 transition-all shadow-lg font-black uppercase tracking-widest text-xs
        ${
          !item?.isPaid
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : (accessState === 'free' || accessState === 'approved')
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' // GREEN
            : accessState === 'pending'
            ? 'bg-amber-500 text-white cursor-default' // YELLOW
            : 'bg-slate-900 hover:bg-black text-white shadow-black/20' // BLACK
        }`}
    >
      {requesting ? <Loader2 size={16} className="animate-spin" /> : 
       (accessState === 'free' || accessState === 'approved') ? <PlayCircle size={16} /> : 
       accessState === 'pending' ? <Loader2 size={16} /> : <Lock size={16} />}
      
      {!item?.isPaid 
        ? 'PDF Locked' 
        : (accessState === 'free' || accessState === 'approved')
          ? 'Open PDF + Video'
          : accessState === 'pending'
          ? 'Request Sent'
          : 'Request Access'}
    </button>
  );
}