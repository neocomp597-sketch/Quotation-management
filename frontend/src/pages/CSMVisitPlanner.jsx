import React, { useState, useEffect } from 'react';
import { csmService } from '../services/api';
import { toast } from 'react-toastify';
import {
    MdChevronLeft, MdChevronRight, MdToday, MdAdd, MdRefresh,
    MdSearch, MdFilterList, MdCalendarMonth, MdPerson,
    MdLocalShipping, MdCheckCircle, MdSchedule, MdCancel, MdLocationOn,
    MdAssignment, MdClose, MdEvent
} from 'react-icons/md';
import Modal from '../components/Modal';

const CSMVisitPlanner = () => {
    const [loading, setLoading] = useState(false);
    const [visits, setVisits] = useState([]);
    const [engineers, setEngineers] = useState([]);
    const [tickets, setTickets] = useState([]);

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // month, week, day, agenda

    // Filter state
    const [selectedEngineer, setSelectedEngineer] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    
    // Schedule Modal state
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [createTicketId, setCreateTicketId] = useState('');
    const [createEngineerId, setCreateEngineerId] = useState('');
    const [createScheduledDate, setCreateScheduledDate] = useState('');
    const [createBillingStatus, setCreateBillingStatus] = useState('Paid');
    const [creating, setCreating] = useState(false);

    // Reschedule Modal state
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleEngineer, setRescheduleEngineer] = useState('');
    const [rescheduleTicketType, setRescheduleTicketType] = useState('');
    const [rescheduling, setRescheduling] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vRes, eRes, tRes] = await Promise.all([
                csmService.getVisits(),
                csmService.getEngineers(),
                csmService.getTickets()
            ]);
            setVisits(Array.isArray(vRes.data) ? vRes.data : (vRes.data?.data || []));
            setEngineers(Array.isArray(eRes.data) ? eRes.data : (eRes.data?.data || []));
            setTickets(Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []));
        } catch (err) {
            toast.error('Failed to load Visit Planner data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter logic
    const filteredVisits = visits.filter(v => {
        if (selectedEngineer !== 'all') {
            const engId = v.engineerId?._id || v.engineerId;
            if (engId !== selectedEngineer) return false;
        }
        if (selectedStatus !== 'all' && v.status !== selectedStatus) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const visitNoMatch = v.visitNo?.toLowerCase().includes(q);
            const ticketNoMatch = v.ticketId?.ticketNo?.toLowerCase().includes(q);
            const custMatch = v.ticketId?.customerId?.customerName?.toLowerCase().includes(q);
            const engMatch = v.engineerId?.name?.toLowerCase().includes(q);
            if (!visitNoMatch && !ticketNoMatch && !custMatch && !engMatch) return false;
        }
        return true;
    });

    // Calendar navigation
    const handlePrev = () => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
        else if (viewMode === 'week') d.setDate(d.getDate() - 7);
        else d.setDate(d.getDate() - 1);
        setCurrentDate(d);
    };

    const handleNext = () => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
        else if (viewMode === 'week') d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 1);
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Month grid generator
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Padding from previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            days.push(new Date(year, month, d));
        }
        return days;
    };

    // Week days generator
    const getWeekDays = (date) => {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    // Check if same date
    const isSameDay = (d1, d2) => {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    // Open schedule modal for specific date or today
    const handleOpenScheduleModal = (targetDate = null) => {
        setCreateTicketId(tickets.length > 0 ? tickets[0]._id : '');
        setCreateEngineerId(engineers.length > 0 ? engineers[0]._id : '');
        const d = targetDate ? new Date(targetDate) : new Date(currentDate.getTime() + 2 * 3600 * 1000);
        if (targetDate) {
            d.setHours(10, 0, 0, 0);
        }
        const pad = (n) => String(n).padStart(2, '0');
        const isoStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setCreateScheduledDate(isoStr);
        setCreateBillingStatus('Paid');
        setShowScheduleModal(true);
    };

    const handleScheduleVisit = async (e) => {
        e.preventDefault();
        if (!createTicketId || !createEngineerId || !createScheduledDate) {
            toast.error('Ticket, Engineer and Scheduled Date are required');
            return;
        }
        setCreating(true);
        try {
            await csmService.createVisit({
                ticketId: createTicketId,
                engineerId: createEngineerId,
                scheduledDate: createScheduledDate,
                billingStatus: createBillingStatus
            });
            toast.success('Field Visit scheduled successfully!');
            setShowScheduleModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to schedule visit');
        } finally {
            setCreating(false);
        }
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleDate || !rescheduleEngineer || !selectedVisit) {
            toast.error('Date and Engineer are required');
            return;
        }
        setRescheduling(true);
        try {
            const res = await csmService.rescheduleVisit(selectedVisit._id, {
                scheduledDate: rescheduleDate,
                engineerId: rescheduleEngineer,
                ticketType: rescheduleTicketType
            });
            toast.success('Service Visit rescheduled successfully');
            setShowRescheduleModal(false);
            setShowDetailModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Rescheduling failed');
        } finally {
            setRescheduling(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Started': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'In Transit': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
            default: return 'bg-sky-50 text-sky-700 border-sky-200';
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Field Service Visit Planner
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Visual schedule planner, engineer calendar allocations, and dispatch manager.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                        title="Refresh Planner"
                    >
                        <MdRefresh size={20} />
                    </button>
                    <button
                        onClick={handleOpenScheduleModal}
                        className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-wider rounded-2xl transition-all shadow-md flex items-center gap-2 active:scale-95"
                    >
                        <MdAdd size={20} />
                        Schedule New Visit
                    </button>
                </div>
            </div>

            {/* Filter & Calendar Controls Toolbar */}
            <div className="glass shadow-premium rounded-[2rem] p-5 bg-white border border-slate-100 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Month / Date Navigation */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToday}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all border border-slate-200"
                        >
                            Today
                        </button>
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                            <button onClick={handlePrev} className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all">
                                <MdChevronLeft size={20} />
                            </button>
                            <button onClick={handleNext} className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all">
                                <MdChevronRight size={20} />
                            </button>
                        </div>
                        <h2 className="text-lg font-black text-slate-900 font-outfit uppercase min-w-[180px]">
                            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h2>
                    </div>

                    {/* Filters & View Modes */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search input */}
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search visit, ticket..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-44"
                            />
                        </div>

                        {/* Engineer Filter */}
                        <select
                            value={selectedEngineer}
                            onChange={(e) => setSelectedEngineer(e.target.value)}
                            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Engineers ({engineers.length})</option>
                            {engineers.map(eng => (
                                <option key={eng._id} value={eng._id}>{eng.name}</option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Transit">In Transit</option>
                            <option value="Started">Started</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        {/* View Mode Buttons */}
                        <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                            {['month', 'week', 'day', 'agenda'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                                        viewMode === mode ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid View */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-28 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Field Visits...</p>
                    </div>
                ) : (
                    <>
                        {/* MONTH VIEW */}
                        {viewMode === 'month' && (
                            <div className="space-y-2">
                                {/* Weekday Header */}
                                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-100">
                                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                                </div>
                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-2">
                                    {getDaysInMonth(currentDate).map((day, idx) => {
                                        if (!day) {
                                            return <div key={idx} className="h-32 bg-slate-50/40 rounded-2xl border border-dashed border-slate-100"></div>;
                                        }

                                        const dayVisits = filteredVisits.filter(v => isSameDay(new Date(v.scheduledDate), day));
                                        const isToday = isSameDay(day, new Date());

                                        return (
                                            <div
                                                key={idx}
                                                className={`h-32 p-2.5 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                                                    isToday 
                                                        ? 'bg-primary-50/40 border-primary-300 ring-2 ring-primary-500/20' 
                                                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-xs font-black rounded-lg w-6 h-6 flex items-center justify-center ${
                                                        isToday ? 'bg-primary-600 text-white' : 'text-slate-700'
                                                    }`}>
                                                        {day.getDate()}
                                                     </span>
                                                    <div className="flex items-center gap-1">
                                                        {dayVisits.length > 0 && (
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                                                {dayVisits.length} {dayVisits.length === 1 ? 'visit' : 'visits'}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenScheduleModal(day);
                                                            }}
                                                            title={`Schedule visit for ${day.toLocaleDateString()}`}
                                                            className="w-5 h-5 rounded-md bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 active:scale-95 shadow-2xs"
                                                        >
                                                            <MdAdd size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1 overflow-y-auto flex-1 pr-0.5 scrollbar-thin">
                                                    {dayVisits.slice(0, 3).map(v => (
                                                        <div
                                                            key={v._id}
                                                            onClick={() => {
                                                                setSelectedVisit(v);
                                                                setShowDetailModal(true);
                                                            }}
                                                            className={`p-1.5 rounded-xl border text-[10px] cursor-pointer font-bold transition-all hover:scale-[1.02] shadow-2xs ${getStatusBadgeClass(v.status)}`}
                                                        >
                                                            <div className="flex justify-between items-center truncate">
                                                                <span className="font-extrabold truncate">{v.visitNo}</span>
                                                                <span className="text-[9px] opacity-75">{new Date(v.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <p className="truncate text-[9px] opacity-90">{v.ticketId?.ticketNo} • {v.engineerId?.name || 'Unassigned'}</p>
                                                        </div>
                                                    ))}
                                                    {dayVisits.length > 3 && (
                                                        <div className="text-[9px] font-black text-primary-600 text-center pt-0.5">
                                                            +{dayVisits.length - 3} more visits
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* WEEK VIEW */}
                        {viewMode === 'week' && (
                            <div className="grid grid-cols-7 gap-3">
                                {getWeekDays(currentDate).map((day, idx) => {
                                    const dayVisits = filteredVisits.filter(v => isSameDay(new Date(v.scheduledDate), day));
                                    const isToday = isSameDay(day, new Date());

                                    return (
                                        <div key={idx} className={`p-4 rounded-2xl border min-h-[420px] flex flex-col space-y-3 ${
                                            isToday ? 'bg-primary-50/30 border-primary-300' : 'bg-white border-slate-100'
                                        }`}>
                                            <div className="text-center border-b border-slate-100 pb-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400">
                                                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                                </p>
                                                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                                    <span className={`text-base font-black rounded-lg px-2 py-0.5 inline-block ${
                                                        isToday ? 'bg-primary-600 text-white' : 'text-slate-900'
                                                    }`}>
                                                        {day.getDate()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenScheduleModal(day);
                                                        }}
                                                        title={`Schedule visit for ${day.toLocaleDateString()}`}
                                                        className="w-5 h-5 rounded-md bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 active:scale-95 shadow-2xs"
                                                    >
                                                        <MdAdd size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-2 flex-1 overflow-y-auto">
                                                {dayVisits.length === 0 ? (
                                                    <p className="text-[10px] text-slate-300 text-center py-6 font-bold uppercase">No Visits</p>
                                                ) : (
                                                    dayVisits.map(v => (
                                                        <div
                                                            key={v._id}
                                                            onClick={() => {
                                                                setSelectedVisit(v);
                                                                setShowDetailModal(true);
                                                            }}
                                                            className={`p-2.5 rounded-xl border cursor-pointer space-y-1 transition-all hover:scale-105 shadow-sm ${getStatusBadgeClass(v.status)}`}
                                                        >
                                                            <div className="flex justify-between items-center text-xs font-black">
                                                                <span>{v.visitNo}</span>
                                                                <span className="text-[10px]">{v.status}</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-700 truncate">{v.ticketId?.ticketNo} - {v.ticketId?.issueTitle}</p>
                                                            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-semibold pt-1">
                                                                <MdPerson size={12} />
                                                                <span>{v.engineerId?.name || 'Unassigned'}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* DAY VIEW & AGENDA VIEW */}
                        {(viewMode === 'day' || viewMode === 'agenda') && (
                            <div className="space-y-4 max-w-4xl mx-auto">
                                <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100">
                                    <span className="text-sm font-black text-slate-900 font-outfit uppercase">
                                        Scheduled Field Visits for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="px-3 py-1 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
                                        {filteredVisits.filter(v => isSameDay(new Date(v.scheduledDate), currentDate)).length} Visits Today
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {filteredVisits.filter(v => isSameDay(new Date(v.scheduledDate), currentDate)).length === 0 ? (
                                        <div className="text-center py-16 text-slate-400 space-y-2">
                                            <MdCalendarMonth size={48} className="mx-auto text-slate-300" />
                                            <p className="font-bold text-sm">No service visits scheduled for this date.</p>
                                        </div>
                                    ) : (
                                        filteredVisits
                                            .filter(v => isSameDay(new Date(v.scheduledDate), currentDate))
                                            .map(v => (
                                                <div
                                                    key={v._id}
                                                    onClick={() => {
                                                        setSelectedVisit(v);
                                                        setShowDetailModal(true);
                                                    }}
                                                    className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-primary-400 shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-base font-black text-slate-900">{v.visitNo}</span>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-wider ${getStatusBadgeClass(v.status)}`}>
                                                                {v.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700">{v.ticketId?.ticketNo} - {v.ticketId?.issueTitle}</p>
                                                        <p className="text-xs text-slate-500 font-medium">Customer: {v.ticketId?.customerId?.customerName || 'N/A'}</p>
                                                    </div>

                                                    <div className="flex items-center gap-6 shrink-0">
                                                        <div className="text-right text-xs space-y-0.5">
                                                            <span className="block font-black text-slate-900">
                                                                {new Date(v.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className="block text-slate-500 font-semibold">{v.engineerId?.name || 'Unassigned'}</span>
                                                        </div>
                                                        <button className="px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white rounded-xl text-xs font-black uppercase transition-all">
                                                            View Details
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Visit Details Modal */}
            {showDetailModal && selectedVisit && (
                <Modal
                    isOpen={showDetailModal}
                    onClose={() => setShowDetailModal(false)}
                    title={`Visit Dispatch Details: ${selectedVisit.visitNo}`}
                    maxWidth="max-w-xl"
                >
                    <div className="space-y-5">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visit Status</span>
                                <h4 className="text-lg font-black text-slate-900">{selectedVisit.status}</h4>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${getStatusBadgeClass(selectedVisit.status)}`}>
                                {selectedVisit.billingStatus || 'Paid Service'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="block text-[9px] font-black uppercase text-slate-400">Complaint Ticket</span>
                                <span className="text-sm font-bold text-slate-900">{selectedVisit.ticketId?.ticketNo || 'N/A'}</span>
                                <p className="text-[11px] text-slate-500">{selectedVisit.ticketId?.issueTitle}</p>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="block text-[9px] font-black uppercase text-slate-400">Assigned Engineer</span>
                                <span className="text-sm font-bold text-slate-900">{selectedVisit.engineerId?.name || 'Unassigned'}</span>
                                <p className="text-[11px] text-slate-500">{selectedVisit.engineerId?.email}</p>
                            </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-semibold space-y-1">
                            <span className="block text-[9px] font-black uppercase text-slate-400">Scheduled Date & Time</span>
                            <p className="text-slate-900 font-bold">{new Date(selectedVisit.scheduledDate).toLocaleString()}</p>
                        </div>

                        {selectedVisit.ticketType && (
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs space-y-1">
                                <span className="block text-[9px] font-black uppercase text-indigo-800">Type of Ticket</span>
                                <p className="text-indigo-950 font-bold">{selectedVisit.ticketType}</p>
                            </div>
                        )}

                        {selectedVisit.rescheduleHistory && selectedVisit.rescheduleHistory.length > 0 && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                                <span className="block text-[9px] font-black uppercase text-slate-400">Reschedule History</span>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {selectedVisit.rescheduleHistory.map((h, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                                            <div>
                                                <span className="font-bold text-slate-800">{new Date(h.rescheduledDate).toLocaleDateString()}</span>
                                                {h.ticketType && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">{h.ticketType}</span>}
                                            </div>
                                            <span className="text-slate-400 text-[10px]">{new Date(h.rescheduledAt).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedVisit.checkIn?.location?.address && (
                            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-xs space-y-1">
                                <span className="block text-[9px] font-black uppercase text-teal-800">Check-in Location Stamp</span>
                                <p className="text-teal-950 font-bold">{selectedVisit.checkIn.location.address}</p>
                            </div>
                        )}

                        {selectedVisit.visitReport && (
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                                <span className="block text-[9px] font-black uppercase text-slate-400">Visit Summary Report</span>
                                <p className="text-slate-800">{selectedVisit.visitReport}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                    setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
                                    setRescheduleTicketType(selectedVisit.ticketType || '');
                                    setShowRescheduleModal(true);
                                }}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                Reschedule Visit
                            </button>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Schedule New Visit Modal */}
            {showScheduleModal && (
                <Modal
                    isOpen={showScheduleModal}
                    onClose={() => setShowScheduleModal(false)}
                    title="Schedule Field Service Visit"
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleScheduleVisit} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Support Ticket *</label>
                            <select
                                required
                                value={createTicketId}
                                onChange={(e) => setCreateTicketId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="">-- Select Active Complaint Ticket --</option>
                                {tickets.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.ticketNo} - {t.issueTitle} ({t.customerId?.customerName || 'Customer'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Service Engineer *</label>
                            <select
                                required
                                value={createEngineerId}
                                onChange={(e) => setCreateEngineerId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="">-- Select Service Engineer --</option>
                                {engineers.map((e) => (
                                    <option key={e._id} value={e._id}>
                                        {e.name} ({e.mobile || 'No Mobile'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled Date & Time *</label>
                            <input
                                type="datetime-local"
                                required
                                value={createScheduledDate}
                                onChange={(e) => setCreateScheduledDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Status</label>
                            <select
                                value={createBillingStatus}
                                onChange={(e) => setCreateBillingStatus(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="Paid">Paid Out-Of-Warranty Service</option>
                                <option value="Under Warranty">Covered Under Warranty</option>
                                <option value="Under AMC">Covered Under AMC Contract</option>
                                <option value="Free Service">Complimentary Service</option>
                            </select>
                        </div>

                        <div className="pt-3 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase text-xs rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs rounded-xl shadow-md"
                            >
                                {creating ? 'Scheduling...' : 'Confirm Schedule'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Reschedule Visit Modal */}
            {showRescheduleModal && (
                <Modal
                    isOpen={showRescheduleModal}
                    onClose={() => setShowRescheduleModal(false)}
                    title="Reschedule Service Visit"
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleReschedule} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">New Scheduled Date & Time *</label>
                            <input
                                type="datetime-local"
                                required
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Engineer *</label>
                            <select
                                required
                                value={rescheduleEngineer}
                                onChange={(e) => setRescheduleEngineer(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                                <option value="">-- Select Engineer --</option>
                                {engineers.map((e) => (
                                    <option key={e._id} value={e._id}>
                                        {e.name} ({e.mobile || 'No Mobile'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type of Ticket (Manual Entry)</label>
                            <input
                                type="text"
                                placeholder="e.g. Product Breakdown, Maintenance, Installation, Repair..."
                                value={rescheduleTicketType}
                                onChange={(e) => setRescheduleTicketType(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                            />
                        </div>

                        <div className="pt-3 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowRescheduleModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold uppercase text-xs rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={rescheduling}
                                className="flex-1 py-3 bg-primary-600 text-white font-black uppercase text-xs rounded-xl shadow-md"
                            >
                                {rescheduling ? 'Rescheduling...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CSMVisitPlanner;
