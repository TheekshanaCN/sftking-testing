'use client';
import { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export default function OfflineDetector() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        // Check current status on load
        if (typeof navigator !== 'undefined') {
            setIsOffline(!navigator.onLine);
        }

        // Listeners for when connection drops or reconnects
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    // If online, render absolutely nothing!
    if (!isOffline) return null;

    // 🚀 IF OFFLINE: Render the God-Tier Lock Screen
    return (
        <div className="fixed inset-0 z-[99999] bg-[#020617]/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6 animate-in fade-in duration-500 font-sans">
            
            <div className="w-32 h-32 rounded-full border-4 border-red-500/30 flex items-center justify-center mb-8 relative shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                <div className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent animate-spin"></div>
                <WifiOff size={48} className="text-red-500 animate-pulse" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest text-center mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                Signal Lost
            </h1>
            
            <p className="text-slate-400 text-center max-w-md text-lg mb-10 font-medium">
                Your device has disconnected from the Matrix. The platform is locked to prevent data corruption. Please check your internet connection.
            </p>
            
            <div className="flex items-center gap-3 text-red-500 font-bold uppercase tracking-widest text-sm bg-red-500/10 px-8 py-4 rounded-full border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertTriangle size={18} className="animate-pulse" /> 
                Waiting for connection...
            </div>

        </div>
    );
}