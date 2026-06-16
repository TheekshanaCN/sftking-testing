'use client';
import { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { socket } from '@/lib/socket';
import { emitStudentActivity } from '@/lib/studentActivity';
import { Send, Headphones, X, Trash2, Loader2 } from 'lucide-react';
import ChatBubble from '@/components/shared/ChatBubble';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentHelp() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [adminId, setAdminId] = useState(null);
    const [isAdminOnline, setIsAdminOnline] = useState(false);
    
    const chatListRef = useRef(null);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (!user) return; 

        socket.emit('check_admin_status'); 
        socket.on('admin_status', (data) => setIsAdminOnline(data.online));
        
        const init = async () => {
            try {
                const aRes = await axios.get('/admin-id');
                if (aRes.data.id) {
                    setAdminId(aRes.data.id);
                    const mRes = await axios.get(`/messages/${aRes.data.id}`);
                    setMessages(mRes.data);
                    socket.emit('mark_read', { senderId: aRes.data.id, receiverId: user.id });
                }
            } catch(e) { 
                console.error("Chat Init Error:", e); 
            }
        };
        init();

        const handleReceive = (msg) => {
            setMessages(prev => {
                const map = new Map(prev.map(m => [m.id || `temp-${m.content}`, m]));
                if (msg.id) {
                    const tempKey = Array.from(map.keys()).find(k => k.toString().startsWith('temp-') && map.get(k).content === msg.content);
                    if (tempKey) map.delete(tempKey);
                    map.set(msg.id, msg);
                } else {
                    map.set(`temp-${msg.content}`, msg);
                }
                return Array.from(map.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            });
            isInitialLoad.current = false;
        };

        const handleDelete = ({ id }) => setMessages(p => p.filter(m => m.id !== id));
        const handleBulkDelete = ({ senderId, receiverId }) => {
            setMessages((prev) => prev.filter((m) => !(
                (m.senderId === senderId && m.receiverId === receiverId) ||
                (m.senderId === receiverId && m.receiverId === senderId)
            )));
        };
        
        socket.on('receive_message', handleReceive);
        socket.on('message_deleted', handleDelete);
        socket.on('message_deleted_bulk', handleBulkDelete);
        socket.on('message_updated', (upd) => setMessages(p => p.map(m => m.id === upd.id ? upd : m)));

        return () => { 
            socket.off('receive_message', handleReceive);
            socket.off('message_deleted', handleDelete); 
            socket.off('message_deleted_bulk', handleBulkDelete);
            socket.off('message_updated');
            socket.off('admin_status');
        };
    }, [user]);

    useEffect(() => { 
        if (chatListRef.current) {
            const { scrollHeight, clientHeight } = chatListRef.current;
            chatListRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: isInitialLoad.current ? "auto" : "smooth" 
            });
            if (messages.length > 0) isInitialLoad.current = false;
        }
    }, [messages]);

    const clearMyChat = async () => {
        if (!adminId) return;
        if (!confirm("Clear chat for YOU? Admin will still see messages.")) return;

        try {
            await axios.post('/messages/clear', { targetId: adminId });
            emitStudentActivity(socket, user, {
                page: 'Support Desk',
                action: 'Cleared Chat History',
                detail: 'Cleared own support thread',
                route: '/student/help',
                kind: 'support'
            });
            setMessages([]); 
        } catch (e) { alert("Error clearing chat"); }
    };

    const sendMessage = () => {
        if (!input.trim() || !adminId) return;
        
        const msgData = { 
            senderId: user.id, 
            receiverId: adminId, 
            content: input, 
            role: 'student', 
            replyToId: replyTo ? replyTo.id : null 
        };
        
        socket.emit('send_message', msgData);
        emitStudentActivity(socket, user, {
            page: 'Support Desk',
            action: 'Sent Support Message',
            detail: input.slice(0, 120),
            route: '/student/help',
            kind: 'chat'
        });
        
        setMessages(p => [...p, { ...msgData, createdAt: new Date(), id: `temp-${Date.now()}`, replyTo: replyTo }]);
        
        setInput(""); setReplyTo(null); isInitialLoad.current = false; 
    };

    return (
        // 🚀 Dark Mode: Main Background wrapper
        <div className="h-[calc(100vh-120px)] w-full flex justify-center bg-[#F8F9FA] dark:bg-slate-950 overflow-hidden p-1 transition-colors duration-300">
            
            {/* 🚀 Dark Mode: Chat Container Window */}
            <div className="w-full max-w-2xl h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] shadow-lg overflow-hidden relative transition-colors duration-300">
                
                {/* HEADER */}
                {/* 🚀 Dark Mode: Header bg and border */}
                <div className="h-16 px-6 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 z-30 relative shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-red-600 text-white rounded-full shadow-md flex items-center justify-center">
                            <Headphones size={20} />
                        </div>
                        <div className="flex flex-col justify-center">
                            {/* 🚀 Dark Mode: Title text */}
                            <h2 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-wide leading-none mb-1 transition-colors">Support Desk</h2>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isAdminOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest leading-none transition-colors ${isAdminOnline ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {isAdminOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CLEAR BUTTON */}
                    {/* 🚀 Dark Mode: Clear button hover */}
                    <button onClick={clearMyChat} className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 transition-colors rounded-lg">
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* MESSAGES LIST */}
                {/* 🚀 Dark Mode: Chat background */}
                <div 
                    ref={chatListRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA] dark:bg-slate-950/50 custom-scrollbar min-h-0 transition-colors duration-300"
                >
                    {messages.map((m, idx) => (
                        <div key={m.id || `${m.senderId}-${m.receiverId}-${new Date(m.createdAt).getTime()}-${idx}`} className="relative">
                            <ChatBubble msg={m} isMe={m.senderId === user.id} onReply={setReplyTo} />
                        </div>
                    ))}
                </div>

                {/* INPUT AREA */}
                {/* 🚀 Dark Mode: Input wrapper background */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 shrink-0 z-30 relative transition-colors duration-300">
                    {replyTo && (
                        // 🚀 Dark Mode: Reply Toast
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 px-3 rounded-lg mb-2 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                            <span className="truncate font-medium">Replying: {replyTo.content}</span>
                            <button onClick={() => setReplyTo(null)} className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-1 transition-colors"><X size={12}/></button>
                        </div>
                    )}
                    <div className="flex gap-3 items-center">
                        {/* 🚀 Dark Mode: Input Field */}
                        <input 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && sendMessage()} 
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 transition-all w-full shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                            placeholder="Type your message..." 
                        />
                        <button 
                            onClick={sendMessage} 
                            className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg hover:shadow-red-200 dark:hover:shadow-red-900/50 active:scale-95 shrink-0 transition-all"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}