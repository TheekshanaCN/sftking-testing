'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import axios from '@/lib/axios';

const AuthContext = createContext({
    user: null,
    loading: true,
    login: () => {},
    logout: () => {},
    updateUser: () => {}
});

// Helper to safely read/write session storage
const SESSION_KEY = 'sft_auth_user';

const saveUserToSession = (userData) => {
    try {
        if (typeof window !== 'undefined' && userData) {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        }
    } catch (e) {}
};

const getUserFromSession = () => {
    try {
        if (typeof window !== 'undefined') {
            const raw = sessionStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        }
    } catch (e) {}
    return null;
};

const clearUserFromSession = () => {
    try {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_KEY);
        }
    } catch (e) {}
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const loginCalledRef = useRef(false);

    useEffect(() => {
        // RESTORE SESSION FROM COOKIE
        const checkSession = async () => {
            try {
                // Ask server: "Do I have a valid cookie?"
                const res = await axios.get('/me');
                const userData = res.data;
                setUser(userData);
                saveUserToSession(userData);
                
                // Connect Socket
                connectSocket(userData);
            } catch (e) {
                // Cookie-based session check failed.
                // Only clear user if login() was NOT just called during this page lifecycle.
                if (!loginCalledRef.current) {
                    // Fallback: try to restore from sessionStorage (survives page reloads)
                    const cached = getUserFromSession();
                    if (cached) {
                        setUser(cached);
                        connectSocket(cached);
                    } else {
                        setUser(null);
                    }
                }
            } finally {
                setLoading(false);
            }
        };
        checkSession();
    }, []);

    const connectSocket = (userData) => {
        if (!socket.connected) {
            socket.io.opts.query = { userId: userData.id, role: userData.role, sessionId: userData.sessionId || userData.sid || '' };
            socket.connect();
        }
    };

    const login = (userData) => {
        loginCalledRef.current = true;
        setUser(userData);
        setLoading(false);
        saveUserToSession(userData);
        connectSocket(userData);
    };

    const updateUser = (nextUser) => {
        setUser((prev) => {
            const merged = { ...(prev || {}), ...(nextUser || {}) };
            saveUserToSession(merged);
            return merged;
        });
    };

    const logout = async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('sft_notification_token') : null;
            if (token) {
                await axios.post('/notifications/unregister-token', { token }).catch(() => {});
                localStorage.removeItem('sft_notification_token');
            }

            await axios.post('/logout'); 
            

            loginCalledRef.current = false;
            clearUserFromSession();
            setUser(null);
            socket.disconnect();
            
            window.location.href = '/auth'; 
        } catch(e) {}
    };
    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
