import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { csmService, userService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdAssignment, MdPerson, MdCalendarMonth, 
    MdFeedback, MdArrowBack, MdSave, 
    MdWarning, MdCheckCircleOutline, MdChat 
} from 'react-icons/md';
import Modal from '../components/Modal';

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
    const [assignEngineer, setAssignEngineer] = useState('');

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

    const fetchTicketDetails = async () => {
        try {
            const res = await csmService.getTicketById(id);
            const ticketData = res.data;
            setTicket(ticketData);
            setSelectedStatus(ticketData.status);
            setIsFirstCallResolved(ticketData.isFirstCallResolved || false);
            setAssignTeam(ticketData.assignedTeamId?._id || '');
            setAssignEngineer(ticketData.assignedEngineerId?._id || '');

            // Verify entitlements if product is linked
            if (ticketData.customerId?._id && ticketData.productId?._id) {
                const entRes = await csmService.verifyEntitlements({
                    customerId: ticketData.customerId._id,
                    productId: ticketData.productId._id
                });
                setEntitlements(entRes.data);
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
            const [teamRes, userRes] = await Promise.all([
                csmService.getTeams(),
                userService.getAll({ limit: 500 })
            ]);
            setTeams(teamRes.data || []);
            setEngineers(userRes.data?.data || userRes.data || []);
        } catch (error) {
            console.error('Error loading assignments:', error);
        }
    };

    useEffect(() => {
        fetchTicketDetails();
        loadAssignees();
    }, [id]);

    const handleAssign = async () => {
        try {
            await csmService.assignTicket(id, {
                assignedTeamId: assignTeam || null,
                assignedEngineerId: assignEngineer || null
            });
            toast.success('Assignment updated');
            fetchTicketDetails();
        } catch (error) {
            toast.error('Assignment failed');
        }
    };

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

    const handleScheduleVisit = async (e) => {
        e.preventDefault();
        try {
            await csmService.createVisit({
                ticketId: id,
                engineerId: visitEngineer,
                scheduledDate: visitDate,
                billingStatus: entitlements?.recommendedBillingType || 'Paid'
            });
            toast.success('Service Visit scheduled successfully');
            setShowVisitModal(false);
            fetchTicketDetails();
        } catch (error) {
            toast.error('Scheduling failed');
        }
    };

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
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-500 block">👤 Auto-assigned Sales Rep</span>
                                    <p className="text-sm font-black text-primary-900">{ticket.assignedSalespersonId.name}</p>
                                    <div className="text-xs text-slate-600 font-semibold space-y-0.5">
                                        {ticket.assignedSalespersonId.email && <p>✉️ {ticket.assignedSalespersonId.email}</p>}
                                        {ticket.assignedSalespersonId.mobile && <p>📞 {ticket.assignedSalespersonId.mobile}</p>}
                                    </div>
                                </div>
                            )}
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
                    </div>

                    {/* Quick State Management & Escalation */}
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
                            <button
                                onClick={handleEscalate}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 hover:bg-rose-100/50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <MdWarning size={16} />
                                Escalate Ticket
                            </button>
                        </div>
                    </div>

                    {/* Reassign Team / Agent */}
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                        <h3 className="font-outfit font-black text-sm text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-2">
                            Assign case
                        </h3>
                        <div className="space-y-3">
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
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Engineer</label>
                                <select
                                    value={assignEngineer}
                                    onChange={(e) => setAssignEngineer(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="">Unassigned</option>
                                    {engineers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={handleAssign}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                            >
                                <MdSave size={16} />
                                Update Assignee
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
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Actions</span>
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
                                </div>

                                {/* Display Service Visits */}
                                <div className="space-y-3">
                                    {ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                                        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-2xl text-xs font-bold text-center">
                                            Ticket resolved/closed. View visit records in the Service Visits menu.
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 font-semibold text-sm text-center py-8">
                                            Visits scheduled will appear here. Navigate to "Service Visits" tab for geofenced check-ins.
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
                title="Schedule Visit"
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
                            className="flex-1 w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                            Schedule
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
                        <select
                            required
                            value={visitEngineer}
                            onChange={(e) => setVisitEngineer(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">Select Engineer</option>
                            {engineers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TicketDetail;
