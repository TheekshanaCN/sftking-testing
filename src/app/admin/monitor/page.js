'use client';
import { useState, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket'; 
import { 
    Cpu, HardDrive, Activity, Zap, Wifi, ArrowDown, ArrowUp, Globe, Terminal
} from 'lucide-react';

export default function SystemMonitor() {
    const [stats, setStats] = useState(null);
    const [connected, setConnected] = useState(false);
    
    const terminalRef = useRef(null); 
    const isAtBottomRef = useRef(true); // Track if user is at the bottom

    useEffect(() => {
        if (socket.connected) setConnected(true);
        const handlePulse = (data) => {
            setStats(data);
            setConnected(true);
        };
        socket.on('server_health_pulse', handlePulse);
        return () => socket.off('server_health_pulse', handlePulse);
    }, []);

    // 1. SMART SCROLL LOGIC
    useEffect(() => {
        if (terminalRef.current && isAtBottomRef.current) {
            // Only auto-scroll if the user WAS already at the bottom
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [stats?.logs]);

    // 2. DETECT MANUAL SCROLLING
    const handleScroll = () => {
        if (!terminalRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        // Check if user is near the bottom (within 10px tolerance)
        const isBottom = scrollHeight - scrollTop - clientHeight < 10;
        isAtBottomRef.current = isBottom;
    };

    const formatUptime = (s) => {
        if (!s) return "0m";
        const d = Math.floor(s / (3600 * 24));
        const h = Math.floor((s % (3600 * 24)) / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${d}d ${h}h ${m}m`;
    };

    if (!stats) return <div className="flex h-96 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

    return (
        <div className="space-y-6 font-sans pb-20 transition-colors duration-300">
            
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter transition-colors">Command Center</h1>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2 transition-colors">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {connected ? "God Mode Active" : "Connecting..."}
                    </p>
                </div>
                <div className="px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg text-[10px] font-mono shadow-xl flex items-center gap-2 border border-transparent dark:border-white/10 transition-colors">
                    <Globe size={12} className="text-blue-400"/> {stats.net.ip}
                </div>
            </div>

            {/* --- ROW 1: METRICS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="CPU Load" value={`${stats.cpu}%`} subValue={`${stats.cpuFreq} MHz`} icon={<Cpu size={20}/>} color="blue" progress={stats.cpu} />
                <MetricCard label="RAM Usage" value={`${stats.ram.percent}%`} subValue={`${stats.ram.used} / ${stats.ram.total}`} icon={<Zap size={20}/>} color="purple" progress={stats.ram.percent} />
                <MetricCard label="Disk I/O" value={`${stats.diskIo.read} MB/s`} subValue={`${stats.diskIo.write} MB/s Write`} icon={<HardDrive size={20}/>} color="amber" progress={stats.diskIo.read * 2} />
                <MetricCard label="Live Users" value={stats.socketCount} subValue="Active Sockets" icon={<Activity size={20}/>} color="red" progress={(stats.socketCount / 200) * 100} />
            </div>

            {/* --- ROW 2: NETWORK & SPECS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Traffic */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[25px] border border-slate-100 dark:border-white/5 shadow-lg col-span-1 md:col-span-2 relative overflow-hidden transition-colors duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 text-slate-800 dark:text-white"><Wifi size={100}/></div>
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 transition-colors">Network Traffic</h3>
                    <div className="flex items-center justify-around mb-4">
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 transition-colors">Incoming (RX)</p>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2 justify-center transition-colors">
                                <ArrowDown size={24} className="text-green-500 dark:text-green-400"/> {stats.net.rxSpeed} <span className="text-sm text-slate-500 dark:text-slate-400">KB/s</span>
                            </h2>
                        </div>
                        <div className="h-12 w-px bg-slate-100 dark:bg-slate-800 transition-colors"></div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 transition-colors">Outgoing (TX)</p>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2 justify-center transition-colors">
                                <ArrowUp size={24} className="text-blue-500 dark:text-blue-400"/> {stats.net.txSpeed} <span className="text-sm text-slate-500 dark:text-slate-400">KB/s</span>
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Specs */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[25px] border border-slate-100 dark:border-white/5 shadow-lg transition-colors duration-300">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 transition-colors">System Core</h3>
                    <div className="space-y-3">
                        <SpecRow label="OS" value={stats.os} />
                        <SpecRow label="Kernel" value={stats.kernel} />
                        <SpecRow label="Uptime" value={formatUptime(stats.uptime)} />
                    </div>
                </div>
            </div>

            {/* --- ROW 3: TERMINAL --- */}
            {/* Note: Kept pure black even in light mode because it looks awesome like a real terminal */}
            <div className="bg-black rounded-[25px] shadow-lg border border-slate-800 p-6 overflow-hidden flex flex-col h-[300px]">
                <h3 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Terminal size={14}/> Server Terminal (Live Stream)
                </h3>
                <div 
                    ref={terminalRef}
                    onScroll={handleScroll} // 3. Listen for scroll events
                    className="flex-1 overflow-y-auto font-mono text-[10px] text-green-400/80 space-y-1 scrollbar-hide"
                >
                    {stats.logs && stats.logs.map((log, i) => (
                        <div key={i} className="border-b border-green-900/20 pb-1">
                            <span className="text-green-700 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

// Helper Components
function MetricCard({ label, value, subValue, icon, color, progress }) {
    const colors = { blue: "bg-blue-500", purple: "bg-purple-500", amber: "bg-amber-500", red: "bg-red-500" };
    const bgColors = { 
        blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400", 
        purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400", 
        amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400", 
        red: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" 
    };
    
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] border border-slate-100 dark:border-white/5 shadow-md transition-colors duration-300">
            <div className="flex justify-between mb-3">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors">{label}</p>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white transition-colors">{value}</h2>
                </div>
                <div className={`p-2 rounded-lg ${bgColors[color]} h-fit transition-colors`}>{icon}</div>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2 transition-colors">
                <div className={`h-full ${colors[color]}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 text-right transition-colors">{subValue}</p>
        </div>
    );
}

function SpecRow({ label, value }) {
    return (
        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0 transition-colors">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors">{label}</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono transition-colors">{value}</span>
        </div>
    );
}