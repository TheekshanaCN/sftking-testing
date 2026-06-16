'use client';

export default function StatsCard({ label, value, subValue, icon, color = 'red' }) {
    
    // 🚀 DARK MODE ADDED: Dynamic color handling for both modes
    const colors = {
        red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-100 dark:border-red-500/20',
        amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-100 dark:border-amber-500/20',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-100 dark:border-blue-500/20'
    };
    const activeColor = colors[color] || colors.red;

    return (
        <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[40px] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between hover:shadow-xl dark:hover:border-white/20 transition-all duration-300 h-full">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-4 rounded-2xl ${activeColor} border transition-colors duration-300`}>
                    {icon}
                </div>
            </div>
            
            <div>
                <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2 transition-colors duration-300">
                    {value}
                </p>
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic transition-colors duration-300">
                    {label}
                </h3>
                {subValue && (
                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 transition-colors duration-300">
                         <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md transition-colors duration-300">
                            {subValue}
                         </span>
                    </div>
                )}
            </div>
        </div>
    );
}