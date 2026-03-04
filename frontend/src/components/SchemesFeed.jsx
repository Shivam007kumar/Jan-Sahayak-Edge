import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Leaf, Building2, Rocket, GraduationCap, LayoutGrid, Heart, FileText, ArrowUpRight, Home, X } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/feed';

const CATEGORIES = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'agriculture', label: 'Agriculture', icon: Leaf },
    { id: 'healthcare', label: 'Healthcare', icon: Heart },
    { id: 'housing', label: 'Housing', icon: Home },
    { id: 'startup', label: 'Startup', icon: Rocket },
    { id: 'student', label: 'Student', icon: GraduationCap },
    { id: 'infrastructure', label: 'Infrastructure', icon: Building2 },
];

const CATEGORY_COLORS = {
    agriculture: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    healthcare: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    housing: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    startup: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    student: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    infrastructure: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

export default function SchemesFeed() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocsScheme, setSelectedDocsScheme] = useState(null);

    useEffect(() => {
        fetchSchemes(activeCategory);
    }, [activeCategory]);

    const fetchSchemes = async (category) => {
        setLoading(true);
        try {
            const url = category === 'all' ? API_URL : `${API_URL}?category=${category}`;
            const res = await axios.get(url);
            setSchemes(res.data.schemes || []);
        } catch (e) {
            console.error('Feed fetch error:', e);
            setSchemes([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-[350px] min-w-[300px] h-full bg-white border-r border-gray-200 flex flex-col z-10">

            {/* Header */}
            <div className="px-6 pt-8 pb-5 border-b border-gray-100">
                <h2 className="text-[20px] font-bold text-gray-900 tracking-tight font-[family-name:var(--font-display)] mb-1">
                    Scheme Feed
                </h2>
                <p className="text-[13px] text-gray-500 font-medium mb-5">
                    {schemes.length} government schemes available
                </p>

                {/* Filter Chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0
                  ${isActive
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }
                `}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {cat.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Feed Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 space-y-3">

                {loading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-[12px] text-gray-500">Fetching schemes...</p>
                    </div>
                )}

                {!loading && schemes.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 border border-gray-200">
                            <Filter className="w-5 h-5 text-gray-400" />
                        </div>
                        <h3 className="text-[14px] font-semibold text-gray-900 mb-1">No Schemes Found</h3>
                        <p className="text-[12px] text-gray-500 max-w-[200px] leading-relaxed">
                            No schemes match this category. Try "All" or check your backend.
                        </p>
                    </div>
                )}

                <AnimatePresence>
                    {!loading && schemes.map((scheme, index) => {
                        const catKey = (scheme.category || '').toLowerCase();
                        const colors = CATEGORY_COLORS[catKey] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

                        return (
                            <motion.div
                                key={scheme.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                            >
                                {/* Category Badge */}
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                                        {scheme.category}
                                    </span>
                                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                </div>

                                {/* Title */}
                                <h3 className="text-[14px] font-bold text-gray-900 mb-1.5 leading-tight">
                                    {scheme.name}
                                </h3>

                                {/* Description */}
                                <p className="text-[12px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
                                    {scheme.description}
                                </p>

                                {/* Benefits highlight */}
                                <div className="bg-emerald-50/50 rounded-lg px-3 py-2 border border-emerald-100 mb-3">
                                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed line-clamp-2">
                                        💰 {scheme.benefits}
                                    </p>
                                </div>

                                {/* Required docs count */}
                                <div
                                    className="flex items-center gap-1.5 hover:bg-gray-50 px-2 py-1 -ml-2 rounded-md transition-colors w-max group/docs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDocsScheme(scheme);
                                    }}
                                >
                                    <FileText className="w-3.5 h-3.5 text-gray-400 group-hover/docs:text-emerald-500 transition-colors" />
                                    <span className="text-[11px] text-gray-500 font-medium group-hover/docs:text-gray-900 transition-colors">
                                        {scheme.required_docs?.length || 0} documents required
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

            </div>

            {/* Document Details Modal */}
            <AnimatePresence>
                {selectedDocsScheme && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setSelectedDocsScheme(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-full"
                        >
                            <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                <div>
                                    <h3 className="text-[14px] font-bold text-gray-900 leading-tight pr-4">
                                        Required Documents
                                    </h3>
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{selectedDocsScheme.name}</p>
                                </div>
                                <button className="p-1 rounded-full hover:bg-gray-200 transition-colors text-gray-400 shrink-0" onClick={() => setSelectedDocsScheme(null)}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto">
                                {selectedDocsScheme.required_docs && selectedDocsScheme.required_docs.length > 0 ? (
                                    <ul className="space-y-2.5">
                                        {selectedDocsScheme.required_docs.map((doc, i) => (
                                            <li key={i} className="flex gap-2.5 items-start">
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100 mt-0.5">
                                                    <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
                                                </div>
                                                <span className="text-[13px] text-gray-700 font-medium pt-0.5 leading-relaxed">{doc}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-[13px] text-gray-500 italic text-center py-4">No specific documents listed.</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
