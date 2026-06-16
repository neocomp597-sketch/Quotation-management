import React, { useState, useEffect } from 'react';
import { payrollService, companySettingsService } from '../services/api';
import { toast } from 'react-toastify';
import { pdf } from '@react-pdf/renderer';
import PayslipPDF from '../components/PayslipPDF';
import { fetchPdfImageBase64 } from '../utils/helpers';
import { 
    MdReceipt, MdPictureAsPdf, MdDownload, 
    MdVisibility, MdPrint
} from 'react-icons/md';

const PayrollPayslips = () => {
    const [runs, setRuns] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedRunId, setSelectedRunId] = useState('');
    const [summaries, setSummaries] = useState([]);
    const [settings, setSettings] = useState(null);
    const [companySettings, setCompanySettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pdfLoadingId, setPdfLoadingId] = useState(null);

    const loadPayslipImages = async () => {
        const urls = [companySettings?.logoUrl, settings?.companySealUrl, settings?.signatureUrl].filter(Boolean);
        const imageMap = {};

        await Promise.all(urls.map(async (url) => {
            imageMap[url] = await fetchPdfImageBase64(url);
        }));

        return imageMap;
    };

    const fetchConfig = async () => {
        try {
            const [settingsRes, companyRes] = await Promise.all([
                payrollService.getSettings(),
                companySettingsService.get()
            ]);
            setSettings(settingsRes.data);
            setCompanySettings(companyRes.data);
        } catch (error) {
            console.error('Failed to load settings', error);
        }
    };

    const fetchRuns = async () => {
        try {
            setLoading(true);
            const res = await payrollService.getRuns();
            const completedRuns = (res.data || []).filter(r => ['approved', 'locked'].includes(r.status));
            setRuns(completedRuns);
            if (completedRuns.length > 0) {
                setSelectedMonth(completedRuns[0].month);
                setSelectedRunId(completedRuns[0]._id);
            }
        } catch (error) {
            console.error('Failed to fetch runs', error);
            toast.error('Failed to load payroll months');
        } finally {
            setLoading(false);
        }
    };

    const fetchPayslips = async (runId) => {
        if (!runId) return;
        try {
            setLoading(true);
            const res = await payrollService.getRunDetails(runId);
            setSummaries(res.data.summaries || []);
        } catch (error) {
            console.error('Failed to load payslips list', error);
            toast.error('Failed to load payslips register');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchRuns();
    }, []);

    useEffect(() => {
        if (selectedRunId) {
            fetchPayslips(selectedRunId);
        }
    }, [selectedRunId]);

    const handleMonthChange = (e) => {
        const monthVal = e.target.value;
        setSelectedMonth(monthVal);
        const matchedRun = runs.find(r => r.month === monthVal);
        if (matchedRun) {
            setSelectedRunId(matchedRun._id);
        }
    };

    const handleDownloadSinglePdf = async (summary) => {
        try {
            setPdfLoadingId(summary._id);
            const images = await loadPayslipImages();
            const blob = await pdf(
                <PayslipPDF 
                    summary={summary} 
                    settings={settings} 
                    companySettings={companySettings} 
                    images={images}
                />
            ).toBlob();
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Payslip-${summary.basicDetails?.name?.replace(/\s+/g, '_')}-${summary.month}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success(`Payslip for ${summary.basicDetails?.name} downloaded!`);
        } catch (error) {
            console.error('PDF generation error', error);
            toast.error('Failed to generate PDF payslip');
        } finally {
            setPdfLoadingId(null);
        }
    };

    const handleDownloadBulkPdf = async () => {
        if (summaries.length === 0) return;
        const confirmBulk = window.confirm(`Are you sure you want to download payslips for all ${summaries.length} employees? This will trigger browser downloads sequentially.`);
        if (!confirmBulk) return;

        try {
            const images = await loadPayslipImages();
            for (const sum of summaries) {
                toast.info(`Preparing payslip for ${sum.basicDetails?.name}...`);
                const blob = await pdf(
                    <PayslipPDF 
                        summary={sum} 
                        settings={settings} 
                        companySettings={companySettings} 
                        images={images}
                    />
                ).toBlob();
                
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Payslip-${sum.basicDetails?.name?.replace(/\s+/g, '_')}-${sum.month}.pdf`;
                link.click();
                // A short sleep to prevent browser from throttling multiple rapid files
                await new Promise(r => setTimeout(r, 1000));
                URL.revokeObjectURL(url);
            }
            toast.success('All payslips downloaded successfully!');
        } catch (error) {
            console.error('Bulk PDF download error', error);
            toast.error('Failed to generate one or more payslips in bulk');
        }
    };

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payslips Manager</h1>
                    <p className="text-slate-500 font-medium">Download individual employee payslips or trigger bulk downloads for verified registers.</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {runs.length > 0 && (
                        <div className="w-full md:w-56">
                            <select
                                value={selectedMonth}
                                onChange={handleMonthChange}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold text-slate-700"
                            >
                                {runs.map(r => (
                                    <option key={r._id} value={r.month}>
                                        {formatMonthName(r.month)} ({r.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {summaries.length > 0 && (
                        <button
                            onClick={handleDownloadBulkPdf}
                            className="flex items-center justify-center gap-1.5 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 text-sm w-full md:w-auto"
                        >
                            <MdDownload size={18} />
                            Download Bulk Payslips
                        </button>
                    )}
                </div>
            </div>

            {runs.length === 0 ? (
                <div className="bg-white p-16 text-center border border-slate-100 shadow-sm rounded-3xl font-bold text-slate-400">
                    No approved or locked payroll month runs found. Run and approve a payroll run first!
                </div>
            ) : (
                <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                        </div>
                    ) : summaries.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 font-bold">
                            No employees summary found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Designation</th>
                                        <th className="px-6 py-4">Gross Earnings</th>
                                        <th className="px-6 py-4">Net Payout</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {summaries.map((sum) => (
                                        <tr key={sum._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-slate-900 font-bold">{sum.basicDetails?.name}</p>
                                                <p className="text-xs text-slate-400">{sum.basicDetails?.department}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {sum.basicDetails?.designation || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-750">
                                                ₹{(sum.calculatedValues?.grossSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-teal-650 font-bold">
                                                ₹{(sum.calculatedValues?.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        onClick={() => handleDownloadSinglePdf(sum)}
                                                        disabled={pdfLoadingId === sum._id}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-primary-50 hover:bg-primary-600 text-primary-700 hover:text-white rounded-xl transition-all text-xs font-black"
                                                    >
                                                        {pdfLoadingId === sum._id ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-500 border-t-transparent"></div>
                                                                Loading...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MdPictureAsPdf size={14} />
                                                                Print Payslip
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PayrollPayslips;
