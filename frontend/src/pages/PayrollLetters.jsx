import React, { useState, useEffect } from 'react';
import { payrollService, companySettingsService } from '../services/api';
import { toast } from 'react-toastify';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import Modal from '../components/Modal';
import { MdDescription, MdAdd, MdSave, MdDelete, MdPictureAsPdf } from 'react-icons/md';
import { formatDate } from '../utils/helpers';

// Simple PDF Letter Template
const LetterPdfTemplate = ({ letter, companySettings }) => {
    const styles = StyleSheet.create({
        page: { padding: 50, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.6, color: '#334155' },
        header: { borderBottomWidth: 1, borderBottomColor: '#0f766e', paddingBottom: 15, marginBottom: 25, alignItems: 'center' },
        companyName: { fontSize: 18, fontWeight: 'bold', color: '#0f766e', textTransform: 'uppercase' },
        companyAddr: { fontSize: 8, color: '#64748b', marginTop: 2 },
        dateText: { alignSelf: 'flex-end', fontSize: 9, color: '#64748b', marginBottom: 20 },
        recipientSection: { marginBottom: 20 },
        toLabel: { fontSize: 9, color: '#64748b' },
        nameText: { fontSize: 10, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
        emailText: { fontSize: 9, color: '#64748b' },
        subjectText: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', marginVertical: 15, textDecoration: 'underline' },
        body: { fontSize: 10, color: '#334155', textAlign: 'justify', marginBottom: 30 },
        signOff: { marginTop: 40 },
        companySign: { fontSize: 10, fontWeight: 'bold', color: '#0f172a' },
        signSpace: { height: 40 },
        signTitle: { fontSize: 9, color: '#64748b', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 5, width: 150 }
    });

    const getAddressString = () => {
        if (!companySettings?.address) return '';
        const addr = companySettings.address;
        return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    };

    const getSubject = () => {
        switch (letter.type) {
            case 'offer': return 'SUBJECT: OFFER OF EMPLOYMENT';
            case 'appointment': return 'SUBJECT: APPOINTMENT LETTER';
            case 'increment': return 'SUBJECT: SALARY REVISION / INCREMENT LETTER';
            case 'promotion': return 'SUBJECT: PROMOTION & ROLE REVISION LETTER';
            case 'salary_certificate': return 'SUBJECT: SALARY CERTIFICATE';
            case 'experience': return 'SUBJECT: EXPERIENCE CERTIFICATE';
            case 'relieving': return 'SUBJECT: RELIEVING ORDER';
            default: return 'HR CORRESPONDENCE';
        }
    };

    // Replace newlines with spacing in React PDF
    const renderParagraphs = (text) => {
        return text.split('\n\n').map((para, i) => (
            <Text key={i} style={{ marginBottom: 10 }}>{para}</Text>
        ));
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.companyName}>{companySettings?.companyName || 'ARCRM Co.'}</Text>
                    <Text style={styles.companyAddr}>{getAddressString()}</Text>
                </View>
                
                <Text style={styles.dateText}>Date: {formatDate(new Date())}</Text>

                <View style={styles.recipientSection}>
                    <Text style={styles.toLabel}>To,</Text>
                    <Text style={styles.nameText}>{letter.recipientName}</Text>
                    {letter.recipientEmail && <Text style={styles.emailText}>{letter.recipientEmail}</Text>}
                </View>

                <Text style={styles.subjectText}>{getSubject()}</Text>

                <View style={styles.body}>
                    {renderParagraphs(letter.content)}
                </View>

                <View style={styles.signOff}>
                    <Text style={styles.companySign}>For {companySettings?.companyName || 'ARCRM Co.'}</Text>
                    <View style={styles.signSpace} />
                    <Text style={styles.signTitle}>Authorized Signatory</Text>
                </View>
            </Page>
        </Document>
    );
};

const TEMPLATE_CONTENTS = {
    offer: "Dear {name},\n\nWe are pleased to offer you the position of {designation} with our company. Your starting monthly salary will be ₹{salary} per month.\n\nWe expect you to join on {joining_date}. Please review and sign a copy of this letter as confirmation of your acceptance.",
    appointment: "Dear {name},\n\nWith reference to your interview, we are pleased to appoint you as {designation} starting from {joining_date}. You will be on probation for a period of six months.\n\nYour monthly gross package will be ₹{salary} per month. All details regarding role responsibilities are attached.",
    increment: "Dear {name},\n\nBased on your performance review, we are pleased to inform you that your monthly gross salary has been revised to ₹{salary} per month, effective from {joining_date}.\n\nWe appreciate your contribution and look forward to your continued success.",
    promotion: "Dear {name},\n\nWe are delighted to promote you to the designation of {new_designation} starting from {joining_date}. Your revised monthly gross package will be ₹{salary}.\n\nAll other terms of your contract remain unchanged. Congratulations on your promotion!",
    salary_certificate: "To Whom It May Concern,\n\nThis is to certify that {name} is employed with us as {designation}. Their monthly gross salary is ₹{salary} per month.\n\nThis certificate is issued at the request of the employee for verification purposes.",
    experience: "To Whom It May Concern,\n\nThis is to certify that {name} was employed with us as {designation} from {joining_date} to {relieving_date}.\n\nDuring their tenure, we found them to be diligent, hard-working, and sincere in their duties. We wish them all success in future endeavors.",
    relieving: "Dear {name},\n\nWe acknowledge your resignation. You are hereby relieved of your duties as {designation} effective from {relieving_date}.\n\nYour full and final settlement has been completed. We thank you for your service."
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
        let compiled = TEMPLATE_CONTENTS[updatedForm.type] || '';
        compiled = compiled
            .replace(/{name}/g, updatedForm.recipientName || '[Name]')
            .replace(/{designation}/g, updatedForm.designation || '[Designation]')
            .replace(/{new_designation}/g, updatedForm.newDesignation || '[New Designation]')
            .replace(/{company}/g, companySettings?.companyName || 'our company')
            .replace(/{salary}/g, updatedForm.salary ? parseFloat(updatedForm.salary).toLocaleString('en-IN') : '[Salary]')
            .replace(/{joining_date}/g, updatedForm.joiningDate ? formatDate(updatedForm.joiningDate) : '[Joining Date]')
            .replace(/{relieving_date}/g, updatedForm.relievingDate ? formatDate(updatedForm.relievingDate) : '[Relieving Date]');

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
