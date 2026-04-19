import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { MdBusiness, MdPerson, MdLocationOn, MdAccountBalance, MdDescription, MdCloudUpload, MdSave, MdEdit } from 'react-icons/md';
import { userService, companySettingsService, uploadService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../constants/menuPermissions';

const Settings = () => {
    const { user: authUser, refreshSession } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Profile State
    const [user, setUser] = useState({ name: '', email: '', role: '' });
    const [password, setPassword] = useState('');

    // Company Settings State
    const [companySettings, setCompanySettings] = useState({
        companyName: '',
        tagline: '',
        logoUrl: '',
        email: '',
        phone: '',
        website: '',
        address: {
            line1: '',
            line2: '',
            city: '',
            state: '',
            pincode: '',
            country: 'India'
        },
        gstin: '',
        pan: '',
        cin: '',
        bankDetails: {
            bankName: '',
            accountName: '',
            accountNumber: '',
            ifscCode: '',
            branchName: ''
        },
        authorizedSignatory: {
            name: '',
            designation: '',
            signatureImageUrl: ''
        },
        defaultTerms: '',
        quotationPrefix: 'JAG/QTN'
    });

const [logoUploading, setLogoUploading] = useState(false);
    const [signatureUploading, setSignatureUploading] = useState(false);

    const fetchCompanySettings = useCallback(async () => {
        try {
            const res = await companySettingsService.get();
            if (res.data) {
                setCompanySettings((prev) => ({
                    ...prev,
                    ...res.data,
                    address: { ...prev.address, ...res.data.address },
                    bankDetails: { ...prev.bankDetails, ...res.data.bankDetails },
                    authorizedSignatory: { ...prev.authorizedSignatory, ...res.data.authorizedSignatory }
                }));
            }
        } catch (error) {
            console.error('Error fetching company settings:', error);
        }
    }, []);

    useEffect(() => {
        fetchCompanySettings();
    }, [fetchCompanySettings]);

    useEffect(() => {
        if (authUser) {
            setUser({
                name: authUser.name || '',
                email: authUser.email || '',
                role: authUser.role || ''
            });
        }
    }, [authUser]);

    const handleProfileChange = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const updateData = {
                name: user.name,
                email: user.email,
                ...(password && { password })
            };

            const res = await userService.updateProfile(updateData);
            setUser({
                name: res.data.name,
                email: res.data.email,
                role: res.data.role
            });
            await refreshSession();
            setPassword('');
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error("Update failed", error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
            toast.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyChange = (e, section = null) => {
        const { name, value } = e.target;

        if (section) {
            setCompanySettings({
                ...companySettings,
                [section]: {
                    ...companySettings[section],
                    [name]: value
                }
            });
        } else {
            setCompanySettings({
                ...companySettings,
                [name]: value
            });
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLogoUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setCompanySettings({
                ...companySettings,
                logoUrl: res.data.imageUrl
            });
            toast.success('Logo uploaded successfully!');
        } catch (error) {
            console.error('Error uploading logo:', error);
            toast.error('Failed to upload logo');
        } finally {
            setLogoUploading(false);
        }
    };

    const handleSignatureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSignatureUploading(true);
        try {
            const res = await uploadService.uploadImage(file);
            setCompanySettings({
                ...companySettings,
                authorizedSignatory: {
                    ...companySettings.authorizedSignatory,
                    signatureImageUrl: res.data.imageUrl
                }
            });
            toast.success('Signature uploaded successfully!');
        } catch (error) {
            console.error('Error uploading signature:', error);
            toast.error('Failed to upload signature');
        } finally {
            setSignatureUploading(false);
        }
    };

    const handleCompanySettingsUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            await companySettingsService.update(companySettings);
            setMessage({ type: 'success', text: 'Company settings saved successfully!' });
            toast.success('Company settings saved successfully!');
        } catch (error) {
            console.error('Error saving company settings:', error);
            const errorMsg = error.response?.data?.message || 'Failed to save company settings';
            setMessage({ type: 'error', text: errorMsg });
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: MdPerson },
        { id: 'company', label: 'Company Info', icon: MdBusiness },
        { id: 'address', label: 'Address', icon: MdLocationOn },
        { id: 'banking', label: 'Banking', icon: MdAccountBalance },
        { id: 'terms', label: 'Terms & Signatory', icon: MdDescription }
    ];

    const inputClass = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-sm font-bold text-slate-500 mb-1.5";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Settings & Configuration</h1>
                <p className="text-slate-500 font-medium">Manage your account and company preferences.</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {message.text}
                </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8 max-w-2xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MdPerson className="text-primary-500" />
                        Profile Information
                    </h2>

                    <form onSubmit={handleProfileUpdate} className="space-y-5">
                        <div>
                            <label className={labelClass}>Full Name <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={user.name || ''}
                                onChange={handleProfileChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Email Address <span className="text-rose-500">*</span></label>
                            <input
                                type="email"
                                name="email"
                                value={user.email || ''}
                                onChange={handleProfileChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Role</label>
                            <div className="inline-block px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-sm font-black uppercase tracking-wide cursor-not-allowed">
                                {ROLE_LABELS[authUser?.role || user.role] || authUser?.role || user.role || 'User'}
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>New Password (Optional)</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank to keep current"
                                className={inputClass}
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={18} />
                                {loading ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Company Info Tab */}
            {activeTab === 'company' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8 max-w-3xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MdBusiness className="text-primary-500" />
                        Company Information
                    </h2>

                    <form onSubmit={handleCompanySettingsUpdate} className="space-y-6">
                        {/* Logo Upload */}
                        <div className="flex items-start gap-6">
                            <div className="flex-shrink-0">
                                <label className={labelClass}>Company Logo</label>
                                <div className="relative w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden group">
                                    {companySettings.logoUrl ? (
                                        <img
                                            src={resolveImageUrl(companySettings.logoUrl)}
                                            alt="Logo"
                                            className="w-full h-full object-contain p-2"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                            <MdCloudUpload size={32} />
                                            <span className="text-xs font-bold mt-1">Upload Logo</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        disabled={logoUploading}
                                    />
                                    {logoUploading && (
                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className={labelClass}>Company Name <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={companySettings.companyName}
                                        onChange={handleCompanyChange}
                                        className={inputClass}
                                        placeholder="e.g., Eco Pipe Company"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Tagline</label>
                                    <input
                                        type="text"
                                        name="tagline"
                                        value={companySettings.tagline}
                                        onChange={handleCompanyChange}
                                        className={inputClass}
                                        placeholder="e.g., Where quality meets value"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Company Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={companySettings.email}
                                    onChange={handleCompanyChange}
                                    className={inputClass}
                                    placeholder="contact@company.com"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={companySettings.phone}
                                    onChange={handleCompanyChange}
                                    className={inputClass}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Website</label>
                                <input
                                    type="url"
                                    name="website"
                                    value={companySettings.website}
                                    onChange={handleCompanyChange}
                                    className={inputClass}
                                    placeholder="https://www.example.com"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Quotation Prefix</label>
                                <input
                                    type="text"
                                    name="quotationPrefix"
                                    value={companySettings.quotationPrefix}
                                    onChange={handleCompanyChange}
                                    className={inputClass}
                                    placeholder="JAG/QTN"
                                />
                            </div>
                        </div>

                        {/* Tax Info */}
                        <div className="pt-4 border-t border-slate-100">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Tax Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>GSTIN (Optional)</label>
                                    <input
                                        type="text"
                                        name="gstin"
                                        value={companySettings.gstin}
                                        onChange={handleCompanyChange}
                                        className={inputClass}
                                        placeholder="27AAACG1234A1Z5"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>PAN (Optional)</label>
                                    <input
                                        type="text"
                                        name="pan"
                                        value={companySettings.pan}
                                        onChange={handleCompanyChange}
                                        className={inputClass}
                                        placeholder="AAACG1234A"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>CIN (Optional)</label>
                                    <input
                                        type="text"
                                        name="cin"
                                        value={companySettings.cin}
                                        onChange={handleCompanyChange}
                                        className={inputClass}
                                        placeholder="U12345MH2020PTC123456"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={18} />
                                {loading ? 'Saving...' : 'Save Company Info'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8 max-w-3xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MdLocationOn className="text-primary-500" />
                        Company Address
                    </h2>

                    <form onSubmit={handleCompanySettingsUpdate} className="space-y-5">
                        <div>
                            <label className={labelClass}>Address Line 1 <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                name="line1"
                                value={companySettings.address.line1}
                                onChange={(e) => handleCompanyChange(e, 'address')}
                                className={inputClass}
                                placeholder="Building name, Street address"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Address Line 2</label>
                            <input
                                type="text"
                                name="line2"
                                value={companySettings.address.line2}
                                onChange={(e) => handleCompanyChange(e, 'address')}
                                className={inputClass}
                                placeholder="Area, Landmark"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>City <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    name="city"
                                    value={companySettings.address.city}
                                    onChange={(e) => handleCompanyChange(e, 'address')}
                                    className={inputClass}
                                    placeholder="City"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>State <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    name="state"
                                    value={companySettings.address.state}
                                    onChange={(e) => handleCompanyChange(e, 'address')}
                                    className={inputClass}
                                    placeholder="State"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Pin Code <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    name="pincode"
                                    value={companySettings.address.pincode}
                                    onChange={(e) => handleCompanyChange(e, 'address')}
                                    className={inputClass}
                                    placeholder="Pin Code"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Country</label>
                                <input
                                    type="text"
                                    name="country"
                                    value={companySettings.address.country}
                                    onChange={(e) => handleCompanyChange(e, 'address')}
                                    className={inputClass}
                                    placeholder="India"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={18} />
                                {loading ? 'Saving...' : 'Save Address'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Banking Tab */}
            {activeTab === 'banking' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8 max-w-3xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MdAccountBalance className="text-primary-500" />
                        Bank Details
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">These details will appear on your quotations and invoices for payment reference.</p>

                    <form onSubmit={handleCompanySettingsUpdate} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Bank Name</label>
                                <input
                                    type="text"
                                    name="bankName"
                                    value={companySettings.bankDetails.bankName}
                                    onChange={(e) => handleCompanyChange(e, 'bankDetails')}
                                    className={inputClass}
                                    placeholder="e.g., HDFC Bank"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Branch Name</label>
                                <input
                                    type="text"
                                    name="branchName"
                                    value={companySettings.bankDetails.branchName}
                                    onChange={(e) => handleCompanyChange(e, 'bankDetails')}
                                    className={inputClass}
                                    placeholder="e.g., Main Branch, Nagpur"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Account Holder Name</label>
                                <input
                                    type="text"
                                    name="accountName"
                                    value={companySettings.bankDetails.accountName}
                                    onChange={(e) => handleCompanyChange(e, 'bankDetails')}
                                    className={inputClass}
                                    placeholder="e.g., Eco Pipe Company"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Account Number</label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={companySettings.bankDetails.accountNumber}
                                    onChange={(e) => handleCompanyChange(e, 'bankDetails')}
                                    className={inputClass}
                                    placeholder="e.g., 1234567890123"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>IFSC Code</label>
                                <input
                                    type="text"
                                    name="ifscCode"
                                    value={companySettings.bankDetails.ifscCode}
                                    onChange={(e) => handleCompanyChange(e, 'bankDetails')}
                                    className={inputClass}
                                    placeholder="e.g., HDFC0001234"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={18} />
                                {loading ? 'Saving...' : 'Save Bank Details'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Terms & Signatory Tab */}
            {activeTab === 'terms' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6 md:p-8 max-w-3xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <MdDescription className="text-primary-500" />
                        Authorized Signatory & Terms
                    </h2>

                    <form onSubmit={handleCompanySettingsUpdate} className="space-y-6">
                        {/* Authorized Signatory */}
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Authorized Signatory</h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>Signatory Name <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={companySettings.authorizedSignatory.name}
                                        onChange={(e) => handleCompanyChange(e, 'authorizedSignatory')}
                                        className={inputClass}
                                        placeholder="e.g., Rajesh Sharma"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Designation</label>
                                    <input
                                        type="text"
                                        name="designation"
                                        value={companySettings.authorizedSignatory.designation}
                                        onChange={(e) => handleCompanyChange(e, 'authorizedSignatory')}
                                        className={inputClass}
                                        placeholder="e.g., Managing Director"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Signature Image</label>
                                    <div className="relative h-[46px] bg-white border border-slate-200 rounded-xl overflow-hidden group flex items-center">
                                        {companySettings.authorizedSignatory.signatureImageUrl ? (
                                            <div className="flex items-center gap-2 px-3">
                                                <img
                                                    src={resolveImageUrl(companySettings.authorizedSignatory.signatureImageUrl)}
                                                    alt="Signature"
                                                    className="h-8 object-contain"
                                                />
                                                <span className="text-xs text-emerald-600 font-bold">Uploaded</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 text-slate-400">
                                                <MdCloudUpload size={20} />
                                                <span className="text-xs font-bold">Upload Signature</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSignatureUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            disabled={signatureUploading}
                                        />
                                        {signatureUploading && (
                                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Default Terms */}
                        <div>
                            <label className={labelClass}>Default Terms & Conditions</label>
                            <p className="text-xs text-slate-400 mb-2">These will be pre-filled when creating new quotations.</p>
                            <textarea
                                name="defaultTerms"
                                value={companySettings.defaultTerms}
                                onChange={handleCompanyChange}
                                rows={8}
                                className={`${inputClass} resize-none`}
                                placeholder={`1. Prices are valid for 7 days from the date of quotation.
2. Payment Terms: 50% advance, balance before delivery.
3. Delivery within 15-20 working days.
4. Taxes as applicable.
5. Subject to Nagpur Jurisdiction.`}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={18} />
                                {loading ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Settings;
