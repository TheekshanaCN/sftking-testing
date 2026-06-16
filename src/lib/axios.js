import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true // <--- THIS IS REQUIRED FOR COOKIES TO WORK
});

// 🚀 ZERO-TRUST: Automatically attach Device DNA to every request
api.interceptors.request.use((config) => {
    // Only run this on the client side (browser)
    if (typeof window !== 'undefined') {
        const deviceFp = localStorage.getItem('sft_device_fp');
        if (deviceFp) {
            // Inject the DNA into the headers of EVERY outgoing request
            config.headers['x-device-fingerprint'] = deviceFp;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;