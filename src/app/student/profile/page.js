'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import AvatarUploader from '@/components/shared/AvatarUploader'; 
import axios from '@/lib/axios';
import { normalizeAvatarPath } from '@/lib/utils';
import { User, Camera, Eye, EyeOff, Lock, X, Mail, MapPin, Edit2, CreditCard } from 'lucide-react';
import { emitStudentActivity } from '@/lib/studentActivity';
import { socket } from '@/lib/socket';
import { motion } from 'framer-motion';

const passwordStrength = (pw = '') => {
    const p = String(pw);

    const hasMinLen = p.length >= 10;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNum = /\d/.test(p);
    const hasSym = /[^A-Za-z0-9]/.test(p);

    const score =
        (hasMinLen ? 1 : 0) +
        (hasUpper ? 1 : 0) +
        (hasLower ? 1 : 0) +
        (hasNum ? 1 : 0) +
        (hasSym ? 1 : 0);

    const label = score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong';
    const percent = (score / 5) * 100;
    const isValid = hasMinLen && hasUpper && hasLower && hasNum && hasSym;

    return {
        hasMinLen,
        hasUpper,
        hasLower,
        hasNum,
        hasSym,
        score,
        label,
        percent,
        isValid,
    };
};

export default function StudentProfile() {
    const { user, updateUser } = useAuth();
    const [showUploader, setShowUploader] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [editEmail, setEditEmail] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [emailError, setEmailError] = useState('');
    const [addressError, setAddressError] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [pwStep, setPwStep] = useState(1);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pwErrors, setPwErrors] = useState({});
    const [pwLoading, setPwLoading] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const pwMeta = passwordStrength(newPassword);
    const pwMatch = confirmPassword ? confirmPassword === newPassword : null;

    const strengthColor =
        pwMeta.label === 'Weak'
            ? 'bg-red-500'
            : pwMeta.label === 'Medium'
            ? 'bg-yellow-500'
            : 'bg-green-500';

    const strengthText =
        pwMeta.label === 'Weak'
            ? 'text-red-500'
            : pwMeta.label === 'Medium'
            ? 'text-yellow-500'
            : 'text-green-500';

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setPwStep(1);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwErrors({});
        setPwSuccess('');
        setShowOldPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setPwLoading(false);
    };

    const openEmailModal = () => {
        setEditEmail(user?.email || '');
        setEmailError('');
        setShowEmailModal(true);
    };

    const closeEmailModal = () => {
        setShowEmailModal(false);
        setEditEmail('');
        setEmailError('');
    };

    const saveEmail = async () => {
        const normalized = String(editEmail || '').trim().toLowerCase();
        if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setEmailError('Enter a valid email');
            return;
        }
        setEmailLoading(true);
        setEmailError('');
        try {
            const res = await axios.post('/me/email', { email: normalized });
            updateUser({ email: res.data?.email || normalized });
            closeEmailModal();
        } catch (e) {
            setEmailError(e.response?.data?.message || 'Failed to save email');
        } finally {
            setEmailLoading(false);
        }
    };

    const openAddressModal = () => {
        setEditAddress(user?.address || '');
        setAddressError('');
        setShowAddressModal(true);
    };

    const closeAddressModal = () => {
        setShowAddressModal(false);
        setEditAddress('');
        setAddressError('');
    };

    const saveAddress = async () => {
        const normalized = String(editAddress || '').trim();
        if (!normalized) {
            setAddressError('Address is required');
            return;
        }
        if (/^0\d{9,14}$/.test(normalized.replace(/\s+/g, ''))) {
            setAddressError('Enter a real address');
            return;
        }
        setAddressLoading(true);
        setAddressError('');
        try {
            const res = await axios.post('/me/address', { address: normalized });
            updateUser({ address: res.data?.address || normalized });
            closeAddressModal();
        } catch (e) {
            setAddressError(e.response?.data?.message || 'Failed to save address');
        } finally {
            setAddressLoading(false);
        }
    };

    const handleVerifyOldPassword = async () => {
        if (!oldPassword) {
            setPwErrors({ oldPassword: 'Old password is required' });
            return;
        }

        setPwLoading(true);
        setPwErrors({});
        try {
            await axios.post('/user/change-password/verify', { oldPassword });
            emitStudentActivity(socket, user, {
                page: 'Account Settings',
                action: 'Verified Old Password',
                detail: 'Password change step 1',
                route: '/student/profile',
                kind: 'account'
            });
            setPwStep(2);
        } catch (e) {
            setPwErrors({ oldPassword: e.response?.data?.message || 'Failed to verify old password' });
        } finally {
            setPwLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        const e = {};

        if (!newPassword) e.newPassword = 'New password is required';
        if (!confirmPassword) e.confirmPassword = 'Please retype password';
        if (newPassword && !pwMeta.isValid) e.newPassword = 'Use Strong Password Rules';
        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            e.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(e).length) {
            setPwErrors(e);
            return;
        }

        setPwLoading(true);
        setPwErrors({});

        try {
            await axios.post('/user/change-password', {
                oldPassword,
                newPassword,
            });
            emitStudentActivity(socket, user, {
                page: 'Account Settings',
                action: 'Changed Password',
                detail: 'Updated login password',
                route: '/student/profile',
                kind: 'account'
            });
            setPwSuccess('Password updated successfully');
            setTimeout(() => closePasswordModal(), 900);
        } catch (err) {
            setPwErrors({ newPassword: err.response?.data?.message || 'Failed to update password' });
        } finally {
            setPwLoading(false);
        }
    };

    const emailModal = showEmailModal && mounted
        ? createPortal(
            <motion.div
                className="fixed inset-0 z-[9998] p-4 bg-slate-950/90 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-blue-100 dark:border-blue-500/20 shadow-2xl overflow-hidden transition-colors duration-300"
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                >
                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-blue-100 dark:border-blue-500/20 transition-colors">
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white transition-colors flex items-center gap-2">
                                <Mail size={18} className="text-blue-600 dark:text-blue-400" />
                                Edit Email
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={closeEmailModal}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => {
                                setEditEmail(e.target.value);
                                if (emailError) setEmailError('');
                            }}
                            className={`w-full rounded-2xl py-3 px-4 text-sm bg-blue-50/20 dark:bg-white/5 border outline-none text-slate-800 dark:text-white transition-colors ${
                                emailError ? 'border-red-500' : 'border-blue-100 dark:border-white/10 focus:border-blue-500'
                            }`}
                            placeholder="you@example.com"
                            autoFocus
                        />
                        {emailError && (
                            <p className="text-[11px] font-bold text-red-500 flex items-center gap-2">
                                <X size={12} />
                                {emailError}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={saveEmail}
                            disabled={emailLoading}
                            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors"
                        >
                            {emailLoading ? 'Saving...' : 'Save Email'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>,
            document.body
        )
        : null;

    const addressModal = showAddressModal && mounted
        ? createPortal(
            <motion.div
                className="fixed inset-0 z-[9998] p-4 bg-slate-950/90 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 shadow-2xl overflow-hidden transition-colors duration-300"
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                >
                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-emerald-100 dark:border-emerald-500/20 transition-colors">
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white transition-colors flex items-center gap-2">
                                <MapPin size={18} className="text-emerald-600 dark:text-emerald-400" />
                                Edit Address
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={closeAddressModal}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <textarea
                            value={editAddress}
                            onChange={(e) => {
                                setEditAddress(e.target.value);
                                if (addressError) setAddressError('');
                            }}
                            className={`w-full rounded-2xl py-3 px-4 text-sm bg-emerald-50/20 dark:bg-white/5 border outline-none text-slate-800 dark:text-white transition-colors resize-none ${
                                addressError ? 'border-red-500' : 'border-emerald-100 dark:border-white/10 focus:border-emerald-500'
                            }`}
                            placeholder="123 Main Street, City"
                            rows={3}
                            autoFocus
                        />
                        {addressError && (
                            <p className="text-[11px] font-bold text-red-500 flex items-center gap-2">
                                <X size={12} />
                                {addressError}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={saveAddress}
                            disabled={addressLoading}
                            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors"
                        >
                            {addressLoading ? 'Saving...' : 'Save Address'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>,
            document.body
        )
        : null;

    const passwordModal = showPasswordModal && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[9999] p-4 bg-slate-950/90 dark:bg-black/90 backdrop-blur-xl flex items-center justify-center">
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-red-100 dark:border-white/10 shadow-2xl overflow-hidden transition-colors duration-300">
                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-red-100 dark:border-white/10 transition-colors">
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white transition-colors">Change Password</h3>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 transition-colors">Step {pwStep} of 2</p>
                        </div>
                        <button
                            type="button"
                            onClick={closePasswordModal}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="overflow-hidden">
                            <div className={`flex w-[200%] transition-transform duration-500 ease-out ${pwStep === 2 ? '-translate-x-1/2' : 'translate-x-0'}`}>
                                <div className="w-1/2 pr-2 space-y-4">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">Confirm your current password to continue.</p>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Old Password</label>
                                        <div className="relative mt-1">
                                            <input
                                                type={showOldPassword ? 'text' : 'password'}
                                                value={oldPassword}
                                                onChange={(e) => {
                                                    setOldPassword(e.target.value);
                                                    setPwErrors((prev) => ({ ...prev, oldPassword: undefined }));
                                                }}
                                                placeholder="Enter old password"
                                                className={`w-full rounded-2xl py-3 pl-4 pr-11 text-sm bg-red-50/20 dark:bg-white/5 border outline-none text-slate-800 dark:text-white transition-colors ${pwErrors.oldPassword ? 'border-red-500' : 'border-red-100 dark:border-white/10 focus:border-red-500'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOldPassword((p) => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                                            >
                                                {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {pwErrors.oldPassword && <p className="text-[11px] font-bold text-red-500 mt-1 ml-1">{pwErrors.oldPassword}</p>}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleVerifyOldPassword}
                                        disabled={pwLoading}
                                        className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors"
                                    >
                                        {pwLoading ? 'Confirming...' : 'Confirm Old Password'}
                                    </button>
                                </div>

                                <div className="w-1/2 pl-2 space-y-4">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">Create a strong new password for your account.</p>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">New Password</label>
                                        <div className="relative mt-1">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => {
                                                    setNewPassword(e.target.value);
                                                    setPwErrors((prev) => ({ ...prev, newPassword: undefined }));
                                                }}
                                                placeholder="Enter new password"
                                                className={`w-full rounded-2xl py-3 pl-4 pr-11 text-sm bg-red-50/20 dark:bg-white/5 border outline-none text-slate-800 dark:text-white transition-colors ${pwErrors.newPassword ? 'border-red-500' : 'border-red-100 dark:border-white/10 focus:border-red-500'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword((p) => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                                            >
                                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {pwErrors.newPassword && <p className="text-[11px] font-bold text-red-500 mt-1 ml-1">{pwErrors.newPassword}</p>}
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Retype New Password</label>
                                        <div className="relative mt-1">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => {
                                                    setConfirmPassword(e.target.value);
                                                    setPwErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                                                }}
                                                placeholder="Retype new password"
                                                className={`w-full rounded-2xl py-3 pl-4 pr-11 text-sm bg-red-50/20 dark:bg-white/5 border outline-none text-slate-800 dark:text-white transition-colors ${pwErrors.confirmPassword ? 'border-red-500' : 'border-red-100 dark:border-white/10 focus:border-red-500'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((p) => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                                            >
                                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        {pwErrors.confirmPassword && <p className="text-[11px] font-bold text-red-500 mt-1 ml-1">{pwErrors.confirmPassword}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden transition-colors">
                                            <div
                                                className={`h-full transition-all duration-300 ${strengthColor}`}
                                                style={{ width: `${pwMeta.percent}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className={`text-xs font-bold ${strengthText}`}>{pwMeta.label} Password</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest transition-colors">Score {pwMeta.score}/5</p>
                                        </div>

                                        <div className="text-[10px] space-y-1">
                                            <p className={pwMeta.hasMinLen ? 'text-green-500 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>• Minimum 10 characters</p>
                                            <p className={pwMeta.hasUpper ? 'text-green-500 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>• At least one uppercase letter</p>
                                            <p className={pwMeta.hasLower ? 'text-green-500 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>• At least one lowercase letter</p>
                                            <p className={pwMeta.hasNum ? 'text-green-500 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>• At least one number</p>
                                            <p className={pwMeta.hasSym ? 'text-green-500 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>• At least one symbol</p>
                                        </div>

                                        {pwMatch !== null && (
                                            <p className={`text-xs font-bold ${pwMatch ? 'text-green-500 dark:text-green-400' : 'text-red-500'}`}>
                                                {pwMatch ? 'Passwords match' : 'Passwords do not match'}
                                            </p>
                                        )}

                                        {pwSuccess && <p className="text-xs font-bold text-green-500 dark:text-green-400">{pwSuccess}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPwStep(1);
                                                setPwErrors({});
                                            }}
                                            className="py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleUpdatePassword}
                                            disabled={pwLoading || !pwMeta.isValid || !pwMatch}
                                            className="py-3 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors"
                                        >
                                            {pwLoading ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            {/* 🚀 Dark Mode: Added transition */}
            <div className="absolute inset-0 p-4 overflow-y-auto transition-colors duration-300">
                <div className="max-w-xl mx-auto space-y-8 pb-20 pt-10 font-sans">
                
                {/* 🚀 Dark Mode: Card Background & Border */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-red-50 dark:border-white/10 text-center relative overflow-hidden transition-colors duration-300">
                    <button
                        type="button"
                        onClick={() => setShowPasswordModal(true)}
                        className="absolute top-4 right-4 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors"
                    >
                        <Lock size={14} />
                        Change Password
                    </button>
                    
                    {/* 🚀 Dark Mode: Top Banner (Lighter slate in dark mode for contrast) */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-slate-950 dark:bg-slate-800 z-0 transition-colors duration-300"></div>
                    
                    <div className="relative z-10 pt-10">
                        {/* Avatar */}
                        <div className="relative inline-block mb-6 group">
                            {/* 🚀 Dark Mode: Avatar border */}
                            <div 
                                onClick={() => setShowUploader(true)} 
                                className="w-36 h-36 bg-white dark:bg-slate-900 p-1.5 rounded-full mx-auto shadow-2xl cursor-pointer hover:scale-105 transition-all border-4 border-white dark:border-slate-800 overflow-hidden flex items-center justify-center relative"
                            >
                                {user?.avatar ? (
                                    <img src={normalizeAvatarPath(user.avatar)} className="w-full h-full rounded-full object-cover" alt="Profile" onError={(e) => { e.target.style.display = 'none'; }} />
                                ) : (
                                    <div className="text-slate-300 dark:text-slate-600"><User size={80} strokeWidth={1} /></div>
                                )}
                                <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><Camera className="text-white" size={28} /></div>
                            </div>
                        </div>

                        <div className="mb-8">
                            {/* 🚀 Dark Mode: Name Text */}
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase transition-colors">{user.name}</h2>
                            <p className="text-red-600 dark:text-red-500 font-bold uppercase tracking-widest text-[10px] mt-1 italic underline transition-colors">Batch {user.batch}</p>
                        </div>

                        <div className="space-y-4 text-left">
                            {/* 🚀 Dark Mode: Detail Cards */}
                            <div className="p-5 bg-red-50/20 dark:bg-red-500/5 rounded-3xl border border-red-50 dark:border-red-900/30 shadow-inner transition-colors duration-300">
                                <p className="text-[10px] font-black text-red-400 dark:text-red-500/80 uppercase mb-1 italic tracking-widest transition-colors">Official Name</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors">{user.name}</p>
                            </div>
                            <div className="p-5 bg-red-50/20 dark:bg-red-500/5 rounded-3xl border border-red-50 dark:border-red-900/30 shadow-inner transition-colors duration-300">
                                <p className="text-[10px] font-black text-red-400 dark:text-red-500/80 uppercase mb-1 italic tracking-widest transition-colors">Mobile Contact</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors">{user.mobile || 'None'}</p>
                            </div>
                            <div className="p-5 bg-red-50/20 dark:bg-red-500/5 rounded-3xl border border-red-50 dark:border-red-900/30 shadow-inner transition-colors duration-300">
                                <p className="text-[10px] font-black text-red-400 dark:text-red-500/80 uppercase mb-1 italic tracking-widest transition-colors">Student ID</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors">{user.studentCode || 'Pending'}</p>
                            </div>
                            <div className="p-5 bg-amber-50/30 dark:bg-amber-500/5 rounded-3xl border border-amber-100 dark:border-amber-900/30 shadow-inner transition-colors duration-300">
                                <p className="text-[10px] font-black text-amber-500 dark:text-amber-400/90 uppercase mb-2 italic tracking-widest transition-colors flex items-center gap-2">
                                    <CreditCard size={12} />
                                    NIC Number
                                </p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors">{user.nic || 'Not set yet'}</p>
                                <p className="text-[10px] mt-2 font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500/80">Read only</p>
                            </div>
                            <div className="p-5 bg-red-50/20 dark:bg-red-500/5 rounded-3xl border border-red-50 dark:border-red-900/30 shadow-inner transition-colors duration-300">
                                <p className="text-[10px] font-black text-red-400 dark:text-red-500/80 uppercase mb-1 italic tracking-widest transition-colors">Class Mode</p>
                                <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                    {user.classMode === 'physical' ? `Physical${user.hallClass ? ` - ${user.hallClass}` : ''}` : 'Online'}
                                </p>
                            </div>
                            <motion.button
                                onClick={openEmailModal}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full p-5 bg-blue-50/20 dark:bg-blue-500/5 rounded-3xl border border-blue-50 dark:border-blue-900/30 shadow-inner transition-all duration-300 group hover:bg-blue-100/30 dark:hover:bg-blue-500/10 text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-blue-400 dark:text-blue-500/80 uppercase mb-1 italic tracking-widest transition-colors">Email Address</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors break-all text-sm">{user?.email || '(Not set)'}</p>
                                    </div>
                                    <Edit2 size={16} className="text-blue-500 dark:text-blue-400 ml-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </motion.button>
                            <motion.button
                                onClick={openAddressModal}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full p-5 bg-emerald-50/20 dark:bg-emerald-500/5 rounded-3xl border border-emerald-50 dark:border-emerald-900/30 shadow-inner transition-all duration-300 group hover:bg-emerald-100/30 dark:hover:bg-emerald-500/10 text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-emerald-400 dark:text-emerald-500/80 uppercase mb-1 italic tracking-widest transition-colors">Address</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200 transition-colors text-sm">{user?.address || '(Not set)'}</p>
                                    </div>
                                    <Edit2 size={16} className="text-emerald-500 dark:text-emerald-400 ml-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </motion.button>
                        </div>
                    </div>
                </div>

                    {showUploader && <AvatarUploader user={user} onClose={() => setShowUploader(false)} />}
                </div>
            </div>
            {passwordModal}
            {emailModal}
            {addressModal}
        </>
    );
}