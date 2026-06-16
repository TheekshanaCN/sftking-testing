'use client';
import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios';
import { useSocket } from '@/context/SocketContext';
import { Trash2, DownloadCloud, ShieldAlert, CheckCircle, Type, CreditCard, Save, Loader2, Skull, UploadCloud, RotateCcw, MapPin } from 'lucide-react'; // 🚀 Added Skull Icon

export default function AdminSettings() {
    const { maintenanceMode } = useSocket();
    const [batches, setBatches] = useState([]);
    const [hallClasses, setHallClasses] = useState([]);
    const [newName, setNewName] = useState("");
    const [newHallClass, setNewHallClass] = useState("");
    const [appName, setAppName] = useState(""); 
    
    // Bank Details State
    const [bankDetails, setBankDetails] = useState({ 
        bankName: '', 
        accNum: '', 
        accName: '', 
        branch: '' 
    });
    const [savingBank, setSavingBank] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const restoreInputRef = useRef(null);
    
    // Load Initial Data
    const load = async () => {
        try {
            const bRes = await axios.get('/batches');
            setBatches(bRes.data);

            const hRes = await axios.get('/hall-classes');
            setHallClasses(hRes.data || []);
            
            const nRes = await axios.get('/config/site-name');
            setAppName(nRes.data.name);

            const bankRes = await axios.get('/config/bank-details');
            setBankDetails(bankRes.data);

        } catch(e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    // --- BATCH LOGIC ---
    const addBatch = async () => {
        if (!newName) return;
        await axios.post('/batches', { name: newName });
        setNewName("");
        load();
    };

    const deleteBatch = async (id) => {
        if(!confirm("Delete this batch? Students assigned to it might break.")) return;
        await axios.delete(`/batches/${id}`);
        load();
    };

    const addHallClass = async () => {
        const name = newHallClass.trim();
        if (!name) return;
        await axios.post('/hall-classes', { name });
        setNewHallClass("");
        load();
    };

    const deleteHallClass = async (name) => {
        if(!confirm("Delete this Hall Class city? Physical students may need reassignment.")) return;
        await axios.delete(`/hall-classes/${encodeURIComponent(name)}`);
        load();
    };

    // --- MAINTENANCE LOGIC ---
    const toggleMaintenance = async () => {
        await axios.post('/settings/toggle-maintenance');
    };

    // --- SITE NAME LOGIC ---
    const saveName = async () => {
        if(!appName) return;
        await axios.post('/admin/site-name', { name: appName });
        alert("Site Name Updated!");
    };

    // --- BANK DETAILS LOGIC ---
    const saveBankDetails = async () => {
        setSavingBank(true);
        try {
            await axios.post('/admin/bank-details', bankDetails);
            alert("Payment Details Updated!");
        } catch (e) {
            alert("Failed to save payment details.");
        } finally {
            setSavingBank(false);
        }
    };

    const handleCleanup = async () => {
        if (!confirm("Start Disk Cleanup? This will delete all unused images.")) return;
        try {
            const res = await axios.post('/admin/cleanup-files');
            alert(`Cleanup Complete. Removed ${res.data.count} unused files.`);
        } catch (e) { alert("Failed"); }
    };

    // 🚀 THE GOD-MODE NUKE LOGIC
    const handleLeaderboardNuke = async () => {
        if (!confirm("🚨 WARNING: This will instantly delete all ghost scores and physical images belonging to deleted exams. The Leaderboard will be permanently wiped of dead data. Proceed?")) return;
        try {
            const res = await axios.delete('/admin/leaderboard-nuke');
            alert(res.data.message);
        } catch (e) {
            alert("Matrix Error: Failed to trigger nuke.");
        }
    };

    const handleFullBackup = async () => {
        setBackingUp(true);
        try {
            const res = await axios.get('/admin/backup', { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date().toISOString().replace(/[.:]/g, '-');
            a.href = url;
            a.download = `sftking-backup-${now}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            alert('Full backup downloaded successfully.');
        } catch (e) {
            alert('Backup failed.');
        } finally {
            setBackingUp(false);
        }
    };

    const handleFullRestore = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const sure = confirm('Restore will overwrite current system data (messages are excluded). Continue?');
        if (!sure) {
            event.target.value = '';
            return;
        }

        setRestoring(true);
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            await axios.post('/admin/restore', payload);
            alert('Restore completed successfully. Reloading settings...');
            await load();
        } catch (e) {
            alert('Restore failed. Check backup JSON and try again.');
        } finally {
            setRestoring(false);
            event.target.value = '';
        }
    };

    const handleRestartWebsite = async () => {
        const sure = confirm('Restart website service now? Active users may see a short interruption.');
        if (!sure) return;

        setRestarting(true);
        try {
            const res = await axios.post('/admin/restart');
            alert(res.data?.message || 'Restart command sent.');
        } catch (e) {
            const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Restart failed.';
            alert(msg);
        } finally {
            setRestarting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 font-sans pb-20 p-4 md:p-0 transition-colors duration-300">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. BATCH MANAGER */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[40px] border border-red-50 dark:border-white/5 shadow-sm flex flex-col h-[680px] transition-colors duration-300">
                    <h4 className="font-[1000] text-slate-800 dark:text-white uppercase italic text-xl mb-6 tracking-tighter transition-colors">
                        Batch Master
                    </h4>
                    
                    <div className="flex gap-2 mb-6">
                        <input 
                            value={newName} 
                            className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-black uppercase italic outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-red-200 dark:focus:border-red-500/50 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 transition-colors" 
                            placeholder="e.g. 2026 REVISION" 
                            onChange={e => setNewName(e.target.value)} 
                        />
                        <button 
                            onClick={addBatch} 
                            className="bg-red-600 text-white px-6 md:px-8 rounded-2xl font-black italic shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase text-xs tracking-widest hover:bg-red-700"
                        >
                            Add
                        </button>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {batches.map(b => (
                            <div key={b.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 font-black text-slate-600 dark:text-slate-300 italic tracking-widest group hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                {b.name}
                                <button 
                                    onClick={() => deleteBatch(b.id)} 
                                    className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:scale-110 transition-all p-2"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin size={16} className="text-red-500" />
                            <h5 className="font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                                Hall Classes
                            </h5>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <input 
                                value={newHallClass} 
                                className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-red-200 dark:focus:border-red-500/50 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 transition-colors" 
                                placeholder="e.g. Monaragala" 
                                onChange={e => setNewHallClass(e.target.value)} 
                            />
                            <button 
                                onClick={addHallClass} 
                                className="bg-red-600 text-white px-5 rounded-2xl font-black shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase text-xs tracking-widest hover:bg-red-700"
                            >
                                Add
                            </button>
                        </div>

                        <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar max-h-[180px]">
                            {hallClasses.map((city) => (
                                <div key={city} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 font-bold text-slate-600 dark:text-slate-300 group hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                    {city}
                                    <button 
                                        onClick={() => deleteHallClass(city)} 
                                        className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:scale-110 transition-all p-1"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN STACK */}
                <div className="flex flex-col gap-8 h-full">
                    
                    {/* 2. PLATFORM NAME CHANGER */}
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm transition-colors duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors">
                                <Type size={20} />
                            </div>
                            <h4 className="font-[1000] text-slate-800 dark:text-white uppercase italic text-lg tracking-tighter transition-colors">
                                Platform Name
                            </h4>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input 
                                value={appName} 
                                className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-slate-300 dark:focus:border-slate-500 transition-all"
                                onChange={e => setAppName(e.target.value)}
                            />
                            <button 
                                onClick={saveName} 
                                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 sm:py-0 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    {/* 3. LOCKDOWN */}
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[40px] border border-red-50 dark:border-red-900/20 shadow-sm flex flex-col justify-between flex-1 transition-colors duration-300">
                        <div className="mb-6 md:mb-4">
                            <h4 className="font-[1000] text-red-600 dark:text-red-500 uppercase italic text-lg mb-2 tracking-tighter transition-colors">
                                Site Lockdown
                            </h4>
                            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed transition-colors">
                                Emergency Protocol: Blocks all access.
                            </p>
                        </div>
                        
                        <button 
                            onClick={toggleMaintenance} 
                            className={`w-full py-5 rounded-[25px] font-[1000] uppercase tracking-[0.2em] italic text-xs transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${
                                maintenanceMode 
                                ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-900/30 dark:shadow-none' 
                                : 'bg-green-500 dark:bg-green-600 text-white shadow-green-500/30 dark:shadow-none hover:bg-green-600'
                            }`}
                        >
                            {maintenanceMode ? <ShieldAlert size={18}/> : <CheckCircle size={18}/>}
                            {maintenanceMode ? 'SYSTEM LOCKED' : 'SYSTEM LIVE'}
                        </button>
                    </div>

                </div>
            </div>

            {/* 4. PAYMENT CONFIGURATION */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm transition-colors duration-300">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-600 dark:text-red-400 transition-colors">
                        <CreditCard size={28} />
                    </div>
                    <div>
                        <h4 className="font-[1000] text-slate-800 dark:text-white uppercase italic text-2xl tracking-tighter transition-colors">
                            Payment Configuration
                        </h4>
                        <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 transition-colors">
                            Manage Bank Details displayed to students
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* BANK NAME */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-400 dark:text-slate-500">Bank Name</label>
                        <input 
                            value={bankDetails.bankName}
                            onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white rounded-2xl font-bold outline-none focus:border-red-200 dark:focus:border-red-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
                            placeholder="e.g. Bank of Ceylon"
                        />
                    </div>
                    {/* ACCOUNT NUMBER */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-400 dark:text-slate-500">Account Number</label>
                        <input 
                            value={bankDetails.accNum}
                            onChange={e => setBankDetails({...bankDetails, accNum: e.target.value})}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white rounded-2xl font-mono font-bold outline-none focus:border-red-200 dark:focus:border-red-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
                            placeholder="e.g. 123456789"
                        />
                    </div>
                    {/* ACCOUNT HOLDER */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-400 dark:text-slate-500">Account Holder</label>
                        <input 
                            value={bankDetails.accName}
                            onChange={e => setBankDetails({...bankDetails, accName: e.target.value})}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white rounded-2xl font-bold outline-none focus:border-red-200 dark:focus:border-red-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
                            placeholder="e.g. MIS Holding"
                        />
                    </div>
                    {/* BRANCH */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-400 dark:text-slate-500">Branch Name</label>
                        <input 
                            value={bankDetails.branch}
                            onChange={e => setBankDetails({...bankDetails, branch: e.target.value})}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white rounded-2xl font-bold outline-none focus:border-red-200 dark:focus:border-red-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
                            placeholder="e.g. Monaragala"
                        />
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={saveBankDetails} 
                        disabled={savingBank}
                        className="w-full md:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {savingBank ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                        Save Details
                    </button>
                </div>
            </div>

            {/* 5. DATA BACKUP & LEADERBOARD NUKE */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 lg:gap-10 transition-colors duration-300">
                <div className="flex-1">
                    <h4 className="font-[1000] text-slate-400 dark:text-slate-300 uppercase italic text-xl mb-2 tracking-tighter underline decoration-red-500 dark:decoration-red-600 transition-colors">
                        Matrix Controls
                    </h4>
                    <p className="text-slate-400 dark:text-slate-500 text-xs italic tracking-widest uppercase transition-colors max-w-md">
                        Use these protocols to clean dead files, backup the database, or reset corrupted leaderboards.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <input
                        ref={restoreInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFullRestore}
                    />

                    <button 
                        onClick={handleFullBackup}
                        disabled={backingUp || restoring}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-[20px] hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        {backingUp ? <Loader2 className="animate-spin" size={16}/> : <DownloadCloud size={16}/>}
                        {backingUp ? 'Creating Backup...' : 'Backup'}
                    </button>

                    <button 
                        onClick={() => restoreInputRef.current?.click()}
                        disabled={restoring || backingUp}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 rounded-[20px] hover:bg-cyan-500 hover:text-white dark:hover:text-slate-950 transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        {restoring ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16}/>}
                        {restoring ? 'Restoring...' : 'Restore'}
                    </button>

                    <button 
                        onClick={handleRestartWebsite}
                        disabled={restarting || restoring}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-[20px] hover:bg-orange-500 hover:text-white dark:hover:text-slate-950 transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                        {restarting ? <Loader2 className="animate-spin" size={16}/> : <RotateCcw size={16}/>}
                        {restarting ? 'Restarting...' : 'Restart Website'}
                    </button>

                    <button 
                        onClick={() => window.open('http://localhost/phpmyadmin', '_blank')}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-[20px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider shadow-sm"
                    >
                        <DownloadCloud size={16}/> DB Manager
                    </button>
                    
                    {/* 🚀 THE NEW LEADERBOARD NUKE BUTTON */}
                    <button 
                        onClick={handleLeaderboardNuke}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-[20px] hover:bg-amber-500 hover:text-slate-950 transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider"
                    >
                        <Skull size={16}/> Wipe Ghost Scores
                    </button>

                    <button 
                        onClick={handleCleanup}
                        className="flex-1 sm:flex-none justify-center px-6 py-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-[20px] hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-all active:scale-95 flex items-center gap-3 font-bold text-xs uppercase tracking-wider"
                    >
                        <Trash2 size={16}/> Clean Disk
                    </button>
                </div>
            </div>
            
        </div>
    );
}