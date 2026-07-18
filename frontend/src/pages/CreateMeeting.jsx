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

    // Form fields state
    const [title, setTitle] = useState('');
    const [relatedModule, setRelatedModule] = useState('Customer');
    const [relatedRecordId, setRelatedRecordId] = useState('');
    const [meetingDate, setMeetingDate] = useState(prefillDate);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');
    const [organizerId, setOrganizerId] = useState('');
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

            // Set current logged in user as default organizer if not editing
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
            
            // Format dates locally
            setMeetingDate(start.toISOString().split('T')[0]);
            
            const pad = (num) => String(num).padStart(2, '0');
            setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
            setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
            
            setOrganizerId(m.organizerId?._id || m.organizerId || '');
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

    // Related Records lookup mappings based on module selection
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
        // Constructs date in local timezone time bounds
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
                // Time Conflict detected
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
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-10">
            {/* Header Banner */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/meetings')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all"
                >
                    <MdArrowBack size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                        {isEditMode ? 'Edit Scheduled Meeting' : 'Schedule New Appointment'}
                    </h1>
                    <p className="text-slate-500 font-semibold mt-1">Configure meeting parameters, lookups, and participants</p>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Details...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Parameters Form */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                        <h2 className="text-lg font-black text-slate-900 border-b border-slate-50 pb-3">General Information</h2>

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Meeting Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Client discussion, pipeline walkthrough, etc."
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Related To Polymorphic Dropdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Related To *</label>
                                <select
                                    value={relatedModule}
                                    onChange={(e) => handleRelatedModuleChange(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
                                >
                                    <option value="Customer">Customer (Account/Contact)</option>
                                    <option value="Enquiry">Enquiry (Lead/Deal)</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Search Reference *</label>
                                <RecordSearchDropdown
                                    items={recordList}
                                    selectedId={relatedRecordId}
                                    onSelect={setRelatedRecordId}
                                    placeholder={`Select matching ${relatedModule}...`}
                                    labelField="label"
                                    subLabelField="subLabel"
                                />
                            </div>
                        </div>

                        {/* Date & Time bounds */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Meeting Date *</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Start Time *</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">End Time *</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Office board room, conference call links, or address"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Agenda */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Agenda</label>
                            <textarea
                                value={agenda}
                                onChange={(e) => setAgenda(e.target.value)}
                                rows={3}
                                placeholder="What topics will be covered?"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Additional Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Summary, action items, or post-meeting logs"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Sidebar: Organizers, Status & Outcomes */}
                    <div className="space-y-6">
                        {/* Status Panel */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-black text-slate-900 border-b border-slate-50 pb-3">Status</h2>

                            {/* Status Picklist */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Meeting Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
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

                            {/* Outcome Picklist (Only if completed) */}
                            {status === 'Completed' && (
                                <div className="space-y-2 animate-fade-in-up">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest text-primary-600">Meeting Outcome *</label>
                                    <select
                                        value={outcome}
                                        onChange={(e) => setOutcome(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-primary-400 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
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
                        </div>

                        {/* People Panel */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-black text-slate-900 border-b border-slate-50 pb-3">People</h2>

                            {/* Organizer (Single select) */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Organizer *</label>
                                <select
                                    value={organizerId}
                                    onChange={(e) => setOrganizerId(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900"
                                >
                                    <option value="">Select Organizer</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Participants (Multi-select) */}
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Participants</label>
                                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl p-3 space-y-2 bg-slate-50/50">
                                    {users.filter(u => u._id !== organizerId).map(u => {
                                        const isSelected = participants.includes(u._id);
                                        return (
                                            <div
                                                key={u._id}
                                                onClick={() => handleParticipantToggle(u._id)}
                                                className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // toggled by parent div click
                                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/20"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate">{u.name}</p>
                                                    <p className="text-[10px] opacity-75 truncate">{u.email}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {users.filter(u => u._id !== organizerId).length === 0 && (
                                        <p className="text-[10px] text-center font-bold text-slate-400">No other employees registered</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Save Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSave(false)}
                                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20 transition-all hover:scale-[1.01]"
                            >
                                <MdSave size={20} /> {isEditMode ? 'Update Meeting' : 'Schedule Meeting'}
                            </button>
                            <button
                                onClick={() => navigate('/meetings')}
                                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlap Conflict Modal warning */}
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
