'use client';
import { useState, useEffect } from 'react'; 
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from '@/lib/axios'; 
import { normalizeAvatarPath } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  Shield, Video, Users, Send, User, Settings, 
  PlayCircle, Radio, LogOut, ShieldCheck, Lock,
  Camera, FileText, LayoutDashboard, MessageSquare, Headphones, BookOpen,
    Activity, FolderOpen, Flame, CheckSquare, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import AvatarUploader from './AvatarUploader';

export default function Sidebar({ isOpen, setIsOpen }) { 
  const { user, logout } = useAuth();
  const { siteName } = useSocket(); 
  const pathname = usePathname();
  const router = useRouter();
    const isStudent = user?.role === 'student';
  
  // Local State
  const [showMenu, setShowMenu] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [localName, setLocalName] = useState("SFT KING"); 
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isCompactViewport, setIsCompactViewport] = useState(false);

  if (!user) return null;

  // --- NAME SYNC LOGIC ---
  useEffect(() => {
      axios.get('/config/site-name')
          .then(res => { if(res.data.name) setLocalName(res.data.name); })
          .catch(() => {});
  }, []);

  useEffect(() => {
      if (siteName) setLocalName(siteName);
  }, [siteName]);

    useEffect(() => {
        if (!user) return;

        const mediaQuery = window.matchMedia('(max-width: 1279px)');
        const updateViewport = () => setIsCompactViewport(mediaQuery.matches);

        updateViewport();
        mediaQuery.addEventListener('change', updateViewport);

        return () => mediaQuery.removeEventListener('change', updateViewport);
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const storageKey = `${user.role || 'guest'}_sidebar_collapsed_${isCompactViewport ? 'mobile' : 'desktop'}`;
        const saved = localStorage.getItem(storageKey);

        if (saved !== null) {
            setIsCollapsed(saved === '1');
            return;
        }

        setIsCollapsed(false);
    }, [user, isCompactViewport]);

    useEffect(() => {
        if (!user) return;

        const storageKey = `${user.role || 'guest'}_sidebar_collapsed_${isCompactViewport ? 'mobile' : 'desktop'}`;
        localStorage.setItem(storageKey, isCollapsed ? '1' : '0');
    }, [isCollapsed, user, isCompactViewport]);

    const toggleCollapse = () => {
        setIsCollapsed((prev) => !prev);
    };

  const NavItem = ({ icon, label, path }) => {
    const isActive = pathname.startsWith(path);
    return (
            <Link
                href={path}
                onClick={() => {
                    if (setIsOpen) setIsOpen(false);
                }}
                                title={isCollapsed ? label : undefined}
                                className={`group relative flex items-center ${isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-4 lg:px-3'} w-full py-3.5 lg:py-2.5 rounded-2xl transition-all duration-300 ease-out transform-gpu will-change-transform overflow-hidden ${
            isActive 
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 font-black italic uppercase text-xs tracking-widest' 
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 font-bold hover:text-slate-900 dark:hover:text-white'
        }`}
      >
                                {isActive && (
                                    <motion.div
                                        layoutId="student-sidebar-active-bar"
                                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white/90 dark:bg-white"
                                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                    />
                                )}
                                {!isActive && isStudent && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 rounded-r-full bg-red-500/0 transition-all duration-300 group-hover:h-7 group-hover:bg-red-500/40" />
                                )}
                <span className="shrink-0">{icon}</span>
                <span className={`tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300 ease-out ${isCollapsed ? 'max-w-0 opacity-0 translate-x-[-8px]' : 'max-w-[180px] opacity-100 translate-x-0'}`}>
                    {label}
                </span>
            </Link>
    );
  };

  const handleProfileClick = () => {
      if (!user.avatar) {
          setShowUploader(true);
      } else {
          setShowMenu(!showMenu);
      }
  };

  return (
    <>
        <nav className={`
                                fixed inset-y-0 left-0 z-[70] bg-white text-slate-900 dark:bg-slate-950 dark:text-white flex flex-col shadow-2xl transition-all duration-300 ease-out transform-gpu will-change-transform overflow-y-auto overflow-x-hidden
                                lg:translate-x-0 lg:static lg:inset-0 lg:overflow-y-hidden
                                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                                ${isCollapsed ? 'lg:w-[92px] lg:p-4' : 'lg:w-[18.5rem] xl:w-[19rem] 2xl:w-[20rem] lg:p-5'}
                                ${isCollapsed ? 'w-72 p-4' : 'w-72 p-5'}
      `}>
        
                {/* HEADER */}
                {!isCollapsed && (
                    <div className="relative w-full border-b border-slate-200 dark:border-white/10 px-2 py-4 lg:px-3 lg:py-4 min-h-[132px] lg:min-h-[118px] transition-all duration-300 ease-out">
                        <button
                            onClick={toggleCollapse}
                            className="absolute right-0 top-0 hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-lg hover:shadow-red-600/20 hover:text-red-500 hover:border-red-500/30 transition-all duration-300 ease-out transform-gpu hover:scale-110 active:scale-95"
                            title="Hide sidebar"
                            aria-label="Hide sidebar"
                        >
                            <PanelLeftClose size={16} />
                        </button>

                        <div className="mt-4 flex flex-col items-center text-center lg:items-start lg:text-left">
                            {/* AVATAR CIRCLE */}
                            <div className="relative mb-4 group cursor-pointer" onClick={handleProfileClick}>
                                <div className="rounded-full border-2 border-red-600 p-0.5 shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 transition-transform duration-300 ease-out group-hover:scale-105 flex items-center justify-center w-14 h-14 lg:w-16 lg:h-16">
                                    {user.avatar ? (
                                        <img
                                            src={normalizeAvatarPath(user.avatar)}
                                            alt="Profile"
                                            className="w-full h-full rounded-full object-cover"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="text-slate-500">
                                            <User className="w-7 h-7 lg:w-9 lg:h-9" strokeWidth={1.5} />
                                        </div>
                                    )}
                                </div>

                                <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full online-glow"></div>

                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={20} className="text-white" />
                                </div>
                            </div>

                            {/* DROPDOWN MENU */}
                            {showMenu && user.avatar && (
                                <div className="absolute top-[110px] z-50 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 p-1 w-48 text-left animate-in fade-in zoom-in duration-200">
                                    <button
                                        onClick={() => { setShowMenu(false); setShowUploader(true); }}
                                        className="flex items-center gap-2 w-full px-4 py-3 hover:bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 transition-colors"
                                    >
                                        <Camera size={14} /> Change Photo
                                    </button>
                                </div>
                            )}

                            {/* DYNAMIC SITE NAME */}
                            <h1 className="font-[1000] text-red-500 uppercase italic tracking-tighter drop-shadow-md select-none transition-all duration-300 ease-out text-2xl lg:text-[1.55rem]">
                                {localName || 'SFT KING'}
                            </h1>
                        </div>
                    </div>
                )}

        {/* NAVIGATION */}
                <div className={`flex-1 space-y-1 overflow-y-auto custom-scrollbar transition-all duration-300 ease-out ${isCollapsed ? 'pr-1 pt-0' : 'lg:pr-1 pt-2'}`}>
                        {isCollapsed && (
                            <button
                                onClick={toggleCollapse}
                                className="mb-2 hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-lg hover:shadow-red-600/20 hover:text-red-500 hover:border-red-500/30 transition-all duration-300 ease-out transform-gpu hover:scale-110 active:scale-95 mx-auto"
                                title="Show sidebar"
                                aria-label="Show sidebar"
                            >
                                <PanelLeftOpen size={16} />
                            </button>
                        )}

            {user.role === 'admin' ? (
                <>
                    <NavItem icon={<Shield size={18}/>} label="Dashboard" path="/admin/dashboard" />
                    <NavItem icon={<Lock size={18}/>} label="Security" path="/admin/security" />
                    <NavItem icon={<Flame size={18} className="text-orange-500" />} label="Firewall Config" path="/admin/firewall" />
                    
                    <NavItem icon={<FolderOpen size={18}/>} label="Media Library" path="/admin/media" />
                    
                    <NavItem icon={<Video size={18}/>} label="Contents" path="/admin/contents" />
                    
                    {/* 🚀 ADMIN MCQ MANAGER */}
                    <NavItem icon={<CheckSquare size={18} className="text-blue-400" />} label="Exam Manager" path="/admin/exam-manager" />
                    
                    <NavItem icon={<BookOpen size={18}/>} label="Past Papers" path="/admin/pastpapers" />
                    <NavItem icon={<Users size={18}/>} label="Students" path="/admin/students" />
                    <NavItem icon={<Send size={18}/>} label="Requests" path="/admin/requests" />
                    <NavItem icon={<Headphones size={18}/>} label="Support Desk" path="/admin/support" />
                    <NavItem icon={<Activity size={18}/>} label="System Monitor" path="/admin/monitor" />
                    
                    <NavItem icon={<Settings size={18}/>} label="Settings" path="/admin/settings" />
                    <NavItem icon={<User size={18}/>} label="My Profile" path="/admin/profile" />
                </>
            ) : (
                <>  <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" path="/student/dashboard" />
                    
                    {/* 🚀 STUDENT EXAMS (Fixed the path to point to /student/exams) */}
                    <NavItem icon={<CheckSquare size={18} className="text-blue-400" />} label="Exams" path="/student/exams" />

                    <NavItem icon={<PlayCircle size={18}/>} label="Recordings" path="/student/recordings" />
                    <NavItem icon={<BookOpen size={18}/>} label="Past Papers" path="/student/pastpapers" />
                    <NavItem icon={<Radio size={18}/>} label="Live Class" path="/student/live" />
                    <NavItem icon={<MessageSquare size={18}/>} label="Help Desk" path="/student/help" />
                    <NavItem icon={<User size={18}/>} label="My Profile" path="/student/profile" />
                    <NavItem icon={<FileText size={18}/>} label="Legal Protocols" path="/terms" />
                </>
            )}
        </div>

        {/* FOOTER */}
        <div className={`mt-auto pt-4 lg:pt-4 border-t border-slate-200 dark:border-white/10 space-y-2 transition-all duration-300 ease-out ${isCollapsed ? 'px-1' : 'lg:px-0'}`}>
            <button 
                onClick={() => router.push(user.role === 'admin' ? '/admin/about' : '/student/about')} 
                className={`flex items-center ${isCollapsed ? 'justify-center gap-0 px-0' : 'gap-4 px-5 lg:px-4'} w-full py-4 lg:py-3 rounded-2xl transition-all duration-300 ${pathname.includes('about') ? 'bg-red-600/20 text-red-500 border border-red-500/30' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white'}`}
            >
                <ShieldCheck size={20} className={pathname.includes('about') ? 'text-red-500' : 'text-slate-500'} />
                <span className={`text-xs font-[1000] uppercase tracking-widest italic transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0 translate-x-[-8px]' : 'max-w-[140px] opacity-100 translate-x-0'}`}>Platform About</span>
            </button>

            <button 
                onClick={() => { if(confirm("Log out?")) logout(); }} 
                className={`group relative flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4 lg:px-3'} w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 py-4 lg:py-3 rounded-[22px] overflow-hidden transition-all duration-500 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)]`}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/5 to-red-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="bg-red-600/10 p-2 rounded-xl group-hover:bg-red-600 transition-colors duration-500">
                        <LogOut size={16} className="text-red-500 group-hover:text-white" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0 translate-x-[-8px]' : 'max-w-[110px] opacity-100 translate-x-0'}`}>Sign Out</span>
                </div>
            </button>
        </div>

    </nav>

    {showUploader && (
        <AvatarUploader 
            user={user} 
            onClose={() => setShowUploader(false)} 
        />
    )}
    </>
  );
}