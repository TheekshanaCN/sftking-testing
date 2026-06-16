'use client';
import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';

export default function ForceLogoutListener() {
    const { logout } = useAuth(); 

    useEffect(() => {
        // 💥 PATH 1: The Session Replacer (Goes to /auth)
        const handleConcurrent = (data) => {
            console.log("Concurrent login detected!");
            if (data && data.message) alert(data.message);

            if (logout) logout();
            localStorage.removeItem('token');
            document.cookie = 'token=; Max-Age=0; path=/;';

            window.location.replace('/auth');
        };

        // 💥 PATH 2: The Ban Hammer (Goes to /suspended)
        const handleBanned = () => {
            console.log("Account banned!");
            
            if (logout) logout(); 
            localStorage.removeItem('token'); 
            document.cookie = 'token=; Max-Age=0; path=/;'; 
            
            window.location.replace('/suspended'); // 👈 DROPS THEM AT SUSPENDED PAGE
        };

        // Listen for both session replacement and bans
        socket.on('concurrent_login', handleConcurrent);
        socket.on('account_banned', handleBanned);

        return () => {
            socket.off('concurrent_login', handleConcurrent);
            socket.off('account_banned', handleBanned);
        };
    }, [logout]);

    return null;
}