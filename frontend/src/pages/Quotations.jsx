import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdFilterList, MdVisibility, MdDescription, MdDownload, MdPictureAsPdf, MdDelete, MdEdit, MdCheckCircle } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { quotationService } from '../services/api';
import { formatCurrency, formatDate, resolveImageUrl } from '../utils/helpers';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QuotationPDF from '../components/QuotationPDF';
import Modal from '../components/Modal';

const Quotations = () => {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = async () => {
        try {
            const res = await quotationService.getAll();
            setQuotations(res.data);
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
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this quotation? This cannot be undone.")) {
            try {
                await quotationService.delete(id);
                fetchQuotations();
            } catch (err) {
                console.error("Error deleting:", err);
            }
        }
    };

    const handleFinalize = async (id) => {
        if (window.confirm("Finalize this quotation? It will become official.")) {
            try {
                await quotationService.finalize(id);
                fetchQuotations();
            } catch (err) {
                console.error("Error finalizing:", err);
            }
        }
    };

    const filteredQuotations = quotations.filter(q =>
        q.quotationNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customerId?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sales Quotes</h1>
                    <p className="text-slate-500 font-medium">Manage and track your professional trade quotations.</p>
                </div>
                <Link
                    to="/quotations/create"
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>New Quotation</span>
                </Link>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
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
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Syncing Quotation Data...</p>
                        </div>
                    ) : (
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
                                            <div className="font-bold text-slate-700">{q.customerId?.companyName}</div>
                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{q.customerId?.customerName}</div>
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
                                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${q.status === 'final'
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                    {q.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {q.status === 'draft' && (
                                                    <>
                                                        <button
                                                            onClick={() => navigate(`/quotations/edit/${q._id}`)}
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
                                                <button
                                                    onClick={() => handleViewDetails(q._id)}
                                                    className="p-2.5 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="View Profile"
                                                >
                                                    <MdVisibility size={18} />
                                                </button>

                                                <PDFDownloadLink document={<QuotationPDF quotation={q} />} fileName={`${q.quotationNo.replace(/\//g, '-')}.pdf`}>
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

                                                <button
                                                    onClick={() => handleDelete(q._id)}
                                                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                                    title="Purge Record"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
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
                                {selectedQuotation?.customerId?.logoUrl ? (
                                    <img src={resolveImageUrl(selectedQuotation.customerId.logoUrl)} alt="Logo" className="h-16 object-contain mb-4" />
                                ) : (
                                    <div className="text-center">
                                        <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">VISHAL</div>
                                        <div className="text-xl font-black tracking-tighter text-slate-900 mt-1">HARDWARES</div>
                                    </div>
                                )}
                                <div className="h-0.5 w-full bg-slate-900 mt-4"></div>
                                <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-[0.2em]">where quality meets value</div>
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

                        {/* Customer Info */}
                        <div className="p-8 border-b border-slate-200">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Issued To:</div>
                            <div className="text-lg font-black text-slate-900">{selectedQuotation?.customerId?.companyName}</div>
                            {selectedQuotation?.customerId?.billingAddress && (
                                <div className="text-xs font-medium text-slate-500 mt-1 uppercase leading-relaxed">
                                    {selectedQuotation.customerId.billingAddress.line1}, {selectedQuotation.customerId.billingAddress.city}
                                </div>
                            )}
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
                                {selectedQuotation?.customTerms && (
                                    <div className="max-w-sm">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</h4>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">{selectedQuotation.customTerms.substring(0, 150)}...</p>
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
                                <div className="h-0.5 w-48 bg-slate-200 mb-2 ml-auto"></div>
                                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Authorized Signatory</div>
                                <div className="text-sm font-black text-slate-900 mt-1 uppercase tracking-tight">Eco Pipe Company</div>
                                <div className="text-[10px] font-bold text-slate-500 mt-1">Date: {formatDate(new Date())}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <PDFDownloadLink
                            document={<QuotationPDF quotation={selectedQuotation} />}
                            fileName={`${selectedQuotation?.quotationNo.replace(/\//g, '-')}.pdf`}
                        >
                            {({ loading }) => (
                                <button className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white py-5 rounded-3xl font-black transition-all shadow-2xl uppercase tracking-[0.2em] text-[10px]">
                                    <MdPictureAsPdf size={20} className="text-primary-500" />
                                    {loading ? 'Compiling Official Assets...' : 'Download Official PDF Document'}
                                </button>
                            )}
                        </PDFDownloadLink>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Quotations;
