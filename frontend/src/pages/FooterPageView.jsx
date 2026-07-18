import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { footerPageService } from '../services/api';
import { MdArrowBack, MdOutlineTopic } from 'react-icons/md';

const FooterPageView = () => {
    const { slug } = useParams();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPage = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await footerPageService.getBySlug(slug);
                setPageData(res.data);
            } catch (err) {
                console.error("Failed to load page content", err);
                setError("Failed to load page content. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="h-10 w-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-bold text-sm tracking-wider uppercase">Loading content...</p>
            </div>
        );
    }

    if (error || !pageData) {
        return (
            <div className="bg-white rounded-2xl p-8 text-center max-w-lg mx-auto border border-red-100 shadow-sm mt-10">
                <div className="text-red-500 font-black text-lg mb-3">Error Loading Page</div>
                <p className="text-slate-600 font-medium mb-6">{error || "The page you are looking for does not exist."}</p>
                <Link to="/dashboard" className="px-6 py-2.5 bg-black text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors rounded-xl shadow-sm inline-flex items-center gap-2">
                    <MdArrowBack size={16} /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest mb-1.5">
                        <MdOutlineTopic size={14} /> Information Page
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wide">
                        {pageData.label}
                    </h1>
                </div>
                <Link 
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-extrabold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all shadow-sm self-start sm:self-auto"
                >
                    <MdArrowBack size={16} /> Back
                </Link>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100/80 p-8 md:p-10">
                <div 
                    className="rich-text-container"
                    dangerouslySetInnerHTML={{ __html: pageData.content }}
                />
            </div>
        </div>
    );
};

export default FooterPageView;
