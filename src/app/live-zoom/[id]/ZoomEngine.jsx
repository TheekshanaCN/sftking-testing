'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertOctagon, ArrowLeft } from 'lucide-react';
import { socket } from '@/lib/socket';
import { emitStudentActivity } from '@/lib/studentActivity';

export default function ZoomEngine({ id }) {
  const router = useRouter();
  const { user } = useAuth();

  const [status, setStatus] = useState('Initializing Pro Engine...');
  const [fatalError, setFatalError] = useState(null);

  useEffect(() => {
    if (fatalError) {
      const zmmtgRoot = document.getElementById('zmmtg-root');
      if (zmmtgRoot) zmmtgRoot.style.display = 'none';

      document.querySelectorAll('.zm-modal, .zm-modal-overlay').forEach((el) => el.remove());
      document.body.style.overflow = 'auto';
    }
  }, [fatalError]);

  useEffect(() => {
    if (!id) return;

    let liveTrackingTimer = null;

    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(meta);

    const style = document.createElement('style');
    style.innerHTML = `
      .meeting-info-icon__button, 
      .meeting-info-icon,
      button[aria-label="Meeting Information"],
      .zoom-meeting-info-header {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
      }

      .meeting-info-modal,
      .meeting-info-container {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();

        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });

    const loadStyle = (href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    const initZoom = async () => {
      try {
        setStatus('Injecting Core Libraries...');
        loadStyle('https://source.zoom.us/5.1.2/css/bootstrap.css');
        loadStyle('https://source.zoom.us/5.1.2/css/react-select.css');

        await loadScript('https://source.zoom.us/5.1.2/lib/vendor/react.min.js');
        await loadScript('https://source.zoom.us/5.1.2/lib/vendor/react-dom.min.js');
        await loadScript('https://source.zoom.us/5.1.2/lib/vendor/redux.min.js');
        await loadScript('https://source.zoom.us/5.1.2/lib/vendor/redux-thunk.min.js');
        await loadScript('https://source.zoom.us/5.1.2/lib/vendor/lodash.min.js');

        setStatus('Injecting Zoom Desktop Engine...');
        await loadScript('https://source.zoom.us/zoom-meeting-5.1.2.min.js');

        setStatus('Authenticating with Server...');
        const userRes = await axios.get('/me');
        const currentUser = userRes.data;

        const baseName = (
            currentUser?.name ||
            currentUser?.fullName ||
            currentUser?.firstName ||
            currentUser?.username ||
            'Student'
            ).trim();

            const displayId = (currentUser?.studentCode || currentUser?.mobile || '')
            .toString()
            .trim();

            const classMode = String(currentUser?.classMode || '').trim().toLowerCase();
            const hallCity = String(currentUser?.hallClass || '').trim();

            const locationLabel =
            classMode === 'online'
                ? 'Online'
                : hallCity || 'Physical';

            const zoomDisplayName = [baseName, displayId, locationLabel]
            .filter(Boolean)
            .join(' ');

        setStatus('Acquiring Secure Keys...');
        const secretRes = await axios.get(`/student/zoom-secrets/${id}`);
        const { zoomId, zoomPasscode, title } = secretRes.data;

        const liveTitle = String(title || `Live Class ${id}`).trim();

        try {
          window.sessionStorage.setItem('sft_live_title', liveTitle);
        } catch {}

        const cleanZoomId = String(zoomId || '').replace(/[\s-]/g, '');

        if (!cleanZoomId) {
          throw new Error('Zoom meeting ID is missing.');
        }

        if (!zoomPasscode) {
          throw new Error('Zoom passcode is missing.');
        }

        setStatus('Forging VIP Pass...');
        const sigRes = await axios.post('/student/zoom-signature', {
          meetingNumber: cleanZoomId,
        });

        const { signature } = sigRes.data;

        if (!signature) {
          throw new Error('Zoom signature was not returned by server.');
        }

        setStatus('Entering Live Class...');

        const loaderScreen = document.getElementById('sft-loading-screen');
        if (loaderScreen) loaderScreen.style.display = 'none';

        setTimeout(() => {
          const ZoomMtg = window.ZoomMtg;

          if (!ZoomMtg) {
            setFatalError({
              title: 'Engine Crash',
              message: 'Zoom SDK did not load correctly.',
            });
            return;
          }

          ZoomMtg.setZoomJSLib('https://source.zoom.us/5.1.2/lib', '/av');
          ZoomMtg.preLoadWasm();
          ZoomMtg.prepareWebSDK();

          ZoomMtg.init({
            leaveUrl: `${window.location.origin}/student/live`,
            disableInvite: true,
            meetingInfo: ['topic', 'host'],
            success: () => {
              ZoomMtg.join({
  signature,
  sdkKey: process.env.NEXT_PUBLIC_ZOOM_SDK_CLIENT_ID,
  meetingNumber: cleanZoomId,
  passWord: zoomPasscode,
  userName: zoomDisplayName,
  userEmail: currentUser?.email || undefined,
  success: () => {
    console.log("Zoom join success");
  },
  error: (error) => {
    console.error("Zoom Join Error FULL:", error);
    try {
      console.error("Zoom Join Error JSON:", JSON.stringify(error, null, 2));
    } catch {}

    setFatalError({
      title: `Connection Failed${error?.errorCode ? ` (${error.errorCode})` : ""}`,
      message: error?.reason || error?.message || "Zoom join failed."
    });
  }
});
            },
            error: (error) => {
              console.error('Zoom Init Error FULL:', error);
              try {
                console.error('Zoom Init Error JSON:', JSON.stringify(error, null, 2));
              } catch {}

              setFatalError({
                title: 'Engine Crash',
                message:
                  error?.reason ||
                  error?.message ||
                  'Failed to initialize Zoom SDK.',
              });
            },
          });
        }, 100);
      } catch (error) {
        console.error('Zoom System Catch:', error);

        setFatalError({
          title: 'Security Blocked',
          message:
            error?.response?.data?.message ||
            error?.message ||
            'Secure connection failed.',
        });

        const loaderScreen = document.getElementById('sft-loading-screen');
        if (loaderScreen) loaderScreen.style.display = 'none';
      }
    };

    initZoom();

    return () => {
      if (liveTrackingTimer) clearInterval(liveTrackingTimer);

      const zmmtgRoot = document.getElementById('zmmtg-root');
      if (zmmtgRoot) zmmtgRoot.style.display = 'none';

      document.body.style.overflow = 'auto';
      document.body.style.backgroundColor = '';

      if (meta) meta.remove();
      if (style) style.remove();
    };
  }, [id, router, user]);

  return (
    <div className="w-full h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden font-sans">
      {!fatalError && (
        <div
          id="sft-loading-screen"
          className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white"
        >
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/30 mb-6 animate-bounce shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
          </div>

          <p className="font-black tracking-widest uppercase text-[10px] text-blue-400 animate-pulse">
            {status}
          </p>
        </div>
      )}

      {fatalError && (
        <div className="absolute inset-0 z-[999999] flex flex-col items-center justify-center bg-slate-950 px-4 backdrop-blur-md">
          <div className="bg-slate-900/80 border border-red-500/30 p-8 md:p-10 rounded-3xl max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] transform transition-all duration-500">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <AlertOctagon size={40} className="animate-pulse" />
            </div>

            <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white mb-3">
              {fatalError.title}
            </h2>

            <p className="text-sm text-slate-400 mb-8 leading-relaxed px-2">
              {fatalError.message}
            </p>

            <button
              onClick={() => {
                window.location.href = '/student/live';
              }}
              className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30"
            >
              <ArrowLeft size={18} /> Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}