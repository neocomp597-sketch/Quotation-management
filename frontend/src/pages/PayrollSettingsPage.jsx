import React, { useState, useEffect } from 'react';
import { payrollService, uploadService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';
import { toast } from 'react-toastify';
import { 
    MdSettings, MdSave, MdCloudUpload, MdLockOpen,
    MdReceipt, MdToggleOn, MdToggleOff
} from 'react-icons/md';

const PayrollSettingsPage = () => {
    const [settings, setSettings] = useState({
        currentMonth: '',
        calculationType: 'fixed',
        pfEnabled: true,
        esiEnabled: true,
        ptEnabled: true,
        tdsEnabled: true,
        payslipFormat: 'format1',
        lockDate: 25,
        companySealUrl: '',
        signatureUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [sealUploading, setSealUploading] = useState(false);
    const [sigUploading, setSigUploading] = useState(false);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await payrollService.getSettings();
            if (res.data) {
                setSettings(res.data);
            }
        } catch (error) {
            console.error('Failed to load settings', error);
            toast.error('Failed to load payroll settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings({
            ...settings,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleToggle = (field) => {
        setSettings(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handleSealUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSealUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setSettings(prev => ({
                ...prev,
                companySealUrl: res.data.imageUrl
            }));
            toast.success('Company seal uploaded!');
        } catch (error) {
            console.error('Seal upload failed', error);
            toast.error('Failed to upload seal image');
        } finally {
            setSealUploading(false);
        }
    };

    const handleSigUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSigUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setSettings(prev => ({
                ...prev,
                signatureUrl: res.data.imageUrl
            }));
            toast.success('Authorized signature uploaded!');
        } catch (error) {
            console.error('Signature upload failed', error);
            toast.error('Failed to upload signature image');
        } finally {
            setSigUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                ...settings,
                lockDate: parseInt(settings.lockDate) || 25
            };
            await payrollService.updateSettings(payload);
            toast.success('Payroll configuration saved successfully!');
            fetchSettings();
        } catch (error) {
            console.error('Save settings error', error);
            toast.error('Failed to save payroll settings');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    if (loading && !settings.currentMonth) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payroll Settings</h1>
                <p className="text-slate-500 font-medium">Configure calculation rules, enable/disable statutory deductions, and upload payslip assets.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Configuration Card */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-2">
                        <MdLockOpen size={20} className="text-teal-600" />
                        Run & Payout Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Current Payroll Month *</label>
                            <input
                                type="month"
                                name="currentMonth"
                                required
                                value={settings.currentMonth}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Calculation Method</label>
                            <select
                                name="calculationType"
                                value={settings.calculationType}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="fixed">Fixed Monthly Salary</option>
                                <option value="manual">Manual Monthly Entry</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Salary Lock Day of Month</label>
                            <input
                                type="number"
                                name="lockDate"
                                min="1"
                                max="31"
                                value={settings.lockDate}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="25"
                            />
                        </div>
                    </div>
                </div>

                {/* Statutory Toggles Card */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-2">
                        <MdReceipt size={20} className="text-teal-600" />
                        Statutory Contribution Toggles
                    </h3>
                    <p className="text-xs text-slate-400 font-bold -mt-2">Enable or disable calculations of statutory deductions globally across payroll month run calculations.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                        {/* PF Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Provident Fund (PF)</p>
                                <p className="text-[10px] text-slate-400 font-medium">EPF deductions</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('pfEnabled')}
                                className={`text-3xl transition-colors outline-none ${settings.pfEnabled ? 'text-primary-600' : 'text-slate-300'}`}
                            >
                                {settings.pfEnabled ? <MdToggleOn size={40} /> : <MdToggleOff size={40} />}
                            </button>
                        </div>

                        {/* ESI Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Employee State Ins (ESI)</p>
                                <p className="text-[10px] text-slate-400 font-medium">Medical contributions</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('esiEnabled')}
                                className={`text-3xl transition-colors outline-none ${settings.esiEnabled ? 'text-primary-600' : 'text-slate-300'}`}
                            >
                                {settings.esiEnabled ? <MdToggleOn size={40} /> : <MdToggleOff size={40} />}
                            </button>
                        </div>

                        {/* PT Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Professional Tax (PT)</p>
                                <p className="text-[10px] text-slate-400 font-medium">State professional tax</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('ptEnabled')}
                                className={`text-3xl transition-colors outline-none ${settings.ptEnabled ? 'text-primary-600' : 'text-slate-300'}`}
                            >
                                {settings.ptEnabled ? <MdToggleOn size={40} /> : <MdToggleOff size={40} />}
                            </button>
                        </div>

                        {/* TDS Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Income Tax (TDS)</p>
                                <p className="text-[10px] text-slate-400 font-medium">Monthly TDS withholdings</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggle('tdsEnabled')}
                                className={`text-3xl transition-colors outline-none ${settings.tdsEnabled ? 'text-primary-600' : 'text-slate-300'}`}
                            >
                                {settings.tdsEnabled ? <MdToggleOn size={40} /> : <MdToggleOff size={40} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Payslip Assets Card (Seal/Sign) */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-2">
                        <MdSettings size={20} className="text-teal-600" />
                        Payslip Formatting & Assets
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className={labelClass}>Payslip Format Template</label>
                            <select
                                name="payslipFormat"
                                value={settings.payslipFormat}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="format1">Format 1 (Allowance & Deduction Side-by-Side)</option>
                                <option value="format2">Format 2 (Allowance & Deduction Standard)</option>
                            </select>
                        </div>
                        
                        {/* Company Seal Upload */}
                        <div>
                            <label className={labelClass}>Company Seal Image</label>
                            <div className="relative h-[48px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group flex items-center justify-between px-3">
                                {settings.companySealUrl ? (
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={resolveImageUrl(settings.companySealUrl)}
                                            alt="Seal"
                                            className="h-8 w-8 object-contain"
                                        />
                                        <span className="text-xs text-emerald-600 font-bold">Seal uploaded</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <MdCloudUpload size={20} />
                                        <span className="text-xs font-bold">Upload Seal</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSealUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={sealUploading}
                                />
                                {sealUploading && (
                                    <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signature Upload */}
                        <div>
                            <label className={labelClass}>Authorized Signatory Signature</label>
                            <div className="relative h-[48px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group flex items-center justify-between px-3">
                                {settings.signatureUrl ? (
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={resolveImageUrl(settings.signatureUrl)}
                                            alt="Signature"
                                            className="h-8 object-contain"
                                        />
                                        <span className="text-xs text-emerald-600 font-bold">Signature uploaded</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <MdCloudUpload size={20} />
                                        <span className="text-xs font-bold">Upload Signature</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSigUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={sigUploading}
                                />
                                {sigUploading && (
                                    <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                    >
                        <MdSave size={18} />
                        {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PayrollSettingsPage;
