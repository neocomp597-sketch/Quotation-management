import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { csmService, companySettingsService, uploadService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';
import WhyWhySheet, { SHEET_WIDTH } from '../components/csm/WhyWhySheet';
import { 
    MdAssessment, MdAdd, MdPrint, MdRefresh, MdDelete, 
    MdEdit, MdArrowBack, MdSave, MdFormatListBulleted, MdCheckCircle,
    MdTune, MdFactCheck, MdAssignmentTurnedIn, MdHistory, MdVisibility,
    MdPictureAsPdf, MdDownload, MdFileDownload, MdImage, MdClose
} from 'react-icons/md';
import { toast } from 'react-toastify';

// The paper sheet is written dd.mm.yyyy.
const sheetDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

const INITIAL_FORM = {
    rcaNumber: '',
    ticketNo: '',
    date: new Date().toISOString().split('T')[0],
    department: 'Quality',
    priority: 'Medium',
    problemStatement: '',
    impact: '',
    productCode: '',
    productDescription: '',
    serialNumber: '',
    customerName: '',
    postalCode: '',
    yyyNumber: '',
    yyyDate: '',
    sectionCell: '',
    machineNo: '',
    machineDescription: '',
    breakdownDate: '',
    symptomBeforeBreakdown: '',
    sparePartReplaced: false,
    finalCountermeasure: '',
    dueTo: '',
    rootCauseReason: '',
    kaizenIdea: '',
    inCharge: '',
    youDidNot: '',
    actionThatDay: '',
    schedule: '',
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
    // Both logos on the sheet: the left one (TPM by default) and the right one, which
    // falls back to the company logo. They are held as data URLs so html2canvas can draw
    // them into the PDF without tainting the canvas.
    const [branding, setBranding] = useState({ logo: null, leftLogo: null, companyName: '' });
    const [logoUrls, setLogoUrls] = useState({ rcaLeftLogoUrl: '', rcaRightLogoUrl: '' });
    const [logoEditor, setLogoEditor] = useState({ open: false, saving: false, side: null });
    const [brandingRefresh, setBrandingRefresh] = useState(0);

    // Company logo for the RCA document header. It is converted to a data URL so
    // html2canvas can draw it into the PDF without tainting the canvas.
    useEffect(() => {
        let cancelled = false;
        const toDataUrl = async (url) => {
            if (!url) return null;
            try {
                const blob = await fetch(url, { mode: 'cors' }).then(r => (r.ok ? r.blob() : Promise.reject(new Error('logo fetch failed'))));
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.warn('RCA sheet logo unavailable:', err);
                return null;
            }
        };

        const loadBranding = async () => {
            try {
                const res = await companySettingsService.get();
                const settings = res.data || {};
                const companyName = settings.companyName || settings.whitelabelAppTitle || '';
                if (!cancelled) {
                    setLogoUrls({
                        rcaLeftLogoUrl: settings.rcaLeftLogoUrl || '',
                        rcaRightLogoUrl: settings.rcaRightLogoUrl || ''
                    });
                }
                const [right, left] = await Promise.all([
                    toDataUrl(resolveImageUrl(settings.rcaRightLogoUrl || settings.logoUrl)),
                    toDataUrl(resolveImageUrl(settings.rcaLeftLogoUrl))
                ]);
                if (!cancelled) setBranding({ logo: right, leftLogo: left, companyName });
            } catch (err) {
                console.warn('RCA header logo unavailable:', err);
            }
        };

        loadBranding();
        return () => { cancelled = true; };
    }, [brandingRefresh]);

    // Changing a sheet logo saves it against the company, so it applies wherever the
    // sheet is printed, and only these two fields are written.
    const applyLogos = async (update) => {
        setLogoEditor((state) => ({ ...state, saving: true }));
        try {
            const res = await companySettingsService.updateRcaLogos(update);
            setLogoUrls({
                rcaLeftLogoUrl: res.data?.rcaLeftLogoUrl || '',
                rcaRightLogoUrl: res.data?.rcaRightLogoUrl || ''
            });
            setBrandingRefresh((n) => n + 1);
            toast.success('Sheet logo saved');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save the sheet logo');
        } finally {
            setLogoEditor((state) => ({ ...state, saving: false, side: null }));
        }
    };

    const handleLogoFile = async (side, file) => {
        if (!file) return;
        setLogoEditor((state) => ({ ...state, saving: true, side }));
        try {
            const res = await uploadService.uploadImage(file);
            await applyLogos({ [side]: res.data.imageUrl });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not upload the image');
            setLogoEditor((state) => ({ ...state, saving: false, side: null }));
        }
    };

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
            productCode: report.productCode || '',
            productDescription: report.productDescription || '',
            serialNumber: report.serialNumber || '',
            customerName: report.customerName || '',
            postalCode: report.postalCode || '',
            yyyNumber: report.yyyNumber || '',
            yyyDate: report.yyyDate ? new Date(report.yyyDate).toISOString().split('T')[0] : '',
            sectionCell: report.sectionCell || '',
            machineNo: report.machineNo || '',
            machineDescription: report.machineDescription || '',
            breakdownDate: report.breakdownDate ? new Date(report.breakdownDate).toISOString().split('T')[0] : '',
            symptomBeforeBreakdown: report.symptomBeforeBreakdown || '',
            sparePartReplaced: Boolean(report.sparePartReplaced),
            finalCountermeasure: report.finalCountermeasure || '',
            dueTo: report.dueTo || '',
            rootCauseReason: report.rootCauseReason || '',
            kaizenIdea: report.kaizenIdea || '',
            inCharge: report.inCharge || '',
            youDidNot: report.youDidNot || '',
            actionThatDay: report.actionThatDay || '',
            schedule: report.schedule || '',
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
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                // The sheet is a landscape form and is meant to come out on one page, so it
                // is scaled to whichever of the two page dimensions runs out first.
                const pdf = new jsPDF('l', 'mm', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 6;
                const scale = Math.min(
                    (pageWidth - margin * 2) / canvas.width,
                    (pageHeight - margin * 2) / canvas.height
                );
                const imgWidth = canvas.width * scale;
                const imgHeight = canvas.height * scale;

                pdf.addImage(
                    canvas.toDataURL('image/png'),
                    'PNG',
                    (pageWidth - imgWidth) / 2,
                    margin,
                    imgWidth,
                    imgHeight
                );

                const yyyNum = targetReport?.yyyNumber || formData.yyyNumber || targetReport?.rcaNumber || formData.rcaNumber || '001';
                pdf.save(`Why_Why_Analysis_${yyyNum.replace(/\//g, '-')}.pdf`);
                toast.success('RCA Report downloaded successfully as PDF!');
            } catch (err) {
                console.error('PDF Download Error:', err);
                toast.error('Failed to download PDF file');
            }
        }, 400);
    };

    const handleDownloadExcel = async (report) => {
        const targetReport = report || (selectedReportId ? reports.find(r => r._id === selectedReportId) : null) || formData;

        // A saved report is exported as the Why-Why sheet itself, built on the server so it
        // can carry the borders, the merged boxes and the logos. The register as a whole
        // still exports as the plain list below.
        if (targetReport?._id) {
            toast.info('Generating Excel file download...');
            try {
                const res = await csmService.exportRcaSheet(targetReport._id);
                const url = URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.download = `Why_Why_Analysis_${(targetReport.yyyNumber || targetReport.rcaNumber || '001').replace(/\//g, '-')}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                toast.success('RCA Report downloaded successfully as Excel!');
            } catch (err) {
                console.error('Excel Download Error:', err);
                toast.error('Failed to download Excel file');
            }
            return;
        }

        toast.info('Generating Excel file download...');
        try {
            const rows = [];
            if (targetReport && targetReport.rcaNumber) {
                rows.push({ Section: 'Document Header', Field: 'RCA Number', Detail: targetReport.rcaNumber });
                rows.push({ Section: 'Document Header', Field: 'Ticket No', Detail: targetReport.ticketNo || '' });
                rows.push({ Section: 'Document Header', Field: 'Date', Detail: targetReport.date || '' });
                rows.push({ Section: 'Document Header', Field: 'Department', Detail: targetReport.department || '' });
                rows.push({ Section: 'Document Header', Field: 'Priority', Detail: targetReport.priority || '' });
                rows.push({ Section: 'Document Header', Field: 'YYY Number', Detail: targetReport.yyyNumber || '' });
                rows.push({ Section: 'Document Header', Field: 'YYY Date', Detail: targetReport.yyyDate || '' });
                rows.push({ Section: 'Product & Customer', Field: 'Product Code', Detail: targetReport.productCode || '' });
                rows.push({ Section: 'Product & Customer', Field: 'Product Description', Detail: targetReport.productDescription || '' });
                rows.push({ Section: 'Product & Customer', Field: 'Serial Number', Detail: targetReport.serialNumber || '' });
                rows.push({ Section: 'Product & Customer', Field: 'Customer Name', Detail: targetReport.customerName || '' });
                rows.push({ Section: 'Product & Customer', Field: 'Postal Code', Detail: targetReport.postalCode || '' });
                rows.push({ Section: 'Incident', Field: 'Breakdown (Physical Phenomenon)', Detail: targetReport.problemStatement || '' });
                rows.push({ Section: 'Incident', Field: 'Impact', Detail: targetReport.impact || '' });

                // The boxes of the printed Why-Why Analysis Sheet, in the order they appear on it.
                rows.push({ Section: 'Why-Why Sheet', Field: 'Section / Cell', Detail: targetReport.sectionCell || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Machine No.', Detail: targetReport.machineNo || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Machine Description', Detail: targetReport.machineDescription || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Date of Breakdown', Detail: sheetDate(targetReport.breakdownDate || targetReport.date) });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Symptom Before Breakdown', Detail: targetReport.symptomBeforeBreakdown || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Spare Part Replacement', Detail: targetReport.sparePartReplaced ? 'In case of spare part replacement' : 'In case of no spare part replacement' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Final Action or Countermeasure', Detail: targetReport.finalCountermeasure || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Due To', Detail: targetReport.dueTo || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Root Cause Reason', Detail: targetReport.rootCauseReason || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Kaizen Idea', Detail: targetReport.kaizenIdea || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'In-Charge', Detail: targetReport.inCharge || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'You Did Not', Detail: targetReport.youDidNot || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Action or Countermeasure "That Day"', Detail: targetReport.actionThatDay || '' });
                rows.push({ Section: 'Why-Why Sheet', Field: 'Schedule', Detail: targetReport.schedule || '' });

                if (targetReport.fiveWhys && Array.isArray(targetReport.fiveWhys)) {
                    targetReport.fiveWhys.forEach(w => {
                        rows.push({ Section: '5-Why Breakdown', Field: `Why ${w.whyNo}`, Detail: w.analysis || '' });
                    });
                }
                rows.push({ Section: 'Root Cause', Field: 'Category', Detail: targetReport.category || '' });
                rows.push({ Section: 'Root Cause', Field: 'Confirmed Root Cause', Detail: targetReport.rootCause || '' });

                if (targetReport.capaActions && Array.isArray(targetReport.capaActions)) {
                    targetReport.capaActions.forEach((c, idx) => {
                        rows.push({ Section: 'CAPA Action', Field: `CAPA #${idx + 1} (${c.actionType || 'Action'})`, Detail: `Action: ${c.action} | Resp: ${c.responsiblePerson} | Target: ${c.targetDate} | Status: ${c.status}` });
                    });
                }
                rows.push({ Section: 'Verification', Field: 'Verification Date', Detail: targetReport.verificationDate || '' });
                rows.push({ Section: 'Verification', Field: 'Effectiveness', Detail: targetReport.effectiveness || '' });
                rows.push({ Section: 'Verification', Field: 'Remarks', Detail: targetReport.verificationRemarks || '' });
            } else if (reports.length > 0) {
                reports.forEach(r => {
                    rows.push({
                        'RCA Number': r.rcaNumber,
                        'Ticket No': r.ticketNo,
                        'Date': r.date ? new Date(r.date).toLocaleDateString() : '',
                        'Department': r.department,
                        'Priority': r.priority,
                        'Category': r.category,
                        'Confirmed Root Cause': r.rootCause,
                        'Machine No.': r.machineNo || '',
                        'Date of Breakdown': sheetDate(r.breakdownDate),
                        'Breakdown (Physical Phenomenon)': r.problemStatement
                    });
                });
            }

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'RCA Report');

            const fileName = `Why_Why_Analysis_${(targetReport?.yyyNumber || targetReport?.rcaNumber || '001').replace(/\//g, '-')}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            toast.success('RCA Report downloaded successfully as Excel!');
        } catch (err) {
            console.error('Excel Download Error:', err);
            toast.error('Failed to download Excel file');
        }
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
                            Root Cause Analysis
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
                                    onClick={() => setLogoEditor({ open: true, saving: false, side: null })}
                                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 no-print"
                                    title="Change the logos printed on the sheet"
                                >
                                    <MdImage size={18} /> Edit Logos
                                </button>
                            )}
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
                                onClick={() => handleDownloadExcel()}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                                title="Download / Save as Excel Document"
                            >
                                <MdFileDownload size={18} /> Download Excel
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
                                                {/* Download Excel Button */}
                                                <button
                                                    onClick={() => handleDownloadExcel(report)}
                                                    className="p-2 text-teal-600 dark:text-teal-400 hover:text-teal-800 bg-teal-50 dark:bg-teal-950/60 rounded-xl hover:bg-teal-100 transition-all border border-teal-200/50 dark:border-teal-800/50"
                                                    title="Download Excel"
                                                >
                                                    <MdFileDownload size={16} />
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
            {logoEditor.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print">
                    <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Sheet Logos</h2>
                                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Used on the printed sheet, the PDF and the Excel export. They apply to every RCA report of this company.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLogoEditor({ open: false, saving: false, side: null })}
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <MdClose size={20} />
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { side: 'rcaLeftLogoUrl', title: 'Top left (TPM)', hint: 'Left of the sheet title. A plain TPM box is drawn when this is empty.' },
                                { side: 'rcaRightLogoUrl', title: 'Top right (Company)', hint: 'Right of the header. The company logo is used when this is empty.' }
                            ].map(({ side, title, hint }) => (
                                <div key={side} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{title}</p>
                                    <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2">
                                        {logoUrls[side]
                                            ? <img src={resolveImageUrl(logoUrls[side])} alt={title} className="max-h-full max-w-full object-contain" />
                                            : <span className="text-[11px] font-bold text-slate-400">Not set</span>}
                                    </div>
                                    <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">{hint}</p>
                                    <div className="mt-3 flex gap-2">
                                        <label className={`flex-1 text-center px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black uppercase tracking-wider transition-all ${logoEditor.saving ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                                            {logoEditor.saving && logoEditor.side === side ? 'Uploading...' : 'Upload'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; handleLogoFile(side, file); }}
                                            />
                                        </label>
                                        {logoUrls[side] && (
                                            <button
                                                type="button"
                                                disabled={logoEditor.saving}
                                                onClick={() => applyLogos({ [side]: '' })}
                                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'view' && (
                <div className="overflow-x-auto pb-2 print:overflow-visible">
                    {/* Printing the sheet: one landscape page, borders and filled boxes kept.
                        The rule only exists while the sheet is on screen, so printing any
                        other screen is unaffected. */}
                    <style>{`@media print {
                        @page { size: A4 landscape; margin: 6mm; }
                        /* Only the sheet is printed, from the very top of the page: any
                           page padding left around it costs height the sheet needs. */
                        body * { visibility: hidden !important; }
                        #rca-document-sheet, #rca-document-sheet * { visibility: visible !important; }
                        #rca-document-sheet {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: visible !important;
                            /* zoom scales the layout itself, so the sheet is paginated as
                               one page rather than split in two. */
                            zoom: 0.9;
                        }
                        #rca-document-sheet table { width: 100% !important; page-break-inside: avoid; }
                        #rca-document-sheet, #rca-document-sheet * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }`}</style>
                    {/* Fixed width so the sheet keeps the proportions of the paper form. */}
                    <div
                        id="rca-document-sheet"
                        className="print-container mx-auto bg-white p-2"
                        style={{ width: `${SHEET_WIDTH + 16}px` }}
                    >
                        <WhyWhySheet
                            data={{ ...formData, breakdownDate: sheetDate(formData.breakdownDate || formData.date), yyyDate: formData.yyyDate }}
                            logo={branding.logo}
                            leftLogo={branding.leftLogo}
                            companyName={branding.companyName}
                        />
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

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    YYY Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.yyyNumber}
                                    onChange={(e) => handleInputChange('yyyNumber', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="YYY-2026-001"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    YYY Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.yyyDate}
                                    onChange={(e) => handleInputChange('yyyDate', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                />
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Breakdown (Physical Phenomenon)
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.problemStatement}
                                    onChange={(e) => handleInputChange('problemStatement', e.target.value)}
                                    placeholder="Describe the problem clearly..."
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none min-h-[90px] resize-y"
                                ></textarea>
                            </div>

                            <div className="md:col-span-3">
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

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Product Code
                                </label>
                                <input
                                    type="text"
                                    value={formData.productCode}
                                    onChange={(e) => handleInputChange('productCode', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="e.g. STL-VCB-11KV-630A"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Product Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.productDescription}
                                    onChange={(e) => handleInputChange('productDescription', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="e.g. 11kV Vacuum Circuit Breaker, 630A"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Serial Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.serialNumber}
                                    onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="e.g. SN-2026-00123"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Customer Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.customerName}
                                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="e.g. Bajaj Auto Ltd."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Postal Code
                                </label>
                                <input
                                    type="text"
                                    value={formData.postalCode}
                                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                    placeholder="e.g. 410501"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: the boxes on the printed Why-Why Analysis Sheet */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdFormatListBulleted size={18} /> 2. Why-Why Analysis Sheet (Maintenance)
                        </div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 -mt-1">
                            These are the boxes on the printed sheet. Department, the breakdown and the five whys come from the sections above and below.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Section / Cell</label>
                                <input type="text" value={formData.sectionCell} onChange={(e) => handleInputChange('sectionCell', e.target.value)} placeholder="e.g. Assembly Cell 2" className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Machine No.</label>
                                <input type="text" value={formData.machineNo} onChange={(e) => handleInputChange('machineNo', e.target.value)} placeholder="e.g. M-114" className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Date of Breakdown</label>
                                <input type="date" value={formData.breakdownDate} onChange={(e) => handleInputChange('breakdownDate', e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Machine Description</label>
                                <input type="text" value={formData.machineDescription} onChange={(e) => handleInputChange('machineDescription', e.target.value)} placeholder="e.g. 11kV VCB panel, outdoor kiosk" className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Symptom Before Breakdown</label>
                                <textarea rows="2" value={formData.symptomBeforeBreakdown} onChange={(e) => handleInputChange('symptomBeforeBreakdown', e.target.value)} placeholder="What was seen or heard before it failed..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Spare Part Replacement</label>
                                <div className="flex flex-wrap gap-3">
                                    {[{ text: 'In case of spare part replacement', flag: true }, { text: 'In case of no spare part replacement', flag: false }].map((option) => (
                                        <button
                                            key={String(option.flag)}
                                            type="button"
                                            onClick={() => handleInputChange('sparePartReplaced', option.flag)}
                                            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${formData.sparePartReplaced === option.flag
                                                ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            {option.text}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">What is your final Action or Countermeasure</label>
                                <textarea rows="2" value={formData.finalCountermeasure} onChange={(e) => handleInputChange('finalCountermeasure', e.target.value)} placeholder="The action that was finally taken..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Due To (why that countermeasure was taken)</label>
                                <textarea rows="2" value={formData.dueTo} onChange={(e) => handleInputChange('dueTo', e.target.value)} placeholder="Always ask the first why to the final action taken..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Root Cause is always from these 5 reasons</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Poor Basic Condition', 'Poor Operating Condition', 'Deterioration', 'Weak Design', 'Poor Skill'].map((reason, index) => (
                                        <button
                                            key={reason}
                                            type="button"
                                            onClick={() => handleInputChange('rootCauseReason', formData.rootCauseReason === reason ? '' : reason)}
                                            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${formData.rootCauseReason === reason
                                                ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            {index + 1}. {reason}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Kaizen Idea</label>
                                <textarea rows="2" value={formData.kaizenIdea} onChange={(e) => handleInputChange('kaizenIdea', e.target.value)} placeholder="Improvement to stop it happening again..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">In-Charge</label>
                                <input type="text" value={formData.inCharge} onChange={(e) => handleInputChange('inCharge', e.target.value)} placeholder="Who owns the kaizen" className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">You Did Not</label>
                                <textarea rows="2" value={formData.youDidNot} onChange={(e) => handleInputChange('youDidNot', e.target.value)} placeholder="What was not done..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Action or Countermeasure &quot;That Day&quot;</label>
                                <textarea rows="2" value={formData.actionThatDay} onChange={(e) => handleInputChange('actionThatDay', e.target.value)} placeholder="What was done on the day..." className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none resize-y"></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Schedule</label>
                                <input type="text" value={formData.schedule} onChange={(e) => handleInputChange('schedule', e.target.value)} placeholder="e.g. 15.10.2026" className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Root Cause Analysis - 5 Why */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm flex items-center gap-2">
                            <MdHistory size={18} /> 3. Root Cause Analysis – 5 Why
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
                            <MdTune size={18} /> 4. Root Cause Category
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
                                <MdAssignmentTurnedIn size={18} /> 5. Corrective & Preventive Action (CAPA)
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
                            <MdCheckCircle size={18} /> 6. Effectiveness Verification
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
