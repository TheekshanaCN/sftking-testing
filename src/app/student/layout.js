'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Sidebar from '@/components/shared/Sidebar';
import TopBar from '@/components/shared/TopBar';
import MaintenanceOverlay from '@/components/student/MaintenanceOverlay';
import { AnimatePresence, motion } from 'framer-motion';
import ClassModeGate from '@/components/student/ClassModeGate';
import EmailGate from '@/components/student/EmailGate';
import AddressGate from '@/components/student/AddressGate';
import NICGate from '@/components/student/NICGate';
import NotificationGate from '@/components/student/NotificationGate';
import { rememberPostLoginRedirect } from '@/lib/postLoginRedirect';

export default function StudentLayout({ children }) {
    const { user, loading } = useAuth();
    const { maintenanceMode, socket } = useSocket();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                const query = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
                const currentPath = `${pathname || '/student/dashboard'}${query ? `?${query}` : ''}`;
                rememberPostLoginRedirect(currentPath);
                router.replace(`/auth?redirect=${encodeURIComponent(currentPath)}`);
            }
            else if (user.role !== 'student') router.push('/admin/dashboard');
        }
    }, [user, loading, router, pathname]);

    useEffect(() => {
        if (!loading && user) {
            if (user.status === 'deactivated') {
                alert('Your account has been deactivated. You will be logged out.');
                router.push('/');
            }
        }

        if (!socket) return; 

        const handleStatusChange = (status) => {
            if (status === 'deactivated') {
                alert('Your account has been deactivated. You will be logged out.');
                router.push('/');
            }
        };

        socket.on('user_status_change', handleStatusChange);

        return () => {
            if (socket) {
                socket.off('user_status_change', handleStatusChange);
            }
        };
    }, [user, loading, router, socket]);

    if (loading || !user) return null;

    return (
        <div className="flex h-screen bg-[#FFFBFB] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors duration-300">
            
            <AnimatePresence>
                {maintenanceMode && <MaintenanceOverlay />}
            </AnimatePresence>

            <ClassModeGate />
            <EmailGate />
            <AddressGate />
            <NICGate />
            <NotificationGate />

            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <main className="flex-1 flex flex-col min-w-0 bg-[#FFFBFB] dark:bg-slate-950 relative transition-all duration-300">
                <TopBar setSidebarOpen={setIsSidebarOpen} />
                
                <div className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth">
                    <div className="max-w-7xl mx-auto pb-20">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}