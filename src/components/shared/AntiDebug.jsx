'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AntiDebug() {
  const { user } = useAuth();
  const banTriggered = useRef(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return;

    const executeBan = (reason) => {
      if (banTriggered.current) return;
      banTriggered.current = true;

      const payload = new Blob(
        [JSON.stringify({ userId: user.id, type: reason })],
        { type: 'application/json' }
      );
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/security/violation', payload);
      }

      window.location.replace('/suspended');
    };

    // ✅ Detect iOS + Mobile/Touch and EXCLUDE them from resize trap
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    // Treat any touch/coarse pointer as mobile-like (avoids iPad + touch laptops issues)
    const isTouch =
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    // ✅ Only enable resize/devtools dimension trap on real desktop
    const enableResizeTrap = !(isIOS || isTouch);

    // --- TRAP 1: DOCKED DEVTOOLS DETECTOR (DESKTOP ONLY, 1 STRIKE) ---
    const checkDimensions = () => {
      if (!enableResizeTrap) return;

      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;

      // Your original threshold is fine for desktop
      const widthThreshold = widthGap > 160;
      const heightThreshold = heightGap > 160;

      if (widthThreshold || heightThreshold) {
        executeBan('DevTools Detected (Resize)');
      }
    };

    // --- TRAP 2: DEBUGGER LOOP (you can keep as is; also desktop-only if you want) ---
    const initDebuggerTrap = () => {
      if (!enableResizeTrap) return () => {};
      const interval = setInterval(() => {
        const start = performance.now();
        debugger;
        const end = performance.now();
        if (end - start > 100) {
          executeBan('DevTools Detected (Debugger)');
        }
      }, 1200);
      return () => clearInterval(interval);
    };

    // --- TRAP 3: SHORTCUTS & RIGHT CLICK ---
    const onKey = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        executeBan('Illegal Shortcut');
      }
    };

    const onResize = () => checkDimensions();
    const onContext = (e) => e.preventDefault();

    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContext);

    // ✅ Only listen for resize if enabled (desktop only)
    if (enableResizeTrap) window.addEventListener('resize', onResize);

    // ✅ Delay the first check slightly to avoid any initial layout jitter
    const t = setTimeout(checkDimensions, 700);

    const stopTrap = initDebuggerTrap();

    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContext);
      if (enableResizeTrap) window.removeEventListener('resize', onResize);
      stopTrap();
    };
  }, [user]);

  return null;
}
