'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import axios from '@/lib/axios';
import { getFirebasePushToken, subscribeToForegroundPush } from '@/lib/firebaseClient';

export default function FirebaseNotificationBootstrap() {
  const { user } = useAuth();
  const unsubscribeRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refresh = () => setRefreshKey((v) => v + 1);
    window.addEventListener('sft-notification-permission-changed', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener('sft-notification-permission-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const registerNotifications = async () => {
      if (!user?.id || typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

      try {
        if (Notification.permission !== 'granted') return;

        const swParams = new URLSearchParams({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        });

        const serviceWorkerRegistration = await navigator.serviceWorker.register(`/sw.js?${swParams.toString()}`);
        const token = await getFirebasePushToken(serviceWorkerRegistration);
        if (!token || cancelled) return;

        localStorage.setItem('sft_notification_token', token);
        await axios.post('/notifications/register-token', { token });

        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        unsubscribeRef.current = await subscribeToForegroundPush((payload) => {
          const title = payload?.data?.title || payload?.notification?.title || 'SFT KING';
          const body = payload?.data?.body || payload?.notification?.body || 'You have a new notification.';
          const options = {
            body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: payload?.data || {},
          };

          if (Notification.permission === 'granted') {
            try {
              new Notification(title, options);
            } catch {
              window.dispatchEvent(new CustomEvent('sft-push', { detail: { title, ...options } }));
            }
          }
        });
      } catch (error) {
        const message = String(error?.message || error || '').toLowerCase();
        const unsupported =
          message.includes('messaging is not supported') ||
          message.includes('unsupported-browser') ||
          message.includes('unsupported browser') ||
          message.includes('service worker');
        if (!unsupported) {
          console.warn('Notification bootstrap failed:', error?.message || error);
        }
      }
    };

    registerNotifications();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id, refreshKey]);

  return null;
}