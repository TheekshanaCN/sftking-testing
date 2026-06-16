'use client';
import { useState, useRef, useEffect } from 'react';
import { Trash2, Edit2, Reply, Copy, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from '@/lib/axios';

export default function ChatBubble({ msg, isMe, onReply }) {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(msg.content);
    const [editContent, setEditContent] = useState(msg.content);
    const [isDeleted, setIsDeleted] = useState(false);
    
    const menuRef = useRef(null);

    // --- CLICK OUTSIDE & SCROLL HANDLERS ---
    useEffect(() => {
        setContent(msg.content);
        setEditContent(msg.content);
    }, [msg.content]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
        };
        const handleScroll = () => setShowMenu(false);

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, []);

    // --- SCROLL TO ORIGINAL MESSAGE LOGIC (UPDATED: SCROLL THEN GLOW) ---
    const scrollToOriginal = () => {
        if (!msg.replyTo?.id) return;
        
        const targetId = `msg-${msg.replyTo.id}`;
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                targetElement.classList.remove('flash-active');
                void targetElement.offsetWidth; 
                targetElement.classList.add('flash-active');
                
                setTimeout(() => {
                    targetElement.classList.remove('flash-active');
                }, 1000);
            }, 600);
        }
    };

    // --- ACTIONS ---
    const handleDelete = async () => {
        if(!confirm("Delete this message?")) return;
        try { 
            await axios.post('/messages/delete', { messageId: msg.id }); 
            setIsDeleted(true); 
        } catch(e) { alert("Failed to delete"); }
        setShowMenu(false);
    };

    const handleEdit = async () => {
        if (!editContent.trim()) return;
        try { 
            await axios.post('/messages/edit', { messageId: msg.id, newContent: editContent }); 
            setIsEditing(false); 
            setContent(editContent.trim());
        } catch(e) { alert("Failed to edit"); }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setShowMenu(false);
    };

    const handleRightClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        let x = e.clientX;
        let y = e.clientY;
        
        if (window.innerWidth - x < 160) x = window.innerWidth - 170;
        if (window.innerHeight - y < 200) y = window.innerHeight - 210;

        setMenuPos({ x, y });
        setShowMenu(true);
    };

    if (isDeleted) return null;

    const replyName = msg.replyTo?.sender?.name || (msg.replyTo?.role === 'admin' ? "Admin" : "Student");

    return (
        <>
            <style jsx global>{`
                /* 🚀 Dark Mode compatible glow animation */
                @keyframes flashGray {
                    0% { filter: brightness(1); transform: scale(1); }
                    20% { filter: brightness(1.2); transform: scale(1.02); }
                    100% { filter: brightness(1); transform: scale(1); }
                }
                .flash-active .bubble-card {
                    animation: flashGray 1s ease-out forwards;
                    box-shadow: 0 0 15px rgba(255,255,255,0.1);
                }
            `}</style>

            <motion.div 
                id={`msg-${msg.id}`} 
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex w-full mb-3 px-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                onContextMenu={handleRightClick}
            >
                <div className={`relative max-w-[85%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* --- CONTEXT MENU --- */}
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div 
                                ref={menuRef}
                                initial={{ opacity: 0, scale: 0.9, y: -10 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.9 }}
                                // 🚀 Dark Mode: Menu Background
                                className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 w-40 flex flex-col transition-colors"
                                style={{ top: menuPos.y, left: menuPos.x }}
                            >
                                <button onClick={() => { onReply(msg); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                                    <Reply size={14} className="text-slate-500 dark:text-slate-400" /> Reply
                                </button>
                                <button onClick={handleCopy} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                                    <Copy size={14} className="text-slate-500 dark:text-slate-400" /> Copy
                                </button>
                                {isMe && (
                                    <>
                                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2 transition-colors"></div>
                                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                                            <Edit2 size={14} className="text-slate-500 dark:text-slate-400" /> Edit
                                        </button>
                                        <button onClick={handleDelete} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left">
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* --- BUBBLE CONTAINER --- */}
                    <div className={`
                        bubble-card relative px-3 py-2 shadow-sm text-[14px] leading-relaxed break-words min-w-[120px] transition-all duration-300 border
                        ${isMe 
                            // 🚀 Dark Mode: Sent Message (WhatsApp Dark Green)
                            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] border-[#d9fdd3] dark:border-[#005c4b] text-gray-900 dark:text-white rounded-l-2xl rounded-tr-md rounded-br-2xl' 
                            // 🚀 Dark Mode: Received Message (WhatsApp Dark Slate)
                            : 'bg-white dark:bg-[#202c33] border-slate-200 dark:border-[#202c33] text-gray-900 dark:text-white rounded-r-2xl rounded-tl-md rounded-bl-2xl'
                        }
                    `}>
                        {/* --- REPLY BOX --- */}
                        {msg.replyTo && (
                            <div 
                                onClick={scrollToOriginal}
                                className={`
                                    mb-1.5 p-2 rounded-[6px] cursor-pointer flex flex-col border-l-[4px]
                                    active:scale-[0.98] transition-all select-none
                                    ${isMe 
                                        ? 'bg-black/5 dark:bg-black/20 hover:bg-black/10 dark:hover:bg-black/30 border-green-600 dark:border-green-400' 
                                        : 'bg-black/5 dark:bg-black/20 hover:bg-black/10 dark:hover:bg-black/30 border-purple-500 dark:border-purple-400'
                                    }
                                `}
                            >
                                <p className={`text-[11px] font-bold mb-0.5 ${isMe ? 'text-green-800 dark:text-green-400' : 'text-purple-700 dark:text-purple-400'}`}>
                                    {replyName}
                                </p>
                                <p className={`text-[11px] line-clamp-1 opacity-80 ${isMe ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                                    {msg.replyTo.content}
                                </p>
                            </div>
                        )}

                        {/* CONTENT / EDIT */}
                        {isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[220px] pt-1">
                                <textarea 
                                    value={editContent} 
                                    onChange={e => setEditContent(e.target.value)} 
                                    className="bg-white/50 dark:bg-black/20 text-slate-800 dark:text-white p-2 rounded-md text-sm outline-none border border-black/10 dark:border-white/10 resize-none h-16 w-full focus:ring-2 focus:ring-green-500/20"
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-300"><X size={16}/></button>
                                    <button onClick={handleEdit} className="p-1 bg-green-500 dark:bg-green-600 text-white rounded-full shadow-md"><Check size={16}/></button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col min-w-[80px]">
                                <span className="pr-1 whitespace-pre-wrap">{content}</span>
                                <span className={`text-[10px] select-none self-end block mt-0.5 ${isMe ? 'text-gray-500/80 dark:text-white/60' : 'text-gray-500/80 dark:text-white/60'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}
                                </span>
                            </div>
                        )}

                        {/* TAIL SVG */}
                        {isMe ? (
                            // 🚀 Dark Mode: Tail colors sync with bubble
                            <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -right-[8px] fill-[#d9fdd3] dark:fill-[#005c4b] transition-colors duration-300">
                                <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"></path>
                            </svg>
                        ) : (
                            <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -left-[8px] fill-white dark:fill-[#202c33] filter drop-shadow-sm transition-colors duration-300">
                                <path d="M-2.288 1h6.212v11.193l-6.467-8.625C-3.95 2.156-3.382 1-1.612 1z" transform="scale(-1, 1) translate(-8, 0)"></path>
                            </svg>
                        )}
                    </div>
                </div>
            </motion.div>
        </>
    );
}