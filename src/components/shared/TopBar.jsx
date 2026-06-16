'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun } from 'lucide-react';

export default function TopBar({ setSidebarOpen }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [isDarkMode, setIsDarkMode] = useState(true);
    const studentDisplayId = user?.studentCode || user?.mobile;

    // 🚀 THEME LOGIC
    useEffect(() => {
        const savedTheme = localStorage.getItem('sft_theme');
        if (savedTheme === 'light') {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        } else {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
            if (!savedTheme) localStorage.setItem('sft_theme', 'dark'); 
        }
    }, []);

    const toggleTheme = () => {
        setIsDarkMode((prev) => {
            const nextMode = !prev;
            if (nextMode) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('sft_theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('sft_theme', 'light');
            }
            return nextMode;
        });
    };

    const getTitle = () => {
        const parts = pathname.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart ? lastPart.replace('-', ' ').toUpperCase() : 'DASHBOARD';
    };

    return (
        <header className="h-16 md:h-20 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-white/5 flex items-center px-4 md:px-10 justify-between sticky top-0 z-40 transition-colors duration-300">
            <div className="flex items-center gap-4">
                {/* 🚀 THE FIX: Added shrink-0 to stop Apple from crushing it to 0px, and explicit stroke/color! */}
                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg lg:hidden text-slate-800 dark:text-slate-200 transition-colors shrink-0 relative z-50 flex items-center justify-center"
                >
                    <Menu size={28} strokeWidth={2.5} />
                </button>
                <h2 className="text-[10px] md:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest italic truncate select-none">
                    {getTitle()}
                </h2>
            </div>
          
            <div className="flex items-center gap-4 md:gap-6">
                <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all active:scale-95"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? <Sun size={20} className="text-orange-400" /> : <Moon size={20} />}
                </button>

                <div className="flex items-center gap-3 border-l border-slate-100 dark:border-white/10 pl-4 h-8">
                    <div className="hidden md:block text-right mr-2">
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Logged in as</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{user?.name?.split(' ')[0]}</p>
                    </div>
                    <div className="px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black tracking-tighter shadow-md shadow-red-600/30">
                        {user?.role === 'admin' ? 'ADMIN' : studentDisplayId}
                    </div>
                </div>
            </div>
        </header>
    );
}