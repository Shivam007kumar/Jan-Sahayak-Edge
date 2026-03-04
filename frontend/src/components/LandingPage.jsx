import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, Bot, Globe, Check, Phone, KeyRound, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LANGUAGES = [
    { code: 'en-IN', label: 'English', native: 'English' },
    { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
    { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
    { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
];

export default function LandingPage({ onVerify }) {
    const [selectedLang, setSelectedLang] = useState('hi-IN');
    const [step, setStep] = useState('language'); // 'language' | 'phone' | 'otp'
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [session, setSession] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLanguageNext = () => {
        localStorage.setItem('appLanguage', selectedLang);
        setStep('phone');
    };

    const handleSendOTP = async () => {
        setLoading(true);
        setError('');
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const res = await axios.post(`${API}/api/auth/send-otp`, {
                phone: cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`
            });

            if (res.data.status === 'OTP_SENT') {
                setSession(res.data.session);
                setStep('otp');
            } else if (res.data.status === 'AUTHENTICATED') {
                // No MFA required — directly authenticated
                localStorage.setItem('id_token', res.data.id_token);
                localStorage.setItem('access_token', res.data.access_token);
                onVerify();
            }
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Failed to send OTP. Try again.';
            setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        setLoading(true);
        setError('');
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const res = await axios.post(`${API}/api/auth/verify-otp`, {
                phone: cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`,
                otp: otp,
                session: session,
            });

            if (res.data.status === 'AUTHENTICATED') {
                localStorage.setItem('id_token', res.data.id_token);
                localStorage.setItem('access_token', res.data.access_token);
                onVerify();
            }
        } catch (err) {
            const detail = err?.response?.data?.detail || 'Invalid OTP. Try again.';
            setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setLoading(false);
        }
    };

    const handleSkipLogin = () => {
        localStorage.setItem('appLanguage', selectedLang);
        onVerify();
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white relative overflow-hidden flex-1">
            {/* Background decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="z-10 flex flex-col items-center text-center max-w-3xl px-6"
            >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-8 shadow-sm">
                    <Bot className="w-8 h-8 text-emerald-600" />
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6">
                    Welcome to <span className="text-emerald-600">Jan-Sahayak</span>
                </h1>

                <p className="text-lg text-gray-500 mb-8 max-w-xl leading-relaxed">
                    Your personal AI agent for government schemes. It understands you, plans the process, and guides you through forms securely.
                </p>

                <AnimatePresence mode="wait">
                    {/* Step 1: Language Selection */}
                    {step === 'language' && (
                        <motion.div key="lang" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="w-full max-w-md mb-8">
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Select Language</span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto w-full p-2 border border-gray-100 rounded-2xl bg-white shadow-inner chat-scroll">
                                {LANGUAGES.map((lang) => {
                                    const isActive = selectedLang === lang.code;
                                    return (
                                        <button
                                            key={lang.code}
                                            onClick={() => setSelectedLang(lang.code)}
                                            className={`relative flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-center transition-all border
                                                ${isActive
                                                    ? 'bg-emerald-50 border-emerald-400 shadow-sm ring-1 ring-emerald-200'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                                }`}
                                        >
                                            {isActive && (
                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                            <span className={`text-[15px] font-bold ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                {lang.native}
                                            </span>
                                            <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-500' : 'text-gray-400'}`}>
                                                {lang.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleSkipLogin}
                                className="group mt-6 relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-full text-[15px] font-medium transition-all hover:bg-gray-800 hover:shadow-lg w-full"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Start Chatting
                                    <ArrowRight className="w-4 h-4 ml-1 opacity-70 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="mt-4 text-[12px] text-gray-400 font-medium tracking-wide border border-gray-100 bg-gray-50 px-3 py-1 rounded-full">
                    SECURE • FAST • PRIVATE
                </p>
            </motion.div>
        </div>
    );
}
