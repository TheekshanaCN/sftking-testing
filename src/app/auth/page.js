"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import axios from "@/lib/axios";
import { consumePostLoginRedirect } from "@/lib/postLoginRedirect";
import {
  Lock,
  User,
  Loader2,
  MapPin,
  Copy,
  MessageCircle,
  CreditCard,
  Building2,
  X,
  BadgeCheck,
  Phone,
  Clock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Landmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import fpPromise from '@fingerprintjs/fingerprintjs';

// Forgot Password States


const mobileRegex = /^07\d{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nicRegex = /^(\d{9}[VvXx]|\d{12})$/;
const isAdminLogin = (m = "") => String(m).trim().toUpperCase() === "ADMIN";



/* ---------------- PASSWORD STRENGTH ---------------- */
const passwordStrength = (pw = "") => {
  const p = String(pw);

  const hasMinLen = p.length >= 10; // change to 8 if you want
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

  const label = score <= 2 ? "Weak" : score <= 4 ? "Medium" : "Strong";
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

/* ---------------- UI COMPONENTS ---------------- */
const InputField = ({
  label,
  icon,
  rightIcon,
  onRightIconClick,
  type = "text",
  value,
  onChange,
  error,
  placeholder = "",
  autoFocus = false,
  required = false,
  name,
}) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500 flex items-center gap-2">
      {label}{" "}
      {required && (
        <span className="text-red-500 font-black" title="Required">
          *
        </span>
      )}
    </label>

    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </div>
      )}

      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`w-full p-4 pl-12 pr-12 rounded-2xl text-sm text-white outline-none transition-all
          ${
            error
              ? "border border-red-500 bg-red-500/10"
              : "border border-white/10 bg-white/5 focus:border-red-500 focus:bg-white/10"
          }
        `}
      />

      {rightIcon && (
        <button
          type="button"
          onClick={onRightIconClick}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle password visibility"
        >
          {rightIcon}
        </button>
      )}
    </div>

    {error && <p className="text-[10px] text-red-500 ml-2 font-bold">{error}</p>}
  </div>
);

