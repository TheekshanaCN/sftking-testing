'use client';

import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { motion } from 'framer-motion';
import { 
    Flame, Shield, ShieldAlert, Globe, 
    FolderLock, Code, Activity, ServerCrash, 
    Loader2, Power, AlertTriangle, CheckCircle2
} from 'lucide-react';

export default function FirewallManager() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null); 

    const fetchRules = async () => {
        try {
            const res = await axios.get('/admin/firewall');
            setRules(res.data);
        } catch (error) {
            console.error("Failed to load firewall rules", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleToggle = async (key, currentStatus) => {
        setToggling(key);
        const newStatus = !currentStatus;
        
        try {
            setRules(prev => prev.map(r => r.key === key ? { ...r, isActive: newStatus } : r));
            await axios.post('/admin/firewall/toggle', { key, isActive: newStatus });
        } catch (error) {
            alert("Failed to update firewall rule.");
            setRules(prev => prev.map(r => r.key === key ? { ...r, isActive: currentStatus } : r));
        } finally {
            setToggling(null);
        }
    };

    const getIcon = (key, isActive) => {
        // 🚀 DARK MODE: Adapted icon colors
        const colorClass = isActive ? "text-orange-500" : "text-slate-400 dark:text-slate-600";
        switch (key) {
            case 'sqli_xss_filter': return <Code size={28} className={colorClass} />;
            case 'dir_traversal': return <FolderLock size={28} className={colorClass} />;
            case 'ddos_ratelimit': return <Activity size={28} className={colorClass} />; 
            case 'geo_block': return <Globe size={28} className={colorClass} />;
            case 'vpn_block': return <ServerCrash size={28} className={colorClass} />;
            default: return <Shield size={28} className={colorClass} />;
        }
    };

    const activeCount = rules.filter(r => r.isActive).length;
    const systemStatus = activeCount === rules.length ? 'MAXIMUM SECURITY' : activeCount > 0 ? 'PARTIAL DEFENSE' : 'VULNERABLE';
    const statusColor = activeCount === rules.length ? 'text-emerald-500' : activeCount > 0 ? 'text-orange-500' : 'text-red-600';

    if (loading) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4 transition-colors duration-300">
                <Loader2 className="animate-spin text-orange-500" size={48} />
                <p className="text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Defense Grid...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 transition-colors duration-300">
            
            {/* HEADER - COMMAND CENTER STYLE */}
            {/* 🚀 DARK MODE: Header panel morphs from crisp white to deep slate */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-8 rounded-[30px] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-slate-200/50 dark:shadow-2xl transition-colors duration-300">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-10 dark:opacity-10 pointer-events-none text-slate-800 dark:text-white" 
                     style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-20 h-20 bg-orange-50 dark:bg-orange-500/10 rounded-2xl border border-orange-100 dark:border-orange-500/20 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(249,115,22,0.1)] dark:shadow-[0_0_30px_rgba(249,115,22,0.2)] transition-colors duration-300">
                        <Flame size={40} className="text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter transition-colors duration-300">W.A.F. Control Core</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 max-w-md transition-colors duration-300">
                            Web Application Firewall. Deep packet inspection and perimeter defense protocols.
                        </p>
                    </div>
                </div>

                {/* SYSTEM STATUS MONITOR */}
                <div className="relative z-10 flex flex-col items-center md:items-end bg-slate-50 dark:bg-black/40 p-4 rounded-2xl border border-slate-100 dark:border-white/5 min-w-[200px] transition-colors duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        {activeCount === rules.length ? <CheckCircle2 size={14} className={statusColor} /> : <AlertTriangle size={14} className={statusColor} />}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                            {systemStatus}
                        </span>
                    </div>
                    <div className="text-3xl font-mono font-bold text-slate-800 dark:text-white tracking-widest transition-colors duration-300">
                        {activeCount}<span className="text-slate-400 dark:text-slate-600 text-lg transition-colors duration-300">/{rules.length}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 transition-colors duration-300">Rules Active</span>
                </div>
            </div>

            {/* DEFENSE GRID (THE TOGGLES) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rules.map((rule, index) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={rule.key} 
                        className={`relative overflow-hidden p-6 rounded-[24px] border transition-all duration-500 ${
                            rule.isActive 
                            ? 'bg-orange-50/50 dark:bg-slate-900 border-orange-200 dark:border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.05)]' 
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/5 opacity-80 hover:opacity-100 shadow-sm'
                        }`}
                    >
                        {/* Active Glow Effect */}
                        {rule.isActive && (
                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 blur-3xl rounded-full pointer-events-none"></div>
                        )}

                        <div className="flex items-start justify-between gap-4 relative z-10">
                            <div className="flex gap-5">
                                {/* Icon Box */}
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-500 ${
                                    rule.isActive ? 'bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5'
                                }`}>
                                    {getIcon(rule.key, rule.isActive)}
                                </div>

                                {/* Text Info */}
                                <div className="flex flex-col justify-center">
                                    <h3 className={`text-lg font-bold uppercase tracking-tight transition-colors duration-500 ${
                                        rule.isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                        {rule.name}
                                    </h3>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-1 leading-relaxed transition-colors duration-300">
                                        {rule.description}
                                    </p>
                                </div>
                            </div>

                            {/* THE PHYSICAL TOGGLE SWITCH */}
                            <button
                                onClick={() => handleToggle(rule.key, rule.isActive)}
                                disabled={toggling === rule.key}
                                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors duration-300 focus:outline-none ${
                                    rule.isActive ? 'border-orange-500 bg-orange-100 dark:bg-orange-500/20' : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800'
                                } disabled:opacity-50`}
                            >
                                <span className="sr-only">Toggle {rule.name}</span>
                                
                                {/* Loading Spinner OR Switch Thumb */}
                                {toggling === rule.key ? (
                                    <Loader2 size={14} className={`animate-spin ${rule.isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                                ) : (
                                    <span
                                        className={`pointer-events-none absolute left-0.5 inline-block h-5 w-5 transform rounded-full shadow transition-transform duration-300 ${
                                            rule.isActive ? 'translate-x-7 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'translate-x-0 bg-white dark:bg-slate-500'
                                        }`}
                                    />
                                )}
                            </button>
                        </div>

                        {/* Status Footer */}
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between transition-colors duration-300">
                            <div className="flex items-center gap-2">
                                <Activity size={14} className={rule.isActive ? "text-emerald-500 animate-pulse" : "text-slate-400 dark:text-slate-600"} />
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${
                                    rule.isActive ? "text-emerald-600 dark:text-emerald-500" : "text-slate-400 dark:text-slate-600"
                                }`}>
                                    {rule.isActive ? "Monitoring Traffic" : "System Offline"}
                                </span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase transition-colors duration-300">SYS_KEY: {rule.key}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* DANGER ZONE WARNING */}
            <div className="mt-10 p-6 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-start gap-4 transition-colors duration-300">
                <ShieldAlert size={24} className="text-red-500 shrink-0 mt-1" />
                <div>
                    <h4 className="text-red-600 dark:text-red-500 font-black uppercase tracking-widest text-sm mb-1 transition-colors duration-300">Restricted Access Zone</h4>
                    <p className="text-red-800/70 dark:text-slate-400 text-xs leading-relaxed transition-colors duration-300">
                        Disabling these protocols leaves the SFT KING infrastructure vulnerable to Layer 7 application attacks, directory traversal, and brute-force injections. Only disable for debugging purposes. All modifications are logged in the immutable audit trail.
                    </p>
                </div>
            </div>

        </div>
    );
}