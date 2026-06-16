'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';

export default function OpenIntro() {
  const [showIntro, setShowIntro] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const hasSeenIntro = sessionStorage.getItem('sft_intro_seen');

    if (hasSeenIntro) {
      setShowIntro(false);
    } else {
      const timer = setTimeout(() => {
        setShowIntro(false);
        sessionStorage.setItem('sft_intro_seen', 'true');
      }, 3800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {showIntro && (
        <motion.div
          key="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.15, filter: 'blur(25px)' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] bg-[#030101] flex flex-col items-center justify-center overflow-hidden cursor-none pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 4, ease: 'easeOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] bg-red-900/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.1] }}
            transition={{ duration: 3, times: [0, 0.5, 1], ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] md:w-[30vw] md:h-[30vw] bg-rose-700/20 rounded-full blur-[80px] mix-blend-screen pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.3, rotate: -25, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: -10, filter: 'blur(0px)' }}
              transition={{ duration: 1.2, type: 'spring', bounce: 0.5, delay: 0.1 }}
              className="mb-4 text-yellow-500 drop-shadow-[0_0_40px_rgba(234,179,8,0.7)]"
            >
              <Crown size={76} strokeWidth={2.5} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30, filter: 'blur(15px)', scale: 0.9 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center text-6xl md:text-8xl font-black tracking-tighter relative"
            >
              <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">SFT</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-red-500 via-red-600 to-red-900 drop-shadow-[0_0_35px_rgba(220,38,38,0.7)] ml-4">
                KING
              </span>

              <motion.div
                initial={{ left: '-100%' }}
                animate={{ left: '200%' }}
                transition={{ duration: 2, delay: 0.8, ease: 'easeInOut' }}
                className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-[2px] w-[140%] bg-gradient-to-r from-transparent via-red-500 to-transparent mt-8 mb-5 drop-shadow-[0_0_15px_rgba(220,38,38,1)]"
              style={{ transformOrigin: 'center' }}
            />

            <motion.p
              initial={{ opacity: 0, y: 15, letterSpacing: '0em', filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.5em', filter: 'blur(0px)' }}
              transition={{ duration: 1.5, delay: 1.2, ease: 'easeOut' }}
              className="text-red-400/90 text-[10px] md:text-xs font-black uppercase tracking-widest text-center"
            >
              Advanced Level Education
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}