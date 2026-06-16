'use client';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck } from 'lucide-react';

export default function AdminProfile() {
    const { user } = useAuth();

    return (
        <div className="max-w-2xl mx-auto font-sans pb-20 transition-colors duration-300">
            <div className="bg-white dark:bg-slate-900 p-12 rounded-[60px] shadow-sm dark:shadow-2xl border border-red-50 dark:border-white/5 text-center relative overflow-hidden transition-colors duration-300">
                
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-red-600 to-red-500"></div>
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-50 dark:bg-red-500/10 rounded-full blur-3xl opacity-50 transition-colors duration-300"></div>

                <div className="relative z-10">
                    <div className="w-32 h-32 bg-red-100 dark:bg-red-500/10 rounded-full mx-auto mb-8 flex items-center justify-center text-red-600 dark:text-red-500 shadow-inner transition-colors duration-300">
                        <ShieldCheck size={64} />
                    </div>

                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2 transition-colors duration-300">
                        {user.name}
                    </h2>
                    
                    <div className="inline-flex items-center gap-2 px-4 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest mb-10 shadow-md transition-colors duration-300">
                        Root Administrator
                    </div>

                    <div className="grid grid-cols-1 gap-4 text-left">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[30px] border border-slate-100 dark:border-white/5 flex justify-between items-center opacity-80 transition-colors duration-300">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 italic tracking-widest transition-colors duration-300">
                                    System ID
                                </p>
                                <p className="font-bold text-slate-600 dark:text-slate-300 text-lg tracking-widest transition-colors duration-300">ADMIN</p>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[30px] border border-slate-100 dark:border-white/5 flex justify-between items-center opacity-80 transition-colors duration-300">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 italic tracking-widest transition-colors duration-300">
                                    Security Level
                                </p>
                                <p className="font-bold text-slate-600 dark:text-slate-300 text-lg transition-colors duration-300">Maximum (Tier 1)</p>
                            </div>
                        </div>
                    </div>

                    <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 font-medium italic transition-colors duration-300">
                        * Administrative credentials cannot be modified from the dashboard for security.
                        Please access the server configuration to rotate keys.
                    </p>
                </div>
            </div>
        </div>
    );
}