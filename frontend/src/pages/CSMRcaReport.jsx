import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { csmService } from '../services/api';
import { 
    MdAssessment, MdAdd, MdPrint, MdRefresh, MdDelete, 
    MdEdit, MdArrowBack, MdSave, MdFormatListBulleted, MdCheckCircle,
    MdTune, MdFactCheck, MdAssignmentTurnedIn, MdHistory, MdVisibility,
    MdPictureAsPdf, MdDownload
} from 'react-icons/md';
import { toast } from 'react-toastify';

const INITIAL_FORM = {
    rcaNumber: '',
    ticketNo: '',
    date: new Date().toISOString().split('T')[0],
    department: 'Quality',
    priority: 'Medium',
    problemStatement: '',
    impact: '',
    fiveWhys: [
        { whyNo: 1, analysis: '' },
        { whyNo: 2, analysis: '' },
        { whyNo: 3, analysis: '' },
        { whyNo: 4, analysis: '' },
        { whyNo: 5, analysis: '' }
    ],
    category: 'Man / People',
    rootCause: '',
    capaActions: [
        { actionType: 'Corrective', action: '', responsiblePerson: '', targetDate: '', status: 'Open' },
        { actionType: 'Preventive', action: '', responsiblePerson: '', targetDate: '', status: 'Open' }
    ],
    verificationDate: '',
    effectiveness: 'Effective',
    verificationRemarks: ''
};

