'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isFirebaseMessagingSupported } from '@/lib/firebaseClient';

export default function AdminNotificationGate() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default');
  const [supported, setSupported] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (typeof window === 'undefined') return;

      const hasAPIs = 'Notification' in window && 'serviceWorker' in navigator;
      const messagingSupported = hasAPIs ? await isFirebaseMessagingSupported() : false;

      if (!mounted) return;
      setSupported(Boolean(messagingSupported));
      setPermission(hasAPIs ? Notification.permission : 'denied');
      setChecked(true);
    };

    init();

    const onFocus = () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onFocus);
      }
    };
  }, []);

  const mustCapture = useMemo(() => {
    if (!checked) return false;
    if (!user || user.role !== 'admin') return false;
    if (!supported) return false;
    return permission !== 'granted';
  }, [checked, user, supported, permission]);

  const refreshPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const current = Notification.permission;
    setPermission(current);

    if (current === 'granted') {
      window.dispatchEvent(new Event('sft-notification-permission-changed'));
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

  if (!mustCapture) return null;

  return (
    <div className="fixed inset-0 z-[183] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
          <BellRing size={24} className="text-red-500" />
          Enable Admin Notifications
        </h3>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">
          Notifications are required to receive student requests instantly.
        </p>

        {permission === 'denied' ? (
          <div className="mt-5 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
            <p className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert size={16} />
              Browser notifications are blocked.
            </p>
            <p className="text-xs mt-2 leading-relaxed">
              Allow notifications for this site in browser settings, then press Check Again.
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

          <button
            onClick={refreshPermission}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase transition-all"
          >
            Check Again
          </button>
        </div>
      </div>
    </div>
  );
}
