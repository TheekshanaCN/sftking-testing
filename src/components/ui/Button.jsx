'use client';
import { Loader2 } from 'lucide-react';

export default function Button({ 
    children, 
    onClick, 
    variant = 'primary', 
    className = '', 
    disabled, 
    loading, 
    type = "button",
    ...props 
}) {
  
  // Base styles for all SFT KING buttons
  const baseStyle = "px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3";

  // Color Variants
  const variants = {
    primary: "bg-red-600 text-white shadow-xl shadow-red-600/30 hover:bg-red-700",
    secondary: "bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800",
    outline: "bg-transparent border-2 border-slate-100 text-slate-400 hover:border-red-500 hover:text-red-500",
    ghost: "bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50",
    danger: "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}