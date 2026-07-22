import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    MdAdd,
    MdSearch,
    MdCalendarMonth,
    MdList,
    MdBarChart,
    MdChevronLeft,
    MdChevronRight,
    MdLocationOn,
    MdNotes,
    MdPerson,
    MdWarning,
    MdFilterList,
    MdCheckCircle,
    MdCancel,
    MdFolder,
    MdSchedule,
    MdPeople,
    MdClose,
    MdEdit,
    MdOutlineDragIndicator,
    MdExpandMore
} from 'react-icons/md';
import { meetingService, customerService, enquiryService, userService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { formatDate } from '../utils/helpers';

// Searchable dropdown component for Related Record (inside drawer)
const RecordSearchDropdown = ({ items, selectedId, onSelect, placeholder, labelField, subLabelField }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const selectedItem = items.find(item => item._id === selectedId);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const query = searchTerm.toLowerCase();
        return items.filter(item => {
            const primary = String(item[labelField] || '').toLowerCase();
            const secondary = String(item[subLabelField] || '').toLowerCase();
            return primary.includes(query) || secondary.includes(query);
        });
    }, [items, searchTerm, labelField, subLabelField]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (item) => {
        onSelect(item._id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={dropdownRef} className="relative w-full">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full pl-12 pr-10 py-3 bg-slate-50 border rounded-2xl cursor-pointer transition-all flex items-center ${isOpen ? 'border-teal-500 bg-white ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <span className={`text-xs font-bold truncate flex-1 ${selectedItem ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedItem ? `${selectedItem[labelField]} ${subLabelField && selectedItem[subLabelField] ? `(${selectedItem[subLabelField]})` : ''}` : placeholder}
                </span>
                <MdExpandMore className={`absolute right-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search name..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filteredItems.map(item => (
                            <div
                                key={item._id}
                                onClick={() => handleSelect(item)}
                                className="px-4 py-2.5 cursor-pointer hover:bg-teal-50 border-b border-slate-50 last:border-b-0"
                            >
                                <div className="font-bold text-slate-900 text-[11px]">{item[labelField]}</div>
                                {subLabelField && item[subLabelField] && (
                                    <div className="text-[9px] text-slate-400 font-semibold">{item[subLabelField]}</div>
                                )}
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="px-4 py-3 text-[10px] text-slate-400 text-center font-bold">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const Meetings = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // View toggles: list (default), calendar, reports
    const [viewMode, setViewMode] = useState('list'); 
    const [calendarMode, setCalendarMode] = useState('month'); // month, week, day, agenda
    const [scopeFilter, setScopeFilter] = useState('all'); // all, mine, team

    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [organizerFilter, setOrganizerFilter] = useState('');

    // Calendar navigation
    const [calendarDate, setCalendarDate] = useState(new Date());

    // Reports statistics
    const [stats, setStats] = useState({ total: 0, scheduled: 0, confirmed: 0, completed: 0, cancelled: 0, upcoming: 0 });
    const [userSummary, setUserSummary] = useState([]);
    const [monthlySummary, setMonthlySummary] = useState([]);
    const [clientHistory, setClientHistory] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');

    // Dropdown options
    const [customers, setCustomers] = useState([]);
    const [enquiries, setEnquiries] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // Dynamic Slide-out Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState('view'); // view, edit, create
    const [selectedMeetingId, setSelectedMeetingId] = useState(null);

    // Form inputs state (inside Drawer)
    const [formTitle, setFormTitle] = useState('');
    const [formRelatedModule, setFormRelatedModule] = useState('Customer');
    const [formRelatedRecordId, setFormRelatedRecordId] = useState('');
    const [formRelatedRecord, setFormRelatedRecord] = useState(null);
    const [formMeetingDate, setFormMeetingDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('10:00');
    const [formEndTime, setFormEndTime] = useState('11:00');
    const [formOrganizerId, setFormOrganizerId] = useState('');
    const [formReportToId, setFormReportToId] = useState('');
    const [formParticipants, setFormParticipants] = useState([]);
    const [formLocation, setFormLocation] = useState('');
    const [formAgenda, setFormAgenda] = useState('');
    const [formStatus, setFormStatus] = useState('Scheduled');
    const [formOutcome, setFormOutcome] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formAuditLog, setFormAuditLog] = useState([]);

    // Hover tooltip card state
    const [hoveredMeeting, setHoveredMeeting] = useState(null);
    const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 });

    // Conflict confirmation state
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictingMeetings, setConflictingMeetings] = useState([]);
    const [pendingConflictSave, setPendingConflictSave] = useState(null); // stores payload callback

    const previousAppointments = useMemo(
        () => clientHistory.filter(item => item._id !== selectedMeetingId),
        [clientHistory, selectedMeetingId]
    );

    // Hours timeline for week/day view (09:00 - 18:00)
    const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            setCurrentUser(JSON.parse(stored));
        }
        fetchMeetings();
        fetchAuxiliaryData();
    }, [statusFilter, organizerFilter]);

    useEffect(() => {
        const handleRealtimeUpdate = (e) => {
            const entity = e.detail?.entity;
            if (!entity || entity === 'MEETING' || entity === 'SYSTEM') {
                fetchMeetings();
            }
        };
        window.addEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
        return () => window.removeEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
    }, [statusFilter, organizerFilter]);

    // Check query params to open drawer automatically
    useEffect(() => {
        const editId = searchParams.get('edit');
        const isNew = searchParams.get('new');
        const datePrefill = searchParams.get('date');

        if (editId) {
            handleOpenDrawer('view', editId);
        } else if (isNew) {
            handleOpenDrawer('create', null, datePrefill);
        }
    }, [searchParams]);

    const fetchMeetings = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (organizerFilter) params.organizerId = organizerFilter;
            const res = await meetingService.getAll(params);
            setMeetings(res.data);
            
            // Also update stats above calendar
            const statsRes = await meetingService.getStats();
            setStats(statsRes.data);
        } catch (err) {
            console.error('Failed to load appointments', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxiliaryData = async () => {
        try {
            const [custRes, enqRes, userRes] = await Promise.all([
                customerService.getAll({ limit: 100 }),
                enquiryService.getAll(),
                userService.getAll()
            ]);
            const customersData = Array.isArray(custRes.data) ? custRes.data : custRes.data?.data || custRes.data?.customers || [];
            setCustomers(customersData);
            setEnquiries(enqRes.data || []);
            setUsers(userRes.data || []);
        } catch (err) {
            console.error('Failed to load setup options', err);
        }
    };

    const fetchReportsData = async () => {
        try {
            const [userSumRes, monthSumRes] = await Promise.all([
                meetingService.getUserSummary(),
                meetingService.getMonthlySummary()
            ]);
            setUserSummary(userSumRes.data);
            setMonthlySummary(monthSumRes.data);
        } catch (err) {
            console.error('Failed to load analytics reports', err);
        }
    };

    useEffect(() => {
        if (viewMode === 'reports') {
            fetchReportsData();
        }
    }, [viewMode]);

    // Related record mapping inside drawer form
    const recordList = useMemo(() => {
        if (formRelatedModule === 'Customer') {
            return customers.map(c => ({
                _id: c._id,
                label: c.companyName || '',
                subLabel: c.customerName || ''
            }));
        } else if (formRelatedModule === 'Enquiry') {
            return enquiries.map(e => ({
                _id: e._id,
                label: e.enquiryNo || '',
                subLabel: e.projectName || e.customerId?.companyName || ''
            }));
        }
        return [];
    }, [formRelatedModule, customers, enquiries]);

    // Handle My / Team / All Filtering
    const scopeFilteredMeetings = useMemo(() => {
        if (!currentUser) return meetings;
        const currentUserId = currentUser._id || currentUser.id;

        return meetings.filter(m => {
            const organizerId = m.organizerId?._id || m.organizerId || '';
            const reportToId = m.reportTo?._id || m.reportTo || '';
            const organizer = users.find(u => u._id === organizerId);
            const organizerReportsTo = organizer?.reportsTo?._id || organizer?.reportsTo || '';
            const participantIds = m.participants?.map(p => p._id || p) || [];
            const isMine = organizerId.toString() === currentUserId.toString() || participantIds.includes(currentUserId);
            const isTeamAppointment = reportToId.toString() === currentUserId.toString() || organizerReportsTo.toString() === currentUserId.toString();

            if (scopeFilter === 'mine') {
                return isMine;
            } else if (scopeFilter === 'team') {
                return isTeamAppointment;
            }
            return true;
        });
    }, [meetings, scopeFilter, currentUser, users]);

    // Search query filter
    const displayedMeetings = useMemo(() => {
        if (!searchQuery.trim()) return scopeFilteredMeetings;
        const query = searchQuery.toLowerCase();

        return scopeFilteredMeetings.filter(m => {
            const titleMatch = m.title.toLowerCase().includes(query);
            const locationMatch = m.location?.toLowerCase().includes(query);
            const notesMatch = m.notes?.toLowerCase().includes(query);
            const organizerMatch = m.organizerId?.name?.toLowerCase().includes(query);

            let recordName = '';
            if (m.relatedRecordId) {
                recordName = m.relatedRecordId.customerName || m.relatedRecordId.companyName || m.relatedRecordId.enquiryNo || m.relatedRecordId.projectName || '';
            }
            const recordMatch = recordName.toLowerCase().includes(query);

            return titleMatch || locationMatch || notesMatch || organizerMatch || recordMatch;
        });
    }, [scopeFilteredMeetings, searchQuery]);

    // KPI Widgets values calculated in-place
    const kpiWidgets = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);

        let todayCount = 0;
        let weekCount = 0;
        let completedCount = 0;
        let pendingCount = 0;

        meetings.forEach(m => {
            const start = new Date(m.startDateTime);
            const isToday = start.toDateString() === new Date().toDateString();
            const isThisWeek = start >= startOfWeek;

            if (isToday && m.status !== 'Cancelled') todayCount++;
            if (isThisWeek && m.status !== 'Cancelled') weekCount++;
            if (m.status === 'Completed') completedCount++;
            if (['Scheduled', 'Confirmed', 'In Progress'].includes(m.status)) pendingCount++;
        });

        return { todayCount, weekCount, completedCount, pendingCount };
    }, [meetings]);

    // Open slide-out drawer
    const handleOpenDrawer = async (mode, meetingId = null, prefillDate = null) => {
        setDrawerMode(mode);
        setSelectedMeetingId(meetingId);

        if (mode === 'create') {
            setFormTitle('');
            setFormRelatedModule('Customer');
            setFormRelatedRecordId('');
            setFormRelatedRecord(null);
            setFormMeetingDate(prefillDate || new Date().toISOString().split('T')[0]);
            setFormStartTime('10:00');
            setFormEndTime('11:00');
            setFormLocation('');
            setFormAgenda('');
            setFormStatus('Scheduled');
            setFormOutcome('');
            setFormNotes('');
            setFormAuditLog([]);
            
            const currentUserId = currentUser?._id || currentUser?.id;
            setFormOrganizerId(currentUserId || '');
            const currentUserRecord = users.find(u => u._id === currentUserId);
            setFormReportToId(currentUserRecord?.reportsTo?._id || currentUserRecord?.reportsTo || '');
            setFormParticipants([]);
            setDrawerOpen(true);
            return;
        }

        // View or Edit Mode
        try {
            setLoading(true);
            const res = await meetingService.getById(meetingId);
            const m = res.data;
            setFormTitle(m.title);
            setFormRelatedModule(m.relatedModule);
            setFormRelatedRecordId(m.relatedRecordId?._id || m.relatedRecordId || '');
            setFormRelatedRecord(m.relatedRecordId);
            handleClientHistoryLookup(m.relatedRecordId?._id || m.relatedRecordId || '');
            
            const start = new Date(m.startDateTime);
            const end = new Date(m.endDateTime);
            setFormMeetingDate(start.toISOString().split('T')[0]);
            
            const pad = (num) => String(num).padStart(2, '0');
            setFormStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
            setFormEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
            
            setFormOrganizerId(m.organizerId?._id || m.organizerId || '');
            const fallbackReportTo = m.reportTo || users.find(u => u._id === (m.organizerId?._id || m.organizerId || ''))?.reportsTo;
            setFormReportToId(fallbackReportTo?._id || fallbackReportTo || '');
            setFormParticipants(m.participants?.map(p => p._id || p) || []);
            setFormLocation(m.location || '');
            setFormAgenda(m.agenda || '');
            setFormStatus(m.status);
            setFormOutcome(m.outcome || '');
            setFormNotes(m.notes || '');
            setFormAuditLog(m.statusHistory || []);
            setDrawerOpen(true);
        } catch (err) {
            toast.error('Failed to load appointment details');
        } finally {
            setLoading(false);
        }
    };

    const buildISODateTime = (dateStr, timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(dateStr);
        date.setHours(hours, minutes, 0, 0);
        return date.toISOString();
    };

    const handleRelatedModuleChange = (module) => {
        setFormRelatedModule(module);
        setFormRelatedRecordId('');
        setFormRelatedRecord(null);
        setSelectedClient('');
        setClientHistory([]);
    };

    const handleRelatedRecordSelect = (recordId) => {
        setFormRelatedRecordId(recordId);
        handleClientHistoryLookup(recordId);
    };

    const handleParticipantToggle = (userId) => {
        setFormParticipants(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleOrganizerChange = (userId) => {
        setFormOrganizerId(userId);
        const selectedOrganizer = users.find(u => u._id === userId);
        setFormReportToId(selectedOrganizer?.reportsTo?._id || selectedOrganizer?.reportsTo || '');
    };

    const getAppointmentReportTo = (appointment) => {
        const directReportTo = appointment?.reportTo;
        if (directReportTo?._id || typeof directReportTo === 'string') {
            return directReportTo;
        }

        const organizerId = appointment?.organizerId?._id || appointment?.organizerId || '';
        const organizer = users.find(u => u._id === organizerId);
        return organizer?.reportsTo || null;
    };

    const getUserNameByRef = (userRef) => {
        if (!userRef) return '';
        if (userRef.name) return userRef.name;
        return users.find(u => u._id === userRef)?.name || '';
    };

    const getUserEmailByRef = (userRef) => {
        if (!userRef) return '';
        if (userRef.email) return userRef.email;
        return users.find(u => u._id === userRef)?.email || '';
    };

    const handleClientHistoryLookup = async (clientId) => {
        setSelectedClient(clientId);
        if (!clientId) {
            setClientHistory([]);
            return;
        }
        try {
            const res = await meetingService.getClientHistory(clientId);
            setClientHistory(res.data || []);
        } catch (err) {
            console.error('Failed to load client history', err);
            toast.error('Failed to load client appointment history');
        }
    };

    // Save Drawer Appointment Details (Create / Update)
    const handleDrawerSave = async (overrideConflict = false) => {
        if (!formTitle.trim()) {
            return toast.error('Appointment title is required');
        }
        if (!formRelatedRecordId) {
            return toast.error('Related reference is required');
        }
        if (!formOrganizerId) {
            return toast.error('Organizer is required');
        }

        const startDateTime = buildISODateTime(formMeetingDate, formStartTime);
        const endDateTime = buildISODateTime(formMeetingDate, formEndTime);

        if (new Date(startDateTime) >= new Date(endDateTime)) {
            return toast.error('End time must be after start time');
        }

        const payload = {
            title: formTitle,
            startDateTime,
            endDateTime,
            relatedModule: formRelatedModule,
            relatedRecordId: formRelatedRecordId,
            organizerId: formOrganizerId,
            reportTo: formReportToId || null,
            participants: formParticipants,
            location: formLocation,
            agenda: formAgenda,
            status: formStatus,
            outcome: formStatus === 'Completed' ? formOutcome : undefined,
            notes: formNotes,
            allowConflict: overrideConflict
        };

        try {
            if (drawerMode === 'create') {
                await meetingService.create(payload);
                toast.success('Appointment scheduled successfully');
            } else {
                await meetingService.update(selectedMeetingId, payload);
                toast.success('Appointment details updated');
            }
            window.dispatchEvent(new Event('onNotificationUpdate'));
            setDrawerOpen(false);
            setSearchParams({});
            fetchMeetings();
        } catch (err) {
            if (err.response?.status === 409) {
                // Conflict
                setConflictingMeetings(err.response.data.conflicts || []);
                setPendingConflictSave(() => () => handleDrawerSave(true));
                setShowConflictModal(true);
            } else {
                toast.error(err.response?.data?.message || 'Error saving appointment details');
            }
        }
    };

    const handleMarkComplete = async () => {
        try {
            const startDateTime = buildISODateTime(formMeetingDate, formStartTime);
            const endDateTime = buildISODateTime(formMeetingDate, formEndTime);
            await meetingService.update(selectedMeetingId, {
                title: formTitle,
                startDateTime,
                endDateTime,
                relatedModule: formRelatedModule,
                relatedRecordId: formRelatedRecordId,
                organizerId: formOrganizerId,
                reportTo: formReportToId || null,
                notes: formNotes,
                status: 'Completed',
                outcome: 'Successful',
                allowConflict: true
            });
            toast.success('Appointment marked as Completed');
            window.dispatchEvent(new Event('onNotificationUpdate'));
            setDrawerOpen(false);
            fetchMeetings();
        } catch (err) {
            toast.error('Failed to complete appointment');
        }
    };

    // HTML5 Drag and Drop scheduling
    const handleDragStart = (e, meeting) => {
        e.dataTransfer.setData('meetingId', meeting._id);
        e.dataTransfer.setData('meetingDurationMs', new Date(meeting.endDateTime) - new Date(meeting.startDateTime));
    };

    const handleDrop = async (e, dateStr, timeStr = '10:00', allowConflictOverride = false) => {
        e.preventDefault();
        const meetingId = e.dataTransfer.getData('meetingId');
        const durationMs = Number(e.dataTransfer.getData('meetingDurationMs'));
        
        if (!meetingId) return;

        const original = meetings.find(m => m._id === meetingId);
        if (!original) return;

        const newStart = buildISODateTime(dateStr, timeStr);
        const newEnd = new Date(new Date(newStart).getTime() + durationMs).toISOString();

        const payload = {
            title: original.title,
            startDateTime: newStart,
            endDateTime: newEnd,
            relatedModule: original.relatedModule,
            relatedRecordId: original.relatedRecordId?._id || original.relatedRecordId || '',
            organizerId: original.organizerId?._id || original.organizerId || '',
            reportTo: original.reportTo?._id || original.reportTo || null,
            participants: original.participants?.map(p => p._id || p) || [],
            location: original.location,
            agenda: original.agenda,
            status: original.status,
            outcome: original.outcome,
            notes: original.notes,
            allowConflict: allowConflictOverride
        };

        try {
            await meetingService.update(meetingId, payload);
            toast.success('Appointment rescheduled');
            window.dispatchEvent(new Event('onNotificationUpdate'));
            fetchMeetings();
        } catch (err) {
            if (err.response?.status === 409) {
                // Time Conflict
                setConflictingMeetings(err.response.data.conflicts || []);
                setPendingConflictSave(() => () => handleDrop(e, dateStr, timeStr, true));
                setShowConflictModal(true);
            } else {
                toast.error('Failed to reschedule appointment');
            }
        }
    };

    // Hover cards helpers
    const handleMouseMove = (e) => {
        setHoverCoords({ x: e.clientX + 15, y: e.clientY + 15 });
    };

    // Color code mapping for meetings
    const getStatusColor = (status) => {
        switch (status) {
            case 'Scheduled':
                return { bg: 'bg-blue-50 hover:bg-blue-100/70', text: 'text-blue-700', border: 'border-blue-200 border-l-blue-600', dot: 'bg-blue-600' };
            case 'Confirmed':
                return { bg: 'bg-emerald-50 hover:bg-emerald-100/70', text: 'text-emerald-700', border: 'border-emerald-200 border-l-emerald-600', dot: 'bg-emerald-600' };
            case 'Completed':
                return { bg: 'bg-slate-100 hover:bg-slate-150', text: 'text-slate-600', border: 'border-slate-200 border-l-slate-400', dot: 'bg-slate-400' };
            case 'Cancelled':
                return { bg: 'bg-rose-50 hover:bg-rose-100/70', text: 'text-rose-600 line-through', border: 'border-rose-200 border-l-rose-600', dot: 'bg-rose-600' };
            case 'In Progress':
                return { bg: 'bg-teal-50 hover:bg-teal-100/70', text: 'text-teal-700', border: 'border-teal-200 border-l-teal-600', dot: 'bg-teal-600' };
            default:
                return { bg: 'bg-amber-50 hover:bg-amber-100/70', text: 'text-amber-700', border: 'border-amber-200 border-l-amber-600', dot: 'bg-amber-600' };
        }
    };

    // Calendar navigations helpers
    const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const handlePrev = () => {
        if (calendarMode === 'month') {
            setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
        } else if (calendarMode === 'week') {
            setCalendarDate(new Date(calendarDate.getTime() - 7 * 24 * 60 * 60 * 1000));
        } else {
            setCalendarDate(new Date(calendarDate.getTime() - 24 * 60 * 60 * 1000));
        }
    };

    const handleNext = () => {
        if (calendarMode === 'month') {
            setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
        } else if (calendarMode === 'week') {
            setCalendarDate(new Date(calendarDate.getTime() + 7 * 24 * 60 * 60 * 1000));
        } else {
            setCalendarDate(new Date(calendarDate.getTime() + 24 * 60 * 60 * 1000));
        }
    };

    // --- RENDER MONTH GRID VIEW ---
    const renderMonthGrid = () => {
        const daysInMonth = getDaysInMonth(calendarDate);
        const firstDay = getFirstDayOfMonth(calendarDate);
        const cells = [];

        // Sun-Sat headers
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`pad-${i}`} className="min-h-[110px] border border-slate-100 bg-slate-50/40 p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentCellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
            const dateStr = currentCellDate.toISOString().split('T')[0];
            const isToday = currentCellDate.toDateString() === new Date().toDateString();

            const dayMeetings = displayedMeetings.filter(m => {
                const start = new Date(m.startDateTime);
                return start.getDate() === day && start.getMonth() === calendarDate.getMonth() && start.getFullYear() === calendarDate.getFullYear();
            });

            cells.push(
                <div
                    key={`day-${day}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, dateStr, '10:00')}
                    className={`min-h-[110px] border border-slate-100 p-2 flex flex-col justify-between group hover:bg-slate-50/30 transition-colors ${
                        isToday ? 'bg-primary-50/10 border-primary-200' : 'bg-white'
                    }`}
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-primary-600 text-white' : 'text-slate-700'
                        }`}>
                            {day}
                        </span>
                        <button
                            onClick={() => handleOpenDrawer('create', null, dateStr)}
                            className="text-[10px] text-primary-600 font-extrabold opacity-0 group-hover:opacity-100 hover:underline transition-opacity"
                        >
                            + Add
                        </button>
                    </div>

                    <div className="flex-grow space-y-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                        {dayMeetings.map(m => {
                            const colors = getStatusColor(m.status);
                            const startStr = new Date(m.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div
                                    key={m._id}
                                    draggable={m.status !== 'Completed' && m.status !== 'Cancelled'}
                                    onDragStart={(e) => handleDragStart(e, m)}
                                    onMouseMove={handleMouseMove}
                                    onMouseEnter={() => setHoveredMeeting(m)}
                                    onMouseLeave={() => setHoveredMeeting(null)}
                                    onClick={() => handleOpenDrawer('view', m._id)}
                                    className={`p-1 mx-0.5 rounded-lg border-l-4 border text-[9px] font-black truncate cursor-pointer transition-all flex items-center gap-1 ${colors.bg} ${colors.text} ${colors.border}`}
                                >
                                    <span className="shrink-0 font-medium opacity-75">{startStr}</span>
                                    <span className="truncate flex-1">{m.title}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="grid grid-cols-7 text-center py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {weekDays.map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                    {cells}
                </div>
            </div>
        );
    };

    // --- RENDER WEEK TIMELINE VIEW ---
    const renderWeekGrid = () => {
        const startOfWeek = new Date(calendarDate);
        startOfWeek.setDate(calendarDate.getDate() - calendarDate.getDay());

        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            days.push(day);
        }

        return (
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm p-5">
                <div className="grid grid-cols-8 gap-2 border-b border-slate-100 pb-3 mb-4 text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-end justify-center pb-2">Time</div>
                    {days.map((day, idx) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                            <div key={idx} className={`p-2 rounded-2xl ${isToday ? 'bg-primary-50/20 text-primary-600' : ''}`}>
                                <p className="text-[9px] font-black uppercase text-slate-400">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <p className="text-sm font-black mt-0.5">{day.getDate()}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-8 gap-2 items-center min-h-[55px] border-b border-slate-50 last:border-0 py-1">
                            <div className="text-center text-[10px] font-bold text-slate-400">{hour}</div>
                            {days.map((day, dIdx) => {
                                const dateStr = day.toISOString().split('T')[0];
                                const currentHourStr = hour;
                                const cellMeetings = displayedMeetings.filter(m => {
                                    const mStart = new Date(m.startDateTime);
                                    const mHour = String(mStart.getHours()).padStart(2, '0') + ':00';
                                    return mStart.toDateString() === day.toDateString() && mHour === currentHourStr;
                                });

                                return (
                                    <div
                                        key={dIdx}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => handleDrop(e, dateStr, currentHourStr)}
                                        className="h-full border border-dashed border-slate-100 rounded-xl p-1 bg-slate-50/20 hover:bg-slate-50/70 transition-colors relative flex flex-col gap-1 min-h-[45px]"
                                    >
                                        <button
                                            onClick={() => handleOpenDrawer('create', null, `${dateStr}T${currentHourStr}:00`)}
                                            className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center text-[9px] font-black text-primary-600 z-0 bg-white/70 rounded-xl"
                                        >
                                            + Add
                                        </button>
                                        {cellMeetings.map(m => {
                                            const colors = getStatusColor(m.status);
                                            const endHourStr = new Date(m.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div
                                                    key={m._id}
                                                    draggable={m.status !== 'Completed' && m.status !== 'Cancelled'}
                                                    onDragStart={(e) => handleDragStart(e, m)}
                                                    onMouseMove={handleMouseMove}
                                                    onMouseEnter={() => setHoveredMeeting(m)}
                                                    onMouseLeave={() => setHoveredMeeting(null)}
                                                    onClick={(e) => { e.stopPropagation(); handleOpenDrawer('view', m._id); }}
                                                    className={`p-2 rounded-xl border-l-4 border text-[9px] font-black cursor-pointer transition-all flex flex-col relative z-10 hover:scale-[1.01] ${colors.bg} ${colors.text} ${colors.border}`}
                                                >
                                                    <span className="truncate">{m.title}</span>
                                                    <span className="text-[8px] font-semibold opacity-75 mt-0.5">{hour} - {endHourStr}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // --- RENDER DAY TIMELINE VIEW ---
    const renderDayGrid = () => {
        const dateStr = calendarDate.toISOString().split('T')[0];
        return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 max-w-xl mx-auto">
                <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-outfit">Hourly Schedule</h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                        {calendarDate.toLocaleDateString('en-US', { weekday: 'long' })}
                    </span>
                </div>

                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {HOURS.map(hour => {
                        const cellMeetings = displayedMeetings.filter(m => {
                            const mStart = new Date(m.startDateTime);
                            const mHour = String(mStart.getHours()).padStart(2, '0') + ':00';
                            return mStart.toDateString() === calendarDate.toDateString() && mHour === hour;
                        });

                        return (
                            <div key={hour} className="flex items-center gap-4 py-1.5 border-b border-slate-50 last:border-0">
                                <div className="w-12 text-[10px] font-bold text-slate-400 text-center">{hour}</div>
                                <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, dateStr, hour)}
                                    className="flex-1 min-h-[45px] border border-dashed border-slate-100 rounded-xl p-1 bg-slate-50/20 hover:bg-slate-50/70 transition-colors relative flex flex-col gap-1"
                                >
                                    <button
                                        onClick={() => handleOpenDrawer('create', null, `${dateStr}T${hour}:00`)}
                                        className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center text-[9px] font-black text-primary-600 z-0 bg-white/70 rounded-xl"
                                    >
                                        + Book Time Slot
                                    </button>
                                    {cellMeetings.map(m => {
                                        const colors = getStatusColor(m.status);
                                        const endHourStr = new Date(m.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        let recordName = '';
                                        if (m.relatedRecordId) {
                                            recordName = m.relatedRecordId.customerName || m.relatedRecordId.companyName || m.relatedRecordId.enquiryNo || m.relatedRecordId.projectName || '';
                                        }

                                        return (
                                            <div
                                                key={m._id}
                                                draggable={m.status !== 'Completed' && m.status !== 'Cancelled'}
                                                onDragStart={(e) => handleDragStart(e, m)}
                                                onMouseMove={handleMouseMove}
                                                onMouseEnter={() => setHoveredMeeting(m)}
                                                onMouseLeave={() => setHoveredMeeting(null)}
                                                onClick={(e) => { e.stopPropagation(); handleOpenDrawer('view', m._id); }}
                                                className={`p-3 rounded-xl border-l-4 border text-[10px] font-black cursor-pointer transition-all flex justify-between items-center relative z-10 ${colors.bg} ${colors.text} ${colors.border}`}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate">{m.title}</p>
                                                    <p className="text-[8px] font-semibold opacity-75 mt-0.5">{hour} - {endHourStr} • {m.relatedModule}: {recordName}</p>
                                                </div>
                                                {m.location && (
                                                    <span className="text-[8px] opacity-75 shrink-0 flex items-center gap-0.5 bg-white/60 px-2 py-0.5 rounded-lg">
                                                        <MdLocationOn size={10} /> {m.location}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- RENDER AGENDA LIST VIEW ---
    const renderAgendaGrid = () => {
        // Group meetings by Date
        const grouped = {};
        displayedMeetings.forEach(m => {
            const dateStr = new Date(m.startDateTime).toDateString();
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(m);
        });

        const dateKeys = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

        return (
            <div className="max-w-2xl mx-auto space-y-6">
                {dateKeys.length > 0 ? (
                    dateKeys.map(dateKey => {
                        const list = grouped[dateKey];
                        const dateObj = new Date(dateKey);
                        const isToday = dateObj.toDateString() === new Date().toDateString();

                        return (
                            <div key={dateKey} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className={`px-5 py-3 border-b border-slate-100 flex justify-between items-center ${
                                    isToday ? 'bg-primary-50/10' : 'bg-slate-50/30'
                                }`}>
                                    <span className="text-xs font-black text-slate-800 tracking-wide">
                                        {dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                    {isToday && (
                                        <span className="text-[9px] font-black bg-primary-600 text-white uppercase tracking-widest px-2 py-0.5 rounded-full">Today</span>
                                    )}
                                </div>

                                <div className="divide-y divide-slate-50 p-3">
                                    {list.map(m => {
                                        const colors = getStatusColor(m.status);
                                        const startStr = new Date(m.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const endStr = new Date(m.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        let recordName = '';
                                        if (m.relatedRecordId) {
                                            recordName = m.relatedRecordId.customerName || m.relatedRecordId.companyName || m.relatedRecordId.enquiryNo || m.relatedRecordId.projectName || '';
                                        }

                                        return (
                                            <div
                                                key={m._id}
                                                onClick={() => handleOpenDrawer('view', m._id)}
                                                className="p-3 hover:bg-slate-50/30 transition-colors flex items-start gap-4 cursor-pointer"
                                            >
                                                <div className="px-3 py-1.5 rounded-xl bg-slate-50 text-center shrink-0 border border-slate-100">
                                                    <p className="text-xs font-black text-slate-700">{startStr}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{endStr}</p>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-xs font-black text-slate-800 truncate">{m.title}</h4>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border border-slate-100`}>
                                                            {m.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-bold mt-1">
                                                        {m.relatedModule}: <span className="text-slate-800 font-extrabold">{recordName}</span>
                                                        <span className="mx-2 text-slate-300">•</span>
                                                        Organizer: <span className="text-slate-800 font-semibold">{m.organizerId?.name}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center shadow-sm">
                        <MdCalendarMonth size={40} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400">No upcoming appointments listed.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in-up relative">
            
            {/* Hover Tooltip Card */}
            {hoveredMeeting && (
                <div
                    className="fixed z-[100] w-64 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 text-left space-y-2 pointer-events-none transition-all duration-75"
                    style={{ left: hoverCoords.x, top: hoverCoords.y }}
                >
                    <div className="flex justify-between items-start">
                        <h4 className="text-xs font-extrabold uppercase tracking-wide truncate pr-2">{hoveredMeeting.title}</h4>
                        <span className="text-[8px] font-black bg-slate-800 px-2 py-0.5 rounded-full text-teal-400 uppercase tracking-widest">{hoveredMeeting.status}</span>
                    </div>
                    <div className="text-[10px] space-y-1 opacity-90 border-t border-slate-800 pt-2 font-bold">
                        <p className="text-slate-400">
                            Date: <span className="text-white">{formatDate(hoveredMeeting.startDateTime)}</span>
                        </p>
                        <p className="text-slate-400">
                            Time: <span className="text-white">
                                {new Date(hoveredMeeting.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(hoveredMeeting.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </p>
                        <p className="text-slate-400">
                            Organizer: <span className="text-white">{hoveredMeeting.organizerId?.name}</span>
                        </p>
                        {hoveredMeeting.location && (
                            <p className="text-slate-400 truncate">
                                Location: <span className="text-white">{hoveredMeeting.location}</span>
                            </p>
                        )}
                        {hoveredMeeting.relatedRecordId && (
                            <p className="text-slate-400 truncate">
                                Reference: <span className="text-white">
                                    {hoveredMeeting.relatedRecordId.companyName || hoveredMeeting.relatedRecordId.enquiryNo || hoveredMeeting.relatedRecordId.projectName}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Header / Banner area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight font-outfit uppercase">Appointments Planner</h1>
                    <p className="text-slate-500 font-semibold text-xs mt-1">Unified CRM Activity Calendar & Appointments Register</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View selectors */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                viewMode === 'calendar' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <MdCalendarMonth size={16} /> Calendar
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <MdList size={16} /> List Register
                        </button>
                        <button
                            onClick={() => setViewMode('reports')}
                            className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                                viewMode === 'reports' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <MdBarChart size={16} /> Reports
                        </button>
                    </div>

                    <button
                        onClick={() => handleOpenDrawer('create')}
                        className="px-4 py-2 bg-primary-600 rounded-xl text-xs font-bold text-white hover:bg-primary-700 transition-all shadow-md shadow-primary-600/20 flex items-center gap-2"
                    >
                        <MdAdd size={18} /> Schedule Appointment
                    </button>
                </div>
            </div>

            {/* KPI Cards above calendar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <MdSchedule size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</h4>
                        <p className="text-lg font-black text-slate-850 mt-0.5">{kpiWidgets.todayCount}</p>
                    </div>
                </div>
                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                        <MdCalendarMonth size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Week</h4>
                        <p className="text-lg font-black text-slate-850 mt-0.5">{kpiWidgets.weekCount}</p>
                    </div>
                </div>
                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <MdCheckCircle size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed</h4>
                        <p className="text-lg font-black text-slate-850 mt-0.5">{kpiWidgets.completedCount}</p>
                    </div>
                </div>
                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                        <MdWarning size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</h4>
                        <p className="text-lg font-black text-slate-850 mt-0.5">{kpiWidgets.pendingCount}</p>
                    </div>
                </div>
            </div>

            {/* Filter controls panel */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by title, location, organizer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none text-xs font-semibold text-slate-900 placeholder:text-slate-400"
                    />
                </div>

                {/* Team / Mine Scope filter */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200">
                    <button
                        onClick={() => setScopeFilter('mine')}
                        className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                            scopeFilter === 'mine' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        My Appointments
                    </button>
                    <button
                        onClick={() => setScopeFilter('team')}
                        className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                            scopeFilter === 'team' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Team Appointments
                    </button>
                    <button
                        onClick={() => setScopeFilter('all')}
                        className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                            scopeFilter === 'all' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        All Appointments
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none"
                    >
                        <option value="">All Statuses</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="No Show">No Show</option>
                    </select>

                    <select
                        value={organizerFilter}
                        onChange={(e) => setOrganizerFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none"
                    >
                        <option value="">All Organizers</option>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                    </select>

                    {(statusFilter || organizerFilter || searchQuery || scopeFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setStatusFilter('');
                                setOrganizerFilter('');
                                setSearchQuery('');
                                setScopeFilter('all');
                            }}
                            className="text-[10px] font-black text-rose-600 hover:underline px-2 uppercase tracking-wide"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* View Mode Switching */}
            {viewMode === 'calendar' && (
                <div className="space-y-4">
                    {/* Calendar control sub-bar */}
                    <div className="bg-white px-4 py-2 border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrev} className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                <MdChevronLeft size={18} />
                            </button>
                            <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider text-center min-w-[130px]">
                                {calendarMode === 'month' && calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                {calendarMode === 'week' && `Week of ${new Date(calendarDate.getTime() - calendarDate.getDay() * 24 * 60 * 60 * 1000).getDate()} ${calendarDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                                {calendarMode === 'day' && calendarDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {calendarMode === 'agenda' && 'Upcoming Agenda'}
                            </h2>
                            <button onClick={handleNext} className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                <MdChevronRight size={18} />
                            </button>
                            <button onClick={() => setCalendarDate(new Date())} className="px-2.5 py-1 border border-slate-200 rounded-xl hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Today
                            </button>
                        </div>

                        {/* Calendar visual sub-view selector */}
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200">
                            <button
                                onClick={() => setCalendarMode('month')}
                                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all ${
                                    calendarMode === 'month' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => setCalendarMode('week')}
                                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all ${
                                    calendarMode === 'week' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => setCalendarMode('day')}
                                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all ${
                                    calendarMode === 'day' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Day
                            </button>
                            <button
                                onClick={() => setCalendarMode('agenda')}
                                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all ${
                                    calendarMode === 'agenda' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Agenda
                            </button>
                        </div>
                    </div>

                    {/* Render visual cells */}
                    {loading ? (
                        <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Calendar...</p>
                        </div>
                    ) : (
                        <>
                            {calendarMode === 'month' && renderMonthGrid()}
                            {calendarMode === 'week' && renderWeekGrid()}
                            {calendarMode === 'day' && renderDayGrid()}
                            {calendarMode === 'agenda' && renderAgendaGrid()}
                        </>
                    )}
                </div>
            )}

            {/* List Register (secondary view) */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-20 text-center">
                                <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
                                <p className="mt-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading Records...</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Appointment Title</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Related Record</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Organizer</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Report To</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {displayedMeetings.length > 0 ? (
                                        displayedMeetings.map((m) => {
                                            const start = new Date(m.startDateTime);
                                            const end = new Date(m.endDateTime);
                                            const reportTo = getAppointmentReportTo(m);
                                            const reportToName = getUserNameByRef(reportTo);
                                            const reportToEmail = getUserEmailByRef(reportTo);
                                            let recordName = 'N/A';
                                            if (m.relatedRecordId) {
                                                recordName = m.relatedRecordId.customerName || m.relatedRecordId.companyName || m.relatedRecordId.enquiryNo || m.relatedRecordId.projectName || '';
                                            }

                                            return (
                                                <tr key={m._id} className="hover:bg-slate-50/55 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span onClick={() => handleOpenDrawer('view', m._id)} className="font-extrabold text-slate-800 hover:text-primary-600 transition-colors text-xs cursor-pointer">
                                                            {m.title}
                                                        </span>
                                                        {m.location && (
                                                            <span className="block text-[9px] text-slate-400 font-semibold mt-0.5 flex items-center gap-0.5">
                                                                <MdLocationOn size={10} /> {m.location}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                                                        <span>{formatDate(start)}</span>
                                                        <span className="block text-[9px] font-medium text-slate-400 mt-1 uppercase">
                                                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase mr-1">{m.relatedModule}</span>
                                                        {recordName}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-755">
                                                        {m.organizerId?.name}
                                                        <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{m.organizerId?.email}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-755">
                                                        {reportToName || '-'}
                                                        {reportToEmail && (
                                                            <span className="block text-[9px] text-slate-400 font-medium mt-0.5">{reportToEmail}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                            m.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                            m.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                                            m.status === 'Scheduled' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            'bg-amber-50 text-amber-600 border border-amber-100'
                                                        }`}>
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleOpenDrawer('edit', m._id)} className="px-2.5 py-1 text-[9px] font-black uppercase text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-all">
                                                                Edit
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-16 text-center text-slate-400 font-bold">No matching appointments found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Reports analytics board */}
            {viewMode === 'reports' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* User performance */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Appointments per User</h3>
                        <div className="space-y-4">
                            {userSummary.map((item, idx) => {
                                const percentage = stats.total > 0 ? Math.round((item.total / stats.total) * 100) : 0;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-slate-700">{item.user?.name || 'Unassigned'}</span>
                                            <span className="text-slate-500">{item.total} Appointments ({percentage}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-primary-600 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Monthly overview */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Monthly Distribution</h3>
                        <div className="space-y-4">
                            {monthlySummary.map((item, idx) => {
                                const percentage = stats.total > 0 ? Math.round((item.total / stats.total) * 100) : 0;
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-slate-700">{item.label}</span>
                                            <span className="text-slate-500">{item.total} Appointments</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-teal-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Client History lookup */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Client History Lookup</h3>
                        <div className="max-w-xs mb-4">
                            <select
                                value={selectedClient}
                                onChange={(e) => handleClientHistoryLookup(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-primary-600/20"
                            >
                                <option value="">-- Select Client --</option>
                                {customers.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName} ({c.customerName})</option>
                                ))}
                            </select>
                        </div>
                        {selectedClient && (
                            <div className="border border-slate-50 rounded-2xl overflow-hidden mt-4">
                                <table className="w-full text-left border-collapse text-[10px] font-bold text-slate-700">
                                    <thead>
                                        <tr className="bg-slate-50/50">
                                            <th className="px-4 py-2.5 font-black uppercase text-slate-400">Appointment</th>
                                            <th className="px-4 py-2.5 font-black uppercase text-slate-400">Date</th>
                                            <th className="px-4 py-2.5 font-black uppercase text-slate-400">Organizer</th>
                                            <th className="px-4 py-2.5 font-black uppercase text-slate-400">Outcome</th>
                                            <th className="px-4 py-2.5 font-black uppercase text-slate-400 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {clientHistory.map(h => (
                                            <tr key={h._id} className="hover:bg-slate-50/30">
                                                <td className="px-4 py-2.5 font-black text-slate-900">{h.title}</td>
                                                <td className="px-4 py-2.5 text-slate-500">{formatDate(h.startDateTime)}</td>
                                                <td className="px-4 py-2.5">{h.organizerId?.name}</td>
                                                <td className="px-4 py-2.5 italic text-slate-500">{h.outcome || 'N/A'}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">{h.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- SCHEDULE APPOINTMENT MODAL POPUP --- */}
            <Modal
                isOpen={drawerOpen}
                onClose={() => { setDrawerOpen(false); setSearchParams({}); }}
                title={drawerMode === 'create' ? 'Schedule Appointment' : drawerMode === 'edit' ? 'Edit Details' : 'Appointment Details'}
                maxWidth="max-w-xl"
                footer={
                    drawerMode === 'view' ? (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setDrawerMode('edit')}
                                    className="col-span-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                                >
                                    <MdEdit size={14} /> Edit
                                </button>
                                <button
                                    onClick={handleMarkComplete}
                                    disabled={formStatus === 'Completed'}
                                    className="col-span-2 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black shadow-md shadow-primary-600/10 transition-all flex items-center justify-center gap-1"
                                >
                                    <MdCheckCircle size={14} /> Mark Complete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleDrawerSave(false)}
                                    className="py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-black shadow-md shadow-primary-600/10 transition-all flex items-center justify-center gap-1"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => {
                                        if (drawerMode === 'create') {
                                            setDrawerOpen(false);
                                            setSearchParams({});
                                        } else {
                                            handleOpenDrawer('view', selectedMeetingId);
                                        }
                                    }}
                                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )
                }
            >
                <div className="space-y-4 text-left">
                    {drawerMode === 'view' ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="border-b border-slate-50 pb-3">
                                <h2 className="text-base font-extrabold text-slate-900 leading-snug">{formTitle}</h2>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase mt-2 ${
                                    formStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                                    formStatus === 'Cancelled' ? 'bg-rose-50 text-rose-600' :
                                    'bg-blue-50 text-blue-600'
                                }`}>
                                    {formStatus}
                                </span>
                                {formOutcome && (
                                    <span className="block text-[8px] font-bold text-slate-400 mt-1 uppercase">Outcome: {formOutcome}</span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-500">
                                <p className="flex items-center gap-2">
                                    <MdCalendarMonth className="text-slate-400" size={16} />
                                    Date: <span className="text-slate-800">{formatDate(formMeetingDate)}</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <MdSchedule className="text-slate-400" size={16} />
                                    Time: <span className="text-slate-800">{formStartTime} - {formEndTime}</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <MdFolder className="text-slate-400" size={16} />
                                    Related {formRelatedModule}: <span className="text-slate-800 font-extrabold">
                                        {formRelatedRecord ? (formRelatedRecord.companyName || formRelatedRecord.customerName || formRelatedRecord.enquiryNo || formRelatedRecord.projectName || 'N/A') : (recordList.find(r => r._id === formRelatedRecordId)?.label || 'N/A')}
                                    </span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <MdPerson className="text-slate-400" size={16} />
                                    Organizer: <span className="text-slate-800">{users.find(u => u._id === formOrganizerId)?.name}</span>
                                </p>
                                <p className="flex items-center gap-2">
                                    <MdPeople className="text-slate-400" size={16} />
                                    Report To: <span className="text-slate-800">{users.find(u => u._id === formReportToId)?.name || '-'}</span>
                                </p>
                                {formLocation && (
                                    <p className="flex items-center gap-2 md:col-span-2">
                                        <MdLocationOn className="text-slate-400" size={16} />
                                        Location: <span className="text-slate-800">{formLocation}</span>
                                    </p>
                                )}
                            </div>

                            {formAgenda && (
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Agenda</h4>
                                    <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">{formAgenda}</p>
                                </div>
                            )}

                            {formNotes && (
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Discussion Notes</h4>
                                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">{formNotes}</p>
                                </div>
                            )}

                            {/* Participants List */}
                            {formParticipants.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Participants</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {formParticipants.map(pid => {
                                            const u = users.find(user => user._id === pid);
                                            return (
                                                <span key={pid} className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-xl border border-slate-200">
                                                    {u?.name || 'Employee'}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // CREATE & EDIT FORM
                        <div className="space-y-4 animate-fade-in">
                            {/* Title */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Title *</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Client call, demo meeting..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-semibold text-slate-900"
                                />
                            </div>

                            {/* Polymorphic related to */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Related Module</label>
                                    <select
                                        value={formRelatedModule}
                                        onChange={(e) => handleRelatedModuleChange(e.target.value)}
                                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        <option value="Customer">Customer</option>
                                        <option value="Enquiry">Enquiry</option>
                                    </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Record</label>
                                    <RecordSearchDropdown
                                        items={recordList}
                                        selectedId={formRelatedRecordId}
                                        onSelect={handleRelatedRecordSelect}
                                        placeholder={`Select ${formRelatedModule}...`}
                                        labelField="label"
                                        subLabelField="subLabel"
                                    />
                                </div>
                            </div>

                            {formRelatedRecordId && (
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Appointments</h4>
                                        <span className="text-[9px] font-black text-slate-400 uppercase">{previousAppointments.length} Found</span>
                                    </div>
                                    {previousAppointments.length > 0 ? (
                                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                            {previousAppointments
                                                .slice(0, 5)
                                                .map(item => {
                                                    const start = new Date(item.startDateTime);
                                                    return (
                                                        <div key={item._id} className="p-2 bg-white rounded-xl border border-slate-100">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-black text-slate-800 truncate">{item.title}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                                        {formatDate(start)} • {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                                <span className="shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                            {item.notes && (
                                                                <p className="text-[10px] text-slate-600 font-medium mt-1.5 line-clamp-2">{item.notes}</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] font-bold text-slate-400">No previous appointments found for this record.</p>
                                    )}
                                </div>
                            )}

                            {/* Date & times */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                                    <input
                                        type="date"
                                        value={formMeetingDate}
                                        onChange={(e) => setFormMeetingDate(e.target.value)}
                                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                                    <input
                                        type="time"
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                                    <input
                                        type="time"
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                                    />
                                </div>
                            </div>

                            {/* Organizer & Status */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Organizer</label>
                                    <select
                                        value={formOrganizerId}
                                        onChange={(e) => handleOrganizerChange(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        <option value="">Select Organizer</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Report To</label>
                                    <select
                                        value={formReportToId}
                                        onChange={(e) => setFormReportToId(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        <option value="">No senior selected</option>
                                        {users.filter(u => u._id !== formOrganizerId).map(u => (
                                            <option key={u._id} value={u._id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                                    <select
                                        value={formStatus}
                                        onChange={(e) => setFormStatus(e.target.value)}
                                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                        <option value="Rescheduled">Rescheduled</option>
                                        <option value="No Show">No Show</option>
                                    </select>
                                </div>
                            </div>

                            {/* Outcome selection */}
                            {formStatus === 'Completed' && (
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-teal-600 uppercase tracking-widest">Outcome *</label>
                                    <select
                                        value={formOutcome}
                                        onChange={(e) => setFormOutcome(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-teal-400 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500/20"
                                    >
                                        <option value="">-- Select Outcome --</option>
                                        <option value="Successful">Successful</option>
                                        <option value="Follow Up Required">Follow Up Required</option>
                                        <option value="No Show">No Show</option>
                                        <option value="Cancelled">Cancelled</option>
                                        <option value="Not Interested">Not Interested</option>
                                    </select>
                                </div>
                            )}

                            {/* Location */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                <input
                                    type="text"
                                    value={formLocation}
                                    onChange={(e) => setFormLocation(e.target.value)}
                                    placeholder="Conference room, Zoom link..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-semibold text-slate-900"
                                />
                            </div>

                            {/* Agenda */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda</label>
                                <textarea
                                    value={formAgenda}
                                    onChange={(e) => setFormAgenda(e.target.value)}
                                    rows={2}
                                    placeholder="Topics to discuss..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-medium text-slate-900"
                                />
                            </div>

                            {/* Discussion Notes */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Discussion Notes</label>
                                <textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    rows={3}
                                    placeholder="What was discussed, decisions, commitments, next steps..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs font-medium text-slate-900"
                                />
                            </div>

                            {/* Participants checklist */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Participants</label>
                                <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-xl p-2.5 space-y-1.5 bg-slate-50/50 custom-scrollbar">
                                    {users.filter(u => u._id !== formOrganizerId).map(u => {
                                        const isSelected = formParticipants.includes(u._id);
                                        return (
                                            <div
                                                key={u._id}
                                                onClick={() => handleParticipantToggle(u._id)}
                                                className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-teal-50/70 text-teal-800' : 'hover:bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/10 w-3.5 h-3.5"
                                                />
                                                <span className="text-[10px] font-bold truncate">{u.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Overlap Conflict Modal warning */}
            {showConflictModal && (
                <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-slate-100 overflow-hidden shadow-2xl p-5 space-y-5 animate-scale-in">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                <MdWarning size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest font-outfit">Schedule Warning</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                                    The selected organizer or participants are already booked in another scheduled appointment.
                                </p>
                            </div>
                        </div>

                        <div className="border border-slate-100 rounded-2xl p-3 bg-slate-50/50 space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                            {conflictingMeetings.map(m => {
                                const start = new Date(m.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const end = new Date(m.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={m._id} className="text-[10px] font-bold text-slate-700 pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
                                        <p className="font-extrabold text-slate-900">{m.title}</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">
                                            Organizer: {m.organizerId?.name} • {start} - {end}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (pendingConflictSave) pendingConflictSave();
                                    setShowConflictModal(false);
                                }}
                                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all"
                            >
                                Proceed & Save
                            </button>
                            <button
                                onClick={() => {
                                    setShowConflictModal(false);
                                    setPendingConflictSave(null);
                                }}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Meetings;
