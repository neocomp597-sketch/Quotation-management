import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
    MdArrowBack, MdEdit, MdDelete, MdSave, MdPerson, MdAssignment, 
    MdCalendarMonth, MdEventAvailable, MdReceiptLong, MdChat, 
    MdLocationOn, MdMyLocation, MdCheckCircle, MdPrint, MdAdd, 
    MdClose, MdBadge, MdBusiness, MdPhone, MdEmail, MdAttachMoney, 
    MdDescription, MdLabel, MdAccessTime
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { enquiryService, userService, salespersonService, payrollService } from '../services/api';
import Modal from '../components/Modal';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const StatusPill = ({ status }) => {
    const styles = {
        'Open': 'bg-teal-50 text-teal-700 border-teal-200',
        'Assigned': 'bg-blue-50 text-blue-700 border-blue-200',
        'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
        'Pending Customer': 'bg-orange-50 text-orange-700 border-orange-200',
        'Resolved': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'Closed': 'bg-slate-100 text-slate-700 border-slate-300',
        'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200',
        'New': 'bg-blue-50 text-blue-700 border-blue-200',
        'Contacted': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'Quotation Pending': 'bg-amber-50 text-amber-700 border-amber-200',
        'Quotation Received': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
        'Negotiation': 'bg-purple-50 text-purple-700 border-purple-200',
        'Finalized': 'bg-teal-50 text-teal-700 border-teal-200',
        'PO Received': 'bg-teal-50 text-teal-700 border-teal-200',
        'Lost': 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {status || 'Open'}
        </span>
    );
};

const ActionStatusPill = ({ status }) => {
    const colorMap = {
        'VISIT CUSTOMER': 'bg-slate-100 text-slate-700 border-slate-200',
        'Quotation given': 'bg-sky-50 text-sky-700 border-sky-200',
        'Followup date time': 'bg-amber-50 text-amber-700 border-amber-200',
        'quotation revise': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'quotation finalise': 'bg-purple-50 text-purple-700 border-purple-200',
        'po received': 'bg-teal-50 text-teal-700 border-teal-200',
        'enquiry won': 'bg-teal-100 text-teal-800 border-teal-300'
    };
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-tight border ${colorMap[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {status || 'VISIT CUSTOMER'}
        </span>
    );
};

const VisitStatusPill = ({ status }) => {
    const styles = {
        'Scheduled': 'bg-amber-50 text-amber-800 border-amber-300',
        'Visited': 'bg-sky-50 text-sky-800 border-sky-300',
        'Follow-up Required': 'bg-purple-50 text-purple-800 border-purple-300',
        'Completed': 'bg-teal-50 text-teal-800 border-teal-300',
        'Cancelled': 'bg-rose-50 text-rose-800 border-rose-300'
    };
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {status || 'Scheduled'}
        </span>
    );
};