const CSMRcaReport = () => {
    const [reports, setReports] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [isManualTicket, setIsManualTicket] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'view' | 'form'
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [formData, setFormData] = useState(INITIAL_FORM);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await csmService.getRcaReports();
            setReports(res.data || []);
        } catch (error) {
            console.error('Fetch RCA error:', error);
            toast.error('Failed to load RCA reports');
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await csmService.getTickets({ limit: 200 });
            const list = res.data?.tickets || res.data?.data || (Array.isArray(res.data) ? res.data : []);
            setTickets(list);
        } catch (error) {
            console.error('Fetch tickets error:', error);
        }
    };

    useEffect(() => {
        fetchReports();
        fetchTickets();
    }, []);

    const populateForm = (report) => {
        const existsInTickets = tickets.some(t => t.ticketNo === report.ticketNo);
        setIsManualTicket(Boolean(report.ticketNo && !existsInTickets));
        setFormData({
            rcaNumber: report.rcaNumber || '',
            ticketNo: report.ticketNo || '',
            date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
            department: report.department || 'Quality',
            priority: report.priority || 'Medium',
            problemStatement: report.problemStatement || '',
            impact: report.impact || '',
            fiveWhys: report.fiveWhys && report.fiveWhys.length === 5 ? report.fiveWhys : INITIAL_FORM.fiveWhys,
            category: report.category || 'Man / People',
            rootCause: report.rootCause || '',
            capaActions: report.capaActions && report.capaActions.length > 0 ? report.capaActions.map(c => ({
                ...c,
                targetDate: c.targetDate ? new Date(c.targetDate).toISOString().split('T')[0] : ''
            })) : INITIAL_FORM.capaActions,
            verificationDate: report.verificationDate ? new Date(report.verificationDate).toISOString().split('T')[0] : '',
            effectiveness: report.effectiveness || 'Effective',
            verificationRemarks: report.verificationRemarks || ''
        });
    };

    const handleCreateNew = () => {
        setSelectedReportId(null);
        setIsManualTicket(false);
        setFormData({
            ...INITIAL_FORM,
            rcaNumber: `RCA-2026-${String(reports.length + 1).padStart(3, '0')}`,
            date: new Date().toISOString().split('T')[0]
        });
        setViewMode('form');
    };

    const handleView = (report) => {
        setSelectedReportId(report._id);
        populateForm(report);
        setViewMode('view');
    };

    const handleEdit = (report) => {
        setSelectedReportId(report._id);
        populateForm(report);
        setViewMode('form');
    };

    const handleDownloadPdf = async (report) => {
        const targetReport = report || (selectedReportId ? reports.find(r => r._id === selectedReportId) : null);
        if (report) {
            setSelectedReportId(report._id);
            populateForm(report);
        }
        setViewMode('view');
        toast.info('Generating PDF file download...');

        setTimeout(async () => {
            const element = document.getElementById('rca-document-sheet');
            if (!element) {
                toast.error('RCA document sheet container not found');
                return;
            }

            try {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const imgWidth = pdfWidth - 20; // 10mm left/right margin
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                let heightLeft = imgHeight;
                let position = 10;

                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= (pdfHeight - 20);

                while (heightLeft > 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= (pdfHeight - 20);
                }

                const docName = targetReport?.rcaNumber || formData.rcaNumber || 'RCA-Report';
                pdf.save(`${docName.replace(/\//g, '-')}.pdf`);
                toast.success('RCA Report downloaded successfully as PDF!');
            } catch (err) {
                console.error('PDF Download Error:', err);
                toast.error('Failed to download PDF file');
            }
        }, 400);
    };

    const handlePrintReport = (report) => {
        if (report) {
            setSelectedReportId(report._id);
            populateForm(report);
        }
        setViewMode('view');
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleTicketSelect = (selectedNo) => {
        const found = tickets.find(t => t.ticketNo === selectedNo);
        setFormData(prev => ({
            ...prev,
            ticketNo: selectedNo,
            problemStatement: prev.problemStatement || (found ? (found.issueTitle || found.description || '') : prev.problemStatement)
        }));
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleWhyChange = (index, value) => {
        const updated = [...formData.fiveWhys];
        updated[index].analysis = value;
        setFormData(prev => ({ ...prev, fiveWhys: updated }));
    };

    const handleCapaChange = (index, field, value) => {
        const updated = [...formData.capaActions];
        updated[index][field] = value;
        setFormData(prev => ({ ...prev, capaActions: updated }));
    };

    const addCapaRow = () => {
        setFormData(prev => ({
            ...prev,
            capaActions: [
                ...prev.capaActions,
                { actionType: 'Corrective', action: '', responsiblePerson: '', targetDate: '', status: 'Open' }
            ]
        }));
    };

    const removeCapaRow = (index) => {
        if (formData.capaActions.length <= 1) {
            toast.warning('At least one CAPA action is required');
            return;
        }
        setFormData(prev => ({
            ...prev,
            capaActions: prev.capaActions.filter((_, i) => i !== index)
        }));
    };

    const handleReset = () => {
        if (selectedReportId) {
            const report = reports.find(r => r._id === selectedReportId);
            if (report) populateForm(report);
        } else {
            handleCreateNew();
        }
        toast.info('Form reset to original state');
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            if (selectedReportId) {
                await csmService.updateRcaReport(selectedReportId, formData);
                toast.success('RCA Report updated successfully');
            } else {
                await csmService.createRcaReport(formData);
                toast.success('RCA Report saved successfully');
            }
            await fetchReports();
            setViewMode('list');
        } catch (error) {
            console.error('Save RCA error:', error);
            toast.error(error.response?.data?.message || 'Failed to save RCA report');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Top Navigation & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 no-print">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-200 dark:border-teal-800/60 shadow-sm">
                            <MdAssessment size={22} />
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 font-outfit uppercase">
                            Root Cause Analysis (RCA)
                        </h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold text-xs sm:text-sm pl-11">
                        Standardized 5-Why Problem Solving, Root Cause Categorization & CAPA Management
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {viewMode !== 'list' ? (
                        <>
                            <button
                                onClick={() => setViewMode('list')}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                            >
                                <MdArrowBack size={18} /> Back to Register
                            </button>

                            {viewMode === 'view' && (
                                <button
                                    onClick={() => setViewMode('form')}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    <MdEdit size={18} /> Edit Report
                                </button>
                            )}

                            {viewMode === 'form' && selectedReportId && (
                                <button
                                    onClick={() => setViewMode('view')}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    <MdVisibility size={18} /> View Document
                                </button>
                            )}

                            <button
                                onClick={() => handleDownloadPdf()}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                                title="Download / Save as PDF Document"
                            >
                                <MdPictureAsPdf size={18} /> Download PDF
                            </button>

                            <button
                                onClick={() => handlePrintReport()}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                            >
                                <MdPrint size={18} /> Print RCA
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={fetchReports}
                                className="p-3 text-slate-600 dark:text-slate-300 hover:text-slate-900 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                title="Refresh Register"
                            >
                                <MdRefresh size={20} />
                            </button>
                            <button
                                onClick={handleCreateNew}
                                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-teal-500/20 active:scale-95"
                            >
                                <MdAdd size={20} /> Create New RCA
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* REGISTER LIST VIEW */}
            {viewMode === 'list' && (
                <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider flex items-center gap-2">
                            <MdFormatListBulleted size={18} /> RCA Register ({reports.length})
                        </span>
                    </div>

                    {loading ? (
                        <div className="text-center py-16 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
                            Loading RCA reports register...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-16 space-y-3">
                            <MdAssessment size={48} className="mx-auto text-slate-300 dark:text-slate-700" />
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">No RCA Reports created yet.</p>
                            <button
                                onClick={handleCreateNew}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                            >
                                Create First RCA Report
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                        <th className="pb-3 pl-4">RCA Number</th>
                                        <th className="pb-3">Ticket No</th>
                                        <th className="pb-3">Date</th>
                                        <th className="pb-3">Department</th>
                                        <th className="pb-3">Priority</th>
                                        <th className="pb-3">Category</th>
                                        <th className="pb-3 text-right pr-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {reports.map((report) => (
                                        <tr key={report._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="py-4 pl-4 font-black text-slate-900 dark:text-slate-100">{report.rcaNumber}</td>
                                            <td className="py-4 font-bold text-teal-700 dark:text-teal-400">{report.ticketNo || '-'}</td>
                                            <td className="py-4 text-xs text-slate-500 dark:text-slate-400 font-bold">
                                                {new Date(report.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 font-bold text-slate-800 dark:text-slate-200">{report.department}</td>
                                            <td className="py-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                    report.priority === 'High' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                                    report.priority === 'Medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                    {report.priority}
                                                </span>
                                            </td>
                                            <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-300">{report.category}</td>
                                            <td className="py-4 text-right pr-4 space-x-1.5">
                                                {/* View Button */}
                                                <button
                                                    onClick={() => handleView(report)}
                                                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-200/50 dark:border-indigo-800/50"
                                                    title="View RCA Document"
                                                >
                                                    <MdVisibility size={16} />
                                                </button>
                                                {/* Edit Button */}
                                                <button
                                                    onClick={() => handleEdit(report)}
                                                    className="p-2 text-teal-600 dark:text-teal-400 hover:text-teal-800 bg-teal-50 dark:bg-teal-950/60 rounded-xl hover:bg-teal-100 transition-all border border-teal-200/50 dark:border-teal-800/50"
                                                    title="Edit RCA Report"
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                {/* Download PDF Button */}
                                                <button
                                                    onClick={() => handleDownloadPdf(report)}
                                                    className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200/50 dark:border-emerald-800/50"
                                                    title="Download PDF"
                                                >
                                                    <MdPictureAsPdf size={16} />
                                                </button>
                                                {/* Print Button */}
                                                <button
                                                    onClick={() => handlePrintReport(report)}
                                                    className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200/60 dark:border-slate-700/60"
                                                    title="Print Report"
                                                >
                                                    <MdPrint size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW READ-ONLY DOCUMENT MODE */}
            {viewMode === 'view' && (
                <div id="rca-document-sheet" className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-10 space-y-6 print-container max-w-5xl mx-auto text-slate-900">
                    {/* Quality Header Block */}
                    <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
                        <div>
                            <span className="text-[10px] font-black uppercase text-teal-800 tracking-widest block mb-1">
                                Quality & Technical Audit Document
                            </span>
                            <h2 className="text-2xl font-black font-outfit uppercase tracking-tight text-slate-900">
                                ROOT CAUSE ANALYSIS (RCA) REPORT
                            </h2>
                            <p className="text-xs text-slate-500 font-semibold">
                                Customer Service & Technical Quality Root Cause Investigation
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-black text-slate-900">{formData.rcaNumber || 'RCA-DRAFT'}</div>
                            <div className="text-xs font-bold text-slate-500">Date: {formData.date || new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Incident Information */}
                    <div className="space-y-2">
                        <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-widest">
                            1. Incident Overview
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Ticket No</span>
                                <span className="font-extrabold text-teal-800">{formData.ticketNo || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Department</span>
                                <span className="font-extrabold text-slate-800">{formData.department}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Priority</span>
                                <span className="font-extrabold text-slate-800">{formData.priority}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Date</span>
                                <span className="font-extrabold text-slate-800">{formData.date}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="block text-[10px] font-black uppercase text-slate-500 mb-1">Problem Statement</span>
                                <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap">{formData.problemStatement || 'None specified'}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="block text-[10px] font-black uppercase text-slate-500 mb-1">Impact Analysis</span>
                                <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap">{formData.impact || 'None specified'}</p>
                            </div>
                        </div>
                    </div>

                    {/* 5-Why Analysis */}
                    <div className="space-y-2">
                        <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-widest">
                            2. 5-Why Root Cause Breakdown
                        </div>
                        <table className="w-full border-collapse border border-slate-200 text-xs">
                            <thead>
                                <tr className="bg-slate-100 font-black uppercase text-[10px] text-slate-600 border-b border-slate-200">
                                    <th className="p-2 w-12 text-center border-r border-slate-200">Why #</th>
                                    <th className="p-2 text-left">Analysis Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {formData.fiveWhys.map((w) => (
                                    <tr key={w.whyNo}>
                                        <td className="p-2 text-center font-black bg-slate-50 border-r border-slate-200 text-teal-800">
                                            Why {w.whyNo}
                                        </td>
                                        <td className="p-2 font-semibold text-slate-800">{w.analysis || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Category & Final Root Cause */}
                    <div className="space-y-2">
                        <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-widest">
                            3. Categorization & Root Cause
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Category</span>
                                <span className="font-extrabold text-slate-900">{formData.category}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 mb-0.5">Confirmed Root Cause</span>
                                <span className="font-extrabold text-rose-700">{formData.rootCause || 'Not specified'}</span>
                            </div>
                        </div>
                    </div>

                    {/* CAPA Actions */}
                    <div className="space-y-2">
                        <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-widest">
                            4. Corrective & Preventive Actions (CAPA)
                        </div>
                        <table className="w-full border-collapse border border-slate-200 text-xs">
                            <thead>
                                <tr className="bg-slate-100 font-black uppercase text-[10px] text-slate-600 border-b border-slate-200">
                                    <th className="p-2 text-left border-r border-slate-200">Action Type</th>
                                    <th className="p-2 text-left border-r border-slate-200">Action Plan</th>
                                    <th className="p-2 text-left border-r border-slate-200">Responsible</th>
                                    <th className="p-2 text-left border-r border-slate-200">Target Date</th>
                                    <th className="p-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-semibold text-slate-800">
                                {formData.capaActions.map((c, i) => (
                                    <tr key={i}>
                                        <td className="p-2 font-black border-r border-slate-200 text-teal-800">{c.actionType || 'Action'}</td>
                                        <td className="p-2 border-r border-slate-200">{c.action || '-'}</td>
                                        <td className="p-2 border-r border-slate-200">{c.responsiblePerson || '-'}</td>
                                        <td className="p-2 border-r border-slate-200">{c.targetDate || '-'}</td>
                                        <td className="p-2 font-bold">{c.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Verification */}
                    <div className="space-y-2">
                        <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-widest">
                            5. Effectiveness Verification
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Verification Date</span>
                                <span className="font-extrabold text-slate-900">{formData.verificationDate || 'Pending'}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Effectiveness</span>
                                <span className="font-extrabold text-emerald-700">{formData.effectiveness}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400">Remarks</span>
                                <span className="font-bold text-slate-700">{formData.verificationRemarks || 'None'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sign-off / Print Footer */}
                    <div className="pt-8 border-t border-slate-300 grid grid-cols-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <div>
                            <div className="h-10"></div>
                            <div className="border-t border-slate-300 pt-1">Prepared By (Quality Engg)</div>
                        </div>
                        <div>
                            <div className="h-10"></div>
                            <div className="border-t border-slate-300 pt-1">Reviewed By (HOD)</div>
                        </div>
                        <div>
                            <div className="h-10"></div>
                            <div className="border-t border-slate-300 pt-1">Approved By (Plant / CS Head)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDITABLE FORM MODE */}
            {viewMode === 'form' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-8 print-container max-w-5xl mx-auto">
                    
                    {/* Header Bar within Card (Status Removed) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-outfit uppercase tracking-tight">
                                    Quality Standard RCA Sheet
                                </h2>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold pl-4 mt-0.5">
                                Customer Service & Technical Quality Root Cause Investigation
                            </p>
                        </div>
                    </div>

                    {/* Section 1: Incident Details */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdFactCheck size={18} /> 1. Incident Details
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    RCA Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.rcaNumber}
                                    onChange={(e) => handleInputChange('rcaNumber', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="RCA-2026-001"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Ticket No.
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsManualTicket(!isManualTicket)}
                                        className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline transition-all"
                                    >
                                        {isManualTicket ? '📋 Select Dropdown' : '✏️ Manual Entry'}
                                    </button>
                                </div>

                                {!isManualTicket ? (
                                    <select
                                        value={formData.ticketNo}
                                        onChange={(e) => {
                                            if (e.target.value === '__MANUAL__') {
                                                setIsManualTicket(true);
                                            } else {
                                                handleTicketSelect(e.target.value);
                                            }
                                        }}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    >
                                        <option value="">-- Select Ticket No. --</option>
                                        {tickets.map((t) => (
                                            <option key={t._id} value={t.ticketNo}>
                                                {t.ticketNo} {t.issueTitle ? `- ${t.issueTitle}` : t.customerId?.customerName ? `- ${t.customerId.customerName}` : ''}
                                            </option>
                                        ))}
                                        <option value="__MANUAL__">✍️ Type Custom / Manual Ticket No.</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.ticketNo}
                                        onChange={(e) => handleInputChange('ticketNo', e.target.value)}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                        placeholder="e.g. CSM-2026-0005"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => handleInputChange('date', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Department
                                </label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => handleInputChange('department', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                >
                                    <option value="IT">IT</option>
                                    <option value="Purchase">Purchase</option>
                                    <option value="Production">Production</option>
                                    <option value="Quality">Quality</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Customer Service">Customer Service</option>
                                    <option value="R&D / Engineering">R&D / Engineering</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Priority
                                </label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => handleInputChange('priority', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Problem Statement
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.problemStatement}
                                    onChange={(e) => handleInputChange('problemStatement', e.target.value)}
                                    placeholder="Describe the problem clearly..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none min-h-[90px] resize-y"
                                ></textarea>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Impact
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.impact}
                                    onChange={(e) => handleInputChange('impact', e.target.value)}
                                    placeholder="Describe business/production/customer impact..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none min-h-[90px] resize-y"
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Root Cause Analysis - 5 Why */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdHistory size={18} /> 2. Root Cause Analysis – 5 Why
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-left font-black uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="p-3.5 w-16 text-center">Why</th>
                                        <th className="p-3.5">Analysis Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {formData.fiveWhys.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3 text-center font-black text-teal-700 dark:text-teal-400 bg-slate-50/80 dark:bg-slate-800/40 border-r border-slate-200/60 dark:border-slate-700/60">
                                                {item.whyNo}
                                            </td>
                                            <td className="p-2.5">
                                                <input
                                                    type="text"
                                                    value={item.analysis}
                                                    onChange={(e) => handleWhyChange(idx, e.target.value)}
                                                    placeholder={
                                                        idx === 0 ? "Why did the problem occur?" :
                                                        idx === 1 ? "Why did this happen?" :
                                                        idx === 4 ? "Final root cause" : "Why?"
                                                    }
                                                    className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: Root Cause Category */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdTune size={18} /> 3. Root Cause Category
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Category
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleInputChange('category', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                >
                                    <option value="Man / People">Man / People</option>
                                    <option value="Machine">Machine</option>
                                    <option value="Method / Process">Method / Process</option>
                                    <option value="Material">Material</option>
                                    <option value="Measurement">Measurement</option>
                                    <option value="Environment">Environment</option>
                                    <option value="System / IT">System / IT</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Root Cause
                                </label>
                                <input
                                    type="text"
                                    value={formData.rootCause}
                                    onChange={(e) => handleInputChange('rootCause', e.target.value)}
                                    placeholder="Enter confirmed root cause"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Corrective & Preventive Action (CAPA) */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl shadow-sm">
                            <span className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                <MdAssignmentTurnedIn size={18} /> 4. Corrective & Preventive Action (CAPA)
                            </span>
                            <button
                                type="button"
                                onClick={addCapaRow}
                                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all no-print"
                            >
                                <MdAdd size={16} /> Add Action
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-left font-black uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                        <th className="p-3.5">Action Item</th>
                                        <th className="p-3.5">Responsible Person</th>
                                        <th className="p-3.5">Target Date</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5 text-center w-12 no-print">#</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {formData.capaActions.map((capa, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-2.5">
                                                <input
                                                    type="text"
                                                    value={capa.action}
                                                    onChange={(e) => handleCapaChange(idx, 'action', e.target.value)}
                                                    placeholder={idx === 0 ? "Corrective action" : "Preventive action"}
                                                    className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                                />
                                            </td>
                                            <td className="p-2.5">
                                                <input
                                                    type="text"
                                                    value={capa.responsiblePerson}
                                                    onChange={(e) => handleCapaChange(idx, 'responsiblePerson', e.target.value)}
                                                    placeholder="Responsible"
                                                    className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                                />
                                            </td>
                                            <td className="p-2.5">
                                                <input
                                                    type="date"
                                                    value={capa.targetDate}
                                                    onChange={(e) => handleCapaChange(idx, 'targetDate', e.target.value)}
                                                    className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                                />
                                            </td>
                                            <td className="p-2.5">
                                                <select
                                                    value={capa.status}
                                                    onChange={(e) => handleCapaChange(idx, 'status', e.target.value)}
                                                    className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                                >
                                                    <option value="Open">Open</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                            </td>
                                            <td className="p-2.5 text-center no-print">
                                                <button
                                                    type="button"
                                                    onClick={() => removeCapaRow(idx)}
                                                    className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-all"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 5: Effectiveness Verification */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdCheckCircle size={18} /> 5. Effectiveness Verification
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Verification Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.verificationDate}
                                    onChange={(e) => handleInputChange('verificationDate', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Effectiveness
                                </label>
                                <select
                                    value={formData.effectiveness}
                                    onChange={(e) => handleInputChange('effectiveness', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                >
                                    <option value="Effective">Effective</option>
                                    <option value="Partially Effective">Partially Effective</option>
                                    <option value="Not Effective">Not Effective</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Verification Remarks
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.verificationRemarks}
                                    onChange={(e) => handleInputChange('verificationRemarks', e.target.value)}
                                    placeholder="Enter verification details..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none min-h-[90px] resize-y"
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Form Action Buttons */}
                    <div className="pt-4 flex items-center gap-3 no-print border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                            <MdSave size={18} /> {saving ? 'Saving RCA...' : 'Save RCA'}
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            Reset
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
};

export default CSMRcaReport;
