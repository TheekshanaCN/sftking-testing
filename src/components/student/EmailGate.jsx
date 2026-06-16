'use client';

import { useMemo, useState } from 'react';
import axios from '@/lib/axios';
import { Loader2, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGate() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const mustCaptureEmail = useMemo(() => {
    if (!user || user.role !== 'student') return false;
    if (!user.classMode || !user.studentCode) return false;
    return !String(user.email || '').trim();
  }, [user]);

  const submitEmail = async () => {
    const normalized = String(email || '').trim().toLowerCase();

    if (!normalized) {
      setError('Email is required');
      return;
    }

    if (!emailRegex.test(normalized)) {
      setError('Enter a valid email address');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await axios.post('/me/email', { email: normalized });
      updateUser({ email: res.data?.email || normalized });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save email');
    } finally {
      setSaving(false);
    }
  };

  if (!mustCaptureEmail) return null;

  return (
    <div className="fixed inset-0 z-[181] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
          <Mail size={24} className="text-red-500" />
          Add Recovery Email
        </h3>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">
          This is mandatory for support alerts and account recovery.
        </p>

        <div className="mt-6">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            className="mt-2 w-full p-4 rounded-2xl bg-slate-800 border border-white/10 text-white text-sm outline-none focus:border-red-500"
            placeholder="student@email.com"
            autoFocus
          />
          {error && (
            <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-2">
              <ShieldAlert size={12} />
              {error}
            </p>
          )}
        </div>

        <button
          onClick={submitEmail}
          disabled={saving}
          className="w-full mt-6 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all"
        >
          {saving ? <Loader2 className="animate-spin mx-auto" /> : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
