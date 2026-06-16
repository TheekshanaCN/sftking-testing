const CACHE_NAME = 'sft-king-offline-v2';
const OFFLINE_URL = '/offline.html';

importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

const swUrl = new URL(self.location.href);
const firebaseConfig = {
    apiKey: swUrl.searchParams.get('apiKey') || '',
    authDomain: swUrl.searchParams.get('authDomain') || '',
    projectId: swUrl.searchParams.get('projectId') || '',
    storageBucket: swUrl.searchParams.get('storageBucket') || '',
    messagingSenderId: swUrl.searchParams.get('messagingSenderId') || '',
    appId: swUrl.searchParams.get('appId') || '',
};

let messaging = null;
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.add(OFFLINE_URL);
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(OFFLINE_URL);
            })
        );
    }
});

if (messaging) {
    messaging.onBackgroundMessage((payload) => {
        const title = payload?.data?.title || payload?.notification?.title || 'SFT KING';
        const body = payload?.data?.body || payload?.notification?.body || 'You have a new notification.';
        const url = payload?.data?.url || '/';

        self.registration.showNotification(title, {
            body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: { url },
        });
    });
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification?.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
});