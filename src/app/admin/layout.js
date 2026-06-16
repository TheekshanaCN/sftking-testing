'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Sidebar from '@/components/shared/Sidebar';
import TopBar from '@/components/shared/TopBar';
import MaintenanceOverlay from '@/components/student/MaintenanceOverlay';
import { AnimatePresence, motion } from 'framer-motion';
import { rememberPostLoginRedirect } from '@/lib/postLoginRedirect';
import AdminNotificationGate from '@/components/admin/AdminNotificationGate';


// ✅ Fixed Function Name
export default function AdminLayout({ children }) {
    const { user, loading } = useAuth();
    const { maintenanceMode, socket } = useSocket();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const hasRedirectedRef = useRef(false);

    // ✅ THE FIX: Protection Logic for ADMINS
    useEffect(() => {
        if (!loading) {
            if (!user && !hasRedirectedRef.current) {
                hasRedirectedRef.current = true;
                const query = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
                const currentPath = `${pathname || '/admin/dashboard'}${query ? `?${query}` : ''}`;
                rememberPostLoginRedirect(currentPath);
                router.replace(`/auth?redirect=${encodeURIComponent(currentPath)}`);
            } else if (user && user.role !== 'admin') {
                // If a student tries to sneak in, kick them to the student dashboard
                router.push('/student/dashboard');
            } else if (user) {
                // User is valid admin, reset the redirect guard
                hasRedirectedRef.current = false;
            }
        }
    }, [user, loading, router, pathname]);

    // Check deactivated status
    useEffect(() => {
        if (!loading && user) {
            if (user.status === 'deactivated') {
                alert('Your account has been deactivated. You will be logged out.');
                router.push('/');
            }
        }

        if (!socket) return; // socket

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
        // 🚀 DARK MODE ADDED: dark:bg-slate-950 dark:text-slate-100 + transition-colors
        <div className="flex h-screen bg-[#FFFBFB] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors duration-300">

            {/* 2. Mobile Backdrop */}
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

            {/* 3. Navigation Sidebar */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <AdminNotificationGate />

            {/* 4. Main Content Area */}
            {/* 🚀 DARK MODE ADDED: dark:bg-slate-950 */}
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