const toDatetimeLocal = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EnquiryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [enquiry, setEnquiry] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Active tab: 'items' | 'timeline' | 'visits'
    const [activeTab, setActiveTab] = useState('items');

    // Controls state
    const [selectedStatus, setSelectedStatus] = useState('Open');
    const [selectedLossReason, setSelectedLossReason] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingAssignee, setUpdatingAssignee] = useState(false);

    // Follow up logging state
    const [newFollowUpNote, setNewFollowUpNote] = useState('');
    const [newFollowUpAction, setNewFollowUpAction] = useState('Call');
    const [addingFollowUp, setAddingFollowUp] = useState(false);

    // Visit Management Modal state
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [editingVisitId, setEditingVisitId] = useState(null);
    const [visitStatus, setVisitStatus] = useState('Scheduled');
    const [visitDate, setVisitDate] = useState('');
    const [visitExecutive, setVisitExecutive] = useState('');
    const [visitPurpose, setVisitPurpose] = useState('Site Visit');
    const [visitLocation, setVisitLocation] = useState('');
    const [visitNotes, setVisitNotes] = useState('');
    const [visitOutcome, setVisitOutcome] = useState('');
    const [gettingGps, setGettingGps] = useState(false);
    const [schedulingVisit, setSchedulingVisit] = useState(false);

    // Delete Modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const loadEnquiryDetails = async () => {
        try {
            setLoading(true);
            const [enqRes, salesRes, userRes, empRes] = await Promise.allSettled([
                enquiryService.getById(id),
                salespersonService.getAll(),
                userService.getAll({ limit: 1000 }),
                payrollService.getEmployees({ limit: 1000 })
            ]);

            if (enqRes.status !== 'fulfilled' || !enqRes.value.data) {
                toast.error('Enquiry not found');
                navigate('/enquiries');
                return;
            }

            const data = enqRes.value.data;
            setEnquiry(data);
            setSelectedStatus(data.status || 'Open');
            setSelectedLossReason(data.closureReason || '');
            setSelectedAssignee(data.assignedTo?._id || data.assignedTo || '');

            // Sales executives list
            const valueOf = (r) => r.status === 'fulfilled' ? r.value : null;
            const salesData = valueOf(salesRes)?.data || [];
            const userData = valueOf(userRes)?.data || [];
            const empData = valueOf(empRes)?.data || [];

            const fetchedSalespersons = Array.isArray(salesData) ? salesData : salesData?.data || [];
            const fetchedUsers = Array.isArray(userData) ? userData : userData?.data || [];
            const fetchedEmployees = Array.isArray(empData) ? empData : empData?.data || [];

            const empDesignationMap = new Map();
            fetchedEmployees.forEach(emp => {
                if (!emp) return;
                const desig = String(emp.designation || '').trim();
                if (emp.email) empDesignationMap.set(String(emp.email).toLowerCase().trim(), desig);
                if (emp.userId) {
                    const uId = typeof emp.userId === 'object' ? emp.userId._id : emp.userId;
                    if (uId) empDesignationMap.set(String(uId), desig);
                }
            });

            const isSalesExecutiveDesignation = (desigStr, roleStr) => {
                const desigLower = (desigStr || '').toLowerCase().trim();
                const roleLower = (roleStr || '').toLowerCase().trim().replace(/_/g, ' ');
                if (desigLower) {
                    return desigLower === 'sales executive' || desigLower === 'sales executive role' || desigLower === 'salesperson';
                }
                return roleLower === 'sales executive' || roleLower === 'sales executive role' || roleLower === 'sales' || roleLower === 'salesperson' || roleLower === 'sales_executive';
            };

            const mergedMap = new Map();
            const getKey = (item) => {
                if (item.email && String(item.email).trim()) {
                    return String(item.email).toLowerCase().trim();
                }
                return String(item.name || '').toLowerCase().trim();
            };

            fetchedSalespersons.forEach(item => {
                if (item && item._id) {
                    const key = getKey(item);
                    if (key && !mergedMap.has(key)) {
                        const empDesig = item.email ? empDesignationMap.get(String(item.email).toLowerCase().trim()) : null;
                        if (!empDesig || isSalesExecutiveDesignation(empDesig, 'Sales Executive')) {
                            mergedMap.set(key, {
                                _id: item._id.toString(),
                                name: item.name,
                                email: item.email,
                                role: 'Sales Executive'
                            });
                        }
                    }
                }
            });

            fetchedUsers.forEach(item => {
                if (item && item._id) {
                    const key = getKey(item);
                    if (key && !mergedMap.has(key)) {
                        const emailStr = String(item.email || '').toLowerCase().trim();
                        const empDesig = empDesignationMap.get(item._id.toString()) || empDesignationMap.get(emailStr);
                        if (isSalesExecutiveDesignation(empDesig, item.role)) {
                            mergedMap.set(key, {
                                _id: item._id.toString(),
                                name: item.name,
                                email: item.email,
                                role: 'Sales Executive'
                            });
                        }
                    }
                }
            });

            fetchedEmployees.forEach(emp => {
                if (!emp || !emp.name) return;
                const desig = String(emp.designation || '').trim();
                if (isSalesExecutiveDesignation(desig, '')) {
                    const key = getKey(emp);
                    if (key && !mergedMap.has(key)) {
                        const targetId = emp.userId ? (typeof emp.userId === 'object' ? emp.userId._id : emp.userId) : emp._id;
                        const idStr = String(targetId);
                        mergedMap.set(key, {
                            _id: idStr,
                            name: emp.name,
                            email: emp.email || '',
                            role: 'Sales Executive'
                        });
                    }
                }
            });

            setUsers(Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            console.error('Error fetching enquiry details:', err);
            toast.error('Failed to load enquiry details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadEnquiryDetails();
        }
    }, [id]);

    const handleSaveStatus = async () => {
        if (!enquiry) return;
        if (selectedStatus === 'Lost' && !selectedLossReason) {
            toast.error('Please select a reason for loss');
            return;
        }
        try {
            setUpdatingStatus(true);
            const payload = {
                status: selectedStatus,
                closureReason: selectedStatus === 'Lost' ? selectedLossReason : ''
            };

            await enquiryService.update(id, payload);
            toast.success('Enquiry status updated successfully!');
            await loadEnquiryDetails();
        } catch (err) {
            console.error('Save Status Error:', err);
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleSaveAssignee = async () => {
        if (!enquiry) return;
        try {
            setUpdatingAssignee(true);
            const payload = {
                assignedTo: selectedAssignee || null
            };

            await enquiryService.update(id, payload);
            toast.success('Sales Executive assignment updated!');
            await loadEnquiryDetails();
        } catch (err) {
            console.error('Save Assignee Error:', err);
            toast.error('Failed to update Sales Executive assignment');
        } finally {
            setUpdatingAssignee(false);
        }
    };

    const handleAddFollowUp = async (e) => {
        if (e) e.preventDefault();
        if (!newFollowUpNote.trim()) {
            toast.error('Follow-up note cannot be empty');
            return;
        }
        try {
            setAddingFollowUp(true);
            const currentHistory = enquiry.followUpHistory || [];
            const updatedHistory = [
                ...currentHistory,
                {
                    note: newFollowUpNote.trim(),
                    actionType: newFollowUpAction,
                    date: new Date()
                }
            ];

            await enquiryService.update(id, { followUpHistory: updatedHistory });
            toast.success('Follow-up entry recorded successfully!');
            setNewFollowUpNote('');
            await loadEnquiryDetails();
        } catch (err) {
            console.error('Add Followup Error:', err);
            toast.error('Failed to record follow-up entry');
        } finally {
            setAddingFollowUp(false);
        }
    };

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

    const handleOpenNewVisitModal = () => {
        navigate(`/enquiries/view/${id}/visit/new`);
    };

    const handleOpenEditVisitModal = (visitObj, visitIndex) => {
        navigate(`/enquiries/view/${id}/visit/edit/${visitIndex}`);
    };

    const handleScheduleVisitSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!visitDate) {
            toast.error('Please select an appointment date & time');
            return;
        }

        try {
            setSchedulingVisit(true);
            const currentVisits = Array.isArray(enquiry.visits) ? [...enquiry.visits] : [];
            const currentHistory = enquiry.followUpHistory || [];
            const assignedExecObj = users.find(u => u._id === visitExecutive);
            const execName = assignedExecObj ? assignedExecObj.name : 'Unassigned';

            let updatedVisits = [];
            let logMessage = '';

            if (editingVisitId !== null && currentVisits[editingVisitId]) {
                updatedVisits = currentVisits.map((v, i) => {
                    if (i === editingVisitId) {
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

            const payload = {
                visits: updatedVisits,
                followUpDate: nextFollowUp,
                followUpHistory: updatedHistory,
                assignedTo: visitExecutive || enquiry.assignedTo?._id || enquiry.assignedTo || null
            };

            await enquiryService.update(id, payload);
            toast.success(editingVisitId !== null ? 'Visit details & status updated!' : 'Field Visit scheduled successfully!');
            setShowVisitModal(false);
            setEditingVisitId(null);
            await loadEnquiryDetails();
        } catch (err) {
            console.error('Visit Save Error:', err);
            toast.error('Failed to save visit details');
        } finally {
            setSchedulingVisit(false);
        }
    };

    const handleDeleteEnquiry = async () => {
        try {
            await enquiryService.delete(id);
            toast.success('Enquiry deleted successfully');
            navigate('/enquiries');
        } catch (err) {
            console.error('Delete Enquiry Error:', err);
            toast.error('Failed to delete enquiry');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="space-y-3 text-center">
                    <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Enquiry Details...</p>
                </div>
            </div>
        );
    }

    if (!enquiry) return null;

    const customerObj = enquiry.customerId || {};
    const customerDisplayName = customerObj.companyName || customerObj.customerName || enquiry.companyName || 'N/A';
    const executiveName = enquiry.assignedTo?.name || 'Unassigned';

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Top Navigation & Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/enquiries')}
                        className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-colors font-bold text-xs flex items-center gap-2"
                        title="Back to Enquiries List"
                    >
                        <MdArrowBack size={20} />
                        <span className="hidden sm:inline">Back to Enquiries</span>
                    </button>

                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                Enquiry Details: <span className="text-teal-600 dark:text-teal-400 font-mono">{enquiry.enquiryNo}</span>
                            </h1>
                            <StatusPill status={enquiry.status} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                            Created on {formatDate(enquiry.enquiryDate)} • Priority: <span className="font-bold text-slate-800 dark:text-slate-200">{enquiry.priority || 'Medium'}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                        <MdPrint size={18} /> Print
                    </button>
                    
                    <Link
                        to={`/enquiries/edit/${id}`}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center gap-2"
                    >
                        <MdEdit size={18} /> Edit Enquiry
                    </Link>

                    <button
                        onClick={() => setDeleteModalOpen(true)}
                        className="p-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-colors"
                        title="Delete Enquiry"
                    >
                        <MdDelete size={20} />
                    </button>
                </div>
            </div>

            {/* Top Summary Banner */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
                <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Customer Name</span>
                    <span className="text-base font-black mt-1 block truncate text-slate-900 dark:text-white">{customerDisplayName}</span>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Assigned Executive</span>
                    <span className="text-base font-black mt-1 block truncate text-indigo-600 dark:text-indigo-400">
                        {executiveName}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Enquiry Date</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200 mt-1 block">{formatDate(enquiry.enquiryDate)}</span>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Status</span>
                    <div className="mt-1 flex"><StatusPill status={enquiry.status} /></div>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Closure Probability</span>
                    <span className="text-base font-black text-teal-600 dark:text-teal-400 mt-1 block">{enquiry.probability || 0}%</span>
                </div>
            </div>

            {/* Main Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel: Workflow Management & Information Cards */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Card 1: Outcome Status Management */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <MdAssignment className="text-teal-600 dark:text-teal-400" size={20} /> Managing Status
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Update Outcome Status</label>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                                >
                                    {['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed', 'Cancelled', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation', 'Finalized', 'PO Received', 'Lost'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedStatus === 'Lost' && (
                                <div className="animate-in fade-in duration-200">
                                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1.5">Reason for Loss *</label>
                                    <select
                                        value={selectedLossReason}
                                        onChange={(e) => setSelectedLossReason(e.target.value)}
                                        className="w-full px-4 py-3 bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl outline-none text-xs font-bold text-rose-800 dark:text-rose-300"
                                    >
                                        <option value="">-- Select Loss Reason --</option>
                                        {['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other'].map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button
                                onClick={handleSaveStatus}
                                disabled={updatingStatus}
                                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/15 flex items-center justify-center gap-2"
                            >
                                <MdSave size={18} /> {updatingStatus ? 'Saving Status...' : 'Save Status'}
                            </button>
                        </div>
                    </div>

                    {/* Card 2: Sales Executive Assignment */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <MdPerson className="text-teal-600 dark:text-teal-400" size={20} /> Sales Executive Assignment
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Assigned Sales Executive</label>
                                <select
                                    value={selectedAssignee}
                                    onChange={(e) => setSelectedAssignee(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.name} {u.role ? `(${u.role})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleSaveAssignee}
                                disabled={updatingAssignee}
                                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/15 flex items-center justify-center gap-2"
                            >
                                <MdPerson size={18} /> {updatingAssignee ? 'Saving...' : 'Update Sales Executive'}
                            </button>
                        </div>
                    </div>

                    {/* Card 3: Field Visit & Appointment Schedule */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <span className="flex items-center gap-2">
                                <MdCalendarMonth className="text-teal-600 dark:text-teal-400" size={20} /> Visit Management
                            </span>
                        </h3>
                        {enquiry.followUpDate && (
                            <div className="p-4 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60 rounded-2xl flex items-center gap-3">
                                <MdEventAvailable className="text-teal-600 dark:text-teal-400 flex-shrink-0" size={22} />
                                <div>
                                    <span className="text-[9px] font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider block">Next Follow-up / Appointment</span>
                                    <span className="text-xs font-bold text-teal-950 dark:text-teal-100">{formatDate(enquiry.followUpDate)}</span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleOpenNewVisitModal}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-teal-600/15 flex items-center justify-center gap-2"
                        >
                            <MdCalendarMonth size={18} /> + Schedule / Log Field Visit
                        </button>
                    </div>

                    {/* Card 4: Customer Details Summary */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                            Customer Contact Information
                        </h3>
                        <div className="space-y-3 text-xs font-medium">
                            <div className="flex items-start gap-3">
                                <MdBusiness className="text-slate-400 mt-0.5 flex-shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">Company Name</span>
                                    <span className="text-slate-900 dark:text-white font-bold text-sm">{customerDisplayName}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MdPerson className="text-slate-400 mt-0.5 flex-shrink-0" size={18} />
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">Contact Person</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold">{customerObj.customerName || enquiry.contactPerson || 'N/A'}</span>
                                    {enquiry.contactDesignation && <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{enquiry.contactDesignation}</span>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">GSTIN</span>
                                    <span className="text-slate-900 dark:text-white font-bold font-mono">{customerObj.gstin || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">Mobile Phone</span>
                                    <span className="text-slate-900 dark:text-white font-bold">{customerObj.mobile || enquiry.contactMobile || 'N/A'}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">Email Address</span>
                                <span className="text-slate-900 dark:text-white font-bold truncate block">{customerObj.email || enquiry.contactEmail || 'N/A'}</span>
                            </div>
                            {enquiry.siteAddress && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold uppercase">Site / Delivery Address</span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed mt-0.5">{enquiry.siteAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 5: Project & Specification Details */}
                    {(enquiry.projectName || enquiry.technicalSpecifications || enquiry.remarks || enquiry.budget) && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                                Project Overview & Specifications
                            </h3>
                            <div className="space-y-3 text-xs">
                                {enquiry.projectName && (
                                    <div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Project Name</span>
                                        <span className="text-slate-900 dark:text-white font-bold">{enquiry.projectName}</span>
                                    </div>
                                )}
                                {enquiry.budget && (
                                    <div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Estimated Budget</span>
                                        <span className="text-teal-700 dark:text-teal-400 font-bold font-mono">₹{Number(enquiry.budget).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {enquiry.technicalSpecifications && (
                                    <div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Technical Specifications</span>
                                        <p className="text-slate-700 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 leading-relaxed mt-1">
                                            {enquiry.technicalSpecifications}
                                        </p>
                                    </div>
                                )}
                                {enquiry.remarks && (
                                    <div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Remarks</span>
                                        <p className="text-slate-600 dark:text-slate-400 italic mt-0.5">{enquiry.remarks}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Workspace Tabs (Items, Timeline, Visits) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 p-1.5 rounded-3xl gap-2">
                        <button
                            onClick={() => setActiveTab('items')}
                            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'items'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <MdReceiptLong size={18} className="text-teal-600 dark:text-teal-400" />
                            Enquiry Items ({(enquiry.items || []).length})
                        </button>

                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'timeline'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <MdChat size={18} className="text-purple-600 dark:text-purple-400" />
                            Follow-ups & Notes ({(enquiry.followUpHistory || []).length})
                        </button>

                        <button
                            onClick={() => setActiveTab('visits')}
                            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'visits'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <MdCalendarMonth size={18} className="text-teal-600 dark:text-teal-400" />
                            Field Visits ({(enquiry.visits || []).length})
                        </button>
                    </div>

                    {/* TAB 1: ENQUIRY ITEMS */}
                    {activeTab === 'items' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Requested Line Items</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Products and services included in this enquiry</p>
                                </div>
                                <span className="px-3 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 rounded-full text-xs font-black">
                                    {(enquiry.items || []).length} Items
                                </span>
                            </div>

                            <div className="space-y-4">
                                {(enquiry.items || []).map((item, idx) => (
                                    <div key={idx} className="p-5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/80 rounded-2xl space-y-3 hover:border-teal-300 dark:hover:border-teal-500 transition-all shadow-2xs">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                        {item.productName || item.productId?.productName || 'Unnamed Product'}
                                                    </h4>
                                                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                                        (item.itemCategory === 'Manual' || item.isManual)
                                                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                                            : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                                                    }`}>
                                                        {item.itemCategory || (item.isManual ? 'Manual' : 'Added')}
                                                    </span>
                                                </div>
                                                {item.productCode && (
                                                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">Code: {item.productCode}</p>
                                                )}
                                            </div>
                                            <ActionStatusPill status={item.actionStatus} />
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-medium">
                                            <div>
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block uppercase">Quantity</span>
                                                <span className="text-slate-900 dark:text-white font-black">{item.quantity} {item.uom || 'Pcs'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block uppercase">Unit Price</span>
                                                <span className="text-slate-900 dark:text-slate-200 font-bold font-mono">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block uppercase">Discount</span>
                                                <span className="text-slate-900 dark:text-slate-200 font-bold">{item.discountPercent || 0}%</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold block uppercase">Total Value</span>
                                                <span className="text-teal-700 dark:text-teal-400 font-black font-mono">₹{Number(item.value || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                                            <div>
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mr-2">Final Selected Vendor:</span>
                                                <span className="text-teal-700 dark:text-teal-400 font-bold">{item.finalVendor?.name || item.finalVendor || 'Pending Selection'}</span>
                                            </div>
                                            {item.salespersonName && (
                                                <div>
                                                    <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mr-2">Assigned Salesman:</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold">{item.salespersonName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Financial Totals Banner */}
                            <div className="p-5 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="space-y-1 text-center sm:text-left">
                                    <span className="text-[10px] font-black text-teal-800 dark:text-teal-300 uppercase tracking-widest block">Summary Breakdown</span>
                                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap">
                                        <span>Subtotal: ₹{Number(enquiry.subtotal || 0).toLocaleString('en-IN')}</span>
                                        <span>Disc: ₹{Number(enquiry.discount || 0).toLocaleString('en-IN')}</span>
                                        <span>Freight: ₹{Number(enquiry.freight || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest block">Grand Total</span>
                                    <span className="text-2xl font-black text-teal-900 dark:text-teal-200 font-mono">
                                        ₹{Number(enquiry.grandTotal || enquiry.subtotal || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: FOLLOW-UPS & TIMELINE */}
                    {activeTab === 'timeline' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
                            {/* Follow up log form */}
                            <form onSubmit={handleAddFollowUp} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 p-5 rounded-2xl space-y-3">
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Log New Communication / Follow-up</h4>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select
                                        value={newFollowUpAction}
                                        onChange={(e) => setNewFollowUpAction(e.target.value)}
                                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-200"
                                    >
                                        <option value="Call">Call</option>
                                        <option value="Email">Email</option>
                                        <option value="Visit">Visit</option>
                                        <option value="Meeting">Meeting</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="What was discussed with the client?"
                                        value={newFollowUpNote}
                                        onChange={(e) => setNewFollowUpNote(e.target.value)}
                                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-200"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={addingFollowUp}
                                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-purple-600/15"
                                    >
                                        {addingFollowUp ? 'Logging...' : 'Add Note'}
                                    </button>
                                </div>
                            </form>

                            {/* Timeline display */}
                            <div className="space-y-3">
                                {(!enquiry.followUpHistory || enquiry.followUpHistory.length === 0) ? (
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                        No follow-up entries recorded yet. Use the form above to add meeting or call notes.
                                    </p>
                                ) : (
                                    enquiry.followUpHistory.slice().reverse().map((log, idx) => (
                                        <div key={idx} className="bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 p-4 rounded-2xl flex flex-col gap-2 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <span className="px-3 py-1 bg-white dark:bg-slate-900 text-[10px] font-black text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
                                                    {log.actionType}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                    {new Date(log.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-800 dark:text-slate-100 font-bold leading-relaxed">{log.note}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: FIELD VISITS */}
                    {activeTab === 'visits' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Field Visits & Site Appointments</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Track customer visits, GPS locations, statuses, and field feedback</p>
                                </div>
                                <button
                                    onClick={handleOpenNewVisitModal}
                                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-teal-600/15"
                                >
                                    <MdCalendarMonth size={18} /> + Schedule Visit
                                </button>
                            </div>

                            <div className="space-y-4">
                                {(!enquiry.visits || enquiry.visits.length === 0) ? (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                        <MdCalendarMonth size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No field visits recorded yet.</p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Schedule visits to track site visits, product demos, and client meetings.</p>
                                        <button
                                            onClick={handleOpenNewVisitModal}
                                            className="mt-4 px-5 py-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 rounded-xl text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-all"
                                        >
                                            + Schedule First Visit
                                        </button>
                                    </div>
                                ) : (
                                    enquiry.visits.slice().reverse().map((visit, idx) => {
                                        const originalIdx = enquiry.visits.length - 1 - idx;
                                        return (
                                            <div key={visit._id || originalIdx} className="p-5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl space-y-4 hover:border-teal-300 dark:hover:border-teal-500 transition-all shadow-2xs">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <VisitStatusPill status={visit.status} />
                                                        <span className="px-3 py-1 bg-teal-100/90 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                                            {visit.purpose || 'Site Visit'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleOpenEditVisitModal(visit, originalIdx)}
                                                        className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-700 text-slate-700 dark:text-slate-200 hover:text-teal-900 dark:hover:text-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                                                    >
                                                        <MdEdit size={14} className="text-teal-600 dark:text-teal-400" /> Edit Visit
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase block">Appointment Date & Time</span>
                                                        <span className="text-slate-900 dark:text-white font-black">{visit.visitDate ? new Date(visit.visitDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase block">Assigned Representative</span>
                                                        <span className="text-slate-900 dark:text-slate-200 font-bold">{visit.assignedTo?.name || 'Unassigned'}</span>
                                                    </div>
                                                </div>

                                                {visit.location && (
                                                    <div className="text-xs flex items-center gap-2 bg-teal-50/70 dark:bg-teal-950/40 p-3 rounded-xl border border-teal-200/70 dark:border-teal-800/60 font-bold text-teal-950 dark:text-teal-200">
                                                        <MdLocationOn size={18} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                                                        <span>{visit.location}</span>
                                                    </div>
                                                )}

                                                {visit.remarks && (
                                                    <div className="text-xs">
                                                        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase block mb-1">Remarks / Agenda</span>
                                                        <p className="text-slate-800 dark:text-slate-200 font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">{visit.remarks}</p>
                                                    </div>
                                                )}

                                                {visit.outcome && (
                                                    <div className="text-xs">
                                                        <span className="text-teal-700 dark:text-teal-400 text-[10px] font-black uppercase block mb-1">Visit Outcome & Feedback</span>
                                                        <p className="text-teal-950 dark:text-teal-100 font-bold bg-teal-50/70 dark:bg-teal-950/40 p-3 rounded-xl border border-teal-200/70 dark:border-teal-800/60 leading-relaxed">{visit.outcome}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SCHEDULE / EDIT FIELD VISIT MODAL */}
            {showVisitModal && (
                <Modal
                    isOpen={showVisitModal}
                    onClose={() => {
                        setShowVisitModal(false);
                        setEditingVisitId(null);
                    }}
                    title={editingVisitId !== null ? "Edit Visit Details & Status" : "Schedule / Log Customer Visit"}
                    maxWidth="max-w-lg"
                >
                    <form onSubmit={handleScheduleVisitSubmit} className="space-y-4">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {editingVisitId !== null
                                ? `Update visit status and details for Enquiry `
                                : `Schedule a field visit or site meeting for Enquiry `}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{enquiry.enquiryNo}</span>.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Visit Status *</label>
                                <select
                                    value={visitStatus}
                                    onChange={(e) => setVisitStatus(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500"
                                    required
                                >
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="Visited">Visited</option>
                                    <option value="Follow-up Required">Follow-up Required</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Visit Purpose</label>
                                <select
                                    value={visitPurpose}
                                    onChange={(e) => setVisitPurpose(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
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
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Visit Location / GPS Coordinates</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={visitLocation}
                                    onChange={(e) => setVisitLocation(e.target.value)}
                                    placeholder="Enter address or fetch live GPS..."
                                    className="w-full pl-9 pr-24 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
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

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Appointment Date & Time *</label>
                            <input
                                type="datetime-local"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Sales Representative for Visit</label>
                            <select
                                value={visitExecutive}
                                onChange={(e) => setVisitExecutive(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
                            >
                                <option value="">-- Select Executive --</option>
                                {users.map(u => (
                                    <option key={u._id} value={u._id}>{u.name} {u.role ? `(${u.role})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Discussion Agenda / Remarks</label>
                            <textarea
                                rows={2}
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                placeholder="Enter visit details or discussion topics..."
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Visit Outcome & Feedback</label>
                            <textarea
                                rows={2}
                                value={visitOutcome}
                                onChange={(e) => setVisitOutcome(e.target.value)}
                                placeholder="Enter visit outcome, client response, or next required action..."
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-teal-500"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowVisitModal(false);
                                    setEditingVisitId(null);
                                }}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={schedulingVisit}
                                className="px-5 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 shadow-md shadow-teal-600/20 flex items-center gap-1.5"
                            >
                                <MdSave size={16} />
                                {schedulingVisit
                                    ? (editingVisitId !== null ? 'Saving...' : 'Scheduling...')
                                    : (editingVisitId !== null ? 'Update Visit Details' : 'Schedule Visit')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteModalOpen && (
                <Modal
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    title="Confirm Deletion"
                >
                    <div className="space-y-6">
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">
                            Are you sure you want to delete Enquiry <span className="font-mono text-slate-900">{enquiry.enquiryNo}</span>? This action is permanent and cannot be undone.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteEnquiry}
                                className="flex-1 px-6 py-3.5 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                            >
                                Delete Enquiry
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EnquiryDetail;
