"use client";
import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import { useSocket } from "@/context/SocketContext";
import { socket } from "@/lib/socket";
import {
  Search,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Eye,
  EyeOff,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { MessageSquare, MapPin } from "lucide-react";

export default function StudentList() {
  const { onlineCount } = useSocket();
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [hallClasses, setHallClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [classModeFilter, setClassModeFilter] = useState("");
  const [hallClassFilter, setHallClassFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [revealedIds, setRevealedIds] = useState({});
  const [loadingPasswords, setLoadingPasswords] = useState({});
  const [resettingIdentityFields, setResettingIdentityFields] = useState(false);

  const load = async () => {
    try {
      const [sRes, bRes, hRes] = await Promise.all([
        axios.get("/admin/students", {
          params: { search, batch: batchFilter, classMode: classModeFilter, hallClass: hallClassFilter },
        }),
        axios.get("/batches"),
        axios.get("/hall-classes"),
      ]);
      setStudents(sRes.data);
      setBatches(bRes.data);
      setHallClasses(hRes.data || []);
      setLoading(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, [search, batchFilter, classModeFilter, hallClassFilter, onlineCount]);

  useEffect(() => {
    const handleRefresh = () => load();
    
    socket.on("student_list_updated", handleRefresh);
    socket.on("force_logout", handleRefresh);

    return () => {
      socket.off("student_list_updated", handleRefresh);
      socket.off("force_logout", handleRefresh);
    };
  }, []);

  const togglePassword = async (id) => {
    if (revealedIds[id]) {
      const newIds = { ...revealedIds };
      delete newIds[id];
      setRevealedIds(newIds);
      return;
    }

    setLoadingPasswords((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await axios.post("/admin/reveal-password", { userId: id });
      setRevealedIds((prev) => ({ ...prev, [id]: res.data.password }));
    } catch (e) {
      alert("Security Error: Could not decrypt password.");
    } finally {
      setLoadingPasswords((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus === "active" ? "BAN" : "ACTIVATE"} this user?`)) return;
    await axios.post("/admin/students/toggle-status", { id, currentStatus });
    load();
  };

  const deleteUser = async (id) => {
    if (!confirm("PERMANENTLY DELETE? This cannot be undone.")) return;

    setStudents((prev) => prev.filter((s) => s.id !== id));

    try {
      await axios.delete(`/admin/students/${id}`);
    } catch (e) {
      alert("Failed to delete user.");
      load(); 
    }
  };

  const resetStudentIdentityFields = async () => {
    if (!confirm("Clear email and NIC from ALL student accounts? Accounts will stay intact, but email/NIC popups will show again.")) return;

    setResettingIdentityFields(true);
    try {
      const res = await axios.post("/admin/reset-student-email-nic");
      alert(res.data?.message || "Student identity fields reset.");
      load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to reset student identity fields.");
    } finally {
      setResettingIdentityFields(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden font-sans min-h-[600px] flex flex-col transition-colors duration-300">
      {/* Toolbar */}
      <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full md:w-64 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-red-500 dark:group-focus-within:text-red-500 transition-colors"
              size={16}
            />
            <input
              className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl outline-none text-sm font-bold w-full focus:ring-2 ring-red-500/10 dark:focus:border-red-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all shadow-sm"
              placeholder="Search Name or Mobile..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative w-full md:w-48">
            <Filter
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={16}
            />
            <select
              className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold w-full outline-none shadow-sm appearance-none cursor-pointer text-slate-900 dark:text-white transition-colors duration-300"
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full md:w-44">
            <select
              className="pl-4 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold w-full outline-none shadow-sm appearance-none cursor-pointer text-slate-900 dark:text-white transition-colors duration-300"
              onChange={(e) => {
                setClassModeFilter(e.target.value);
                setHallClassFilter(""); // Reset city filter when mode changes
              }}
            >
              <option value="">All Modes</option>
              <option value="online">Online</option>
              <option value="physical">Physical</option>
            </select>
          </div>

          {classModeFilter === "physical" && (
            <div className="relative w-full md:w-52 animate-in fade-in duration-200">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500"
                size={16}
              />
              <select
                className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-2xl text-sm font-bold w-full outline-none shadow-sm appearance-none cursor-pointer text-slate-900 dark:text-white transition-colors duration-300"
                value={hallClassFilter}
                onChange={(e) => setHallClassFilter(e.target.value)}
              >
                <option value="">All Cities</option>
                {hallClasses.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>

        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm transition-colors duration-300">
          {students.length} Students Found
        </div>

        <button
          type="button"
          onClick={resetStudentIdentityFields}
          disabled={resettingIdentityFields}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider shadow-lg transition-colors"
        >
          {resettingIdentityFields ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <RefreshCcw size={14} />
          )}
          Reset Email + NIC
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/80 border-b border-slate-100 dark:border-white/5 tracking-widest transition-colors duration-300">
              <th className="px-8 py-5 text-left pl-10">Identity</th>
              <th className="px-8 py-5 text-left">Location</th>
              <th className="px-8 py-5 text-left">Student ID</th>
              <th className="px-8 py-5 text-left">NIC</th>
              <th className="px-8 py-5 text-left">Email</th>
              <th className="px-8 py-5 text-left">Batch</th>
              <th className="px-8 py-5 text-left text-red-500 dark:text-red-400 italic">
                Access Key
              </th>
              <th className="px-8 py-5 text-center">Status</th>
              <th className="px-8 py-5 text-center">Actions</th>
              <th className="px-8 py-5 text-center">Register Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-bold text-slate-700 dark:text-slate-300 transition-colors duration-300">
            {loading ? (
              <tr>
                <td
                  colSpan="10"
                  className="text-center py-20 text-slate-400 dark:text-slate-500 animate-pulse"
                >
                  Loading Database...
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors group ${s.status === "deactivated" ? "opacity-50 grayscale" : ""}`}
                >
                  <td className="px-8 py-5 pl-10">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-3 h-3 rounded-full shadow-sm ${s.isOnline ? "bg-green-500 online-glow" : "bg-slate-300 dark:bg-slate-700"}`}
                      ></div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white leading-none group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {s.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black mt-1 italic tracking-widest transition-colors">
                          {s.mobile}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-8 py-5">
                    <div
                      className="max-w-[150px] truncate text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 transition-colors"
                      title={s.address}
                    >
                      <MapPin size={12} className="shrink-0 text-slate-300 dark:text-slate-600" />
                      {s.address || "Unknown"}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
                      {s.classMode === "physical" ? `Physical • ${s.hallClass || "N/A"}` : "Online"}
                    </p>
                  </td>

                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-emerald-100 dark:border-emerald-900/40 transition-colors">
                      {s.studentCode || "Pending"}
                    </span>
                  </td>

                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-amber-100 dark:border-amber-900/40 transition-colors">
                      {s.nic || "Not set"}
                    </span>
                  </td>

                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-indigo-100 dark:border-indigo-900/40 transition-colors truncate max-w-[180px]" title={s.email || "Not set"}>
                      {s.email || "Not set"}
                    </span>
                  </td>

                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                      {s.batch}
                    </span>
                  </td>

                  {/* SECURE PASSWORD COLUMN */}
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl w-fit border border-slate-100 dark:border-white/5 transition-colors">
                      <span className="font-mono text-red-600 dark:text-red-400 font-bold text-xs min-w-[80px] transition-colors">
                        {loadingPasswords[s.id] ? (
                          <Loader2
                            size={14}
                            className="animate-spin text-slate-400"
                          />
                        ) : (
                          revealedIds[s.id] || "••••••••"
                        )}
                      </span>
                      <button
                        onClick={() => togglePassword(s.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-lg transition-all"
                        title={
                          revealedIds[s.id]
                            ? "Hide Password"
                            : "Reveal Password"
                        }
                      >
                        {revealedIds[s.id] ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                  </td>

                  <td className="px-8 py-5 text-center">
                    {s.status === "active" ? (
                      <span className="text-[10px] font-black text-green-600 dark:text-green-500 uppercase bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded transition-colors">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-red-600 dark:text-red-500 uppercase bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded transition-colors">
                        Banned
                      </span>
                    )}
                  </td>

                  {/* COMBINED ACTIONS COLUMN */}
                  <td className="px-8 py-5">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() =>
                          (window.location.href = `/admin/support?studentId=${s.id}`)
                        }
                        className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all shadow-sm active:scale-95"
                        title="Message Student"
                      >
                        <MessageSquare size={16} />
                      </button>

                      <button
                        onClick={() => toggleStatus(s.id, s.status)}
                        className={`p-2 rounded-xl transition-all shadow-sm active:scale-95 ${
                          s.status === "active"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400"
                            : "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-600 dark:hover:bg-green-600 hover:text-white dark:hover:text-white"
                        }`}
                        title={
                          s.status === "active"
                            ? "Deactivate User"
                            : "Activate User"
                        }
                      >
                        {s.status === "active" ? (
                          <ShieldAlert size={16} />
                        ) : (
                          <ShieldCheck size={16} />
                        )}
                      </button>

                      <button
                        onClick={() => deleteUser(s.id)}
                        className="p-2 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 text-red-400 dark:text-red-500 rounded-xl hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white transition-all shadow-sm active:scale-95"
                        title="Delete Permanently"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>

                  <td className="px-8 py-5">
                    <div
                      className="max-w-[150px] truncate text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 transition-colors"
                      title={new Date(s.createdAt).toLocaleString("en-GB")}
                    >
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Unknown"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}