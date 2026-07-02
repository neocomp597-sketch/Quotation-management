import React, { useState, useEffect } from 'react';
import { payrollService, companySettingsService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { MdDescription, MdAdd, MdSave, MdDelete, MdPictureAsPdf } from 'react-icons/md';
import { formatDate } from '../utils/helpers';

const TEMPLATE_CONTENTS = {
    offer: "Dear {name},\n\nWe are pleased to offer you employment with {company} for the position of {designation}. This offer is made based on the information provided by you during the selection process and is subject to successful completion of all joining formalities and background verification, wherever applicable.\n\nYour proposed monthly gross compensation will be INR {salary}. Your expected date of joining will be {joining_date}, unless otherwise agreed in writing by the company.\n\nDetailed terms of employment, reporting structure, policies, and other conditions will be shared at the time of joining or appointment. Please sign and return a copy of this letter as confirmation of your acceptance of the offer.\n\nWe look forward to welcoming you and wish you a successful association with us.",
    appointment: "Dear {name},\n\nWith reference to your application and subsequent discussions, we are pleased to appoint you as {designation} with {company}, effective from {joining_date}.\n\nYour monthly gross compensation will be INR {salary}, subject to applicable statutory deductions and company policies. You will be required to comply with all rules, procedures, confidentiality obligations, and employment conditions communicated by the company from time to time.\n\nYour appointment is subject to satisfactory verification of credentials and completion of joining documentation. Please sign and return a copy of this letter to confirm your acceptance of the appointment terms.\n\nWe welcome you to the organization and look forward to a productive and professional association.",
    increment: "Dear {name},\n\nWe are pleased to inform you that, following the recent review process, your monthly gross compensation has been revised to INR {salary}, effective from {joining_date}.\n\nThis revision recognizes your contribution to the organization and your continued commitment to your responsibilities. All other terms and conditions of your employment remain unchanged unless communicated separately in writing.\n\nWe appreciate your efforts and look forward to your continued performance and growth with {company}.",
    promotion: "Dear {name},\n\nWe are pleased to inform you that you have been promoted to the position of {new_designation}, effective from {joining_date}.\n\nConsequent to this promotion, your monthly gross compensation has been revised to INR {salary}. Your responsibilities, reporting structure, and performance expectations will be aligned with your revised role and communicated by your reporting manager or HR.\n\nAll other terms and conditions of your employment remain unchanged unless communicated separately in writing. We congratulate you on this achievement and wish you continued success in your new role.",
    salary_certificate: "TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {name} is employed with {company} as {designation}. As per our employment records, the employee has been associated with the company since {joining_date}.\n\nAs per the current payroll records, the employee's monthly gross salary is INR {salary}.\n\nThis certificate is issued at the request of the employee for official verification and documentation purposes. It does not constitute any financial guarantee or undertaking on behalf of the company.",
    experience: "TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {name} was employed with {company} as {designation} from {joining_date} to {relieving_date}.\n\nDuring the period of employment, the employee carried out assigned responsibilities in a professional manner and maintained satisfactory conduct. The employee was relieved from services after completion of the applicable separation formalities.\n\nWe thank {name} for the services rendered to the organization and wish them success in future endeavors.",
    relieving: "Dear {name},\n\nThis is to confirm that your resignation has been accepted and you are relieved from your duties as {designation} with effect from the close of business hours on {relieving_date}.\n\nAs per company records, you have completed the required handover and separation formalities, subject to any pending obligations that may be communicated separately. Your full and final settlement, if applicable, will be processed in accordance with company policy and statutory requirements.\n\nWe appreciate your contribution during your tenure with {company} and wish you success in your future endeavors."
};

const formatSalary = (salary) => {
    const numericSalary = parseFloat(salary);
    return Number.isFinite(numericSalary) ? numericSalary.toLocaleString('en-IN') : '[Salary]';
};

const compileTemplate = (template, values, companySettings) => {
    return template
        .replace(/{name}/g, values.recipientName || '[Name]')
        .replace(/{designation}/g, values.designation || '[Designation]')
        .replace(/{new_designation}/g, values.newDesignation || '[New Designation]')
        .replace(/{company}/g, companySettings?.companyName || 'the company')
        .replace(/{salary}/g, values.salary ? formatSalary(values.salary) : '[Salary]')
        .replace(/{joining_date}/g, values.joiningDate ? formatDate(values.joiningDate) : '[Joining Date]')
        .replace(/{relieving_date}/g, values.relievingDate ? formatDate(values.relievingDate) : '[Relieving Date]');
};

const getPrintableContent = (letter, companySettings) => {
    const metadata = letter.metadata || {};
    if (TEMPLATE_CONTENTS[letter.type]) {
        return compileTemplate(TEMPLATE_CONTENTS[letter.type], {
            recipientName: letter.recipientName,
            designation: metadata.designation,
            newDesignation: metadata.newDesignation,
            salary: metadata.salary,
            joiningDate: metadata.joiningDate,
            relievingDate: metadata.relievingDate
        }, companySettings);
    }

    const shouldRefreshContent = TEMPLATE_CONTENTS[letter.type] && (
        !letter.content ||
        letter.content.includes('â‚¹') ||
        letter.content.includes('our company') ||
        letter.content.includes('Your full and final settlement has been processed and completed')
    );

    if (!shouldRefreshContent) {
        return letter.content;
    }

    return compileTemplate(TEMPLATE_CONTENTS[letter.type], {
        recipientName: letter.recipientName,
        designation: metadata.designation,
        newDesignation: metadata.newDesignation,
        salary: metadata.salary,
        joiningDate: metadata.joiningDate,
        relievingDate: metadata.relievingDate
    }, companySettings);
};

const getAddressString = (companySettings) => {
    if (!companySettings?.address) return '';
    const addr = companySettings.address;
    return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
};

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toParagraphs = (text) => text
    .split('\n\n')
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');

const getLetterTitle = (type) => ({
    offer: 'Offer of Employment',
    appointment: 'Appointment Letter',
    increment: 'Salary Revision Letter',
    promotion: 'Promotion and Role Revision Letter',
    salary_certificate: 'Salary Certificate',
    experience: 'Experience Certificate',
    relieving: 'Relieving Letter'
}[type] || 'HR Letter');

const getLetterReference = (letter) => {
    const date = letter.createdAt ? new Date(letter.createdAt) : new Date();
    const stamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('');
    return `HR/${String(letter.type || 'LETTER').replace(/_/g, '-').toUpperCase()}/${stamp}`;
};

const buildDetailsTable = (letter) => {
    const metadata = letter.metadata || {};
    const rows = [];

    if (metadata.designation) rows.push(['Designation', metadata.designation]);
    if (metadata.newDesignation && letter.type === 'promotion') rows.push(['Promoted Role', metadata.newDesignation]);
    if (metadata.joiningDate) rows.push([letter.type === 'increment' || letter.type === 'promotion' ? 'Effective Date' : 'Joining Date', formatDate(metadata.joiningDate)]);
    if (metadata.relievingDate) rows.push(['Relieving Date', formatDate(metadata.relievingDate)]);
    if (metadata.salary && ['offer', 'appointment', 'increment', 'promotion', 'salary_certificate'].includes(letter.type)) {
        rows.push(['Monthly Gross Compensation', `INR ${formatSalary(metadata.salary)}`]);
    }

    if (!rows.length) return '';

    return `
        <table class="details-table">
            <tbody>
                ${rows.map(([label, value]) => `
                    <tr>
                        <th>${escapeHtml(label)}</th>
                        <td>${escapeHtml(value)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};

const buildProfessionalLetterHtml = (letter, companySettings) => {
    const companyName = companySettings?.companyName || 'Company Name';
    const address = getAddressString(companySettings);
    const content = getPrintableContent(letter, companySettings);
    const title = getLetterTitle(letter.type);
    const needsAcknowledgment = ['offer', 'appointment', 'increment', 'promotion'].includes(letter.type);
    const footerContact = [
        companySettings?.contactEmail && `Email: ${companySettings.contactEmail}`,
        companySettings?.website && `Web: ${companySettings.website}`
    ].filter(Boolean).join(' | ');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #e5e7eb; color: #111827; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding: 22mm 20mm 19mm; }
        .brand-rule { height: 5px; background: #0f766e; position: absolute; left: 0; top: 0; right: 0; }
        .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 14px; margin-bottom: 22px; }
        .company-name { font-size: 20px; line-height: 1.2; font-weight: 800; letter-spacing: .4px; color: #0f766e; text-transform: uppercase; }
        .company-address { margin-top: 6px; max-width: 380px; font-size: 11px; line-height: 1.45; color: #475569; }
        .company-contact { min-width: 190px; text-align: right; font-size: 11px; line-height: 1.55; color: #475569; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; color: #334155; }
        .recipient { margin-bottom: 18px; font-size: 12px; line-height: 1.55; }
        .recipient strong { display: block; font-size: 13px; color: #0f172a; }
        .title { text-align: center; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; color: #0f172a; margin: 22px 0 18px; text-decoration: underline; text-underline-offset: 4px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 12px; }
        .details-table th, .details-table td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
        .details-table th { width: 34%; text-align: left; background: #f8fafc; color: #334155; font-weight: 700; }
        .body { font-size: 12.5px; line-height: 1.75; text-align: justify; }
        .body p { margin: 0 0 12px; }
        .closing { margin-top: 28px; font-size: 12.5px; line-height: 1.7; }
        .signature-row { display: flex; justify-content: space-between; gap: 40px; margin-top: 42px; }
        .signature { width: 235px; font-size: 12px; color: #0f172a; }
        .signature-space { height: 54px; }
        .signature-line { border-top: 1px solid #94a3b8; padding-top: 7px; font-weight: 700; }
        .signature small { display: block; margin-top: 3px; color: #64748b; font-weight: 400; }
        .footer { position: absolute; left: 20mm; right: 20mm; bottom: 9mm; border-top: 1px solid #e2e8f0; padding-top: 7px; font-size: 9px; line-height: 1.45; color: #64748b; text-align: center; }
        @media print { body { background: #fff; } .page { width: auto; min-height: 297mm; margin: 0; box-shadow: none; } }
    </style>
</head>
<body>
    <main class="page">
        <div class="brand-rule"></div>
        <header class="header">
            <div>
                <div class="company-name">${escapeHtml(companyName)}</div>
                ${address ? `<div class="company-address">${escapeHtml(address)}</div>` : ''}
            </div>
            <div class="company-contact">
                ${companySettings?.contactEmail ? `<div>${escapeHtml(companySettings.contactEmail)}</div>` : ''}
                ${companySettings?.website ? `<div>${escapeHtml(companySettings.website)}</div>` : ''}
            </div>
        </header>
        <section class="meta-row">
            <div><strong>Ref:</strong> ${escapeHtml(getLetterReference(letter))}</div>
            <div><strong>Date:</strong> ${escapeHtml(formatDate(new Date()))}</div>
        </section>
        <section class="recipient">
            <div>To,</div>
            <strong>${escapeHtml(letter.recipientName || '')}</strong>
            ${letter.recipientEmail ? `<div>${escapeHtml(letter.recipientEmail)}</div>` : ''}
        </section>
        <h1 class="title">${escapeHtml(title)}</h1>
        ${buildDetailsTable(letter)}
        <section class="body">${toParagraphs(content)}</section>
        <section class="closing">
            <div>Yours sincerely,</div>
            <div>For <strong>${escapeHtml(companyName)}</strong></div>
        </section>
        <section class="signature-row">
            <div class="signature">
                <div class="signature-space"></div>
                <div class="signature-line">Authorized Signatory<small>Human Resources Department</small></div>
            </div>
            ${needsAcknowledgment ? `
                <div class="signature">
                    <div class="signature-space"></div>
                    <div class="signature-line">Employee Acknowledgment<small>Signature and date</small></div>
                </div>
            ` : ''}
        </section>
        <footer class="footer">
            This letter is issued on the basis of company records and is valid only when signed by an authorized representative.
            ${footerContact ? `<br />${escapeHtml(footerContact)}` : ''}
        </footer>
    </main>
</body>
</html>`;
};

const PayrollLetters = () => {
    const [letters, setLetters] = useState([]);
    const [companySettings, setCompanySettings] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Custom Confirm Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    // Form inputs
    const [letterForm, setLetterForm] = useState({
        employeeId: '',
        type: 'offer',
        recipientName: '',
        recipientEmail: '',
        designation: '',
        joiningDate: '',
        relievingDate: '',
        salary: '',
        newDesignation: '',
        content: ''
    });

    const [pdfGeneratingId, setPdfGeneratingId] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [lettersRes, companyRes, empRes] = await Promise.all([
                payrollService.getLetters(),
                companySettingsService.get(),
                payrollService.getEmployees()
            ]);
            setLetters(lettersRes.data || []);
            setCompanySettings(companyRes.data || null);
            setEmployees(empRes.data || []);
        } catch (error) {
            console.error('Failed to load letters data', error);
            toast.error('Failed to load letters panel');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Autocomplete fields when employee is selected
    const handleEmployeeSelect = (e) => {
        const empId = e.target.value;
        if (!empId) {
            setLetterForm({ ...letterForm, employeeId: '', recipientName: '', recipientEmail: '', designation: '', salary: '' });
            return;
        }

        const emp = employees.find(x => x._id === empId);
        if (emp) {
            const gross = Object.keys(emp.salaryStructure || {}).reduce((acc, curr) => {
                const earnings = ['basic', 'hra', 'da', 'specialAllowance', 'bonus', 'incentive', 'reimbursement'];
                return earnings.includes(curr) ? acc + (emp.salaryStructure[curr] || 0) : acc;
            }, 0);

            setLetterForm({
                ...letterForm,
                employeeId: empId,
                recipientName: emp.name || '',
                recipientEmail: emp.email || '',
                designation: emp.designation || '',
                joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().substring(0, 10) : '',
                salary: gross || ''
            });
        }
    };

    // Compile variables on input change
    const handleFormChange = (name, value) => {
        const updatedForm = { ...letterForm, [name]: value };
        
        // Auto compile content if type or specific variables change
        const template = TEMPLATE_CONTENTS[updatedForm.type] || '';
        const compiled = compileTemplate(template, updatedForm, companySettings);

        updatedForm.content = compiled;
        setLetterForm(updatedForm);
    };

    // Compile content when switching types
    useEffect(() => {
        handleFormChange('type', letterForm.type);
    }, [letterForm.type]);

    const handleCreateLetter = async (e) => {
        e.preventDefault();
        try {
            await payrollService.createLetter({
                employeeId: letterForm.employeeId || undefined,
                type: letterForm.type,
                recipientName: letterForm.recipientName,
                recipientEmail: letterForm.recipientEmail,
                content: letterForm.content,
                metadata: {
                    designation: letterForm.designation,
                    joiningDate: letterForm.joiningDate,
                    relievingDate: letterForm.relievingDate,
                    salary: letterForm.salary,
                    newDesignation: letterForm.newDesignation
                }
            });
            toast.success('Letter generated and archived!');
            setIsCreateOpen(false);
            fetchData();
        } catch (error) {
            console.error('Failed to create letter', error);
            toast.error('Failed to generate letter');
        }
    };

    const handleDeleteLetter = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Letter Record',
            message: 'Are you sure you want to delete this generated letter from logs?',
            onConfirm: async () => {
                try {
                    await payrollService.deleteLetter(id);
                    toast.success('Letter record deleted.');
                    fetchData();
                } catch (error) {
                    console.error('Failed to delete letter', error);
                    toast.error('Failed to delete letter');
                }
            }
        });
    };

    const handlePrintLetter = async (letter) => {
        try {
            setPdfGeneratingId(letter._id);
            const blob = await pdf(
                <LetterPdfTemplate 
                    letter={letter} 
                    companySettings={companySettings} 
                />
            ).toBlob();
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Letter-${letter.recipientName.replace(/\s+/g, '_')}-${letter.type}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to generate letter PDF', error);
            toast.error('Failed to print letter PDF');
        } finally {
            setPdfGeneratingId(null);
        }
    };

    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">HR Letters</h1>
                    <p className="text-slate-500 font-medium">Generate, print, and archive dynamic HR letters using placeholders.</p>
                </div>

                <button
                    onClick={() => {
                        setLetterForm({
                            employeeId: '', type: 'offer', recipientName: '', recipientEmail: '',
                            designation: '', joiningDate: '', relievingDate: '', salary: '', newDesignation: '',
                            content: TEMPLATE_CONTENTS.offer
                        });
                        setIsCreateOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                >
                    <MdAdd size={20} />
                    Generate Letter
                </button>
            </div>

            {/* Generated Letters List */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                {loading && letters.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                    </div>
                ) : letters.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-bold">
                        No letters generated yet. Click "Generate Letter" to start.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-6 py-4">Recipient</th>
                                    <th className="px-6 py-4">Letter Type</th>
                                    <th className="px-6 py-4">Generated On</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {letters.map((l) => (
                                    <tr key={l._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 font-bold">{l.recipientName}</p>
                                            <p className="text-xs text-slate-400">{l.recipientEmail || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4 uppercase text-sm text-slate-600">
                                            {l.type?.replace(/_/g, ' ')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {formatDate(l.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handlePrintLetter(l)}
                                                    disabled={pdfGeneratingId === l._id}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 hover:bg-primary-650 hover:text-white text-primary-700 rounded-xl transition-all text-xs font-black"
                                                >
                                                    {pdfGeneratingId === l._id ? 'Generating...' : (
                                                        <>
                                                            <MdPictureAsPdf size={14} /> Print
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLetter(l._id)}
                                                    className="p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition-all"
                                                >
                                                    <MdDelete size={14} />
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

            {/* Generate Letter Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Generate HR Letter"
                maxWidth="max-w-4xl"
            >
                            <form onSubmit={handleCreateLetter} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Link Existing Employee</label>
                                        <select
                                            value={letterForm.employeeId}
                                            onChange={handleEmployeeSelect}
                                            className={inputClass}
                                        >
                                            <option value="">-- Manual entry (Not linked) --</option>
                                            {employees.map(e => (
                                                <option key={e._id} value={e._id}>{e.name} ({e.designation})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Letter Type</label>
                                        <select
                                            value={letterForm.type}
                                            onChange={(e) => handleFormChange('type', e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="offer">Offer Letter</option>
                                            <option value="appointment">Appointment Letter</option>
                                            <option value="increment">Increment Letter</option>
                                            <option value="promotion">Promotion Letter</option>
                                            <option value="salary_certificate">Salary Certificate</option>
                                            <option value="experience">Experience Letter</option>
                                            <option value="relieving">Relieving Letter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Recipient Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={letterForm.recipientName}
                                            onChange={(e) => handleFormChange('recipientName', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Ramesh Sharma"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelClass}>Recipient Email</label>
                                        <input
                                            type="email"
                                            value={letterForm.recipientEmail}
                                            onChange={(e) => handleFormChange('recipientEmail', e.target.value)}
                                            className={inputClass}
                                            placeholder="ramesh@company.com"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Current Designation</label>
                                        <input
                                            type="text"
                                            value={letterForm.designation}
                                            onChange={(e) => handleFormChange('designation', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Executive"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Proposed Designation / New Role</label>
                                        <input
                                            type="text"
                                            value={letterForm.newDesignation}
                                            onChange={(e) => handleFormChange('newDesignation', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Senior Associate"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Monthly Gross (Salary)</label>
                                        <input
                                            type="number"
                                            value={letterForm.salary}
                                            onChange={(e) => handleFormChange('salary', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Date of Joining / Revision Date</label>
                                        <input
                                            type="date"
                                            value={letterForm.joiningDate}
                                            onChange={(e) => handleFormChange('joiningDate', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Relieving Date</label>
                                        <input
                                            type="date"
                                            value={letterForm.relievingDate}
                                            onChange={(e) => handleFormChange('relievingDate', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Generated Content Preview & Edit</label>
                                    <textarea
                                        rows={8}
                                        value={letterForm.content}
                                        onChange={(e) => setLetterForm({ ...letterForm, content: e.target.value })}
                                        className={`${inputClass} resize-none font-sans leading-relaxed`}
                                    />
                                </div>

                                <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateOpen(false)}
                                        className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                                    >
                                        <MdSave size={18} />
                                        Generate & Archive
                                    </button>
                                </div>
                            </form>
            </Modal>

            {/* Confirm Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                maxWidth="max-w-md"
            >
                <div className="space-y-6">
                    <p className="text-slate-650 font-medium leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                        <button
                            type="button"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="px-5 py-2.5 border border-slate-200 text-slate-650 font-bold rounded-xl hover:bg-slate-50 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (confirmModal.onConfirm) confirmModal.onConfirm();
                                setConfirmModal({ ...confirmModal, isOpen: false });
                            }}
                            className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PayrollLetters;
