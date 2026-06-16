'use client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import axios from '@/lib/axios';
import { socket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import ChatBubble from '@/components/shared/ChatBubble'; 
import { Search, Send, X, User as UserIcon, Loader2, ChevronLeft, CornerDownRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';

export default function AdminSupportPage() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [reply, setReply] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const searchParams = useSearchParams(); 

    const chatContainerRef = useRef(null);
    const isAutoScrollRef = useRef(false); 
    const activeChatRef = useRef(null);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    useEffect(() => {
        if (!user) return;

        const fetchConvos = async () => {
            try {
                const res = await axios.get('/admin/conversations');
                setConversations(res.data);
                setLoading(false);

                const studentId = searchParams.get('studentId');
                if (studentId) {
                    const targetConvo = res.data.find(c => String(c.student.id) === studentId);
                    if (targetConvo) {
                        openChat(targetConvo);
                    } else {
                        try {
                            const studentRes = await axios.get(`/admin/student/${studentId}`);
                            const student = studentRes.data?.student;
                            if (student) {
                                const freshConvo = {
                                    student,
                                    lastMessage: '',
                                    time: new Date().toISOString(),
                                    unread: 0
                                };
                                setConversations((prev) => [freshConvo, ...prev]);
                                openChat(freshConvo);
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };

        fetchConvos();

        socket.emit('i_am_here', { userId: user.id, role: 'admin' });

        const handleMessage = (msg) => {
            setMessages((prev) => {
                const active = activeChatRef.current;
                const isForCurrentChat = active && (msg.senderId === active.student.id || msg.receiverId === active.student.id);
                if (!isForCurrentChat) return prev;
                
                if (prev.some(m => m.id === msg.id)) return prev;

                const tempIndex = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('temp-') && m.content === msg.content && m.senderId === msg.senderId);
                if (tempIndex !== -1) {
                    const newArr = [...prev];
                    newArr[tempIndex] = msg;
                    return newArr;
                }
                isAutoScrollRef.current = true;
                return [...prev, msg];
            });

            setConversations((prev) => {
                const otherId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
                const existingIndex = prev.findIndex(c => c.student.id === otherId);
                
                let newConvoList = [...prev];
                if (existingIndex > -1) {
                    const updated = { 
                        ...newConvoList[existingIndex], 
                        lastMessage: msg.content, 
                        time: msg.createdAt, 
                        unread: msg.senderId === user.id ? 0 : newConvoList[existingIndex].unread + 1
                    };
                    newConvoList.splice(existingIndex, 1);
                    newConvoList.unshift(updated);
                } else {
                    fetchConvos(); 
                }
                return newConvoList;
            });
        };

        const handleDelete = ({ id }) => setMessages(p => p.filter(m => m.id !== id));
        
        const handleBulkDelete = ({ senderId, receiverId }) => {
            if (activeChatRef.current) {
                setMessages(prev => prev.filter(m => !(
                    (m.senderId === senderId && m.receiverId === receiverId) ||
                    (m.senderId === receiverId && m.receiverId === senderId)
                )));
            }
        };

        const handleUpdated = (updated) => {
            setMessages((prev) => prev.map((item) => item.id === updated.id ? updated : item));
        };

        socket.on('receive_message', handleMessage);
        socket.on('message_deleted', handleDelete);
        socket.on('message_deleted_bulk', handleBulkDelete);
        socket.on('message_updated', handleUpdated);

        return () => { 
            socket.off('receive_message', handleMessage);
            socket.off('message_deleted', handleDelete);
            socket.off('message_deleted_bulk', handleBulkDelete);
            socket.off('message_updated', handleUpdated);
        };
    }, [user, searchParams]);

    useLayoutEffect(() => {
        if (!chatContainerRef.current) return;
        const container = chatContainerRef.current;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (isAutoScrollRef.current || isNearBottom) {
            container.scrollTop = scrollHeight;
            isAutoScrollRef.current = false;
        }
    }, [messages, reply]);

    const openChat = async (convo) => {
        setActiveChat(convo);
        setReply(null); 
        setConversations(prev => prev.map(c => c.student.id === convo.student.id ? { ...c, unread: 0 } : c));

        try {
            const res = await axios.get(`/messages/${convo.student.id}`);
            setMessages(res.data);
            isAutoScrollRef.current = true;
            socket.emit('mark_read', { senderId: convo.student.id, receiverId: user.id });
        } catch (e) { console.error(e); }
    };

    const clearMyChat = async () => {
        if (!activeChat) return;
        if (!confirm("Clear chat? This only removes messages for YOU.")) return;

        try {
            await axios.post('/messages/clear', { targetId: activeChat.student.id });
            
            setMessages([]);

            setConversations(prev => prev.map(c => 
                c.student.id === activeChat.student.id 
                ? { ...c, lastMessage: 'Chat cleared', time: new Date().toISOString() } 
                : c
            ));
            
        } catch (e) { alert("Failed to clear chat"); }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !activeChat) return;
        setSending(true);

        const payload = {
            senderId: user.id,
            receiverId: activeChat.student.id,
            content: input,
            role: 'admin',
            replyToId: reply ? reply.id : null 
        };

        try {
            socket.emit('send_message', payload);
            const tempMsg = { 
                ...payload, 
                createdAt: new Date().toISOString(), 
                id: `temp-${Date.now()}`, 
                replyTo: reply 
            };
            isAutoScrollRef.current = true; 
            setMessages(p => [...p, tempMsg]);
            setInput('');
            setReply(null); 
        } catch (error) {
            alert('Failed to send');
        } finally {
            setSending(false);
        }
    };

    const filteredConversations = conversations.filter((item) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        const name = String(item?.student?.name || '').toLowerCase();
        const mobile = String(item?.student?.mobile || '').toLowerCase();
        const last = String(item?.lastMessage || '').toLowerCase();
        return name.includes(q) || mobile.includes(q) || last.includes(q);
    });

    return (
        <div className="flex h-[calc(100vh-100px)] w-full p-4 md:p-6 bg-[#F8F9FA] dark:bg-transparent justify-center overflow-hidden transition-colors duration-300">
            <div className="w-full max-w-7xl bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-2xl border border-slate-200 dark:border-white/10 flex transition-colors duration-300">
                
                {/* --- INBOX --- */}
                <div className={`w-full md:w-80 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-white/5 flex flex-col transition-colors duration-300 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-5 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 transition-colors duration-300">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase italic tracking-tighter mb-4">Inbox</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors" size={16} />
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search students..." 
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-red-500/20 dark:focus:ring-red-500/50 outline-none transition-all" 
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {loading ? (
                            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-red-500" /></div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="text-center p-8 opacity-50">
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">No conversations</p>
                            </div>
                        ) : (
                            filteredConversations.map((c) => (
                                <div 
                                    key={c.student.id} 
                                    onClick={() => openChat(c)}
                                    className={`p-3 rounded-xl cursor-pointer transition-all border border-transparent group ${
                                        activeChat?.student.id === c.student.id 
                                        ? 'bg-white dark:bg-slate-800 shadow-md dark:shadow-none border-slate-100 dark:border-white/5' 
                                        : 'hover:bg-white dark:hover:bg-slate-800/50 hover:shadow-sm dark:hover:shadow-none'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold text-sm transition-colors ${
                                            activeChat?.student.id === c.student.id 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {c.student.name}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                            {new Date(c.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px] font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                                            {c.lastMessage || 'No messages yet'}
                                        </p>
                                        {c.unread > 0 && (
                                            <span className="bg-red-600 dark:bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                                                {c.unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* --- CHAT --- */}
                <div className={`flex-1 flex flex-col bg-white dark:bg-slate-900 transition-colors duration-300 ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                    {activeChat ? (
                        <>
                            <div className="h-16 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-6 bg-white dark:bg-slate-900 shrink-0 shadow-sm dark:shadow-none z-10 transition-colors duration-300">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-colors">
                                        <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border border-slate-100 dark:border-slate-600 shadow-inner transition-colors duration-300">
                                        <UserIcon className="text-slate-400 dark:text-slate-300" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-wide transition-colors duration-300">
                                            {activeChat.student.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest transition-colors duration-300">
                                            Mobile: {activeChat.student.mobile || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={clearMyChat} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-all border border-slate-100 dark:border-transparent hover:border-red-100 dark:hover:border-red-500/20" title="Clear chat for me">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#FAFAFA] dark:bg-[#0A0F1C] space-y-1 custom-scrollbar transition-colors duration-300">
                                {messages.map((msg, i) => (
                                    <ChatBubble key={msg.id || i} msg={msg} isMe={msg.senderId === user.id} onReply={(m) => setReply(m)} />
                                ))}
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 relative z-20 transition-colors duration-300">
                                <AnimatePresence>
                                    {reply && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-4 right-4 mb-2 bg-white/80 dark:bg-slate-800/90 backdrop-blur-md border-l-4 border-red-500 rounded-lg p-3 shadow-lg flex justify-between items-center z-10 border border-slate-200/50 dark:border-white/10 transition-colors duration-300">
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-0.5">
                                                    Replying to {reply.senderId === user.id ? "Yourself" : activeChat.student.name}
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{reply.content}</p>
                                            </div>
                                            <button onClick={() => setReply(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                                <X size={16} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"/>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <form onSubmit={sendMessage} className="flex gap-3 relative z-20">
                                    <input 
                                        type="text" 
                                        value={input} 
                                        onChange={(e) => setInput(e.target.value)} 
                                        placeholder={reply ? "Type your reply..." : "Type message..."} 
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-medium rounded-xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-red-500/10 dark:focus:ring-red-500/20 focus:border-red-500 dark:focus:border-red-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner dark:shadow-none" 
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={sending || !input.trim()} 
                                        className="bg-slate-900 dark:bg-white hover:bg-red-600 dark:hover:bg-red-500 text-white dark:text-slate-900 dark:hover:text-white p-3.5 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-slate-900 dark:disabled:hover:bg-white shadow-lg hover:shadow-red-500/20 active:scale-95 flex items-center justify-center"
                                    >
                                        {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-60 transition-colors duration-300">
                            <CornerDownRight size={64} className="mb-4 text-slate-200 dark:text-slate-800 transition-colors" />
                            <p className="font-black uppercase tracking-widest text-sm text-slate-400 dark:text-slate-600">Select a conversation to start</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}