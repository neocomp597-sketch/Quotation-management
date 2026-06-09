import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdFilterList, MdVisibility, MdDescription, MdDownload, MdPictureAsPdf, MdDelete, MdEdit, MdCheckCircle, MdReceipt } from 'react-icons/md';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { quotationService, territoryService } from '../services/api';
import { formatDate, resolveImageUrl, fetchPdfImageBase64 } from '../utils/helpers';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QuotationPDF from '../components/QuotationPDF';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';

const LIST_PAGE_SIZE = 20;

const Quotations = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const statusFilter = searchParams.get('status');
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [pdfImages, setPdfImages] = useState({});
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [pdfFormat, setPdfFormat] = useState('format1');
    const [companySettings, setCompanySettings] = useState(null);
    const [territories, setTerritories] = useState([]);
    const [selectedTerritory, setSelectedTerritory] = useState('');

    useEffect(() => {
        const fetchTerritories = async () => {
            try {
                const res = await territoryService.getAll();
                setTerritories(res.data || []);
            } catch (err) {
                console.error("Error fetching territories:", err);
            }
        };
        fetchTerritories();
    }, []);

    useEffect(() => {
        if (!selectedQuotation) return;

        const loadImages = async () => {
            const urls = new Set();
            const q = selectedQuotation;

            // Collect all image URLs
            if (q.companySettings?.logoUrl) urls.add(q.companySettings.logoUrl);
            if (q.customerId?.logoUrl) urls.add(q.customerId.logoUrl);
            if (q.companySettings?.authorizedSignatory?.signatureImageUrl) {
                urls.add(q.companySettings.authorizedSignatory.signatureImageUrl);
            }
            if (q.items) {
                q.items.forEach(item => {
                    const u = item.productSnapshot?.productImageUrl || item.productImageUrl || item.productId?.productImageUrl;
                    if (u) urls.add(u);
                });
            }

            const imageMap = {};
            await Promise.all(Array.from(urls).map(async (url) => {
                try {
                    const base64 = await fetchPdfImageBase64(url);
                    imageMap[url] = base64;
                } catch {
                    console.warn("Failed to pre-fetch PDF image", url);
                }
            }));

            setPdfImages(imageMap);
        };

        loadImages();
    }, [selectedQuotation]);

    useEffect(() => {
        fetchCompanySettings();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [statusFilter]);

    useEffect(() => {
        fetchQuotations();
    }, [page, debouncedSearch, statusFilter, selectedTerritory]);

    const fetchCompanySettings = async () => {
        try {
            const { companySettingsService } = await import('../services/api');
            const res = await companySettingsService.get();
            setCompanySettings(res.data);
        } catch (err) {
            console.error("Error fetching settings:", err);
        }
    };

    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const res = await quotationService.getAll({
                page,
                limit: LIST_PAGE_SIZE,
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                territory: selectedTerritory || undefined,
            });
            const payload = res.data;
            setQuotations(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1,
            });
        } catch (err) {
            console.error("Error fetching quotations:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (id) => {
        try {
            const res = await quotationService.getById(id);
            setSelectedQuotation(res.data);
            setIsPreviewOpen(true);
        } catch (err) {
            console.error("Error fetching detail:", err);
            toast.error('Failed to load quotation details');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this quotation? This cannot be undone.")) {
            try {
                await quotationService.delete(id);
                toast.success('Quotation deleted successfully!');
                fetchQuotations();
            } catch (err) {
                console.error("Error deleting:", err);
                toast.error('Failed to delete quotation');
            }
        }
    };

    const handleFinalize = async (id) => {
        if (window.confirm("Finalize this quotation? It will become official.")) {
            try {
                await quotationService.finalize(id);
                toast.success('Quotation finalized successfully!');
                fetchQuotations();
            } catch (err) {
                console.error("Error finalizing:", err);
                toast.error('Failed to finalize quotation');
            }
        }
    };

    const handleMarkAsOrdered = async (id) => {
        if (window.confirm("Mark this quotation as ORDERED? This will reflect in your sales reports.")) {
            try {
                // Update status to 'ordered' using dedicated status endpoint
                await quotationService.updateStatus(id, 'ordered');
                toast.success('Quotation marked as ORDERED!');
                fetchQuotations();
            } catch (err) {
                console.error("Error marking ordered:", err);
                toast.error('Failed to update status');
            }
        }
    };

    const filteredQuotations = quotations;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">ARCRM Sales</h1>
                    <p className="text-slate-500 font-medium">Manage and track your professional trade quotations.</p>
                </div>
                <Link
                    to="/quotations/new"
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>New Quotation</span>
                </Link>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30 w-full">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder="Search by QTN Ref or Customer..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <select
                            value={selectedTerritory}
                            onChange={(e) => {
                                setSelectedTerritory(e.target.value);
                                setPage(1);
                            }}
                            className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold text-slate-900 transition-all shadow-sm"
                        >
                            <option value="">All Territories</option>
                            {territories.map(t => (
                                <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    {loading ? (
                        <div className="hidden md:block">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">Ref Number</th>
                                        <th className="px-8 py-5">Customer Info</th>
                                        <th className="px-8 py-5">Validity</th>
                                        <th className="px-8 py-5 text-right">Net Amount</th>
                                        <th className="px-8 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {[...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-8 py-5"><div className="space-y-2"><div className="h-3.5 w-28 bg-slate-200 rounded" /><div className="h-2.5 w-20 bg-slate-100 rounded" /></div></td>
                                            <td className="px-8 py-5"><div className="space-y-2"><div className="h-3.5 w-36 bg-slate-200 rounded" /><div className="h-2.5 w-24 bg-slate-100 rounded" /></div></td>
                                            <td className="px-8 py-5"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                                            <td className="px-8 py-5 text-right"><div className="h-5 w-24 bg-slate-200 rounded ml-auto" /></td>
                                            <td className="px-8 py-5"><div className="flex justify-center"><div className="h-6 w-16 bg-slate-200 rounded-xl" /></div></td>
                                            <td className="px-8 py-5"><div className="flex justify-end gap-2">{[...Array(4)].map((_, j) => <div key={j} className="h-9 w-9 bg-slate-100 rounded-xl" />)}</div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden p-4 space-y-4 bg-slate-50/50">
                                {filteredQuotations.map((q) => (
                                    <div key={q._id} className="mobile-master-card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="p-5 border-b border-slate-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-50 px-2 py-1 rounded-md">{q.quotationNo}</span>
                                                    <h3 className="font-bold text-slate-900 mt-2 text-sm">{q.customerId?.companyName}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <p className="text-xs text-slate-400 font-medium">{q.customerId?.customerName}</p>
                                                        {q.territory && (
                                                            <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md text-[9px] font-black uppercase tracking-wider">
                                                                {q.territory.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${q.status === 'ordered'
                                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                    : q.status === 'final'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                    {q.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-end mt-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Net Amount</p>
                                                    <p className="text-lg font-black text-slate-900">₹{q.grandTotal?.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Expires</p>
                                                    <p className="text-xs font-bold text-rose-500">{formatDate(q.validTill)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50/50 px-4 py-3 flex justify-between items-center">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                {formatDate(q.quotationDate)}
                                            </div>
                                            <div className="flex gap-1">
                                                {q.status === 'draft' && (
                                                    <>
                                                        <button
                                                            onClick={() => navigate(`/quotations/${q._id}`)}
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                        >
                                                            <MdEdit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleFinalize(q._id)}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                        >
                                                            <MdCheckCircle size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                {q.status === 'final' && (
                                                    <button
                                                        onClick={() => handleMarkAsOrdered(q._id)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Convert to Order"
                                                    >
                                                        <MdCheckCircle size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleViewDetails(q._id)}
                                                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                >
                                                    <MdVisibility size={18} />
                                                </button>
                                                <PDFDownloadLink document={<QuotationPDF quotation={q} />} fileName={`${q.quotationNo.replace(/\//g, '-')}.pdf`}>
                                                    {({ loading }) => (
                                                        <button
                                                            disabled={loading}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                                                        >
                                                            <MdPictureAsPdf size={18} />
                                                        </button>
                                                    )}
                                                </PDFDownloadLink>

                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredQuotations.length === 0 && (
                                    <div className="text-center p-8 text-slate-400 text-xs font-bold uppercase tracking-widest">No quotations found</div>
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">Ref Number</th>
                                            <th className="px-8 py-5">Customer Info</th>
                                            <th className="px-8 py-5">Validity</th>
                                            <th className="px-8 py-5 text-right">Net Amount</th>
                                            <th className="px-8 py-5 text-center">Status</th>
                                            <th className="px-8 py-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredQuotations.map((q) => (
                                            <tr key={q._id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="font-black text-slate-900 tracking-tight">{q.quotationNo}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(q.quotationDate)}</div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <div className="font-bold text-slate-700">{q.customerId?.companyName}</div>
                                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{q.customerId?.customerName}</div>
                                                        </div>
                                                        {q.territory && (
                                                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                                                                {q.territory.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-xs font-bold text-rose-500 uppercase tracking-tighter flex items-center gap-1">
                                                        Expires {formatDate(q.validTill)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="text-lg font-black text-slate-900">₹{q.grandTotal?.toLocaleString()}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Incl Txs</div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex justify-center">
                                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${q.status === 'ordered'
                                                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                            : q.status === 'final'
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                                            }`}>
                                                            {q.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {q.status === 'draft' && (
                                                            <>
                                                                <button
                                                                    onClick={() => navigate(`/quotations/${q._id}`)}
                                                                    className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                                    title="Edit Draft"
                                                                >
                                                                    <MdEdit size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleFinalize(q._id)}
                                                                    className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                                    title="Finalize"
                                                                >
                                                                    <MdCheckCircle size={18} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {q.status === 'final' && (
                                                            <button
                                                                onClick={() => handleMarkAsOrdered(q._id)}
                                                                className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                                title="Mark as Ordered (Invoice)"
                                                            >
                                                                <MdCheckCircle size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleViewDetails(q._id)}
                                                            className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                            title="View Profile"
                                                        >
                                                            <MdVisibility size={18} />
                                                        </button>

                                                        {/* Tax Invoice Format */}
                                                        <PDFDownloadLink document={<QuotationPDF quotation={q} format="format2" companySettings={companySettings} />} fileName={`${q.quotationNo.replace(/\//g, '-')}-invoice.pdf`}>
                                                            {({ loading }) => (
                                                                <button
                                                                    disabled={loading}
                                                                    className="p-2.5 text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100 disabled:opacity-50"
                                                                    title="Tax Invoice"
                                                                >
                                                                    <MdReceipt size={18} />
                                                                </button>
                                                            )}
                                                        </PDFDownloadLink>

                                                        <PDFDownloadLink document={<QuotationPDF quotation={q} companySettings={companySettings} />} fileName={`${q.quotationNo.replace(/\//g, '-')}.pdf`}>
                                                            {({ loading }) => (
                                                                <button
                                                                    disabled={loading}
                                                                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100 disabled:opacity-50"
                                                                    title="Export PDF"
                                                                >
                                                                    <MdPictureAsPdf size={18} />
                                                                </button>
                                                            )}
                                                        </PDFDownloadLink>


                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredQuotations.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">No quotations found</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={pagination} onPageChange={setPage} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                title="Quotation Management Review"
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xl">
                        {/* Header Mockup */}
                        <div className="flex border-b border-slate-200">
                            <div className="w-3/5 p-8 border-r border-slate-200 flex flex-col items-center justify-center bg-slate-50/50">
                                {selectedQuotation?.companySettings?.logoUrl ? (
                                    <img src={resolveImageUrl(selectedQuotation.companySettings.logoUrl)} alt="Logo" className="h-16 object-contain mb-4" />
                                ) : (
                                    <div className="text-center">
                                        <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                            {selectedQuotation?.companySettings?.companyName?.toUpperCase() || 'YOUR COMPANY'}
                                        </div>
                                    </div>
                                )}
                                <div className="h-0.5 w-full bg-slate-900 mt-4"></div>
                                <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-[0.2em]">
                                    {selectedQuotation?.companySettings?.tagline || 'where quality meets value'}
                                </div>
                            </div>
                            <div className="w-2/5 flex flex-col">
                                <div className="bg-slate-100 p-3 text-center border-b border-slate-200">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Quotation</span>
                                </div>
                                <div className="flex-1 divide-y divide-slate-200">
                                    <div className="flex px-4 py-2.5 items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 w-24">Ref No.</span>
                                        <span className="text-xs font-bold text-slate-900 flex-1">{selectedQuotation?.quotationNo}</span>
                                    </div>
                                    <div className="flex px-4 py-2.5 items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 w-24">Date</span>
                                        <span className="text-xs font-bold text-slate-900 flex-1">{formatDate(selectedQuotation?.quotationDate)}</span>
                                    </div>
                                    <div className="flex px-4 py-2.5 items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 w-24">Valid Till</span>
                                        <span className="text-xs font-bold text-rose-600 flex-1">{formatDate(selectedQuotation?.validTill)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Company Address (From) */}
                        {selectedQuotation?.companySettings && (
                            <div className="px-8 py-4 bg-slate-50 border-b border-slate-200">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">From:</div>
                                <div className="text-sm font-bold text-slate-900">{selectedQuotation.companySettings.companyName}</div>
                                {selectedQuotation.companySettings.address && (
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {[
                                            selectedQuotation.companySettings.address.line1,
                                            selectedQuotation.companySettings.address.line2,
                                            selectedQuotation.companySettings.address.city,
                                            selectedQuotation.companySettings.address.state,
                                            selectedQuotation.companySettings.address.pincode
                                        ].filter(Boolean).join(', ')}
                                    </div>
                                )}
                                <div className="flex gap-4 mt-1 text-[10px] text-slate-400">
                                    {selectedQuotation.companySettings.phone && <span>Ph: {selectedQuotation.companySettings.phone}</span>}
                                    {selectedQuotation.companySettings.email && <span>Email: {selectedQuotation.companySettings.email}</span>}
                                    {selectedQuotation.companySettings.gstin && <span>GSTIN: {selectedQuotation.companySettings.gstin}</span>}
                                </div>
                            </div>
                        )}

                        {/* Customer Info */}
                        <div className="p-8 border-b border-slate-200">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Issued To:</div>
                            <div className="flex items-start gap-4">
                                {/* Customer Logo */}
                                {selectedQuotation?.customerId?.logoUrl && (
                                    <div className="flex-shrink-0 h-16 w-16 rounded-xl bg-white border border-slate-100 p-1 overflow-hidden shadow-sm">
                                        <img
                                            src={resolveImageUrl(selectedQuotation.customerId.logoUrl)}
                                            alt={selectedQuotation.customerId.companyName}
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="text-lg font-black text-slate-900">{selectedQuotation?.customerId?.companyName}</div>
                                    {selectedQuotation?.customerId?.customerName && (
                                        <div className="text-xs font-bold text-primary-600 mt-0.5">Attn: {selectedQuotation.customerId.customerName}</div>
                                    )}
                                    {selectedQuotation?.customerId?.billingAddress && (
                                        <div className="text-xs font-medium text-slate-500 mt-1 uppercase leading-relaxed">
                                            {[
                                                selectedQuotation.customerId.billingAddress.line1,
                                                selectedQuotation.customerId.billingAddress.line2,
                                                selectedQuotation.customerId.billingAddress.city,
                                                selectedQuotation.customerId.billingAddress.state,
                                                selectedQuotation.customerId.billingAddress.pincode
                                            ].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    <div className="flex gap-4 mt-1 text-[10px] text-slate-400">
                                        {selectedQuotation?.customerId?.mobile && <span>Ph: {selectedQuotation.customerId.mobile}</span>}
                                        {selectedQuotation?.customerId?.email && <span>Email: {selectedQuotation.customerId.email}</span>}
                                        {selectedQuotation?.customerId?.gstin && <span>GSTIN: {selectedQuotation.customerId.gstin}</span>}
                                    </div>
                                </div>
                            </div>
                            {selectedQuotation?.siteId && (
                                <div className="mt-4 p-4 rounded-2xl bg-primary-50 border border-primary-100">
                                    <div className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Project Site</div>
                                    <div className="text-sm font-bold text-slate-900">{selectedQuotation.siteId.siteName}</div>
                                    <div className="text-xs font-medium text-slate-500 mt-0.5">{selectedQuotation.siteId.address}</div>
                                </div>
                            )}
                        </div>

                        {/* Table Mockup */}
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead className="bg-slate-100 border-b border-slate-200 font-black uppercase tracking-widest text-slate-600 text-[9px]">
                                    <tr>
                                        <th className="px-4 py-3 text-center border-r border-slate-200 w-12">SN</th>
                                        <th className="px-4 py-3 text-center border-r border-slate-200 w-16">Image</th>
                                        <th className="px-4 py-3 text-left border-r border-slate-200">Product Details</th>
                                        <th className="px-4 py-3 text-center border-r border-slate-200 w-20">HSN</th>
                                        <th className="px-4 py-3 text-center border-r border-slate-200 w-20">Qty</th>
                                        <th className="px-4 py-3 text-right w-24">Final Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedQuotation?.items.map((item, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4 text-center text-slate-400 font-bold border-r border-slate-100">{i + 1}</td>
                                            <td className="px-2 py-4 border-r border-slate-100 flex justify-center">
                                                <div className="h-10 w-10 rounded-lg bg-white border border-slate-100 p-0.5 overflow-hidden">
                                                    {(item.productSnapshot?.productImageUrl || item.productImageUrl || item.productId?.productImageUrl) ? (
                                                        <img
                                                            src={resolveImageUrl(item.productSnapshot?.productImageUrl || item.productImageUrl || item.productId?.productImageUrl)}
                                                            alt=""
                                                            className="h-full w-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-slate-200">
                                                            <MdDescription size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 border-r border-slate-100">
                                                <div className="font-bold text-slate-900 uppercase text-[10px]">{item.productSnapshot?.productName || item.productId?.productName}</div>
                                                <div className="text-[9px] font-black text-slate-400 mt-0.5 tracking-tighter">{item.productSnapshot?.productCode || item.productId?.productCode} | RATE: ₹{item.rate.toLocaleString()} | DISC: {item.discountPercent}%</div>
                                                {(item.vendorName || item.vendorId?.name) && (
                                                    <div className="text-[9px] font-bold text-primary-600 mt-1">
                                                        Vendor: {item.vendorName || item.vendorId?.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center text-slate-600 font-medium border-r border-slate-100">{item.productSnapshot?.hsnCode || '-'}</td>
                                            <td className="px-4 py-4 text-center border-r border-slate-100">
                                                <div className="font-bold text-slate-900">{item.quantity}</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.productSnapshot?.uom || 'pcs'}</div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-black text-slate-900">
                                                ₹{item.lineTotal.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Calculation Summary Section */}
                        <div className="flex border-t border-slate-200">
                            <div className="flex-1 bg-slate-50/30 p-8">
                                {/* Terms & Conditions */}
                                {(selectedQuotation?.customTerms || selectedQuotation?.termsTemplateId?.content || selectedQuotation?.companySettings?.defaultTerms) && (
                                    <div className="max-w-sm">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</h4>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed whitespace-pre-line">
                                            {(selectedQuotation.customTerms || selectedQuotation.termsTemplateId?.content || selectedQuotation.companySettings?.defaultTerms)?.substring(0, 300)}
                                            {(selectedQuotation.customTerms || selectedQuotation.termsTemplateId?.content || selectedQuotation.companySettings?.defaultTerms)?.length > 300 ? '...' : ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="w-80 p-6 divide-y divide-slate-100 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
                                <div className="flex justify-between py-2 items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Net Valuation</span>
                                    <span className="text-sm font-bold text-slate-700">₹{selectedQuotation?.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-2 items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Tax Liability</span>
                                    <span className="text-sm font-bold text-slate-700">₹{(selectedQuotation?.gstBreakup?.cgst + selectedQuotation?.gstBreakup?.sgst + (selectedQuotation?.gstBreakup?.igst || 0))?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-4 items-center border-t-2 border-slate-900">
                                    <span className="text-xs font-black uppercase text-slate-900">Grand Total</span>
                                    <span className="text-xl font-black text-primary-600">₹{selectedQuotation?.grandTotal?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Authorized Signatory Section */}
                        <div className="p-8 flex justify-end border-t border-slate-100">
                            <div className="text-right">
                                {selectedQuotation?.companySettings?.authorizedSignatory?.signatureImageUrl && (
                                    <img
                                        src={resolveImageUrl(selectedQuotation.companySettings.authorizedSignatory.signatureImageUrl)}
                                        alt="Signature"
                                        className="h-8 object-contain ml-auto mb-2"
                                    />
                                )}
                                <div className="h-0.5 w-48 bg-slate-200 mb-2 ml-auto"></div>
                                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Authorized Signatory</div>
                                <div className="text-sm font-black text-slate-900 mt-1 uppercase tracking-tight">
                                    {selectedQuotation?.companySettings?.companyName || 'Company Name'}
                                </div>
                                {selectedQuotation?.companySettings?.authorizedSignatory?.name && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        {selectedQuotation.companySettings.authorizedSignatory.name}
                                        {selectedQuotation.companySettings.authorizedSignatory.designation && ` (${selectedQuotation.companySettings.authorizedSignatory.designation})`}
                                    </div>
                                )}
                                <div className="text-[10px] font-bold text-slate-500 mt-1">Date: {formatDate(new Date())}</div>
                            </div>
                        </div>
                    </div>


                    <div className="flex flex-col gap-4">
                        <div className="flex p-1 bg-slate-100 rounded-xl relative">
                            <div
                                className={`absolute h-[calc(100%-8px)] w-[calc(50%-4px)] top-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-spring ${pdfFormat === 'format2' ? 'translate-x-[calc(100%+8px)]' : 'translate-x-0'
                                    }`}
                            ></div>
                            <button
                                onClick={() => setPdfFormat('format1')}
                                className={`flex-1 relative z-10 py-3 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${pdfFormat === 'format1' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                Standard Format
                            </button>
                            <button
                                onClick={() => setPdfFormat('format2')}
                                className={`flex-1 relative z-10 py-3 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${pdfFormat === 'format2' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                Tax Invoice Format
                            </button>
                        </div>

                        <PDFDownloadLink
                            key={pdfFormat}
                            document={<QuotationPDF quotation={selectedQuotation} format={pdfFormat} images={pdfImages} companySettings={companySettings} />}
                            fileName={`${selectedQuotation?.quotationNo.replace(/\//g, '-')}-${pdfFormat}.pdf`}
                        >
                            {({ loading }) => (
                                <PDFDownloadButton loading={loading} />
                            )}
                        </PDFDownloadLink>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const PDFDownloadButton = ({ loading }) => {
    useEffect(() => {
        if (!loading) {
            toast.success("PDF Ready for Download!");
        }
    }, [loading]);

    return (
        <button
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black transition-all shadow-xl hover:shadow-2xl uppercase tracking-widest text-xs active:scale-[0.98]"
        >
            <MdPictureAsPdf size={20} className="text-primary-400" />
            {loading ? 'Compiling Official Assets...' : 'Download Official PDF Document'}
        </button>
    );
};

export default Quotations;
