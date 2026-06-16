'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isFirebaseMessagingSupported } from '@/lib/firebaseClient';
import axios from '@/lib/axios';

const getIsIOS = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const touchMac = platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/i.test(ua) || touchMac;
};

export default function NotificationGate() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default');
  const [supported, setSupported] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [busy, setBusy] = useState(false);
  const welcomeInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (typeof window === 'undefined') return;

      const iosDevice = getIsIOS();
      const hasAPIs = 'Notification' in window && 'serviceWorker' in navigator;
      const messagingSupported = hasAPIs ? await isFirebaseMessagingSupported() : false;

      if (!mounted) return;
      setIsIOS(iosDevice);
      setSupported(Boolean(messagingSupported));
      setPermission(hasAPIs ? Notification.permission : 'denied');
      setChecked(true);
    };

    init();

    const onFocus = () => refreshPermission();
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshPermission();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, []);

  const mustCapture = useMemo(() => {
    if (!checked) return false;
    if (!user || user.role !== 'student') return false;
    if (!user.classMode || !user.studentCode) return false;
    if (!supported) return false;
    return permission !== 'granted';
  }, [checked, user, supported, permission]);

  const refreshPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const current = Notification.permission;

    if (current === 'granted' && permission !== 'granted') {
      void triggerWelcomeNotification();
    }

    setPermission(current);

    if (current === 'granted') {
      window.dispatchEvent(new Event('sft-notification-permission-changed'));
    }
  };

  const getWelcomeSentKey = () => {
    if (!user?.id) return '';
    return `sft_welcome_notified_${user.id}`;
  };

  const waitForTokenRegistration = async (timeoutMs = 10000) => {
    if (typeof window === 'undefined') return null;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const token = localStorage.getItem('sft_notification_token');
      if (token) return token;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return null;
  };

  const triggerWelcomeNotification = async () => {
    if (typeof window === 'undefined' || !user?.id) return;
    if (welcomeInFlightRef.current) return;

    const sentKey = getWelcomeSentKey();
    if (sentKey && localStorage.getItem(sentKey) === '1') return;

    welcomeInFlightRef.current = true;
    try {
      window.dispatchEvent(new Event('sft-notification-permission-changed'));
      await waitForTokenRegistration();

      const result = await sendWelcomeNotification();
      const sentPush = Number(result?.push?.sent || 0);
      const sentEmail = Number(result?.emailSent || 0);
      const success = !result?.skipped && Boolean(result?.success) && (sentPush > 0 || sentEmail > 0);
      if (success && sentKey) {
        localStorage.setItem(sentKey, '1');
      }

      if (!success && result?.reason === 'already_sent' && sentKey) {
        localStorage.setItem(sentKey, '1');
      }

      // Registration-only fallback: show a local foreground notification
      // so students still see it while actively using the site.
      if (success && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Welcome to SFT King', {
            body: `Hi ${String(user?.name || 'Student')}, your account is ready.`,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: { url: '/student/dashboard', type: 'account_created_local' },
          });
        } catch {}
      }
    } finally {
      welcomeInFlightRef.current = false;
    }
  };

  const sendWelcomeNotification = async () => {
    try {
      const { data } = await axios.post('/student/send-welcome-notification');
      console.log('[NotificationGate] Welcome notification sent successfully:', data);
      return data || { success: false };
    } catch (error) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.error || error?.response?.data?.message;
      console.error('[NotificationGate] Error sending welcome notification:', status, serverMessage || error?.message || error);
      return { success: false };
    }
  };

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    setBusy(true);
    try {
      await Notification.requestPermission();
    } finally {
      refreshPermission();
      setBusy(false);
    }
  };

  if (!checked) return null;

  if (!mustCapture && isIOS && !supported) {
    // Silent bypass for unsupported iOS Firebase messaging path.
    return null;
  }

  if (!mustCapture) return null;

  return (
    <div className="fixed inset-0 z-[182] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
          <BellRing size={24} className="text-red-500" />
          Enable Notifications
        </h3>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">
          Notifications are required for instant support replies and alerts.
        </p>

        {permission === 'denied' ? (
          <div className="mt-5 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
            <p className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert size={16} />
              Browser notifications are currently blocked.
            </p>
            <p className="text-xs mt-2 leading-relaxed">
              Open your browser site settings and allow notifications for this website, then come
              back here.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={requestPermission}
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all"
          >
            {busy ? 'Please wait...' : 'Allow Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
}
