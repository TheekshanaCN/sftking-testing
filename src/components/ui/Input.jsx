'use client';

export default function Input({ label, icon, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 w-full group ${className}`}>
      {label && (
        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest italic group-focus-within:text-red-500 transition-colors">
            {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors z-10 pointer-events-none">
                {icon}
            </div>
        )}
        
        <input 
            className={`
                w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-slate-900 text-sm font-bold outline-none 
                focus:border-red-500 focus:bg-white transition-all shadow-sm placeholder:text-slate-300
                ${icon ? 'pl-12' : 'pl-4'}
            `}
            {...props} 
        />
      </div>
    </div>
  );
}