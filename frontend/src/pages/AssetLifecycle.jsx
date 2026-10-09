import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { MdArrowBack, MdFileDownload, MdPictureAsPdf, MdSync } from 'react-icons/md';
import { csmService } from '../services/api';
import AssetActivityLog from '../components/AssetActivityLog';
import { filterActivity, formatActivityDate } from '../utils/assetActivity';

// Asset Lifecycle Detail of one serial number, as a full page (it used to be a popup on
// Invoice Bulk Upload): the record, its coverage and its activity log, with PDF / Excel export.

const MGR_FIELDS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const formatMgrVal = (mgr) => {
    if (!mgr) return '';
    if (typeof mgr === 'string') return mgr;
    if (mgr.code && mgr.description && mgr.code.toLowerCase() !== mgr.description.toLowerCase()) {
        return `${mgr.code} - ${mgr.description}`;
    }
    return mgr.description || mgr.code || '';
};

const resolveMgr = (asset, key) => {
    const product = asset?.productId;
    if (product && typeof product === 'object') return formatMgrVal(product[key]);
    return formatMgrVal(asset?.[key]);
};

const codeLabel = (doc) => (doc && typeof doc === 'object' ? [doc.code, doc.description].filter(Boolean).join(' - ') : '');

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '');
const formatDateTime = formatActivityDate;

