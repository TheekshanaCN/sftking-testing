'use client';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import RequestRow from '@/components/admin/RequestRow';
import { Inbox, CheckCircle2, Trash2 } from 'lucide-react';

export default function RequestManager() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await axios.get('/admin/requests');
            
            // LOGIC UPDATE: Combine Name + Mobile so it shows in the row
            const processedData = res.data.map(r => ({
                ...r,
                studentName: r.User?.mobile 
                    ? `${r.studentName} • ${r.User.mobile}` 
                    : r.studentName
            }));

            setRequests(processedData);
            setLoading(false);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 5000); 
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (id, status) => {
        // OPTIMISTIC UPDATE:
        // Immediately change the status in the local list so it moves to History INSTANTLY
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: status } : r));
        
        try {
            await axios.post('/admin/request-action', { id, status });
        } catch(e) {
            alert("Action Failed");
            load(); // Revert on fail
        }
    };
    
    const handleClearHistory = async () => {
        if (!confirm("Clear all approved/declined history? This cannot be undone.")) return;
        try {
            await axios.delete('/admin/requests/history');
            load();
            alert("History Cleared.");
        } catch (e) { alert("Failed to clear."); }
    };

    // STRICT FILTERS
    // Pending = ONLY items with status 'pending'
    const pending = requests.filter(r => r.status === 'pending');
    
    // History = Items that are Approved OR Declined
    const history = requests
        .filter(r => r.status !== 'pending')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return (
        <div className="space-y-10 font-sans pb-20 transition-colors duration-300">
            
            {/* PENDING HEADER */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl transition-colors duration-300">
                        <Inbox size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter transition-colors duration-300">
                            Approval Queue
                        </h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">
                            {pending.length} Requests Waiting
                        </p>
                    </div>
                </div>

                {pending.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[40px] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center transition-colors duration-300">
                        <CheckCircle2 size={48} className="text-emerald-100 dark:text-emerald-900/50 mb-4 transition-colors duration-300"/>
                        <p className="text-slate-300 dark:text-slate-600 font-black italic uppercase tracking-widest text-sm transition-colors duration-300">
                            Queue Clear
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pending.map(req => (
                            <RequestRow key={req.id} req={req} onAction={handleAction} />
                        ))}
                    </div>
                )}
            </div>

            {/* HISTORY SECTION */}
            {history.length > 0 && (
                <div className="pt-10 border-t border-slate-100 dark:border-white/5 transition-colors duration-300">
                    <div className="flex justify-between items-center mb-6 ml-2">
                        <h4 className="text-xs font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">
                            Processed History ({history.length})
                        </h4>
                        
                        {/* CLEAR BUTTON */}
                        <button 
                            onClick={handleClearHistory}
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                            title="Clear History"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="space-y-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        {history.map(req => (
                            <RequestRow key={req.id} req={req} onAction={handleAction} isHistory />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}