export default function AuthPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [fpStep, setFpStep] = useState(1); // 1=mobile, 2=otp, 3=reset
  const [fpMobile, setFpMobile] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpErrors, setFpErrors] = useState({});
  const [fpLoading, setFpLoading] = useState(false);
  const [fpResetToken, setFpResetToken] = useState(""); // returned by server after OTP verify
  const [fpShowNew, setFpShowNew] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);

  const [fpPwMeta, setFpPwMeta] = useState(() => passwordStrength(""));
  const [fpPwMatch, setFpPwMatch] = useState(null); // null | true | false

  const handleForgotSendOtp = async () => {
    const m = (fpMobile || "").trim();

    if (!mobileRegex.test(m)) {
      return setFpErrors({ mobile: "Invalid Mobile (07xxxxxxxx)" });
    }

    setFpLoading(true);
    setFpErrors({});
    try {
      const res = await axios.post("/forgot/start", { mobile: m });

      if (!res.data?.sent) {
        // user not found OR provider failed
        return setFpErrors({ mobile: "OTP not sent. Check number or try again." });
      }

      setFpStep(2);
    } catch (e) {
      setFpErrors({ mobile: e.response?.data?.message || "Failed to send OTP" });
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotVerifyOtp = async () => {
    const m = (fpMobile || "").trim();
    const code = (fpOtp || "").trim();

    if (!code) return setFpErrors({ otp: "Enter OTP" });
    if (code.length !== 4) return setFpErrors({ otp: "Enter 4 digits" });

    setFpLoading(true);
    setFpErrors({});
    try {
      const res = await axios.post("/forgot/verify", { mobile: m, otp: code });
      setFpResetToken(res.data?.resetToken || "");
      setFpStep(3);
    } catch (e) {
      setFpErrors({ otp: e.response?.data?.message || "Incorrect OTP" });
    } finally {
      setFpLoading(false);
    }
  };

  // ✅ UPDATE: handleForgotResetPassword (replace your function with this)
  const handleForgotResetPassword = async () => {
    const e = {};

    if (!fpNewPassword) e.password = "Required";
    if (!fpConfirmPassword) e.confirm = "Please retype password";

    if (fpNewPassword && !fpPwMeta.isValid) e.password = "Use Strong Password Rules";

    if (fpNewPassword && fpConfirmPassword && fpNewPassword !== fpConfirmPassword) {
      e.confirm = "Passwords do not match";
    }

    if (!fpResetToken) e.password = "Please verify OTP again"; // safety

    if (Object.keys(e).length) return setFpErrors(e);

    try {
      await axios.post("/forgot/reset", {
        mobile: fpMobile,
        resetToken: fpResetToken,
        newPassword: fpNewPassword,
      });

      alert("Password Updated Successfully");

      setShowForgotModal(false);
      setFpStep(1);
      setFpMobile("");
      setFpOtp("");
      setFpNewPassword("");
      setFpConfirmPassword("");
      setFpErrors({});
      setFpResetToken("");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update password";
      setFpErrors({ password: msg });
    }
  };



  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [regStep, setRegStep] = useState(1); // 1: Mobile, 2: OTP, 3: Details
  const [loading, setLoading] = useState(false);

  const [batchList, setBatchList] = useState([]);
  const [hallClasses, setHallClasses] = useState([]);
  const [errors, setErrors] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [siteName, setSiteName] = useState("SFT KING");
  const [bankInfo, setBankInfo] = useState({
    bankName: "Loading...",
    accNum: "Loading...",
    accName: "Loading...",
    branch: "Loading...",
  });

  // Register step-1
  const [mobile, setMobile] = useState("");

  // Register step-2
  const [otpInput, setOtpInput] = useState("");
  

  // Login + Register details
  const [details, setDetails] = useState({
    mobile: "",
    name: "",
    email: "",
    nic: "",
    address: "",
    password: "",
    confirmPassword: "",
    batch: "",
    classMode: "",
    hallClass: "",
  });

  // Password UI
  const [pwMeta, setPwMeta] = useState(() => passwordStrength(""));
  const [pwMatch, setPwMatch] = useState(null); // null | true | false

  // Timer
  const [resendTimer, setResendTimer] = useState(0);

  // Maintenance
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    axios.get("/batches").then((r) => setBatchList(r.data || [])).catch(() => {});
    axios.get("/hall-classes").then((r) => setHallClasses(r.data || [])).catch(() => {});
    axios
      .get("/config/bank-details")
      .then((res) => res.data && setBankInfo(res.data))
      .catch(() => {});
    axios
      .get("/config/site-name")
      .then((res) => res.data?.name && setSiteName(res.data.name))
      .catch(() => {});
    axios
      .get("/settings/maintenance")
      .then((res) => res.data?.enabled && setIsMaintenance(true))
      .catch(() => {});
  }, []);

  // ✅ ADD: live strength + match effect (put near your existing password useEffect)
  useEffect(() => {
    const meta = passwordStrength(fpNewPassword || "");
    setFpPwMeta(meta);

    if (!fpConfirmPassword) setFpPwMatch(null);
    else setFpPwMatch(fpConfirmPassword === (fpNewPassword || ""));
  }, [fpNewPassword, fpConfirmPassword]);


  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Live password rules + confirm match (REGISTER step 3 only)
  useEffect(() => {
    const meta = passwordStrength(details.password || "");
    setPwMeta(meta);

    const confirm = details.confirmPassword || "";
    if (!confirm) setPwMatch(null);
    else setPwMatch(confirm === (details.password || ""));
  }, [details.password, details.confirmPassword]);

  // 🚀 THE TELEPORTATION SPELL
  useEffect(() => {
    if (!authLoading && user) {
      const target = consumePostLoginRedirect(user.role);
      router.push(target);
    }
  }, [user, authLoading, router]);

  const resetForm = () => {
    setRegStep(1);
    setMobile("");
    setOtpInput("");
    setDetails({
      mobile: "",
      name: "",
      email: "",
      nic: "",
      address: "",
      password: "",
      confirmPassword: "",
      batch: "",
      classMode: "",
      hallClass: "",
    });
    setErrors({});
    setPwMeta(passwordStrength(""));
    setPwMatch(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  // REGISTER STEP 1: SEND OTP (server generates OTP)
  const handleSendOtp = async () => {
    if (!mobileRegex.test(mobile)) {
      setErrors({ mobile: "Invalid Format (07xxxxxxxx)" });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const checkRes = await axios.post("/check-mobile", { mobile });
      if (checkRes.data?.exists) {
        setErrors({ mobile: "Number already registered! Please Login." });
        return;
      }

      // ✅ server generates OTP + sends SMS
      await axios.post("/send-otp", { mobile });

      setResendTimer(300);
      setRegStep(2);
      setOtpInput("");
    } catch (e) {
      alert(e.response?.data?.message || "OTP send failed");
    } finally {
      setLoading(false);
    }
  };

  // REGISTER STEP 2: VERIFY OTP (server verifies)
  const handleVerifyOtp = async () => {
    if (!otpInput) return setErrors({ otp: "Enter OTP" });
    if (otpInput.length !== 4) return setErrors({ otp: "Enter 4 digits" });

    setLoading(true);
    setErrors({});
    try {
      await axios.post("/verify-otp", { mobile, otp: otpInput });
      setRegStep(3);
      setDetails((p) => ({ ...p, mobile }));
    } catch (e) {
      setErrors({ otp: e.response?.data?.message || "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- REGISTER STEP 3: REGISTER ---------------- */
  const handleRegister = async () => {
    const e = {};

    if (!details.name) e.name = "Required";
    if (!details.email) e.email = "Required";
    if (details.email && !emailRegex.test(details.email.trim().toLowerCase())) {
      e.email = "Enter a valid email address";
    }
    if (!details.nic) e.nic = "Required";
    if (details.nic && !nicRegex.test(details.nic.trim())) {
      e.nic = "Enter a valid NIC";
    }
    if (!details.classMode) e.classMode = "Select Online or Physical";
    if (details.classMode === "physical" && !details.hallClass) {
      e.hallClass = "Select a Hall Class city";
    }
    if (!details.address) e.address = "Required";
    const trimmedAddress = (details.address || "").trim();
    if (trimmedAddress && /^0\d{9,14}$/.test(trimmedAddress.replace(/\s+/g, ""))) {
      e.address = "Enter a real address, not a phone number";
    }
    if (!details.batch) e.batch = "Required";
    if (!details.password) e.password = "Required";
    if (!details.confirmPassword) e.confirmPassword = "Please retype password";
    if (!pwMeta.isValid) e.password = "Use Strong Password Rules";
    if (details.password !== details.confirmPassword) e.confirmPassword = "Passwords do not match";

    // must have verified mobile
    if (!mobileRegex.test(mobile)) e.mobile = "Invalid mobile (go back)";

    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      await axios.post("/register", {
        name: details.name,
        email: details.email.trim().toLowerCase(),
        nic: details.nic.trim().toUpperCase(),
        mobile,
        address: details.address.trim(),
        password: details.password,
        batch: details.batch,
        classMode: details.classMode,
        hallClass: details.classMode === "physical" ? details.hallClass : "",
      });

      alert("Registration Successful! Please Login.");
      setAuthMode("login");
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || "Registration Failed.";
      if (msg.toLowerCase().includes("mobile")) {
        setRegStep(1);
        setErrors({ mobile: "Mobile already registered!" });
      } else {
        alert(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- LOGIN ---------------- */
  const handleLogin = async () => {
    const e = {};
    const m = (details.mobile || "").trim();

    if (!m) e.loginMobile = "Mobile required";
    if (!details.password) e.loginPassword = "Password required";

    // Only enforce 07xxxxxxxx format for normal users (NOT ADMIN)
    if (m && !isAdminLogin(m) && !mobileRegex.test(m)) {
      e.loginMobile = "Invalid mobile (07xxxxxxxx)";
    }

    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      // 🚀 ZERO-TRUST: SCAN THE DEVICE HARDWARE DNA
      const fp = await fpPromise.load();
      const result = await fp.get();
      const deviceFingerprint = result.visitorId;

      // Save it locally so we can send it with future requests
      if (typeof window !== 'undefined') {
          localStorage.setItem('sft_device_fp', deviceFingerprint);
      }

      // Send mobile, password, AND fingerprint to the backend
      const res = await axios.post("/login", {
        mobile: m,
        password: details.password,
        fingerprint: deviceFingerprint // 🧬 Injecting the DNA
      });
      
      login(res.data);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Login Failed. Check Mobile Number / Password.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- PAYMENT MODAL ---------------- */
  const PaymentModal = () => (
    <AnimatePresence>
      {showPaymentModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
            className="w-full max-w-md bg-slate-950 border border-white/10 rounded-[30px] overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-red-900/40 to-slate-900/40 p-6 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                    Bank Details
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    For Transfers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 group hover:border-red-500/30 transition-colors">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                  Bank Name
                </p>
                <p className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <Landmark size={16} className="text-red-500" />
                  {bankInfo.bankName}
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:border-red-500/30 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                    Account Number
                  </p>
                  <p className="text-xl font-mono font-bold text-white tracking-wider">
                    {bankInfo.accNum}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(bankInfo.accNum)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-400 transition-all"
                >
                  <Copy size={18} />
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:border-red-500/30 transition-colors">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                    Account Holder
                  </p>
                  <p className="text-sm sm:text-base font-bold text-white">
                    {bankInfo.accName}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(bankInfo.accName)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-red-600 hover:text-white text-slate-400 transition-all"
                >
                  <Copy size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3 px-2 py-1">
                <MapPin size={16} className="text-red-500" />
                <p className="text-xs font-bold text-slate-400">
                  <span className="uppercase text-[10px] text-slate-500 mr-2 tracking-widest">
                    Branch:
                  </span>
                  {bankInfo.branch}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Please upload slip after registration
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const strengthColor =
    pwMeta.label === "Weak"
      ? "bg-red-500"
      : pwMeta.label === "Medium"
      ? "bg-yellow-500"
      : "bg-green-500";

  const strengthText =
    pwMeta.label === "Weak"
      ? "text-red-500"
      : pwMeta.label === "Medium"
      ? "text-yellow-500"
      : "text-green-500";

  const fpStrengthColor =
    fpPwMeta.label === "Weak"
      ? "bg-red-500"
      : fpPwMeta.label === "Medium"
      ? "bg-yellow-500"
      : "bg-green-500";

  const fpStrengthText =
    fpPwMeta.label === "Weak"
      ? "text-red-500"
      : fpPwMeta.label === "Medium"
      ? "text-yellow-500"
      : "text-green-500";

  // button enable helpers
  const loginReady =
  !!details.mobile &&
  !!details.password &&
  (!mobileRegex.test(details.mobile) ? isAdminLogin(details.mobile) : true) &&
  !loading;

  const registerStep1Ready = !!mobile && mobileRegex.test(mobile) && !loading;
  const registerStep2Ready = !!otpInput && otpInput.length === 4 && !loading;

  const registerReady =
    !!details.name &&
    !!details.email &&
    emailRegex.test((details.email || "").trim().toLowerCase()) &&
    !!details.nic &&
    nicRegex.test((details.nic || "").trim()) &&
    !!details.classMode &&
    (details.classMode === "online" || !!details.hallClass) &&
    !!details.address &&
    !!details.batch &&
    !!details.password &&
    !!details.confirmPassword &&
    pwMeta.isValid &&
    details.password === details.confirmPassword &&
    !loading;

  // Keep login page visible on first load; only hide it if a session already exists.
  if (user) {
    return (
      <div className="min-h-screen bg-[#0C0101] flex items-center justify-center">
        <Loader2 className="animate-spin text-red-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0101] flex items-center justify-center p-4 text-white relative font-sans">
      <motion.button
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        onClick={() => setShowPaymentModal(true)}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-red-500/30 text-red-400 rounded-full shadow-lg backdrop-blur-md hover:bg-red-950/50 cursor-pointer"
      >
        <CreditCard size={16} />{" "}
        <span className="text-[10px] font-bold uppercase hidden sm:inline">
          Payment Info
        </span>
      </motion.button>
      <PaymentModal />

      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-950 border border-white/10 rounded-3xl p-8 w-full max-w-md"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="text-xl font-bold mb-6 text-white text-center uppercase">
                Reset Password
              </h3>

              {/* STEP 1 */}
              {fpStep === 1 && (
                <>
                  <input
                    type="text"
                    placeholder="Enter Mobile (07xxxxxxxx)"
                    value={fpMobile}
                    onChange={(e) => setFpMobile(e.target.value)}
                    className="w-full p-4 rounded-xl bg-black/40 border border-white/20 text-white"
                  />
                  {fpErrors.mobile && (
                    <p className="text-red-500 text-xs mt-2">{fpErrors.mobile}</p>
                  )}

                  <button
                    onClick={handleForgotSendOtp}
                    disabled={fpLoading}
                    className="w-full mt-6 bg-red-600 py-3 rounded-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? "Sending..." : "Send OTP"}
                  </button>

                </>
              )}

              {/* STEP 2 */}
              {fpStep === 2 && (
                <>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value)}
                    className="w-full p-4 rounded-xl bg-black/40 border border-white/20 text-white"
                  />
                  {fpErrors.otp && (
                    <p className="text-red-500 text-xs mt-2">{fpErrors.otp}</p>
                  )}

                  <button
                    onClick={handleForgotVerifyOtp}
                    disabled={fpLoading}
                    className="w-full mt-6 bg-red-600 py-3 rounded-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                </>
              )}

              {/* STEP 3 */}
              {fpStep === 3 && (
              <>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={fpShowNew ? "text" : "password"}
                      placeholder="New Password"
                      value={fpNewPassword}
                      onChange={(e) => {
                        setFpNewPassword(e.target.value);
                        setFpErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={`w-full p-4 rounded-xl bg-black/40 border text-white pr-12 ${
                        fpErrors.password ? "border-red-500" : "border-white/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowNew((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {fpShowNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fpErrors.password && (
                    <p className="text-red-500 text-xs mt-1">{fpErrors.password}</p>
                  )}

                  <div className="relative">
                    <input
                      type={fpShowConfirm ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={fpConfirmPassword}
                      onChange={(e) => {
                        setFpConfirmPassword(e.target.value);
                        setFpErrors((p) => ({ ...p, confirm: undefined }));
                      }}
                      className={`w-full p-4 rounded-xl bg-black/40 border text-white pr-12 ${
                        fpErrors.confirm ? "border-red-500" : "border-white/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setFpShowConfirm((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {fpShowConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fpErrors.confirm && (
                    <p className="text-red-500 text-xs mt-1">{fpErrors.confirm}</p>
                  )}
                </div>

                {/* ✅ Strength UI */}
                <div className="space-y-2 mt-4">
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${fpStrengthColor}`}
                      style={{ width: `${fpPwMeta.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold ${fpStrengthText}`}>
                      {fpPwMeta.label} Password
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Score {fpPwMeta.score}/5
                    </p>
                  </div>

                  <div className="text-[10px] space-y-1">
                    <p className={fpPwMeta.hasMinLen ? "text-green-400" : "text-slate-500"}>
                      • Minimum 10 characters
                    </p>
                    <p className={fpPwMeta.hasUpper ? "text-green-400" : "text-slate-500"}>
                      • At least one uppercase letter
                    </p>
                    <p className={fpPwMeta.hasLower ? "text-green-400" : "text-slate-500"}>
                      • At least one lowercase letter
                    </p>
                    <p className={fpPwMeta.hasNum ? "text-green-400" : "text-slate-500"}>
                      • At least one number
                    </p>
                    <p className={fpPwMeta.hasSym ? "text-green-400" : "text-slate-500"}>
                      • At least one symbol
                    </p>
                  </div>

                  {fpPwMatch !== null && (
                    <p className={`text-xs font-bold ${fpPwMatch ? "text-green-400" : "text-red-500"}`}>
                      {fpPwMatch ? "Passwords match" : "Passwords do not match"}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleForgotResetPassword}
                  // ✅ disables until strong + match + filled
                  disabled={!fpPwMeta.isValid || fpNewPassword !== fpConfirmPassword || !fpNewPassword || !fpConfirmPassword}
                  className="w-full mt-6 bg-green-600 disabled:bg-slate-700 disabled:cursor-not-allowed py-3 rounded-xl font-bold"
                >
                  Update Password
                </button>
              </>
            )}

              <button
                onClick={() => setShowForgotModal(false)}
                className="text-xs text-slate-400 mt-6 w-full text-center"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <div className="relative w-full max-w-5xl bg-slate-900/40 backdrop-blur-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-white/5">
        {/* LEFT */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto max-h-[100svh] relative">
          <div className="max-w-sm mx-auto space-y-6 pb-10">
            <AnimatePresence mode="wait">
              {/* LOGIN */}
              {authMode === "login" && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <h2 className="text-3xl font-black italic uppercase mb-8 text-white">
                    Sign In
                  </h2>

                  <InputField
                    required
                    name="loginMobile"
                    label="Mobile Number"
                    icon={<User size={18} />}
                    value={details.mobile ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDetails((p) => ({ ...p, mobile: v }));
                      setErrors((p) => ({ ...p, loginMobile: undefined }));
                    }}
                    error={errors.loginMobile}
                    placeholder="07xxxxxxxx"
                  />

                  <InputField
                    required
                    name="loginPassword"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    icon={<Lock size={18} />}
                    rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    onRightIconClick={() => setShowPassword((p) => !p)}
                    value={details.password ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDetails((p) => ({ ...p, password: v }));
                      setErrors((p) => ({ ...p, loginPassword: undefined }));
                    }}
                    error={errors.loginPassword}
                    placeholder="Enter password"
                  />

                  <button
                    onClick={handleLogin}
                    disabled={!loginReady}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all shadow-lg shadow-red-600/20"
                  >
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : "Login"}
                  </button>

                  <div className="text-center pt-4">
                    <p className="text-sm text-slate-500">Don't have an account?</p>
                    <button
                      onClick={() => {
                        setAuthMode("register");
                        resetForm();
                      }}
                      className="text-sm font-bold text-red-500 hover:text-red-400 underline decoration-red-500/30 underline-offset-4 mt-1"
                    >
                      Create Account
                    </button>
                  </div>

                  <div className="text-center">
                    <div className="text-center mt-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] font-bold text-slate-500 hover:text-red-500 transition-colors uppercase"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <a
                      href="/terms"
                      className="text-[10px] font-bold text-slate-500 hover:text-green-500 flex items-center justify-center gap-2 uppercase mt-4"
                    >
                      TERMS & CONDITIONS
                    </a>
                    <div className="text-[10px] font-bold text-slate-500 hover:text-green-500 flex mt-4 items-center justify-center gap-2 uppercase">
                      <a href="tel:+94705370470"> Contact Us - 0705 370 470</a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* REGISTER */}
              {authMode === "register" && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {isMaintenance ? (
                    <div className="text-center p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <h3 className="text-lg font-bold text-red-500 mb-2">
                        System Maintenance
                      </h3>
                      <p className="text-sm text-slate-400">
                        We are currently performing scheduled system maintenance to
                        improve your registration experience. During this time, the
                        registration portal is offline.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-8">
                        <button
                          onClick={() => {
                            setAuthMode("login");
                            resetForm();
                          }}
                          className="text-slate-500 hover:text-white"
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-2xl font-black italic uppercase text-white">
                          Register
                        </h2>
                        <div className="text-[10px] font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                          Step {regStep} of 3
                        </div>
                      </div>

                      {/* STEP 1 */}
                      {regStep === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          className="space-y-6"
                        >
                          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl mb-6">
                            <p className="text-xs text-blue-200 leading-relaxed text-center">
                              Please verify your mobile number to access the
                              registration panel.
                            </p>
                          </div>

                          <InputField
                            required
                            name="regMobile"
                            label="Mobile Number (WhatsApp Only)"
                            icon={<Phone size={18} />}
                            value={mobile}
                            onChange={(e) => {
                              setMobile(e.target.value);
                              setErrors((p) => ({ ...p, mobile: undefined }));
                            }}
                            placeholder="07xxxxxxxx"
                            error={errors.mobile}
                            autoFocus
                          />

                          <button
                            onClick={handleSendOtp}
                            disabled={!registerStep1Ready}
                            className="w-full bg-white text-slate-900 hover:bg-slate-200 disabled:bg-slate-200/60 disabled:cursor-not-allowed py-4 rounded-2xl font-black uppercase transition-all flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <>
                                Send Verification Code <ArrowRight size={16} />
                              </>
                            )}
                          </button>

                          <div className="text-[10px] font-bold text-slate-500 hover:text-green-500 flex mt-4 items-center justify-center gap-2 uppercase">
                            <a href="tel:+94705370470"> Contact Us - 0705 370 470</a>
                          </div>
                          <a
                            href="/terms"
                            className="text-[10px] font-bold text-slate-500 hover:text-green-500 flex items-center justify-center gap-2 uppercase mt-4"
                          >
                            TERMS & CONDITIONS
                          </a>
                        </motion.div>
                      )}

                      {/* STEP 2 */}
                      {regStep === 2 && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          className="space-y-6 text-center"
                        >
                          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/20 animate-pulse">
                            <MessageCircle size={32} />
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-white mb-1">
                              Enter 4-Digit Code
                            </h3>
                            <p className="text-xs text-slate-400">
                              Sent to{" "}
                              <span className="text-red-400 font-mono">{mobile}</span>
                            </p>
                            <button
                              onClick={() => setRegStep(1)}
                              className="text-[10px] underline text-slate-500 mt-2"
                            >
                              Change Number
                            </button>
                          </div>

                          <input
                            type="text"
                            maxLength={4}
                            value={otpInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              setOtpInput(val);
                              setErrors((p) => ({ ...p, otp: undefined }));
                            }}
                            className="w-full bg-black/30 border border-white/20 rounded-2xl p-6 text-center text-4xl font-mono tracking-[0.5em] text-white focus:border-red-500 outline-none transition-all"
                            placeholder="----"
                            autoFocus
                          />

                          {errors.otp && (
                            <p className="text-xs text-red-500 font-bold">{errors.otp}</p>
                          )}

                          <button
                            onClick={handleVerifyOtp}
                            disabled={!registerStep2Ready}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all shadow-lg shadow-red-600/20"
                          >
                            Verify & Continue
                          </button>

                          <button
                            onClick={handleSendOtp}
                            disabled={resendTimer > 0 || loading}
                            className={`text-xs font-bold uppercase tracking-widest ${
                              resendTimer > 0
                                ? "text-slate-600"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {resendTimer > 0 ? (
                              <span className="flex items-center justify-center gap-2">
                                <Clock size={12} /> Resend in {formatTime(resendTimer)}
                              </span>
                            ) : (
                              "Send Code Again"
                            )}
                          </button>
                        </motion.div>
                      )}

                      {/* STEP 3 */}
                      {regStep === 3 && (
                        <motion.div
                          key="step3"
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          className="space-y-4"
                        >
                          <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center justify-center gap-2 mb-4">
                            <BadgeCheck size={16} className="text-green-500" />{" "}
                            <span className="text-green-400 text-xs font-bold uppercase">
                              Mobile Verified
                            </span>
                          </div>

                          <InputField
                            required
                            name="regName"
                            label="Full Name"
                            icon={<User size={18} />}
                            value={details.name}
                            onChange={(e) => {
                              setDetails((p) => ({ ...p, name: e.target.value }));
                              setErrors((p) => ({ ...p, name: undefined }));
                            }}
                            error={errors.name}
                          />

                          <InputField
                            required
                            name="regEmail"
                            label="Email Address"
                            icon={<MessageCircle size={18} />}
                            type="email"
                            value={details.email}
                            onChange={(e) => {
                              setDetails((p) => ({ ...p, email: e.target.value }));
                              setErrors((p) => ({ ...p, email: undefined }));
                            }}
                            error={errors.email}
                            placeholder="student@email.com"
                          />

                          <InputField
                            required
                            name="regNic"
                            label="NIC Number"
                            icon={<CreditCard size={18} />}
                            value={details.nic}
                            onChange={(e) => {
                              setDetails((p) => ({ ...p, nic: e.target.value }));
                              setErrors((p) => ({ ...p, nic: undefined }));
                            }}
                            error={errors.nic}
                            placeholder="200012345678 or 123456789V"
                          />

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
                              Class Type <span className="text-red-500 font-black">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="flex items-center gap-2 p-3 rounded-2xl border border-white/10 bg-white/5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={details.classMode === "online"}
                                  onChange={() => {
                                    setDetails((p) => ({ ...p, classMode: "online", hallClass: "" }));
                                    setErrors((p) => ({ ...p, classMode: undefined, hallClass: undefined }));
                                  }}
                                />
                                <span className="text-sm font-bold text-white">Online</span>
                              </label>
                              <label className="flex items-center gap-2 p-3 rounded-2xl border border-white/10 bg-white/5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={details.classMode === "physical"}
                                  onChange={() => {
                                    setDetails((p) => ({ ...p, classMode: "physical" }));
                                    setErrors((p) => ({ ...p, classMode: undefined }));
                                  }}
                                />
                                <span className="text-sm font-bold text-white">Physical</span>
                              </label>
                            </div>
                            {errors.classMode && <p className="text-[10px] text-red-500 ml-2 font-bold">{errors.classMode}</p>}
                          </div>

                          {details.classMode === "physical" && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-1"
                            >
                              <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
                                Hall Classes <span className="text-red-500 font-black">*</span>
                              </label>
                              <select
                                value={details.hallClass}
                                onChange={(e) => {
                                  setDetails((p) => ({ ...p, hallClass: e.target.value }));
                                  setErrors((p) => ({ ...p, hallClass: undefined }));
                                }}
                                className={`w-full p-4 rounded-2xl bg-slate-800 text-white text-sm outline-none transition-all ${
                                  errors.hallClass
                                    ? "border border-red-500"
                                    : "border border-white/10 focus:border-red-500"
                                }`}
                              >
                                <option value="">Select Hall City</option>
                                {hallClasses.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </select>
                              {errors.hallClass && (
                                <p className="text-[10px] text-red-500 ml-2 font-bold">{errors.hallClass}</p>
                              )}
                            </motion.div>
                          )}

                          <InputField
                            required
                            name="regAddress"
                            label="Address"
                            icon={<MapPin size={18} />}
                            value={details.address}
                            onChange={(e) => {
                              setDetails((p) => ({ ...p, address: e.target.value }));
                              setErrors((p) => ({ ...p, address: undefined }));
                            }}
                            error={errors.address}
                          />

                          {/* CHANGED: grid-cols-2 removed, changed to space-y-4 for vertical stacking */}
                          <div className="space-y-4">
                            <InputField
                              required
                              name="regPassword"
                              label="Password"
                              type={showPassword ? "text" : "password"}
                              icon={<Lock size={18} />}
                              rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              onRightIconClick={() => setShowPassword((p) => !p)}
                              value={details.password ?? ""}
                              onChange={(e) => {
                                setDetails((p) => ({ ...p, password: e.target.value }));
                                setErrors((p) => ({ ...p, password: undefined }));
                              }}
                              error={errors.password}
                              placeholder="Strong password"
                            />

                            <InputField
                              required
                              name="regConfirm"
                              label="Retype Password"
                              type={showConfirmPassword ? "text" : "password"}
                              icon={<Lock size={18} />}
                              rightIcon={
                                showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />
                              }
                              onRightIconClick={() => setShowConfirmPassword((p) => !p)}
                              value={details.confirmPassword ?? ""}
                              onChange={(e) => {
                                setDetails((p) => ({ ...p, confirmPassword: e.target.value }));
                                setErrors((p) => ({ ...p, confirmPassword: undefined }));
                              }}
                              error={errors.confirmPassword}
                              placeholder="Retype password"
                            />
                          </div>

                          {/* Strength UI */}
                          <div className="space-y-2 mt-1">
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${strengthColor}`}
                                style={{ width: `${pwMeta.percent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold ${strengthText}`}>
                                {pwMeta.label} Password
                              </p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                Score {pwMeta.score}/5
                              </p>
                            </div>

                            <div className="text-[10px] space-y-1">
                              <p className={pwMeta.hasMinLen ? "text-green-400" : "text-slate-500"}>
                                • Minimum 10 characters
                              </p>
                              <p className={pwMeta.hasUpper ? "text-green-400" : "text-slate-500"}>
                                • At least one uppercase letter
                              </p>
                              <p className={pwMeta.hasLower ? "text-green-400" : "text-slate-500"}>
                                • At least one lowercase letter
                              </p>
                              <p className={pwMeta.hasNum ? "text-green-400" : "text-slate-500"}>
                                • At least one number
                              </p>
                              <p className={pwMeta.hasSym ? "text-green-400" : "text-slate-500"}>
                                • At least one symbol
                              </p>
                            </div>

                            {pwMatch !== null && (
                              <p
                                className={`text-xs font-bold ${
                                  pwMatch ? "text-green-400" : "text-red-500"
                                }`}
                              >
                                {pwMatch ? "Passwords match" : "Passwords do not match"}
                              </p>
                            )}
                          </div>

                          {/* Batch */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-slate-500">
                              Batch{" "}
                              <span className="text-red-500 font-black" title="Required">
                                *
                              </span>
                            </label>
                            <select
                              value={details.batch}
                              onChange={(e) => {
                                setDetails((p) => ({ ...p, batch: e.target.value }));
                                setErrors((p) => ({ ...p, batch: undefined }));
                              }}
                              className={`w-full p-4 rounded-2xl bg-slate-800 text-white text-sm outline-none transition-all ${
                                errors.batch
                                  ? "border border-red-500"
                                  : "border border-white/10 focus:border-red-500"
                              }`}
                            >
                              <option value="">Select Batch</option>
                              {batchList.map((b) => (
                                <option key={b.id} value={b.name}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                            {errors.batch && (
                              <p className="text-[10px] text-red-500 ml-2 font-bold">
                                {errors.batch}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={handleRegister}
                            disabled={!registerReady}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase transition-all shadow-lg shadow-red-600/20 mt-2"
                          >
                            {loading ? (
                              <Loader2 className="animate-spin mx-auto" />
                            ) : (
                              "Complete Registration"
                            )}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT */}
        <div className="hidden md:flex w-5/12 bg-gradient-to-br from-red-700 to-red-900 items-center justify-center text-center p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          <div className="relative z-10">
            <h1 className="text-5xl font-black italic mb-6 uppercase drop-shadow-xl">
              {siteName}
            </h1>
            <p className="text-red-200 text-xs font-bold uppercase tracking-[0.3em] mb-10">
              Advanced Learning Platform - V2 TEST
            </p>
            <div className="w-24 h-1 bg-white/20 mx-auto rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

