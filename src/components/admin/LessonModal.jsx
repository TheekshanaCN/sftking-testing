'use client';
import { useState } from 'react';
import axios from '@/lib/axios';
import { X, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function LessonModal({ onClose, onSave, batches, type, item, parentId }) {
    const [name, setName] = useState(item ? item.name : "");
    const [price, setPrice] = useState(item ? item.price : "");
    const [month, setMonth] = useState(item ? item.month : "");
    
    const getInitialBatches = () => {
        if (!item || !item.batches) return [];
        let parsed = [];
        if (Array.isArray(item.batches)) parsed = item.batches;
        else try { parsed = JSON.parse(item.batches); } catch { return []; }
        
        if (parsed.includes("All")) return [];
        return parsed;
    };
    
    const [selectedBatches, setSelectedBatches] = useState(getInitialBatches());
    const [loading, setLoading] = useState(false);

    const toggleBatch = (batchName) => {
        if (selectedBatches.includes(batchName)) {
            setSelectedBatches(selectedBatches.filter(b => b !== batchName));
        } else {
            setSelectedBatches([...selectedBatches, batchName]);
        }
    };

    const handleSubmit = async () => {
        if (!name || !price) return alert("Fill Name and Price");
        setLoading(true);
        try {
            const finalBatches = selectedBatches.length === 0 
                ? ["All"] 
                : selectedBatches.filter(b => b !== "All");

            const payload = { 
                name, 
                price, 
                batches: finalBatches,
                month,
                type,
                parentId: parentId || null 
            };

            if (item) {
                await axios.put(`/lessons/${item.id}`, payload);
            } else {
                await axios.post('/lessons', payload);
            }
            onSave();
        } catch (e) { alert("Failed"); } 
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-colors duration-300">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 border border-transparent dark:border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl overflow-hidden relative transition-colors duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black uppercase italic text-red-600 dark:text-red-500 tracking-tighter">
                        {item ? 'Edit Folder' : `New ${type} Folder`}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-4">
                    <input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-slate-400 transition-colors" 
                        placeholder="Folder Name (e.g. Unit 5)" 
                    />
                    
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <input 
                                type="number" 
                                value={price} 
                                onChange={e => setPrice(e.target.value)} 
                                className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-slate-400 transition-colors" 
                                placeholder="Price" 
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-red-500 dark:text-red-400 text-xs">LKR</span>
                        </div>

                        <div className="flex-1">
                            <select 
                                value={month} 
                                onChange={e => setMonth(e.target.value)} 
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer transition-colors"
                            >
                                <option value="">Select Month</option>
                                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-4 border border-slate-100 dark:border-white/5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assign to Batches</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                            {batches.map(b => (
                                <button 
                                    key={b.id} 
                                    onClick={() => toggleBatch(b.name)} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border text-xs font-bold uppercase ${
                                        selectedBatches.includes(b.name) 
                                        ? 'bg-slate-900 dark:bg-red-600 border-slate-900 dark:border-red-600 text-white' 
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                                    }`}
                                >
                                    {selectedBatches.includes(b.name) && <Check size={10} />}
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleSubmit} disabled={loading} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:opacity-50 hover:bg-red-700 transition-all border border-transparent dark:border-white/10">
                        {loading ? "Saving..." : (item ? "Save Changes" : "Create Folder")}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}