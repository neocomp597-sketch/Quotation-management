import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { csmService, userService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdAssignment, MdPerson, MdCalendarMonth, 
    MdFeedback, MdArrowBack, MdSave, 
    MdWarning, MdCheckCircleOutline, MdCheckCircle, MdChat,
    MdMyLocation, MdLocationOn, MdStar, MdStarBorder, MdMap
} from 'react-icons/md';
import Modal from '../components/Modal';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const TicketDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState(null);
    const [activeTab, setActiveTab] = useState('communication');
    
    // Entitlements (Warranty/AMC check results)
    const [entitlements, setEntitlements] = useState(null);

    // Dynamic Lists
    const [teams, setTeams] = useState([]);
    const [engineers, setEngineers] = useState([]);
    
    // Assignment Form State
    const [assignTeam, setAssignTeam] = useState('');
    const [assignEngineers, setAssignEngineers] = useState([]);

    // Operations states
    const [commentText, setCommentText] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isFirstCallResolved, setIsFirstCallResolved] = useState(false);
    
    // Feedback Stars State
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState('');

    // Field Visit Schedule Form
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [visitDate, setVisitDate] = useState('');
    const [visitEngineer, setVisitEngineer] = useState('');
    const [activeVisit, setActiveVisit] = useState(null);

    // Ticket Reassignment Form
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignEngineer, setReassignEngineer] = useState('');
    const [reassignReason, setReassignReason] = useState('Leave');
    const [reassignNotes, setReassignNotes] = useState('');

    // GPS & Location Tracking State
    const [isCapturingGps, setIsCapturingGps] = useState(false);
    const [manualAddress, setManualAddress] = useState('');

    // Ticket Closing Modal State
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeResolutionNotes, setCloseResolutionNotes] = useState('');
    const [closeIsFcr, setCloseIsFcr] = useState(true);
    const [closeRating, setCloseRating] = useState(5);
    const [closeFeedbackComment, setCloseFeedbackComment] = useState('');
    const [closeGps, setCloseGps] = useState(null);
    const [isClosingTicket, setIsClosingTicket] = useState(false);

    const handleReassignSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!reassignEngineer) {
            toast.error('Please select an engineer to reassign ticket');
            return;
        }
        try {
            await csmService.reassignTicket(id, {
                toEngineerId: reassignEngineer,
                reason: reassignReason,
                notes: reassignNotes
            });
            toast.success('Ticket reassigned successfully!');
            setShowReassignModal(false);
            setReassignNotes('');
            fetchTicketDetails();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reassignment failed');
        }
    };

    const handleCaptureGps = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }
        setIsCapturingGps(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await csmService.updateTicketLocation(id, {
                        latitude,
                        longitude,
                        address: manualAddress || ''
                    });
                    toast.success('GPS Location updated successfully!');
                    setIsCapturingGps(false);
                    fetchTicketDetails();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to update GPS location');
                    setIsCapturingGps(false);
                }
            },
            (error) => {
                toast.error(`GPS Location error: ${error.message}`);
                setIsCapturingGps(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleCaptureGpsForClose = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCloseGps({
                    latitude,
                    longitude,
                    address: manualAddress || ''
                });
                toast.success('GPS coordinates attached for closing!');
            },
            (err) => {
                toast.error(`GPS Error: ${err.message}`);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleCloseTicketSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!closeResolutionNotes.trim()) {
            toast.error('Please enter resolution notes to close the ticket');
            return;
        }
        try {
            setIsClosingTicket(true);
            const locData = closeGps ? {
                latitude: closeGps.latitude,
                longitude: closeGps.longitude,
                address: closeGps.address || manualAddress || ''
            } : {};

            await csmService.closeTicket(id, {
                resolutionNotes: closeResolutionNotes,
                isFirstCallResolved: closeIsFcr,
                rating: closeRating,
                comment: closeFeedbackComment,
                ...locData
            });

            toast.success('Ticket closed successfully!');
            setShowCloseModal(false);
            fetchTicketDetails();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to close ticket');
        } finally {
            setIsClosingTicket(false);
        }
    };

    const fetchTicketDetails = async () => {
        try {
            const res = await csmService.getTicketById(id);
            const ticketData = res.data;
            setTicket(ticketData);
            setSelectedStatus(ticketData.status);
            setIsFirstCallResolved(ticketData.isFirstCallResolved || false);
            setAssignTeam(ticketData.assignedTeamId?._id || '');
            const currentEngIds = (ticketData.assignedEngineerIds || []).map(e => e._id || e);
            if (currentEngIds.length === 0 && ticketData.assignedEngineerId) {
                currentEngIds.push(ticketData.assignedEngineerId._id || ticketData.assignedEngineerId);
            }
            setAssignEngineers(currentEngIds);

            // Verify entitlements if product is linked
            if (ticketData.customerId?._id && ticketData.productId?._id) {
                const entRes = await csmService.verifyEntitlements({
                    customerId: ticketData.customerId._id,
                    productId: ticketData.productId._id
                });
                setEntitlements(entRes.data);
            }

            // Load service visits for this customer to see if there is an active one
            if (ticketData.customerId?._id) {
                const visitsRes = await csmService.getVisits({ customerId: ticketData.customerId._id });
                const allVisits = visitsRes.data || [];
                const active = allVisits.find(v => ['Scheduled', 'In Transit', 'Started'].includes(v.status));
                setActiveVisit(active || null);
            }
        } catch (error) {
            toast.error('Failed to load ticket details');
            navigate('/csm/tickets');
        } finally {
            setLoading(false);
        }
    };

    const loadAssignees = async () => {
        try {
            const [teamRes, engRes] = await Promise.all([
                csmService.getTeams(),
                csmService.getEngineers()
            ]);
            setTeams(teamRes.data || []);
            setEngineers(engRes.data || []);
        } catch (error) {
            console.error('Error loading assignments:', error);
        }
    };

    useEffect(() => {
        fetchTicketDetails();
        loadAssignees();
    }, [id]);

    const { isSubmitting: isAssigning, execute: handleAssign } = useSubmitGuard(async () => {
        try {
            await csmService.assignTicket(id, {
                assignedTeamId: assignTeam || null,
                assignedEngineerIds: assignEngineers,
                assignedEngineerId: assignEngineers.length > 0 ? assignEngineers[0] : null
            });
            toast.success('Assignments updated successfully');
            fetchTicketDetails();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Assignment failed');
        }
    });

    const handleStatusChange = async (status, fcr = false) => {
        try {
            await csmService.updateTicketStatus(id, status, fcr);
            toast.success(`Status updated to ${status}`);
            fetchTicketDetails();
        } catch (error) {
            toast.error('Status change failed');
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        try {
            await csmService.addComment(id, { text: commentText });
            setCommentText('');
            toast.success('Comment posted');
            fetchTicketDetails();
        } catch (error) {
            toast.error('Comment failed');
        }
    };

    const handleEscalate = async () => {
        try {
            await csmService.escalateTicket(id);
            toast.warning('Ticket escalated to next level');
            fetchTicketDetails();
        } catch (error) {
            toast.error('Escalation failed');
        }
    };

    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        try {
            await csmService.submitFeedback(id, {
                rating: feedbackRating,
                comment: feedbackComment
            });
            toast.success('Feedback submitted successfully!');
            fetchTicketDetails();
        } catch (error) {
            toast.error('Feedback submission failed');
        }
    };

    const { isSubmitting: isSchedulingVisit, execute: handleScheduleVisit } = useSubmitGuard(async (e) => {
        e.preventDefault();
        try {
            if (activeVisit) {
                await csmService.rescheduleVisit(activeVisit._id, {
                    engineerId: visitEngineer,
                    scheduledDate: visitDate
                });
                toast.success('Service Visit rescheduled successfully');
            } else {
                await csmService.createVisit({
                    ticketId: id,
                    engineerId: visitEngineer,
                    scheduledDate: visitDate,
                    billingStatus: entitlements?.recommendedBillingType || 'Paid'
                });
                toast.success('Service Visit scheduled successfully');
            }
            setShowVisitModal(false);
            fetchTicketDetails();
        } catch (error) {
            const errMsg = error.response?.data?.message || (activeVisit ? 'Rescheduling visit failed' : 'Scheduling visit failed');
            toast.error(errMsg);
        }
    });

    if (loading || !ticket) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading Ticket details...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Nav Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/csm/tickets')}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all text-slate-600"
                >
                    <MdArrowBack size={20} />
                </button>
                <div>
                    <span className="text-xs font-black uppercase text-teal-600 tracking-wider">Ticket Details</span>
                    <h1 className="text-2xl font-black text-slate-900 font-outfit uppercase -mt-1">
                        {ticket.ticketNo}
                    </h1>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Panel: Ticket Details */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Information Box */}
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                        <h2 className="font-outfit font-black text-lg text-slate-900 uppercase border-b border-slate-50 pb-2">
                            {ticket.issueTitle}
                        </h2>
                        
                        <div className="space-y-3 text-sm font-semibold text-slate-700">
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</span>
                                <span className="font-black text-slate-900 text-base">{ticket.customerId?.customerName}</span>
                                <p className="text-xs text-slate-400">{ticket.customerId?.companyName}</p>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</span>
                                    <span className="truncate block">{ticket.contactName || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</span>
                                    <span className="truncate block">{ticket.contactPhone || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Pincode</span>
                                    <span className="truncate block">{ticket.pincode || '-'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Priority</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: ticket.priorityId?.color }}>
                                        {ticket.priorityId?.name}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Category</span>
                                    <span>{ticket.categoryId?.name}</span>
                                </div>
                            </div>

                            {ticket.productId && (
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Product Linked</span>
                                    <span>{ticket.productId?.productName}</span>
                                </div>
                            )}

                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Description</span>
                                <p className="text-xs text-slate-500 font-medium whitespace-pre-wrap leading-relaxed">{ticket.description || 'No description provided'}</p>
                            </div>

                            {ticket.assignedSalespersonId && (
                                <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100 space-y-1.5 mt-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-500 block">👤 Assigned Sales Rep</span>
                                    <p className="text-sm font-black text-primary-900">{ticket.assignedSalespersonId.name}</p>
                                    <div className="text-xs text-slate-600 font-semibold space-y-0.5">
                                        {ticket.assignedSalespersonId.email && <p>✉️ {ticket.assignedSalespersonId.email}</p>}
                                        {ticket.assignedSalespersonId.mobile && <p>📞 {ticket.assignedSalespersonId.mobile}</p>}
                                    </div>
                                </div>
                            )}

                            {(() => {
                                const assignedEngs = (ticket.assignedEngineerIds && ticket.assignedEngineerIds.length > 0)
                                    ? ticket.assignedEngineerIds
                                    : (ticket.assignedEngineerId ? [ticket.assignedEngineerId] : []);

                                if (assignedEngs.length === 0) return null;

                                return (
                                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-100 space-y-2 mt-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 block">
                                            🛠️ Assigned Service Engineer{assignedEngs.length > 1 ? 's' : ''} ({assignedEngs.length})
                                        </span>
                                        <div className="space-y-2">
                                            {assignedEngs.map((eng, idx) => (
                                                <div key={eng._id || idx} className="bg-white/80 p-2.5 rounded-xl border border-teal-200/60 space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-black text-teal-900">{eng.name}</p>
                                                        {idx === 0 && assignedEngs.length > 1 && (
                                                            <span className="text-[9px] font-black text-teal-700 bg-teal-200/60 px-1.5 py-0.5 rounded uppercase">Lead</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-600 font-semibold space-y-0.5">
                                                        {eng.email && <p>✉️ {eng.email}</p>}
                                                        {eng.mobile && <p>📞 {eng.mobile}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Entitlement Status Box */}

                        {entitlements && (
                            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Entitlements Check</span>
                                <div className="flex items-center gap-2 text-xs font-bold">
                                    {entitlements.warranty.isActive ? (
                                        <div className="flex items-center gap-1 text-teal-600">
                                            <MdCheckCircleOutline size={18} />
                                            <span>Warranty Valid (Expires: {new Date(entitlements.warranty.expiryDate).toLocaleDateString()})</span>
                                        </div>
                                    ) : entitlements.amc.isActive ? (
                                        <div className="flex items-center gap-1 text-primary-600">
                                            <MdCheckCircleOutline size={18} />
                                            <span>AMC Active ({entitlements.amc.remainingVisits} visits left)</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <MdWarning size={18} />
                                            <span>No active Warranty or AMC contract</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-[10px] font-black tracking-widest uppercase bg-teal-600 text-white rounded-lg px-3 py-1.5 text-center mt-1">
                                    Billing Coverage: {entitlements.recommendedBillingType}
                                </div>
                            </div>
                        )}



                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                        <h3 className="font-outfit font-black text-sm text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">
                            Actions & Escalation
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Update Status</label>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="Open">Open</option>
                                    <option value="Assigned">Assigned</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pending Customer">Pending Customer</option>
                                    <option value="Resolved">Resolved</option>
                                    <option value="Closed">Closed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            
                            {selectedStatus === 'Resolved' && (
                                <div className="flex items-center gap-2 py-2 px-3 bg-teal-50/60 rounded-xl border border-teal-100/80 animate-fade-in">
                                    <input
                                        type="checkbox"
                                        id="fcr-checkbox"
                                        checked={isFirstCallResolved}
                                        onChange={(e) => setIsFirstCallResolved(e.target.checked)}
                                        className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                                    />
                                    <label htmlFor="fcr-checkbox" className="text-xs font-bold text-teal-800 cursor-pointer select-none">
                                        First Call Resolved (FCR)
                                    </label>
                                </div>
                            )}

                            {(selectedStatus !== ticket.status || (selectedStatus === 'Resolved' && isFirstCallResolved !== ticket.isFirstCallResolved)) && (
                                <button
                                    onClick={() => handleStatusChange(selectedStatus, isFirstCallResolved)}
                                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md animate-pulse"
                                >
                                    Save Status
                                </button>
                            )}

                            {ticket.status !== 'Closed' ? (
                                <button
                                    onClick={() => {
                                        setCloseResolutionNotes('');
                                        setCloseIsFcr(ticket.isFirstCallResolved || false);
                                        setCloseGps(ticket.location?.latitude ? ticket.location : null);
                                        setShowCloseModal(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                                >
                                    <MdCheckCircle size={16} />
                                    Close Ticket
                                </button>
                            ) : (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                    <span className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
                                        <MdCheckCircle size={16} /> Ticket Closed
                                    </span>
                                    {ticket.closedAt && (
                                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                            {new Date(ticket.closedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleEscalate}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 hover:bg-rose-100/50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <MdWarning size={16} />
                                Escalate Ticket
                            </button>
                        </div>
                    </div>

                    {/* GPS & Location Tracking Card */}
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                            <h3 className="font-outfit font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <MdLocationOn className="text-emerald-600" size={18} />
                                GPS & Location
                            </h3>
                            {ticket.location?.latitude && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                    Captured
                                </span>
                            )}
                        </div>

                        {ticket.location?.latitude ? (
                            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2 text-xs">
                                <div className="flex items-center justify-between text-emerald-900 font-bold">
                                    <span>Lat: {ticket.location.latitude.toFixed(6)}</span>
                                    <span>Lng: {ticket.location.longitude.toFixed(6)}</span>
                                </div>
                                {ticket.location.address && (
                                    <p className="text-slate-600 font-medium">{ticket.location.address}</p>
                                )}
                                {ticket.location.updatedAt && (
                                    <p className="text-[10px] text-slate-400">
                                        Updated: {new Date(ticket.location.updatedAt).toLocaleString()}
                                    </p>
                                )}
                                <a
                                    href={`https://www.google.com/maps?q=${ticket.location.latitude},${ticket.location.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline mt-1"
                                >
                                    <MdMap size={14} /> Open in Google Maps
                                </a>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 font-medium">No GPS location recorded for this ticket yet.</p>
                        )}

                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Optional address / location notes..."
                                value={manualAddress}
                                onChange={(e) => setManualAddress(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-600"
                            />
                            <button
                                type="button"
                                onClick={handleCaptureGps}
                                disabled={isCapturingGps}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
                            >
                                <MdMyLocation size={14} className={isCapturingGps ? 'animate-spin' : ''} />
                                {isCapturingGps ? 'Capturing Location...' : 'Capture GPS Location'}
                            </button>
                        </div>
                    </div>

                    {/* Reassign Team / Agent */}
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                        <h3 className="font-outfit font-black text-sm text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">
                            Assign case
                        </h3>
                        <div className="space-y-3">
                            {ticket.assignedSalespersonId && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sales Representative</label>
                                    <div className="px-4 py-3.5 bg-primary-50/50 border border-primary-100/60 rounded-xl text-xs font-bold text-primary-900 flex items-center gap-2">
                                        <span>👤</span>
                                        <div>
                                            <p className="font-black">{ticket.assignedSalespersonId.name}</p>
                                            {ticket.assignedSalespersonId.mobile && <p className="text-[10px] text-slate-500 font-semibold">{ticket.assignedSalespersonId.mobile}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(() => {
                                const assignedEngs = (ticket.assignedEngineerIds && ticket.assignedEngineerIds.length > 0)
                                    ? ticket.assignedEngineerIds
                                    : (ticket.assignedEngineerId ? [ticket.assignedEngineerId] : []);

                                if (assignedEngs.length === 0) return null;

                                return (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            Currently Assigned ({assignedEngs.length})
                                        </label>
                                        <div className="space-y-1.5">
                                            {assignedEngs.map((eng, idx) => (
                                                <div key={eng._id || idx} className="px-3.5 py-2.5 bg-teal-50/70 border border-teal-100/80 rounded-xl text-xs font-bold text-teal-900 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span>🛠️</span>
                                                        <div>
                                                            <p className="font-black text-slate-800">{eng.name}</p>
                                                            {eng.mobile && <p className="text-[10px] text-slate-500 font-semibold">{eng.mobile}</p>}
                                                        </div>
                                                    </div>
                                                    {idx === 0 && assignedEngs.length > 1 && (
                                                        <span className="text-[9px] font-extrabold px-2 py-0.5 bg-teal-200/60 text-teal-800 rounded-full uppercase">Lead</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service Team</label>
                                <select
                                    value={assignTeam}
                                    onChange={(e) => setAssignTeam(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="">Unassigned</option>
                                    {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Assign Engineers ({assignEngineers.length} selected)
                                    </label>
                                    {ticket.pincode && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">PIN: {ticket.pincode}</span>
                                    )}
                                </div>
                                {(() => {
                                    const ticketPincode = ticket.pincode ? String(ticket.pincode).trim() : '';
                                    const currentEngIds = ticket.assignedEngineerIds?.map(e => e._id || e) || (ticket.assignedEngineerId ? [ticket.assignedEngineerId._id || ticket.assignedEngineerId] : []);

                                    const eligibleEngineers = engineers.filter(eng => {
                                        if (currentEngIds.includes(eng._id)) return true;
                                        if (activeVisit && (activeVisit.engineerId?._id === eng._id || activeVisit.engineerId === eng._id)) return true;
                                        if (!ticketPincode) return true;
                                        if (Array.isArray(eng.pincodes) && eng.pincodes.includes(ticketPincode)) return true;
                                        const terrPincodes = eng.territoryId?.rules?.pincodes;
                                        if (Array.isArray(terrPincodes) && terrPincodes.includes(ticketPincode)) return true;
                                        return false;
                                    });

                                    const toggleEngineer = (engId) => {
                                        if (assignEngineers.includes(engId)) {
                                            setAssignEngineers(assignEngineers.filter(id => id !== engId));
                                        } else {
                                            setAssignEngineers([...assignEngineers, engId]);
                                        }
                                    };

                                    return (
                                        <div className="space-y-2">
                                            <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                                                {eligibleEngineers.length === 0 ? (
                                                    <p className="text-[11px] font-semibold text-slate-400 p-2 text-center">
                                                        No eligible engineers for PIN {ticketPincode || 'N/A'}.
                                                    </p>
                                                ) : (
                                                    eligibleEngineers.map(eng => {
                                                        const isSelected = assignEngineers.includes(eng._id);
                                                        return (
                                                            <div
                                                                key={eng._id}
                                                                onClick={() => toggleEngineer(eng._id)}
                                                                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                                                                    isSelected
                                                                        ? 'bg-primary-50 border-primary-300 text-primary-900 shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}}
                                                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 cursor-pointer"
                                                                    />
                                                                    <div>
                                                                        <span className="font-bold">{eng.name}</span>
                                                                        {eng.mobile && <span className="text-[10px] text-slate-400 block">{eng.mobile}</span>}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <span className="text-[10px] font-black text-primary-600 bg-primary-100/70 px-2 py-0.5 rounded-md">Selected</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            {ticketPincode && eligibleEngineers.length === 0 && (
                                                <p className="text-[10px] font-bold text-amber-600 mt-1">No engineers assigned for pincode {ticketPincode}.</p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <button
                                onClick={handleAssign}
                                disabled={isAssigning}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MdSave size={16} />
                                {isAssigning ? 'Updating...' : 'Update Assignees'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReassignEngineer(ticket.assignedEngineerId?._id || (ticket.assignedEngineerIds && ticket.assignedEngineerIds[0]?._id) || '');
                                    setReassignReason('Leave');
                                    setShowReassignModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mt-2"
                            >
                                <MdAssignment size={16} />
                                <span>Reassign Ticket</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Tabs */}
                <div className="lg:col-span-2 space-y-6 flex flex-col">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-200 gap-2">
                        <button
                            onClick={() => setActiveTab('communication')}
                            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                                activeTab === 'communication'
                                    ? 'border-primary-600 text-primary-600 font-black'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <MdChat size={18} />
                            Communication & Timeline
                        </button>
                        <button
                            onClick={() => setActiveTab('visits')}
                            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                                activeTab === 'visits'
                                    ? 'border-primary-600 text-primary-600 font-black'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <MdCalendarMonth size={18} />
                            Field Visits
                        </button>
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                                activeTab === 'feedback'
                                    ? 'border-primary-600 text-primary-600 font-black'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <MdFeedback size={18} />
                            Feedback Survey
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 min-h-[400px]">
                        
                        {/* Tab 1: Timeline & Chat */}
                        {activeTab === 'communication' && (
                            <div className="space-y-6 h-full flex flex-col">
                                {/* Chats and timelines */}
                                <div className="flex-1 space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {ticket.comments?.map((c, i) => (
                                        <div key={i} className="flex flex-col space-y-1 items-start bg-slate-50 rounded-2xl p-4 max-w-lg border border-slate-100">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.authorName}</span>
                                            <p className="text-sm font-semibold text-slate-700 leading-relaxed">{c.text}</p>
                                            <span className="text-[9px] text-slate-400 self-end mt-1">{new Date(c.createdAt).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    
                                    <div className="border-t border-slate-50 pt-4 mt-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Audit Activity Log</span>
                                        <div className="space-y-3 border-l-2 border-slate-100 ml-2 pl-4">
                                            {ticket.timeline?.map((t, idx) => (
                                                <div key={idx} className="relative pb-2">
                                                    <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 bg-primary-600 border border-white rounded-full"></span>
                                                    <div className="text-xs">
                                                        <span className="font-bold text-slate-900">{t.activityType}: </span>
                                                        <span className="text-slate-500 font-medium">{t.description}</span>
                                                        <span className="text-[9px] text-slate-400 block mt-0.5">{new Date(t.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleAddComment} className="border-t border-slate-100 pt-4 flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Type comment or support reply..."
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    />
                                    <button
                                        type="submit"
                                        className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-md active:scale-95"
                                    >
                                        Post
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Tab 2: Service Visits */}
                        {activeTab === 'visits' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Actions</span>
                                    {!activeVisit && (
                                        <button
                                            onClick={() => {
                                                setVisitDate('');
                                                setVisitEngineer(assignEngineer);
                                                setShowVisitModal(true);
                                            }}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all"
                                        >
                                            Schedule Visit
                                        </button>
                                    )}
                                </div>

                                {/* Display Service Visits */}
                                <div className="space-y-3">
                                    {activeVisit ? (
                                        <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Active Visit No</span>
                                                    <p className="text-sm font-black text-slate-900">{activeVisit.visitNo}</p>
                                                </div>
                                                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                    {activeVisit.status}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Scheduled Date</span>
                                                    <span>{new Date(activeVisit.scheduledDate).toLocaleString()}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Service Engineer</span>
                                                    <span>{activeVisit.engineerId?.name || 'Unassigned'}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setVisitDate(activeVisit.scheduledDate ? new Date(activeVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                                    setVisitEngineer(activeVisit.engineerId?._id || activeVisit.engineerId || '');
                                                    setShowVisitModal(true);
                                                }}
                                                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md animate-pulse"
                                            >
                                                Reschedule Visit
                                            </button>
                                        </div>
                                    ) : ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                                        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-2xl text-xs font-bold text-center">
                                            Ticket resolved/closed. View visit records in the Service Visits menu.
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 font-semibold text-sm text-center py-8">
                                            No active visit scheduled. Navigate to "Service Visits" tab for geofenced check-ins once scheduled.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab 3: Customer Feedback */}
                        {activeTab === 'feedback' && (
                            <div className="max-w-md mx-auto space-y-6">
                                <h3 className="font-outfit font-black text-lg text-slate-900 uppercase text-center">
                                    Customer Satisfaction (CSAT) Survey
                                </h3>
                                
                                {ticket.feedback?.rating ? (
                                    <div className="p-6 bg-teal-50 border border-teal-200 text-teal-800 rounded-[2rem] text-center space-y-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <span 
                                                    key={star} 
                                                    className={`text-2xl ${star <= ticket.feedback.rating ? 'text-amber-500' : 'text-slate-200'}`}
                                                >
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <p className="font-black text-base">CSAT Feedback Logged</p>
                                        <p className="text-xs font-medium text-teal-700">"{ticket.feedback.comment || 'No comment provided.'}"</p>
                                        <span className="text-[10px] text-teal-600 block">{new Date(ticket.feedback.submittedAt).toLocaleDateString()}</span>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmitFeedback} className="space-y-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setFeedbackRating(star)}
                                                    className={`text-4xl hover:scale-110 transition-transform ${star <= feedbackRating ? 'text-amber-400' : 'text-slate-200'}`}
                                                >
                                                    ★
                                                </button>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Feedback Comments</label>
                                            <textarea
                                                required
                                                placeholder="Explain customer satisfaction levels..."
                                                value={feedbackComment}
                                                onChange={(e) => setFeedbackComment(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-24"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                                        >
                                            Submit Review
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Visit Modal */}
            <Modal
                isOpen={showVisitModal}
                onClose={() => setShowVisitModal(false)}
                title={activeVisit ? "Reschedule Visit" : "Schedule Visit"}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowVisitModal(false)}
                            className="flex-1 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="schedule-visit-form"
                            disabled={isSchedulingVisit}
                            className="flex-1 w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSchedulingVisit ? (activeVisit ? 'Rescheduling...' : 'Scheduling...') : (activeVisit ? 'Reschedule' : 'Schedule')}
                        </button>
                    </>
                }
            >
                <form id="schedule-visit-form" onSubmit={handleScheduleVisit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment Date & Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign Service Engineer *</label>
                        {(() => {
                            const ticketPincode = ticket?.pincode ? String(ticket.pincode).trim() : '';
                            const eligibleEngineers = engineers.filter(eng => {
                                if (ticket?.assignedEngineerId && (ticket.assignedEngineerId._id === eng._id || ticket.assignedEngineerId === eng._id)) return true;
                                if (activeVisit && (activeVisit.engineerId?._id === eng._id || activeVisit.engineerId === eng._id)) return true;
                                if (!ticketPincode) return true;
                                if (Array.isArray(eng.pincodes) && eng.pincodes.includes(ticketPincode)) return true;
                                const terrPincodes = eng.territoryId?.rules?.pincodes;
                                if (Array.isArray(terrPincodes) && terrPincodes.includes(ticketPincode)) return true;
                                return false;
                            });

                            return (
                                <select
                                    required
                                    value={visitEngineer}
                                    onChange={(e) => setVisitEngineer(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="">Select Engineer</option>
                                    {eligibleEngineers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                                </select>
                            );
                        })()}
                    </div>
                </form>
            </Modal>

            {/* Reassign Ticket Modal */}
            <Modal
                isOpen={showReassignModal}
                onClose={() => setShowReassignModal(false)}
                title="Reassign Ticket"
                footer={
                    <div className="flex items-center justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => setShowReassignModal(false)}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold uppercase text-xs hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="reassign-ticket-form"
                            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                        >
                            Reassign Ticket
                        </button>
                    </div>
                }
            >
                <form id="reassign-ticket-form" onSubmit={handleReassignSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Original Engineer</label>
                        <input
                            type="text"
                            disabled
                            value={ticket.assignedEngineerId?.name || 'Unassigned'}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-slate-100 text-slate-600"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select New Service Engineer *</label>
                        <select
                            required
                            value={reassignEngineer}
                            onChange={(e) => setReassignEngineer(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">-- Select New Engineer --</option>
                            {engineers.map(u => (
                                <option key={u._id} value={u._id}>{u.name} ({u.status || 'Active'})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reassignment Reason *</label>
                        <select
                            required
                            value={reassignReason}
                            onChange={(e) => setReassignReason(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="Leave">Leave</option>
                            <option value="Sick">Sick</option>
                            <option value="Emergency">Emergency</option>
                            <option value="Workload">Workload</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Additional Notes</label>
                        <textarea
                            rows={3}
                            placeholder="Enter any transfer notes or context..."
                            value={reassignNotes}
                            onChange={(e) => setReassignNotes(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                        />
                    </div>
                </form>
            </Modal>

            {/* Close Ticket Modal */}
            <Modal
                isOpen={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                title="Close Ticket & Record Resolution"
                footer={
                    <div className="flex items-center justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => setShowCloseModal(false)}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold uppercase text-xs hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCloseTicketSubmit}
                            disabled={isClosingTicket}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            <MdCheckCircle size={16} />
                            {isClosingTicket ? 'Closing Ticket...' : 'Confirm & Close Ticket'}
                        </button>
                    </div>
                }
            >
                <form onSubmit={handleCloseTicketSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution Summary / Notes *</label>
                        <textarea
                            required
                            rows={3}
                            placeholder="Describe how the ticket was resolved..."
                            value={closeResolutionNotes}
                            onChange={(e) => setCloseResolutionNotes(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-emerald-600"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div>
                            <span className="text-xs font-bold text-slate-900 block">First Call Resolved (FCR)</span>
                            <span className="text-[10px] text-slate-500">Was the issue resolved on the first interaction?</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={closeIsFcr}
                            onChange={(e) => setCloseIsFcr(e.target.checked)}
                            className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer Feedback Rating</label>
                        <div className="flex items-center gap-2 py-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setCloseRating(star)}
                                    className="p-1 text-amber-400 hover:scale-125 transition-transform"
                                >
                                    {star <= closeRating ? <MdStar size={24} /> : <MdStarBorder size={24} />}
                                </button>
                            ))}
                            <span className="text-xs font-bold text-slate-700 ml-2">{closeRating} / 5 Stars</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Feedback Remarks (Optional)</label>
                        <input
                            type="text"
                            placeholder="Customer remarks..."
                            value={closeFeedbackComment}
                            onChange={(e) => setCloseFeedbackComment(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-emerald-600"
                        />
                    </div>

                    <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                <MdLocationOn size={16} /> Attach Geolocation Stamp
                            </span>
                            <button
                                type="button"
                                onClick={handleCaptureGpsForClose}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-extrabold uppercase hover:bg-emerald-700 transition-all"
                            >
                                Capture GPS
                            </button>
                        </div>
                        {closeGps ? (
                            <p className="text-[11px] font-semibold text-emerald-800">
                                📍 Lat: {closeGps.latitude.toFixed(6)}, Lng: {closeGps.longitude.toFixed(6)}
                            </p>
                        ) : (
                            <p className="text-[10px] text-slate-500 font-medium">Click Capture GPS to attach live coordinates to this closure.</p>
                        )}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TicketDetail;
