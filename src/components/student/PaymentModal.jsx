"use client";
import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { Lock, UploadCloud, X, Building2, Copy, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { emitStudentActivity } from "@/lib/studentActivity";
import { socket } from "@/lib/socket";

export default function PaymentModal({ item, user, onClose, onSuccess }) {
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const MAX_SLIP_MB = 5;
  const MAX_SLIP_BYTES = MAX_SLIP_MB * 1024 * 1024;

  const [slipError, setSlipError] = useState("");

  // NEW: State for dynamic bank details
  const [bankInfo, setBankInfo] = useState({
    bankName: "Loading...", // NEW
    accNum: "Loading...",
    accName: "Loading...",
    branch: "Loading...",
  });

  useEffect(() => {
    const fetchBankDetails = async () => {
      try {
        const res = await axios.get("/config/bank-details");
        if (res.data) setBankInfo(res.data);
      } catch (e) {
        setBankInfo({
          bankName: "Bank of Ceylon",
          accNum: "123456789",
          accName: "MIS Holding (Pvt)Ltd",
          branch: "Monaragala",
        });
      }
    };
    fetchBankDetails();
  }, []);

  // DATA LOGIC
  let targetName = "Unknown Item";
  let targetPrice = "0";
  let targetId = null;
  let targetMonth = "";
  let isFolderPayment = false;

  if (item) {
    if (item.title && item.isSeparate) {
      targetName = item.title;
      targetPrice = item.price;
      targetId = item.id;
      targetMonth = item.month || "";
      isFolderPayment = false;
    } else if (item.title && item.lesson) {
      targetName = item.lesson.name;
      targetPrice = item.lesson.price;
      targetId = item.lesson.id;
      targetMonth = item.lesson.month || "";
      isFolderPayment = true;
    } else if (item.name || item.lesson) {
      const l = item.lesson || item;
      targetName = l.name;
      targetPrice = l.price;
      targetId = l.id;
      targetMonth = l.month || "";
      isFolderPayment = true;
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("Copied: " + text);
  };

  const handleRequest = async () => {
    // Enforce slip validation immediately since Online is the only option
    if (!slip) return alert("Please select your bank slip image.");
    if (!targetId) return alert("System Error: Target ID missing.");

    setLoading(true);
    const fd = new FormData();
    fd.append("slip", slip);
    fd.append("studentId", user.id);

    if (isFolderPayment) fd.append("lessonId", targetId);
    else fd.append("contentId", targetId);

    // Hardcoded to online since cash option is removed
    fd.append("type", "online");

    try {
      await axios.post("/student/request", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      emitStudentActivity(socket, user, {
        page: 'Payment Request',
        action: 'Submitted Access Request',
        detail: `${targetName} (${isFolderPayment ? 'folder' : 'content'})`,
        route: '/student/request',
        kind: 'request',
        contentId: targetId
      });
      alert("Request Sent! Wait for approval.");
      onSuccess();
    } catch (e) {
      alert("Request Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSlipChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSlip(null);
      setSlipError("Only image files are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SLIP_BYTES) {
      setSlip(null);
      setSlipError(`File is too large. Max ${MAX_SLIP_MB}MB allowed.`);
      e.target.value = "";
      return;
    }

    setSlipError("");
    setSlip(file);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[35px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden border border-slate-200/70 dark:border-white/10 transition-colors duration-300"
      >
        {/* Fixed Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 flex justify-between items-center text-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
              <Building2 size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-black uppercase italic tracking-wider">
                Bank Details
              </h3>
              <p className="text-[10px] text-red-100 opacity-80 font-bold uppercase tracking-widest">
                For Transfers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="mb-6 text-center">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase italic mb-1 tracking-tighter leading-tight transition-colors duration-300">
              {targetName}
            </h3>
            <div className="inline-block px-4 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase tracking-widest border border-red-100 dark:border-red-500/20 transition-colors duration-300">
              Fee: LKR {targetPrice || "0"}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-bold uppercase tracking-wide transition-colors duration-300">
              {isFolderPayment
                ? "Full Access Payment"
                : "Separate Video Access"}
            </p>
          </div>

          <div className="space-y-3 text-left mb-6">
            {/* BANK NAME */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/30 transition-colors duration-300">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1 transition-colors duration-300">
                  Bank Name
                </p>
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 transition-colors duration-300">
                  {bankInfo.bankName}
                </p>
              </div>
            </div>

            {/* Account Number */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/30 transition-colors duration-300">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1 transition-colors duration-300">
                  Account Number
                </p>
                <p className="text-xl font-mono font-black text-slate-800 dark:text-slate-100 tracking-wider transition-colors duration-300">
                  {bankInfo.accNum}
                </p>
              </div>
              <button
                onClick={() => handleCopy(bankInfo.accNum)}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/70 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all border border-slate-100 dark:border-white/10"
              >
                <Copy size={18} />
              </button>
            </div>

            {/* Account Holder */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-sm group hover:border-red-200 dark:hover:border-red-500/30 transition-colors duration-300">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1 transition-colors duration-300">
                  Account Holder
                </p>
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 transition-colors duration-300">
                  {bankInfo.accName}
                </p>
              </div>
              <button
                onClick={() => handleCopy(bankInfo.accName)}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/70 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all border border-slate-100 dark:border-white/10"
              >
                <Copy size={18} />
              </button>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-3 px-2 py-2 bg-red-50/50 dark:bg-red-500/10 rounded-xl border border-red-100/50 dark:border-red-500/20 transition-colors duration-300">
              <MapPin size={18} className="text-red-500" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors duration-300">
                <span className="uppercase text-[10px] text-slate-400 dark:text-slate-500 mr-2 tracking-widest transition-colors duration-300">
                  Branch:
                </span>{" "}
                {bankInfo.branch}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-red-200 dark:hover:border-red-500/30 transition-colors group cursor-pointer relative duration-300">
              <label className="flex items-center gap-3 w-full cursor-pointer justify-center">
                <UploadCloud size={20} className="text-red-500" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors duration-300">
                  {slip ? "Slip Selected" : "Upload Bank Slip"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>

            {slipError && (
              <p className="text-[11px] font-bold text-red-600 text-center">
                {slipError}
              </p>
            )}

            <button
              onClick={handleRequest}
              disabled={loading || !slip}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-lg uppercase text-xs active:scale-95 disabled:opacity-50 transition-all"
            >
              {loading ? "Processing..." : "Submit Payment"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
