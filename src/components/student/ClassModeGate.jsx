'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from '@/lib/axios';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ClassModeGate() {
  const { user, updateUser } = useAuth();
  const [hallClasses, setHallClasses] = useState([]);
  const [classMode, setClassMode] = useState('');
  const [hallClass, setHallClass] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const mustChooseMode = useMemo(() => {
    if (!user || user.role !== 'student') return false;
    return !user.classMode || !user.studentCode;
  }, [user]);

  useEffect(() => {
    if (!mustChooseMode) return;
    axios.get('/hall-classes').then((res) => setHallClasses(res.data || [])).catch(() => setHallClasses([]));
  }, [mustChooseMode]);

  const submitMode = async () => {
    const nextErrors = {};
    if (!classMode) nextErrors.classMode = 'Select Online or Physical';
    if (classMode === 'physical' && !hallClass) nextErrors.hallClass = 'Select a Hall Class city';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post('/me/class-mode', {
        classMode,
        hallClass: classMode === 'physical' ? hallClass : '',
      });
      updateUser({
        classMode: res.data.classMode,
        hallClass: res.data.hallClass,
        studentCode: res.data.studentCode,
      });
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save class mode');
    } finally {
      setSaving(false);
    }
  };

  if (!mustChooseMode) return null;

  return (
    <div className="fixed inset-0 z-[180] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-900 p-6 md:p-8 shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">
          Choose Class Mode
        </h3>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">
          This step is required before using the student portal.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <label className="flex items-center gap-2 p-4 rounded-2xl border border-white/10 bg-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={classMode === 'online'}
              onChange={() => {
                setClassMode('online');
                setHallClass('');
                setErrors({});
              }}
            />
            <span className="text-sm font-bold text-white">Online</span>
          </label>

          <label className="flex items-center gap-2 p-4 rounded-2xl border border-white/10 bg-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={classMode === 'physical'}
              onChange={() => {
                setClassMode('physical');
                setErrors({});
              }}
            />
            <span className="text-sm font-bold text-white">Physical</span>
          </label>
        </div>
        {errors.classMode && <p className="text-[10px] text-red-500 font-bold mt-2">{errors.classMode}</p>}

        {classMode === 'physical' && (
          <div className="mt-4">
            <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
              Hall Classes
            </label>
            <select
              value={hallClass}
              onChange={(e) => {
                setHallClass(e.target.value);
                setErrors((prev) => ({ ...prev, hallClass: undefined }));
              }}
              className="mt-2 w-full p-4 rounded-2xl bg-slate-800 border border-white/10 text-white text-sm outline-none"
            >
              <option value="">Select Hall City</option>
              {hallClasses.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {errors.hallClass && <p className="text-[10px] text-red-500 font-bold mt-2">{errors.hallClass}</p>}
          </div>
        )}

        <button
          onClick={submitMode}
          disabled={saving}
          className="w-full mt-6 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all"
        >
          {saving ? <Loader2 className="animate-spin mx-auto" /> : 'Continue'}
        </button>
      </div>
    </div>
  );
}
