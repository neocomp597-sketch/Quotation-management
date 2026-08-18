import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    MdArrowBack, MdCalendarMonth, MdLocationOn, MdMyLocation, 
    MdPerson, MdBusiness, MdCheckCircle, MdSave, MdPhone
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { enquiryService, userService } from '../services/api';

const toDatetimeLocal = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ScheduleEnquiryVisit = () => {
    const { id, visitIndex } = useParams();
    const navigate = useNavigate();

    const isEditMode = visitIndex !== undefined && visitIndex !== null;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gettingGps, setGettingGps] = useState(false);
    const [enquiry, setEnquiry] = useState(null);
    const [users, setUsers] = useState([]);

    // Form states
    const [visitStatus, setVisitStatus] = useState('Scheduled');
    const [visitPurpose, setVisitPurpose] = useState('Site Visit');
    const [visitLocation, setVisitLocation] = useState('');
    const [visitDate, setVisitDate] = useState(toDatetimeLocal(new Date(Date.now() + 86400000)));
    const [visitExecutive, setVisitExecutive] = useState('');
    const [visitNotes, setVisitNotes] = useState('');
    const [visitOutcome, setVisitOutcome] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [enqRes, usersRes] = await Promise.all([
                    enquiryService.getById(id),
                    userService.getAll()
                ]);

                const enq = enqRes.data;
                setEnquiry(enq);
                
                const userList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.users || []);
                setUsers(userList);

                if (isEditMode) {
                    const idx = parseInt(visitIndex, 10);
                    const currentVisits = Array.isArray(enq?.visits) ? enq.visits : [];
                    const v = currentVisits[idx];
                    if (v) {
                        setVisitStatus(v.status || 'Scheduled');
                        setVisitPurpose(v.purpose || 'Site Visit');
                        setVisitLocation(v.location || '');
                        setVisitDate(toDatetimeLocal(v.visitDate || v.date || new Date()));
                        setVisitExecutive(v.assignedTo?._id || v.assignedTo || enq?.assignedTo?._id || enq?.assignedTo || '');
                        setVisitNotes(v.remarks || v.note || '');
                        setVisitOutcome(v.outcome || '');
                    }
                } else {
                    setVisitExecutive(enq?.assignedTo?._id || enq?.assignedTo || '');
                    setVisitLocation(enq?.siteAddress || enq?.customerId?.billingAddress?.line1 || '');
                }
            } catch (err) {
                toast.error('Failed to load enquiry or user details');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id, visitIndex, isEditMode]);

    const handleFetchGpsLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                let address = '';

                // Primary Provider: OpenStreetMap Nominatim with zoom=18 for Street-Level Address
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`);
                    const data = await res.json();
                    if (data && data.address) {
                        const a = data.address;
                        const houseNo = a.house_number ? `No. ${a.house_number}` : '';
                        const placeName = a.building || a.amenity || a.shop || a.office || a.commercial || a.industrial;
                        const street = a.road || a.street || a.pedestrian || a.footway;
                        const area = a.suburb || a.neighbourhood || a.residential || a.city_district || a.subdistrict;
                        const city = a.city || a.town || a.village || a.district;
                        const state = a.state;
                        const pincode = a.postcode;

                        const buildingOrStreet = [houseNo, placeName, street].filter(Boolean).join(' ');
                        const parts = [buildingOrStreet, area, city, pincode, state].filter(Boolean);
                        
                        if (parts.length > 0) {
                            address = parts.join(', ');
                        } else if (data.display_name) {
                            address = data.display_name;
                        }
                    } else if (data && data.display_name) {
                        address = data.display_name;
                    }
                } catch (e) {
                    console.error('Nominatim street address error:', e);
                }

                // Fallback Provider: BigDataCloud
                if (!address) {
                    try {
                        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                        const data = await res.json();
                        if (data) {
                            const locality = data.locality || data.city;
                            const state = data.principalSubdivision;
                            const pincode = data.postcode;
                            const country = data.countryName;

                            const parts = [locality, state, pincode, country].filter(Boolean);
                            if (parts.length > 0) {
                                address = parts.join(', ');
                            }
                        }
                    } catch (e) {
                        console.error('BigDataCloud error:', e);
                    }
                }

                if (address) {
                    setVisitLocation(address);
                    toast.success('Accurate street address retrieved!');
                } else {
                    setVisitLocation(`Location near Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`);
                    toast.success('GPS position captured!');
                }
                setGettingGps(false);
            },
            (error) => {
                console.error('GPS error:', error);
                toast.error(`Unable to retrieve location: ${error.message}`);
                setGettingGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!visitDate) {
            toast.error('Please select an appointment date & time');
            return;
        }

        try {
            setSaving(true);
            const currentVisits = Array.isArray(enquiry.visits) ? [...enquiry.visits] : [];
            const currentHistory = enquiry.followUpHistory || [];
            const assignedExecObj = users.find(u => u._id === visitExecutive);
            const execName = assignedExecObj ? assignedExecObj.name : 'Unassigned';

            let updatedVisits = [];
            let logMessage = '';

            if (isEditMode) {
                const idx = parseInt(visitIndex, 10);
                updatedVisits = currentVisits.map((v, i) => {
                    if (i === idx) {
                        return {
                            ...v,
                            visitDate: new Date(visitDate),
                            assignedTo: visitExecutive || null,
                            purpose: visitPurpose,
                            location: visitLocation,
                            status: visitStatus,
                            remarks: visitNotes,
                            outcome: visitOutcome,
                            updatedAt: new Date()
                        };
                    }
                    return v;
                });
                logMessage = `[VISIT UPDATED] Status: ${visitStatus}. Purpose: ${visitPurpose}. Location: ${visitLocation || 'N/A'}. Remarks: ${visitNotes || 'N/A'}${visitOutcome ? ` - Outcome: ${visitOutcome}` : ''} (Executive: ${execName})`;
            } else {
                const newVisitObj = {
                    visitDate: new Date(visitDate),
                    assignedTo: visitExecutive || null,
                    purpose: visitPurpose,
                    location: visitLocation,
                    status: visitStatus,
                    remarks: visitNotes,
                    outcome: visitOutcome,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                updatedVisits = [...currentVisits, newVisitObj];
                logMessage = `[VISIT SCHEDULED] Status: ${visitStatus}. Purpose: ${visitPurpose}. Location: ${visitLocation || 'N/A'}. Remarks: ${visitNotes || 'N/A'}${visitOutcome ? ` - Outcome: ${visitOutcome}` : ''} (Assigned: ${execName})`;
            }

            const updatedHistory = [...currentHistory, {
                note: logMessage,
                actionType: 'Visit',
                date: new Date()
            }];

            const nextFollowUp = (visitStatus === 'Scheduled' || visitStatus === 'Follow-up Required')
                ? new Date(visitDate)
                : enquiry.followUpDate;

            const updatedEnquiryPayload = {
                visits: updatedVisits,
                followUpHistory: updatedHistory,
                followUpDate: nextFollowUp,
                lastActivityDate: new Date()
            };

            await enquiryService.update(id, updatedEnquiryPayload);
            toast.success(isEditMode ? 'Visit updated successfully!' : 'Visit scheduled successfully!');
            navigate(`/enquiries/view/${id}`);
        } catch (err) {
            console.error('Failed to save visit:', err);
            toast.error('Failed to save visit schedule');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Visit Form...</p>
                </div>
            </div>
        );
    }

    if (!enquiry) {
        return (
            <div className="p-8 text-center space-y-4">
                <p className="text-sm font-bold text-slate-600">Enquiry not found.</p>
                <button
                    onClick={() => navigate('/enquiries')}
                    className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"
                >
                    Back to Enquiries
                </button>
            </div>
        );
    }

    const customerObj = enquiry.customerId || {};
    const customerDisplayName = customerObj.companyName || enquiry.companyName || customerObj.customerName || enquiry.contactPerson || 'Customer';

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(`/enquiries/view/${id}`)}
                        className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all"
                        title="Back to Enquiry Details"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-black text-slate-900 font-outfit">
                                {isEditMode ? 'Edit Customer Visit' : 'Schedule / Log Customer Visit'}
                            </h1>
                            <span className="px-3 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-black uppercase tracking-wider">
                                Enquiry #{enquiry.enquiryNo}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {customerDisplayName} • {customerObj.mobile || enquiry.contactMobile || 'No contact number'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => navigate(`/enquiries/view/${id}`)}
                        className="flex-1 sm:flex-none px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2"
                    >
                        <MdSave size={18} />
                        {saving ? 'Saving...' : isEditMode ? 'Update Visit Details' : 'Schedule Visit'}
                    </button>
                </div>
            </div>

            {/* Form Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Form: Main Visit Details */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-5">
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                        <MdCalendarMonth className="text-teal-600" size={18} />
                        Visit Parameters & Timeline
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    Visit Status *
                                </label>
                                <select
                                    value={visitStatus}
                                    onChange={(e) => setVisitStatus(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                                >
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="Visited">Visited</option>
                                    <option value="Follow-up Required">Follow-up Required</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    Visit Purpose
                                </label>
                                <select
                                    value={visitPurpose}
                                    onChange={(e) => setVisitPurpose(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                                >
                                    <option value="Site Visit">Site Visit / Measurement</option>
                                    <option value="Product Demonstration">Product Demonstration</option>
                                    <option value="Commercial Negotiation">Commercial Negotiation</option>
                                    <option value="Requirement Gathering">Requirement Gathering</option>
                                    <option value="Customer Meeting">Customer Meeting</option>
                                    <option value="Followup">General Followup</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Visit Location / GPS Coordinates
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={visitLocation}
                                    onChange={(e) => setVisitLocation(e.target.value)}
                                    placeholder="Enter address or fetch live GPS..."
                                    className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                                />
                                <MdLocationOn className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" size={18} />
                                <button
                                    type="button"
                                    onClick={handleFetchGpsLocation}
                                    disabled={gettingGps}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-teal-600 text-white rounded-xl text-[10px] font-black hover:bg-teal-700 transition-all flex items-center gap-1 shadow-xs"
                                >
                                    <MdMyLocation size={12} />
                                    {gettingGps ? 'Fetching...' : 'Get GPS'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    Appointment Date & Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={visitDate}
                                    onChange={(e) => setVisitDate(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    Sales Representative for Visit
                                </label>
                                <select
                                    value={visitExecutive}
                                    onChange={(e) => setVisitExecutive(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>
                                            {u.name} {u.role ? `(${u.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Discussion Agenda / Remarks
                            </label>
                            <textarea
                                rows={3}
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                placeholder="Enter visit details or discussion topics..."
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Visit Outcome & Feedback
                            </label>
                            <textarea
                                rows={3}
                                value={visitOutcome}
                                onChange={(e) => setVisitOutcome(e.target.value)}
                                placeholder="Enter visit outcome, client response, or next required action..."
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500 transition-all"
                            />
                        </div>
                    </form>
                </div>

                {/* Right Sidebar: Customer & Enquiry Summary Card */}
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                            Client & Site Reference
                        </h3>
                        <div className="space-y-3 text-xs font-medium">
                            <div className="flex items-start gap-3">
                                <MdBusiness className="text-slate-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Company</span>
                                    <span className="text-slate-900 font-bold">{customerDisplayName}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MdPerson className="text-slate-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Contact Person</span>
                                    <span className="text-slate-800 font-bold">{customerObj.customerName || enquiry.contactPerson || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MdPhone className="text-slate-400 mt-0.5 shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Phone Number</span>
                                    <span className="text-slate-900 font-bold">{customerObj.mobile || enquiry.contactMobile || 'N/A'}</span>
                                </div>
                            </div>

                            {enquiry.siteAddress && (
                                <div className="pt-2 border-t border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Registered Site Address</span>
                                    <p className="text-slate-700 font-semibold leading-relaxed mt-0.5">{enquiry.siteAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-teal-50/70 border border-teal-200/80 p-5 rounded-3xl space-y-2">
                        <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block">Pro-Tip for Field Visits</span>
                        <p className="text-xs text-teal-950 font-medium leading-relaxed">
                            Click <strong>Get GPS</strong> when arriving at the client site to automatically capture live GPS coordinates and street address verification.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleEnquiryVisit;
