import React, { useState, useEffect } from 'react';
import { MdAdd, MdSearch, MdReceipt, MdDelete, MdEdit, MdPrint, MdVisibility } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { voucherService } from '../services/api';
import { formatDate } from '../utils/helpers';
import { pdf } from '@react-pdf/renderer';
import VoucherPDF from '../components/VoucherPDF';

import { useAuth } from '../context/AuthContext';

const Vouchers = ({ mode = 'grn' }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isVendorUser = user?.role === 'vendor' || String(user?.role || '').toLowerCase() === 'vendor';
    const isInvoiceMode = mode === 'invoice';
    const basePath = isInvoiceMode ? '/invoices' : '/grn';
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [companySettings, setCompanySettings] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [downloadingPdfId, setDownloadingPdfId] = useState(null);
    const itemsPerPage = 6;

    useEffect(() => {
        fetchVouchers();
        const fetchSettings = async () => {
            try {
                const { companySettingsService } = await import('../services/api');
                const res = await companySettingsService.get();
                setCompanySettings(res.data);
            } catch (err) {
                console.error("Failed to fetch settings", err);
            }
        };
        fetchSettings();
    }, []);

    const fetchVouchers = async () => {
        try {
            const res = await voucherService.getAll({ scope: isInvoiceMode ? 'invoice' : 'grn' });
            setVouchers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this voucher? (This does not auto-reverse physical stock)")) {
            try {
                await voucherService.delete(id);
                toast.success('Voucher deleted');
                fetchVouchers();
            } catch (err) {
                console.error(err);
                toast.error('Failed to delete voucher');
            }
        }
    };

    const handleDownloadPdf = async (voucher) => {
        try {
            setDownloadingPdfId(voucher._id);
            const blob = await pdf(<VoucherPDF voucher={voucher} companySettings={companySettings} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Voucher-${voucher.voucherNumber.replace(/\//g, '-')}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF');
        } finally {
            setDownloadingPdfId(null);
        }
    };

    const filteredVouchers = vouchers.filter(v =>
        v.voucherNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);
    const paginatedVouchers = filteredVouchers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{isInvoiceMode ? 'Sales Invoice' : 'Invoice Voucher'}</h1>
                    <p className="text-slate-500 font-medium">{isInvoiceMode ? 'Sales outward, customer billing and stock deduction' : 'Material inward, vendor invoice vouchers, and return management'}</p>
                </div>
                {!isVendorUser && (
                    <Link
                        to={`${basePath}/new`}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>{isInvoiceMode ? 'New Invoice' : 'New GRN Entry'}</span>
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                    <div className="relative flex-1 w-full text-slate-400 focus-within:text-primary-600 transition-colors">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                        <input
                            type="text"
                            placeholder={`Search by ${isInvoiceMode ? 'Invoice No or Customer' : 'GRN No, Vendor or Customer'}...`}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm text-slate-900 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>

                <div>
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">{isInvoiceMode ? 'Invoice Detail' : 'GRN Detail'}</th>
                                        <th className="px-8 py-5">{isInvoiceMode ? 'Customer' : 'Vendor / Link'}</th>
                                        <th className="px-8 py-5 text-center">Qty</th>
                                        <th className="px-8 py-5 text-center">Tax</th>
                                        <th className="px-8 py-5 text-right">Grand Total</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginatedVouchers.map((v) => (
                                        <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5 border-r border-slate-50">
                                                <div className="font-black text-slate-900 tracking-tight">{v.voucherNumber}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex gap-2">
                                                    <span>{formatDate(v.date)}</span>
                                                    <span className={`px-1 rounded ${v.voucherType === 'Invoice' ? 'bg-rose-100 text-rose-600' : v.voucherType === 'Purchase' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        {v.voucherType}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 border-r border-slate-50">
                                                <div className="font-bold text-slate-700">{['Invoice', 'Sale Return'].includes(v.voucherType) ? v.customerName : v.vendorName}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-1">{v.contactNumber || '-'}</div>
                                            </td>
                                            <td className="px-8 py-5 text-center border-r border-slate-50 font-black text-slate-500 text-sm">
                                                {v.totalQty}
                                            </td>
                                            <td className="px-8 py-5 text-center border-r border-slate-50 font-black text-slate-500 text-sm">
                                                ₹{v.totalTax}
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-slate-900 text-lg">
                                                ₹{v.grandTotal?.toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => navigate(`${basePath}/view/${v._id}`)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="View voucher"
                                                    >
                                                        <MdVisibility size={20} />
                                                    </button>
                                                    {!isVendorUser && (
                                                        <button
                                                            onClick={() => navigate(`${basePath}/${v._id}`)}
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                            title="Edit voucher"
                                                        >
                                                            <MdEdit size={20} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDownloadPdf(v)}
                                                        disabled={downloadingPdfId === v._id}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all disabled:opacity-50"
                                                        title="Print voucher"
                                                    >
                                                        <MdPrint size={20} />
                                                    </button>
                                                    {!isVendorUser && (
                                                        <button
                                                            onClick={() => handleDelete(v._id)}
                                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Delete voucher"
                                                        >
                                                            <MdDelete size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredVouchers.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">No records found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            
                            {totalPages > 1 && (
                                <div className="p-4 flex items-center justify-between bg-slate-50/50">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => p - 1)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-widest"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => p + 1)}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-widest"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Vouchers;
