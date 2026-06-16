'use client';

import { useMemo, useState } from 'react';
import axios from '@/lib/axios';
import { Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AddressGate() {
  const { user, updateUser } = useAuth();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const mustCaptureAddress = useMemo(() => {
    if (!user || user.role !== 'student') return false;
    if (!user.classMode || !user.studentCode) return false;
    const addr = String(user.address || '').trim();
    // Show gate if address is empty or is only digits (phone-like)
    return !addr || /^0\d{9,14}$/.test(addr.replace(/\s+/g, ''));
  }, [user]);

  const submitAddress = async () => {
    const normalized = String(address || '').trim();

    if (!normalized) {
      setError('Address is required');
      return;
    }

    // Block phone-number-like addresses
    if (/^0\d{9,14}$/.test(normalized.replace(/\s+/g, ''))) {
      setError('Enter a real address, not a phone number');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await axios.post('/me/address', { address: normalized });
      updateUser({ address: res.data?.address || normalized });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  if (!mustCaptureAddress) return null;

  return (
    <div className="fixed inset-0 z-[181] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-3">
          <MapPin size={24} className="text-red-500" />
          Complete Your Profile
        </h3>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">
          Please provide your residential address for record-keeping.
        </p>

        <div className="mt-6">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
            Street Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError('');
            }}
            className="mt-2 w-full p-4 rounded-2xl bg-slate-800 border border-white/10 text-white text-sm outline-none focus:border-red-500"
            placeholder="123 Main Street, City"
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
          onClick={submitAddress}
          disabled={saving}
          className="w-full mt-6 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all"
        >
          {saving ? <Loader2 className="animate-spin mx-auto" /> : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
