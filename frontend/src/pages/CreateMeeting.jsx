import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    MdArrowBack,
    MdSave,
    MdPerson,
    MdSearch,
    MdExpandMore,
    MdClose,
    MdWarning,
    MdLocationOn,
    MdAccessTime,
    MdCalendarMonth
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { meetingService, customerService, enquiryService, userService } from '../services/api';

// Searchable dropdown component for Related Record
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
                className={`w-full pl-12 pr-10 py-3.5 bg-slate-50 border rounded-2xl cursor-pointer transition-all flex items-center ${isOpen ? 'border-teal-500 bg-white ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <span className={`text-sm font-bold truncate flex-1 ${selectedItem ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedItem ? `${selectedItem[labelField]} ${subLabelField && selectedItem[subLabelField] ? `(${selectedItem[subLabelField]})` : ''}` : placeholder}
                </span>
                <MdExpandMore className={`absolute right-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-slate-100">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredItems.map(item => (
                            <div
                                key={item._id}
                                onClick={() => handleSelect(item)}
                                className="px-4 py-3 cursor-pointer hover:bg-teal-50 border-b border-slate-50 last:border-b-0"
                            >
                                <div className="font-bold text-slate-900 text-xs">{item[labelField]}</div>
                                {subLabelField && item[subLabelField] && (
                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{item[subLabelField]}</div>
                                )}
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="px-4 py-3 text-xs text-slate-400 text-center font-bold">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const CreateMeeting = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const isEditMode = !!id;

    // Filter Date prefill if passed from Calendar Day View
    const prefillDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Master lists
    const [customers, setCustomers] = useState([]);
    const [enquiries, setEnquiries] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [clientHistory, setClientHistory] = useState([]);

    // Form fields state
    const [title, setTitle] = useState('');
    const [relatedModule, setRelatedModule] = useState('Customer');
    const [relatedRecordId, setRelatedRecordId] = useState('');
    const [meetingDate, setMeetingDate] = useState(prefillDate);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');
    const [organizerId, setOrganizerId] = useState('');
    const [reportToId, setReportToId] = useState('');
    const [participants, setParticipants] = useState([]);
    const [location, setLocation] = useState('');
    const [agenda, setAgenda] = useState('');
    const [status, setStatus] = useState('Scheduled');
    const [outcome, setOutcome] = useState('');
    const [notes, setNotes] = useState('');

    // Conflict Warning modal state
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictingMeetings, setConflictingMeetings] = useState([]);

    useEffect(() => {
        fetchAuxiliaryData();
        if (isEditMode) {
            fetchMeetingDetails();
        }
    }, [id]);

    useEffect(() => {
        if (organizerId && users.length > 0) {
            const org = users.find(u => u._id === organizerId);
            if (org && org.reportsTo) {
                const repId = typeof org.reportsTo === 'object' ? org.reportsTo._id : org.reportsTo;
                setReportToId(repId || '');
            }
        }
    }, [organizerId, users]);

    useEffect(() => {
        if (relatedRecordId) {
            fetchClientHistory(relatedRecordId);
        } else {
            setClientHistory([]);
        }
    }, [relatedRecordId]);

    const fetchClientHistory = async (recId) => {
        try {
            const res = await meetingService.getAll({ relatedRecordId: recId, limit: 10 });
            const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setClientHistory(list.filter(item => item._id !== id));
        } catch (err) {
            console.error('Error fetching client history:', err);
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

            if (!isEditMode) {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    setOrganizerId(parsed._id || parsed.id || '');
                }
            }
        } catch (err) {
            console.error('Failed to load form lookup data', err);
            toast.error('Failed to load setup parameters');
        }
    };

    const fetchMeetingDetails = async () => {
        setLoading(true);
        try {
            const res = await meetingService.getById(id);
            const m = res.data;
            setTitle(m.title);
            setRelatedModule(m.relatedModule);
            setRelatedRecordId(m.relatedRecordId?._id || m.relatedRecordId || '');
            
            const start = new Date(m.startDateTime);
            const end = new Date(m.endDateTime);
            
            setMeetingDate(start.toISOString().split('T')[0]);
            
            const pad = (num) => String(num).padStart(2, '0');
            setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
            setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
            
            setOrganizerId(m.organizerId?._id || m.organizerId || '');
            if (m.reportToId) {
                setReportToId(m.reportToId?._id || m.reportToId || '');
            }
            setParticipants(m.participants?.map(p => p._id || p) || []);
            setLocation(m.location || '');
            setAgenda(m.agenda || '');
            setStatus(m.status);
            setOutcome(m.outcome || '');
            setNotes(m.notes || '');
        } catch (err) {
            console.error('Failed to load meeting details', err);
            toast.error('Failed to load meeting details');
            navigate('/meetings');
        } finally {
            setLoading(false);
        }
    };

    const recordList = useMemo(() => {
        if (relatedModule === 'Customer') {
            return customers.map(c => ({
                _id: c._id,
                label: c.companyName || '',
                subLabel: c.customerName || ''
            }));
        } else if (relatedModule === 'Enquiry') {
            return enquiries.map(e => ({
                _id: e._id,
                label: e.enquiryNo || '',
                subLabel: e.projectName || e.customerId?.companyName || ''
            }));
        }
        return [];
    }, [relatedModule, customers, enquiries]);

    const handleRelatedModuleChange = (module) => {
        setRelatedModule(module);
        setRelatedRecordId('');
    };

    const handleParticipantToggle = (userId) => {
        setParticipants(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const buildISODateTime = (dateStr, timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(dateStr);
        date.setHours(hours, minutes, 0, 0);
        return date.toISOString();
    };

    const handleSave = async (allowConflictOverride = false) => {
        if (!title.trim()) {
            return toast.error('Meeting Title is required');
        }
        if (!relatedRecordId) {
            return toast.error('Related record reference is required');
        }
        if (!organizerId) {
            return toast.error('Organizer selection is required');
        }
        if (!startTime || !endTime) {
            return toast.error('Start and End times are required');
        }

        const startDateTime = buildISODateTime(meetingDate, startTime);
        const endDateTime = buildISODateTime(meetingDate, endTime);

        if (new Date(startDateTime) >= new Date(endDateTime)) {
            return toast.error('End time must be strictly after start time');
        }

        const payload = {
            title,
            startDateTime,
            endDateTime,
            relatedModule,
            relatedRecordId,
            organizerId,
            reportToId: reportToId || undefined,
            participants,
            location,
            agenda,
            status,
            outcome: status === 'Completed' ? outcome : undefined,
            notes,
            allowConflict: allowConflictOverride
        };

        setLoading(true);
        try {
            if (isEditMode) {
                await meetingService.update(id, payload);
                toast.success('Meeting updated successfully');
            } else {
                await meetingService.create(payload);
                toast.success('Meeting scheduled successfully');
            }
            window.dispatchEvent(new Event('onNotificationUpdate'));
            setShowConflictModal(false);
            navigate('/meetings');
        } catch (err) {
            if (err.response?.status === 409) {
                setConflictingMeetings(err.response.data.conflicts || []);
                setShowConflictModal(true);
            } else {
                toast.error(err.response?.data?.message || 'Error saving meeting schedule');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 font-outfit pb-16">
            {/* Header Banner */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/meetings')}
                        className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            {isEditMode ? 'Edit Scheduled Appointment' : 'Schedule Appointment'}
                        </h1>
                        <p className="text-slate-500 font-semibold mt-0.5 text-xs">Configure appointment details, participants, and notes</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Appointment Details...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: APPOINTMENT & CUSTOMER DETAILS */}
                    <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-6">
                        <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest border-b border-slate-200/60 pb-3 flex items-center gap-2">
                            <span className="bg-slate-200 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                            APPOINTMENT & CUSTOMER DETAILS
                        </h2>

                        {/* Title */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">TITLE *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Client call, demo meeting..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                            />
                        </div>

                        {/* Related To Polymorphic Dropdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">RELATED MODULE</label>
                                <select
                                    value={relatedModule}
                                    onChange={(e) => handleRelatedModuleChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                >
                                    <option value="Customer">Customer</option>
                                    <option value="Enquiry">Enquiry</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">SELECT RECORD</label>
                                <RecordSearchDropdown
                                    items={recordList}
                                    selectedId={relatedRecordId}
                                    onSelect={setRelatedRecordId}
                                    placeholder={`Select ${relatedModule}...`}
                                    labelField="label"
                                    subLabelField="subLabel"
                                />
                            </div>
                        </div>

                        {/* Previous Appointments Card */}
                        {clientHistory.length > 0 && (
                            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-2">
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">
                                    Previous Appointments ({clientHistory.length})
                                </span>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                                    {clientHistory.map(hist => (
                                        <div key={hist._id} className="text-xs bg-white p-2.5 rounded-xl border border-amber-100 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800">{hist.title}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    {new Date(hist.startDateTime).toLocaleDateString()} • {hist.organizerId?.name || 'Unknown'}
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                                {hist.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Date & Time bounds */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</label>
                                <input
                                    type="date"
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">START TIME</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">END TIME</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">LOCATION / MEETING LINK</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Conference room, Google Meet / Zoom link..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                            />
                        </div>
                    </div>

                    {/* Right Column: EMPLOYEE ASSIGNMENT & DISCUSSION */}
                    <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-6">
                        <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest border-b border-slate-200/60 pb-3 flex items-center gap-2">
                            <span className="bg-slate-200 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                            EMPLOYEE ASSIGNMENT & DISCUSSION
                        </h2>

                        {/* Organizer & Report To */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">ORGANIZER / ASSIGNED TO *</label>
                                <select
                                    value={organizerId}
                                    onChange={(e) => setOrganizerId(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                >
                                    <option value="">Select Organizer</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">REPORT TO (SENIOR)</label>
                                <select
                                    value={reportToId}
                                    onChange={(e) => setReportToId(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                >
                                    <option value="">No senior selected</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">STATUS</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
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

                        {/* Outcome (Only if Completed) */}
                        {status === 'Completed' && (
                            <div className="space-y-1.5 animate-fade-in-up">
                                <label className="block text-[10px] font-black text-teal-600 uppercase tracking-widest">OUTCOME *</label>
                                <select
                                    value={outcome}
                                    onChange={(e) => setOutcome(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-teal-400 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                                >
                                    <option value="">-- Choose Outcome --</option>
                                    <option value="Successful">Successful</option>
                                    <option value="Follow Up Required">Follow Up Required</option>
                                    <option value="No Show">No Show</option>
                                    <option value="Cancelled">Cancelled</option>
                                    <option value="Not Interested">Not Interested</option>
                                </select>
                            </div>
                        )}

                        {/* Agenda */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">AGENDA</label>
                            <textarea
                                value={agenda}
                                onChange={(e) => setAgenda(e.target.value)}
                                rows={2}
                                placeholder="Topics to discuss..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                            />
                        </div>

                        {/* Discussion Notes */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">DISCUSSION NOTES</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="What was discussed, decisions, commitments, next steps..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none text-xs font-bold text-slate-900"
                            />
                        </div>

                        {/* Participants checklist */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">PARTICIPANTS</label>
                            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-2xl p-3 space-y-1.5 bg-white">
                                {users.filter(u => u._id !== organizerId).map(u => {
                                    const isSelected = participants.includes(u._id);
                                    return (
                                        <div
                                            key={u._id}
                                            onClick={() => handleParticipantToggle(u._id)}
                                            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                                                isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/20"
                                            />
                                            <span className="text-xs uppercase font-bold">{u.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Action Footer */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
                <button
                    type="button"
                    onClick={() => navigate('/meetings')}
                    className="px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className="px-10 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
                >
                    <MdSave size={18} />
                    {isEditMode ? 'Update Changes' : 'Save Changes'}
                </button>
            </div>

            {/* Overlap Conflict Warning Modal */}
            {showConflictModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 overflow-hidden shadow-2xl p-6 space-y-6 animate-scale-in">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                <MdWarning size={28} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-black text-slate-900 font-outfit uppercase">Schedule Conflict Detected</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                    The selected organizer or participants already have appointments booked during this timeframe.
                                </p>
                            </div>
                        </div>

                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3 max-h-48 overflow-y-auto">
                            {conflictingMeetings.map(m => {
                                const start = new Date(m.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const end = new Date(m.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={m._id} className="text-xs font-bold text-slate-700 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                                        <p className="font-extrabold text-slate-900">{m.title}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Organizer: {m.organizerId?.name} • {start} - {end}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleSave(true)}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all"
                            >
                                Overwrite & Save Anyway
                            </button>
                            <button
                                onClick={() => setShowConflictModal(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-bold transition-all"
                            >
                                Adjust Time
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateMeeting;
