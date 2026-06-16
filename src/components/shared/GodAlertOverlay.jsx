'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';

const AUTO_DISMISS_MS = 15000;

const PRIORITY_STYLE = {
  normal: {
    badge: 'Normal Priority',
    shell: 'from-slate-900 via-slate-800 to-slate-900',
    ring: 'bg-cyan-400/35',
    accent: 'text-cyan-200'
  },
  high: {
    badge: 'High Priority',
    shell: 'from-amber-700 via-orange-700 to-amber-700',
    ring: 'bg-amber-300/40',
    accent: 'text-amber-100'
  },
  critical: {
    badge: 'Critical Command',
    shell: 'from-red-700 via-rose-700 to-red-700',
    ring: 'bg-red-300/45',
    accent: 'text-red-100'
  }
};

export default function GodAlertOverlay() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef(null);

  const style = useMemo(() => {
    if (!active) return PRIORITY_STYLE.high;
    return PRIORITY_STYLE[active.priority] || PRIORITY_STYLE.high;
  }, [active]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(!!media.matches);
    sync();

    if (media.addEventListener) media.addEventListener('change', sync);
    else media.addListener(sync);

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', sync);
      else media.removeListener(sync);
    };
  }, []);

  useEffect(() => {
    if (!socket || !user || user.role !== 'student') return;

    const handleGodAlert = async (payload) => {
      if (!payload || String(payload.targetUserId || '') !== String(user.id || '')) return;

      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore browser fullscreen restriction failures.
        }
      }

      setQueue((prev) => [...prev, payload]);
      socket.emit('god_alert_seen', {
        alertId: payload.id,
        targetUserId: payload.targetUserId
      });
    };

    socket.on('god_alert', handleGodAlert);

    return () => {
      socket.off('god_alert', handleGodAlert);
    };
  }, [socket, user]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [queue, active]);

  useEffect(() => {
    if (!active) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setActive(null);
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  if (!user || user.role !== 'student') return null;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={active.id || active.sentAt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 md:p-8"
          style={{
            background: 'radial-gradient(circle at 15% 18%, rgba(255,255,255,0.12), transparent 34%), radial-gradient(circle at 85% 82%, rgba(255,255,255,0.08), transparent 36%), rgba(2, 6, 23, 0.82)'
          }}
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 28 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 22 }}
            className={`relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/25 text-white bg-gradient-to-br ${style.shell} shadow-[0_30px_90px_rgba(0,0,0,0.45)]`}
          >
            {!reduceMotion ? (
              <>
                <motion.div
                  aria-hidden="true"
                  className={`absolute -left-24 -top-24 w-64 h-64 rounded-full blur-3xl ${style.ring}`}
                  animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.45, 0.25] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute -right-28 -bottom-28 w-72 h-72 rounded-full blur-3xl bg-white/10"
                  animate={{ scale: [1.08, 1, 1.08], opacity: [0.2, 0.35, 0.2] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </>
            ) : null}

            <div className="relative p-6 md:p-10">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-white/20 text-[11px] tracking-[0.18em] uppercase font-black">
                  <ShieldAlert size={13} />
                  Admin Override
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/20 text-[11px] tracking-[0.18em] uppercase font-black">
                  <AlertTriangle size={13} />
                  {style.badge}
                </span>
              </div>

              <h2 className="text-3xl md:text-5xl leading-tight font-black tracking-tight">
                Attention Required
              </h2>

              <p className={`mt-3 text-sm md:text-base font-bold tracking-wide uppercase ${style.accent}`}>
                Message from {active.adminName || 'Administrator'}
              </p>

              <div className="mt-6 rounded-2xl border border-white/20 bg-black/20 backdrop-blur-sm p-5 md:p-6">
                <p className="text-base md:text-xl font-extrabold leading-relaxed whitespace-pre-wrap break-words">
                  {active.message}
                </p>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs md:text-sm font-semibold text-white/80">
                  This notice auto-dismisses in {Math.round(AUTO_DISMISS_MS / 1000)} seconds.
                </p>
                <button
                  onClick={() => setActive(null)}
                  className="px-5 py-2.5 rounded-xl text-xs md:text-sm uppercase tracking-wider font-black bg-white text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  I Understand
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
