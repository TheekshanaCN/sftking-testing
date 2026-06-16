import { io } from 'socket.io-client';

// 1. DYNAMIC URL DETECTION
// If we are on the browser, use the current address (e.g., https://xyz.trycloudflare.com)
// If we are on the server, use empty string (default)
const URL = typeof window !== 'undefined' ? window.location.origin : '';

export const socket = io(URL, {
    path: '/socket.io', // Standard path
    autoConnect: false, // We connect manually in AuthContext
    transports: ['polling', 'websocket'], // Try Polling first (most reliable through tunnels), then upgrade
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    secure: true, // Allow secure connections (HTTPS)
});