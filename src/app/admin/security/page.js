'use client';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { ShieldAlert, Activity, Lock, Ban, Unlock, AlertTriangle, Trash2, UserX } from 'lucide-react';

export default function SecurityCenter() {
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('alerts'); 

    const fetchLogs = async () => {
        try {
            const res = await axios.get('/admin/security/logs');
            setLogs(res.data);
        } catch(e) {}
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); 
        return () => clearInterval(interval);
    }, []);

    const handleClearLogs = async (type) => {
        const label = type === 'alerts' ? 'Security Alerts' : 'Live Feed';
        if (!confirm(`Are you sure you want to CLEAR ALL ${label}? This cannot be undone.`)) return;

        try {
            await axios.delete('/admin/security/logs', { data: { type } });
            fetchLogs();
            alert(`${label} Cleared.`);
        } catch(e) {
            alert("Failed to clear logs.");
        }
    };

    const handleStatusToggle = async (log) => {
        if (!log.user_id) return alert("Cannot trace User ID.");

        const isCurrentlyBanned = log.current_status === 'deactivated';
        const targetName = log.mobile || 'User';

        try {
            if (isCurrentlyBanned) {
                if(!confirm(`Unblock Student ${targetName}?`)) return;
                await axios.post('/admin/students/toggle-status', { id: log.user_id, currentStatus: 'deactivated' });
            } else {
                if(!confirm(`BAN Student ${targetName}?`)) return;
                await axios.post('/admin/students/toggle-status', { id: log.user_id, currentStatus: 'active' });
            }
            await fetchLogs();
        } catch(e) {
            if (e.response && e.response.status === 404) {
                alert("Action Failed: This user has been DELETED.");
            } else {
                alert("Action Failed.");
            }
        }
    };

    const alerts = logs.filter(l => 
        (l.severity === 'high' || l.severity === 'medium') && 
        !l.event.startsWith('Admin') 
    );

    const liveFeed = logs.filter(l => 
        l.severity === 'low' || 
        l.event.startsWith('Admin')
    );

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col font-sans transition-colors duration-300">
            
            {/* 🚀 DARK MODE: Header background and borders */}
            <div className="sticky top-0 z-30 bg-[#FFFBFB]/95 dark:bg-slate-950/95 backdrop-blur-sm pb-4 border-b border-slate-100 dark:border-white/5 mb-6 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/30">
                        <Lock size={32} />
                    </div>
                    <div>
                        {/* 🚀 DARK MODE: Heading text color */}
                        <h2 className="text-3xl font-black uppercase italic text-slate-800 dark:text-white tracking-tighter transition-colors duration-300">
                            Security Command
                        </h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">
                            Threat Detection & Monitoring
                        </p>
                    </div>
                </div>

                {/* 🚀 DARK MODE: Tabs Container */}
                <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-fit transition-colors duration-300">
                    <button 
                        onClick={() => setActiveTab('alerts')}
                        className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <ShieldAlert size={14}/> Security Alerts
                        {alerts.length > 0 && <span className="bg-white text-red-600 px-1.5 rounded text-[9px]">{alerts.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('live')}
                        className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-lg shadow-black/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <Activity size={14}/> Live Feed
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'alerts' && (
                    /* 🚀 DARK MODE: Border adjustment for terminal card */
                    <div className="h-full bg-slate-900 rounded-[30px] overflow-hidden shadow-2xl border border-slate-800 dark:border-white/10 flex flex-col transition-colors duration-300">
                        <div className="p-6 border-b border-red-500/30 bg-red-900/10 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-red-500"/>
                                <h3 className="font-black text-red-500 uppercase tracking-widest text-sm">Active Threats</h3>
                            </div>
                            {alerts.length > 0 && (
                                <button onClick={() => handleClearLogs('alerts')} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors" title="Clear Alerts"><Trash2 size={18}/></button>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-slate-500 font-black uppercase text-[10px] tracking-widest bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-5 pl-8">Time</th>
                                        <th className="p-5">Event</th>
                                        <th className="p-5">Details</th>
                                        <th className="p-5 text-purple-400">Device</th>
                                        <th className="p-5">Target</th>
                                        <th className="p-5">IP Source</th>
                                        <th className="p-5 pr-8">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs text-slate-300 divide-y divide-white/5">
                                    {alerts.length === 0 ? (
                                        <tr><td colSpan="6" className="p-10 text-center italic text-slate-600">No Active Threats</td></tr>
                                    ) : alerts.map(log => {
                                        const isBanned = log.current_status === 'deactivated';
                                        const isDeleted = log.current_status === 'unknown' && log.user_id;
                                        
                                        return (
                                        <tr key={log.id} className="hover:bg-red-900/10 transition-colors">
                                            <td className="p-5 pl-8 text-slate-500 font-bold">{new Date(log.createdAt).toLocaleTimeString()}</td>
                                            <td className="p-5"><span className="font-bold text-white">{log.event}</span></td>
                                            <td className="p-5 text-red-300">{log.description}</td>
                                            <td className="p-5 text-purple-300 font-bold">{log.device_name || 'Unknown'}</td>
                                            <td className="p-5 text-blue-400 font-bold">{log.mobile || 'Unknown'}</td>
                                            <td className="p-5 text-amber-500">{log.ip_address}</td>
                                            <td className="p-5 pr-8">
                                                
                                                {log.mobile === 'ADMIN' ? (
                                                    <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-800 px-3 py-1 rounded border border-slate-700 select-none cursor-not-allowed">
                                                        Protected
                                                    </span>
                                                ) : isDeleted ? (
                                                    <span className="text-[10px] font-black uppercase text-red-500/50 bg-red-950/20 px-3 py-1 rounded border border-red-900/20 select-none cursor-not-allowed flex items-center justify-center gap-1">
                                                        <UserX size={12}/> Deleted
                                                    </span>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleStatusToggle(log)}
                                                        className={`p-2 rounded-lg border flex items-center gap-2 transition-all w-[100px] justify-center ${
                                                            isBanned 
                                                            ? 'bg-green-900/50 text-green-400 border-green-800/50 hover:bg-green-600 hover:text-white' 
                                                            : 'bg-red-900/50 text-red-400 border-red-800/50 hover:bg-red-600 hover:text-white'
                                                        }`}
                                                    >
                                                        {isBanned ? <Unlock size={14}/> : <Ban size={14}/>}
                                                        {isBanned ? "Unblock" : "Ban User"}
                                                    </button>
                                                )}

                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'live' && (
                    /* 🚀 DARK MODE: Border adjustment for terminal card */
                    <div className="h-full bg-slate-900 rounded-[30px] shadow-2xl overflow-hidden border border-slate-800 dark:border-white/10 flex flex-col transition-colors duration-300">
                        <div className="p-6 border-b border-white/10 bg-slate-950/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm">Access Log</h3>
                            {liveFeed.length > 0 && (
                                <button onClick={() => handleClearLogs('live')} className="p-2 text-slate-500 hover:bg-white/10 rounded-lg transition-colors" title="Clear Feed"><Trash2 size={18}/></button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-slate-500 font-black uppercase text-[10px] tracking-widest bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-5 pl-8">Time</th>
                                        <th className="p-5">Event</th>
                                        <th className="p-5 text-purple-400">Device</th>
                                        <th className="p-5">Mobile</th>
                                        <th className="p-5">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs text-slate-300 divide-y divide-white/5">
                                    {liveFeed.length === 0 ? <tr><td colSpan="4" className="p-20 text-center italic text-slate-600">Feed Empty</td></tr> : liveFeed.map(log => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-5 pl-8 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</td>
                                            <td className="p-5 font-bold text-white">{log.event}</td>
                                            <td className="p-5 text-purple-300 font-bold">{log.device_name || 'Unknown'}</td>
                                            <td className="p-5 text-blue-400 font-bold">{log.mobile || '-'}</td>
                                            <td className="p-5 text-amber-500">{log.ip_address}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}