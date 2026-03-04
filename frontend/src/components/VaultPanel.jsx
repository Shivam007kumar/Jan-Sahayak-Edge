import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, Landmark, ScrollText, MapPin, Lock, Fingerprint, BookOpen, CreditCard, UserSquare2, Home } from 'lucide-react';

const VAULT_KEY = 'jan_sahayak_vault';

const CATEGORIES = [
    {
        id: 'identity',
        title: 'Identity',
        items: [
            { key: 'aadhar_card', label: 'Aadhar Card', description: 'UIDAI 12-digit Identity', icon: Fingerprint, colorClass: 'text-blue-600 bg-blue-50' },
            { key: 'pan_card', label: 'PAN Card', description: 'Income Tax Identity', icon: CreditCard, colorClass: 'text-indigo-600 bg-indigo-50' },
            { key: 'voter_id', label: 'Voter ID', description: 'Election Commission ID', icon: UserSquare2, colorClass: 'text-cyan-600 bg-cyan-50' }
        ]
    },
    {
        id: 'assets',
        title: 'Assets & Economy',
        items: [
            { key: 'land_record_7_12', label: 'Land Record (7/12)', description: 'Revenue & Land Papers', icon: MapPin, colorClass: 'text-amber-600 bg-amber-50' },
            { key: 'bank_passbook', label: 'Bank Passbook', description: 'Account & IFSC Details', icon: Landmark, colorClass: 'text-emerald-600 bg-emerald-50' },
            { key: 'ration_card', label: 'Ration Card', description: 'PDS / BPL Card', icon: Home, colorClass: 'text-orange-600 bg-orange-50' }
        ]
    },
    {
        id: 'education',
        title: 'Education & Caste',
        items: [
            { key: 'caste_certificate', label: 'Caste Certificate', description: 'SC / ST / OBC Proof', icon: ScrollText, colorClass: 'text-purple-600 bg-purple-50' },
            { key: '10th_marksheet', label: '10th Marksheet', description: 'Matriculation Board', icon: BookOpen, colorClass: 'text-pink-600 bg-pink-50' },
            { key: '12th_marksheet', label: '12th Marksheet', description: 'HSC Board Record', icon: BookOpen, colorClass: 'text-rose-600 bg-rose-50' }
        ]
    }
];

const TOTAL_DOCS = CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);

function LightToggle({ checked, onChange }) {
    return (
        <div className={`toggle-switch-light ${checked ? 'on' : 'off'}`} onClick={(e) => { e.stopPropagation(); onChange(); }}>
            <div className="toggle-knob-light" />
        </div>
    );
}

export default function VaultPanel() {
    const [vault, setVault] = useState({});

    useEffect(() => {
        const stored = localStorage.getItem(VAULT_KEY);
        if (stored) { try { setVault(JSON.parse(stored)); } catch { } }
    }, []);

    const toggleDoc = (key) => {
        const updated = { ...vault, [key]: !vault[key] };
        setVault(updated);
        localStorage.setItem(VAULT_KEY, JSON.stringify(updated));
    };

    const possessedCount = Object.values(vault).filter(Boolean).length;
    const progress = (possessedCount / TOTAL_DOCS) * 100;

    return (
        <div className="w-[30%] min-w-[320px] max-w-[400px] h-full flex flex-col bg-white border-r border-gray-200 z-20">

            {/* Branded Header */}
            <div className="px-6 pt-8 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                        <h2 className="text-[16px] font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)]">Digital Vault</h2>
                        <p className="text-[12px] text-gray-500 font-medium">Local Device Storage</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[11px] text-gray-500 font-medium">{possessedCount} of {TOTAL_DOCS} stored</span>
                    <span className="text-[11px] font-bold text-emerald-600">{Math.round(progress)}% Secure</span>
                </div>
            </div>

            {/* Document Categories */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 mt-1">
                {CATEGORIES.map((category) => (
                    <div key={category.id}>
                        <div className="mb-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{category.title}</p>
                        </div>
                        <div className="space-y-3">
                            {category.items.map((doc) => {
                                const isActive = !!vault[doc.key];
                                const Icon = doc.icon;

                                return (
                                    <div
                                        key={doc.key}
                                        className={`
                            relative rounded-xl p-3.5 cursor-pointer transition-all duration-200 overflow-hidden flex items-center justify-between
                            ${isActive
                                                ? 'bg-emerald-50/50 border border-emerald-500 ring-1 ring-emerald-500/50'
                                                : 'bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-gray-100/50'
                                            }
                          `}
                                        onClick={() => toggleDoc(doc.key)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? doc.colorClass : 'bg-white border border-gray-200 text-gray-400'}`}>
                                                <Icon className="w-4.5 h-4.5" />
                                            </div>
                                            <div>
                                                <p className={`text-[13px] font-semibold ${isActive ? 'text-emerald-900' : 'text-gray-900'}`}>{doc.label}</p>
                                                <p className={`text-[11px] ${isActive ? 'text-emerald-700/70' : 'text-gray-500'}`}>{doc.description}</p>
                                            </div>
                                        </div>
                                        <LightToggle checked={isActive} onChange={() => toggleDoc(doc.key)} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-center gap-1.5 text-gray-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold tracking-widest uppercase">Zero Cloud Footprint</span>
                </div>
            </div>
        </div>
    );
}
