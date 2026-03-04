import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, AlertCircle, ArrowRight, ExternalLink, FileText, GraduationCap, Shield, Mic, Volume2 } from 'lucide-react';
import axios from 'axios';

const VAULT_KEY = 'jan_sahayak_vault';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_URL = `${API_BASE}/api/chat`;

// Helper to get or create a persistent session ID for guest users
function getOrCreateSessionId() {
    let sessionId = localStorage.getItem('guest_session_id');
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('guest_session_id', sessionId);
    }
    return sessionId;
}

// Helper to get auth headers
function getAuthHeaders() {
    const headers = {
        'X-Session-Id': getOrCreateSessionId()
    };
    const token = localStorage.getItem('id_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="typing-dot w-1.5 h-1.5 rounded-full"></div>
            <div className="typing-dot w-1.5 h-1.5 rounded-full"></div>
            <div className="typing-dot w-1.5 h-1.5 rounded-full"></div>
        </div>
    );
}

function MessageBubble({ message }) {
    const isUser = message.role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full mb-6`}
        >
            <div className={`flex items-start gap-4 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
            ${isUser ? 'bg-gray-900 text-white' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}
        `}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble Content */}
                <div className={`
          rounded-2xl
          ${isUser
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }
        `}>
                    <div className="px-5 py-3.5">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    </div>

                    {!isUser && message.audio_base64 && (
                        <div className="px-5 pb-3">
                            <button
                                onClick={() => new Audio(`data:audio/mp3;base64,${message.audio_base64}`).play()}
                                className="flex items-center gap-2 text-[12px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors w-fit border border-emerald-100"
                            >
                                <Volume2 className="w-4 h-4" />
                                Listen
                            </button>
                        </div>
                    )}

                    {!isUser && message.missing_docs && message.missing_docs.length > 0 && (
                        <div className="px-5 py-3 bg-red-50/50 border-t border-red-100 rounded-b-2xl">
                            <div className="flex items-center gap-1.5 mb-2">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                <span className="text-[12px] font-bold text-red-700 uppercase tracking-wide">Missing Documents</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {message.missing_docs.map((doc) => (
                                    <span key={doc} className="text-[11px] bg-white text-red-700 px-2 py-1 rounded border border-red-200 font-semibold shadow-sm">
                                        {doc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isUser && message.action && (
                        <div className="px-5 py-3 bg-emerald-50/50 border-t border-emerald-100 rounded-b-2xl">
                            {message.action.includes('http') ? (
                                <a href={message.action} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 transition-colors group">
                                    <ArrowRight className="w-4 h-4" />
                                    <span className="text-[13px] font-semibold">{message.action}</span>
                                    <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60 group-hover:opacity-100" />
                                </a>
                            ) : (
                                <button
                                    onClick={(e) => { e.preventDefault(); }}
                                    className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 transition-colors group cursor-default w-full text-left"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                    <span className="text-[13px] font-semibold">{message.action}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function ChatPanel() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    const scrollToBottom = () => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    useEffect(() => { scrollToBottom(); }, [messages, loading]);

    // Load chat history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/history`, {
                    headers: getAuthHeaders(),
                });
                if (res.data.messages && res.data.messages.length > 0) {
                    const restored = res.data.messages.map((msg, i) => ({
                        id: `hist_${msg.timestamp || i}`,
                        role: msg.role,
                        text: msg.content,
                    }));
                    setMessages(restored);
                }
            } catch (err) {
                console.log('No history loaded:', err.message);
            }
        };
        loadHistory();
    }, []);

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            // Use language selected on landing page, default to Hindi
            recognition.lang = localStorage.getItem('appLanguage') || 'hi-IN';
            recognition.interimResults = false;
            recognition.continuous = false;

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                // Auto-submit after a small delay
                setTimeout(() => {
                    executeSearchRef.current(transcript);
                }, 300);
            };

            recognition.onerror = (event) => {
                console.error('STT Error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const getVaultDocs = () => {
        try {
            const stored = localStorage.getItem(VAULT_KEY);
            if (stored) {
                const vault = JSON.parse(stored);
                return Object.entries(vault).filter(([_, v]) => v).map(([k]) => k);
            }
        } catch { }
        return [];
    };

    const executeSearch = async (textToSearch) => {
        if (!textToSearch.trim() || loading) return;

        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: textToSearch }]);
        setInput('');
        setLoading(true);

        try {
            const vaultDocs = getVaultDocs();
            // Read language code selected on the landing page (e.g. 'en-IN', 'hi-IN', 'ta-IN')
            const langCode = localStorage.getItem('appLanguage') || 'hi-IN';
            const response = await axios.post(API_URL, { query: textToSearch, vault_docs: vaultDocs, language: langCode }, {
                headers: getAuthHeaders(),
            });
            const data = response.data;
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.reply,
                missing_docs: data.missing_docs || [],
                action: data.action || null,
                audio_base64: data.audio_base64 || null,
            }]);

            // Play AWS Polly audio if available
            if (data.audio_base64) {
                try {
                    const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
                    audio.play().catch(err => {
                        console.error("Audio playback blocked by browser (autoplay limitation):", err);
                    });
                } catch (audioErr) {
                    console.error('Audio object creation failed:', audioErr);
                }
            } else {
                console.warn("Backend did not return any audio data for this reply.");
            }
        } catch (error) {
            console.error('API Error:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: 'API Connection Failed. Please ensure the backend is running.',
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // Ref for auto-submit from STT callback
    const executeSearchRef = useRef(executeSearch);
    useEffect(() => { executeSearchRef.current = executeSearch; });

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser. Please use Chrome.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            setIsListening(true);
            recognitionRef.current.start();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeSearch(input); }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#fcfcfc] relative">

            {/* Header */}
            <div className="px-8 py-4 bg-white border-b border-gray-200 flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Jan-Sahayak AI</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[12px] font-medium text-gray-500">Groq Llama 3.3 Engine</span>
                </div>
            </div>

            {/* Main chat area */}
            {/* pb-32 ensures the messages can be scrolled past the floating input bar */}
            <div className="flex-1 overflow-y-auto px-8 md:px-16 pt-8 pb-36 relative chat-scroll">

                {/* Welcome Splash for Empty State */}
                <AnimatePresence>
                    {messages.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto align-middle pt-10"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-6 shadow-sm">
                                <Bot className="w-8 h-8 text-emerald-600" />
                            </div>

                            <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                                Welcome to Jan-Sahayak
                            </h1>
                            <p className="text-[15px] text-gray-500 mb-10 text-center max-w-lg leading-relaxed">
                                I can plan processes, guide you live, and seamlessly autofill forms using your secure digital vault. Private, fast, and deterministic.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                {[
                                    { title: "Agriculture", icon: <FileText className="w-5 h-5" />, text: "Kheti ke liye sarkari yojana batao" },
                                    { title: "Education", icon: <GraduationCap className="w-5 h-5" />, text: "SC/ST scholarship ke liye details" },
                                    { title: "Healthcare", icon: <Shield className="w-5 h-5" />, text: "Ayushman Bharat card rules" }
                                ].map((card) => (
                                    <button
                                        key={card.title}
                                        onClick={() => executeSearch(card.text)}
                                        className="bg-white border border-gray-200 hover:border-emerald-500 hover:shadow-md transition-all rounded-xl p-5 text-left flex flex-col group overflow-hidden"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-emerald-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-600 mb-3 transition-colors">
                                            {card.icon}
                                        </div>
                                        <h3 className="font-semibold text-gray-900 text-[14px] mb-1">{card.title}</h3>
                                        <p className="text-[12.5px] text-gray-500 leading-snug">"{card.text}"</p>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Real Messages */}
                <div className="max-w-3xl mx-auto w-full">
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                    </AnimatePresence>

                    {/* Typing Indicator */}
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-6">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center mt-1">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                                    <TypingIndicator />
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Sleek Floating Input Area */}
            <div className="absolute bottom-6 left-0 right-0 px-8 pointer-events-none flex justify-center w-full">
                <div className="w-full max-w-3xl relative pointer-events-auto">
                    <div className="flex gap-3">
                        <div className="flex-1 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-200 rounded-full flex items-center p-1.5 pl-5 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything about schemes..."
                                disabled={loading}
                                className="flex-1 w-full bg-transparent py-2.5 outline-none text-[15px] font-medium text-gray-900 placeholder:text-gray-400 disabled:opacity-50"
                            />
                            <button
                                onClick={() => executeSearch(input)}
                                disabled={loading || !input.trim()}
                                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed ml-2 shrink-0"
                            >
                                <Send className="w-4.5 h-4.5" />
                            </button>
                        </div>

                        {/* Voice Mic Button */}
                        <div className="shrink-0 flex items-center justify-center">
                            <button
                                onClick={toggleListening}
                                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all border group overflow-hidden relative
                                    ${isListening
                                        ? 'bg-red-600 border-red-500 animate-pulse scale-110'
                                        : 'bg-gray-900 hover:bg-gray-800 border-gray-700 hover:scale-105 active:scale-95'
                                    }
                                `}
                            >
                                <div className={`absolute inset-0 rounded-full transition-opacity ${isListening ? 'bg-red-400 opacity-30 animate-ping' : 'bg-emerald-500 opacity-0 group-hover:opacity-20'}`}></div>
                                <Mic className={`w-6 h-6 ${isListening ? 'text-white' : 'text-emerald-400'}`} />
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-[10.5px] font-medium text-gray-400 mt-2.5 flex justify-center items-center gap-1.5 pr-16">
                        <Shield className="w-3 h-3" /> Secure AI processing
                    </p>
                </div>
            </div>
        </div>
    );
}