const AssetLifecycle = () => {
    const { serialNumber: rawSerial } = useParams();
    const serialNumber = decodeURIComponent(rawSerial || '');
    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [category, setCategory] = useState('All');

    const load = async () => {
        setLoading(true);
        setNotFound(false);
        try {
            const [summaryRes, activityRes] = await Promise.all([
                csmService.getAssetSummary({ serialNumber }),
                csmService.getAssetActivity(serialNumber)
            ]);
            setSummary(summaryRes.data);
            setActivity(activityRes.data?.activity || []);
        } catch (err) {
            console.error('Error loading asset lifecycle:', err);
            if (err.response?.status === 404) setNotFound(true);
            else toast.error(err.response?.data?.message || 'Failed to load asset details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [serialNumber]); // eslint-disable-line react-hooks/exhaustive-deps

    const asset = summary?.asset;
    const isCovered = summary?.warranty?.status === 'Active' || Boolean(summary?.amc);

    // Field / value pairs shared by the page, the PDF and the Excel export.
    const detailRows = useMemo(() => {
        if (!asset) return [];
        const customer = asset.customerId?.companyName || asset.customerId?.customerName || asset.customerNameStr || 'Stock (Unsold)';
        return [
            ['Serial Number', asset.serialNumber],
            ['Status', asset.status || 'IN_STOCK'],
            ['Customer', customer],
            ['Customer Code', asset.customerCode || asset.customerId?.externalCode || ''],
            ['Product Name', asset.productId?.productName || asset.productName || ''],
            ['Product Code', asset.productId?.productCode || asset.productCode || ''],
            ['Invoice Number', asset.invoiceNumber || ''],
            ['Date of Sale', formatDate(asset.saleDate || asset.invoiceDate)],
            ['Postal Code', asset.customerPostalCode || ''],
            ['Location', asset.location || ''],
            ['Division', codeLabel(asset.divisionId)],
            ['Segment', codeLabel(asset.segmentId)],
            ['Indicator', asset.indicatorField || ''],
            ['Project', [asset.projectCode, asset.projectName].filter(Boolean).join(' - ')],
            ...MGR_FIELDS.map((key, i) => [`MGR ${i + 1}`, resolveMgr(asset, key)]),
            ['Coverage', isCovered ? 'Covered (Warranty/AMC)' : 'Out of Warranty/AMC'],
            ['Warranty Expiry', formatDate(summary?.warranty?.expiryDate)],
            ['Last Service', formatDate(summary?.lastServiceDate)],
            ['Open Tickets', String(summary?.ticketCounts?.open ?? 0)],
            ['Closed Tickets', String(summary?.ticketCounts?.closed ?? 0)]
        ];
    }, [asset, summary, isCovered]);

    const visibleActivity = useMemo(() => filterActivity(activity, category), [activity, category]);

    const activityExportRows = visibleActivity.map(a => ({
        'Date & Time': formatDateTime(a.date),
        Category: a.category,
        Activity: a.action,
        Reference: a.reference || '',
        Customer: a.customer || '',
        Status: a.status || '',
        Details: a.details || '',
        By: a.by || ''
    }));

    const fileBase = `Serial_${serialNumber.replace(/[^A-Za-z0-9_-]/g, '_')}_Activity_${new Date().toISOString().slice(0, 10)}`;

    const handleExportExcel = () => {
        if (!asset) return;
        const wb = XLSX.utils.book_new();
        const details = XLSX.utils.aoa_to_sheet([['Field', 'Value'], ...detailRows]);
        details['!cols'] = [{ wch: 18 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, details, 'Asset Details');
        const log = XLSX.utils.json_to_sheet(activityExportRows.length ? activityExportRows : [{ 'Date & Time': 'No activity recorded' }]);
        log['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 60 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, log, 'Activity Log');
        XLSX.writeFile(wb, `${fileBase}.xlsx`);
        toast.success('Excel exported');
    };

    const handleExportPdf = () => {
        if (!asset) return;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 36;
        let y = margin;

        const ensureSpace = (needed) => {
            if (y + needed > pageHeight - margin) {
                doc.addPage();
                y = margin;
                return true;
            }
            return false;
        };

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Asset Lifecycle Detail', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(110);
        doc.text(`Serial ${asset.serialNumber}  |  Generated ${formatDateTime(new Date())}`, margin, y + 14);
        doc.setTextColor(0);
        y += 34;

        // Asset details: two field/value columns.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Asset Details', margin, y);
        y += 14;
        doc.setFontSize(9);
        const colWidth = (pageWidth - margin * 2) / 2;
        const labelWidth = 90;
        for (let i = 0; i < detailRows.length; i += 2) {
            const pair = detailRows.slice(i, i + 2);
            const heights = pair.map(([, value]) => doc.splitTextToSize(String(value || '-'), colWidth - labelWidth - 10).length);
            const rowHeight = Math.max(...heights) * 11 + 3;
            ensureSpace(rowHeight);
            pair.forEach(([label, value], j) => {
                const x = margin + j * colWidth;
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(110);
                doc.text(label, x, y);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0);
                doc.text(doc.splitTextToSize(String(value || '-'), colWidth - labelWidth - 10), x + labelWidth, y);
            });
            y += rowHeight;
        }

        // Activity log table.
        y += 12;
        ensureSpace(40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Activity Log${category !== 'All' ? ` (${category})` : ''}`, margin, y);
        y += 10;

        const columns = [
            { key: 'Date & Time', width: 95 },
            { key: 'Category', width: 70 },
            { key: 'Activity', width: 100 },
            { key: 'Reference', width: 100 },
            { key: 'Customer', width: 110 },
            { key: 'Status', width: 60 },
            { key: 'Details', width: 165 },
            { key: 'By', width: 70 }
        ];
        const drawHeader = () => {
            doc.setFillColor(226, 243, 239);
            doc.rect(margin, y, pageWidth - margin * 2, 16, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            let x = margin + 4;
            columns.forEach(c => { doc.text(c.key, x, y + 11); x += c.width; });
            y += 20;
            doc.setFont('helvetica', 'normal');
        };
        drawHeader();

        if (!activityExportRows.length) {
            doc.text('No activity recorded.', margin + 4, y + 8);
        }
        activityExportRows.forEach((row) => {
            const cells = columns.map(c => doc.splitTextToSize(String(row[c.key] || ''), c.width - 8));
            const rowHeight = Math.max(...cells.map(lines => lines.length)) * 10 + 6;
            if (ensureSpace(rowHeight)) drawHeader();
            let x = margin + 4;
            cells.forEach((lines, i) => { doc.text(lines, x, y + 2); x += columns[i].width; });
            y += rowHeight;
            doc.setDrawColor(230);
            doc.line(margin, y - 4, pageWidth - margin, y - 4);
        });

        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(140);
            doc.text(`Page ${p} of ${pages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
        }
        doc.save(`${fileBase}.pdf`);
        toast.success('PDF exported');
    };

    const statusBadge = (status) => (
        status === 'SOLD' ? 'bg-blue-50 text-blue-600 border-blue-200'
            : status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : status === 'RETURN' || status === 'RETURNED' ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate('/serial-no-master')}
                        className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1 transition-all cursor-pointer"
                    >
                        <MdArrowBack size={14} /> Back to Invoice Bulk Upload
                    </button>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit">Asset Lifecycle Detail</h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Serial <span className="font-mono font-black text-slate-800">{serialNumber}</span> — record, coverage and full activity log.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={load}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200 shadow-sm"
                    >
                        <MdSync size={18} /> Refresh
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={!asset}
                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md shadow-teal-600/10"
                    >
                        <MdFileDownload size={18} /> Export Excel
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={!asset}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md shadow-rose-600/10"
                    >
                        <MdPictureAsPdf size={18} /> Export PDF
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-slate-400 font-medium bg-white rounded-[2rem] border border-slate-200">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                    <p className="text-xs uppercase font-black tracking-widest">Loading asset history...</p>
                </div>
            ) : notFound || !asset ? (
                <div className="py-16 text-center text-slate-400 text-sm font-semibold bg-white rounded-[2rem] border border-slate-200">
                    No Invoice Bulk Upload record found for serial "{serialNumber}".
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Asset details */}
                        <div className="xl:col-span-2 p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Asset Details</span>
                                <div className="flex gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge(asset.status)}`}>
                                        Status: {asset.status || 'IN_STOCK'}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${isCovered ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                                        {isCovered ? 'Covered' : 'Out of Warranty/AMC'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold text-slate-600">
                                {detailRows
                                    .filter(([label]) => !label.startsWith('MGR') && !['Status', 'Coverage', 'Warranty Expiry', 'Last Service', 'Open Tickets', 'Closed Tickets'].includes(label))
                                    .map(([label, value]) => (
                                        <div key={label}>
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                                            <span className={`text-sm font-bold ${value ? 'text-slate-900' : 'text-slate-300'} ${label === 'Serial Number' ? 'font-mono' : ''}`}>
                                                {value || 'N/A'}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                            <div>
                                <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">MGR 1 – 5 (from Product Master)</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {MGR_FIELDS.map((key, i) => {
                                        const value = resolveMgr(asset, key);
                                        return (
                                            <span
                                                key={key}
                                                className={`px-2 py-0.5 rounded-md border text-[10px] ${value ? 'bg-teal-50 text-teal-700 border-teal-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200 font-normal italic'}`}
                                            >
                                                MGR {i + 1}: {value || 'Not assigned'}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Coverage & service */}
                        <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm space-y-4">
                            <span className="block text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-3">Coverage & Service</span>
                            {[
                                ['Warranty', summary?.warranty ? `${summary.warranty.status || ''}${summary.warranty.expiryDate ? ` · until ${formatDate(summary.warranty.expiryDate)}` : ''}` : 'None'],
                                ['AMC', summary?.amc ? `${summary.amc.contractNo || 'Active'} · until ${formatDate(summary.amc.endDate)}` : 'None'],
                                ['Last Service', formatDate(summary?.lastServiceDate) || 'None'],
                                ['Open Tickets', summary?.ticketCounts?.open ?? 0],
                                ['Closed Tickets', summary?.ticketCounts?.closed ?? 0]
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between text-xs">
                                    <span className="font-black uppercase tracking-widest text-[9px] text-slate-400">{label}</span>
                                    <span className="font-bold text-slate-900">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity log, shared with Serial No Transfer */}
                    <AssetActivityLog activity={activity} category={category} onCategoryChange={setCategory} />
                </>
            )}
        </div>
    );
};

export default AssetLifecycle;
