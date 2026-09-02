import React, { useEffect, useState, useRef } from 'react';
import { csmService, mgrService, productService, uploadService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdLocalShipping, MdMyLocation, MdCheckCircle, 
    MdAssignment, MdEvent, MdAttachMoney, MdDelete, MdAdd, MdCalendarMonth, MdPhotoCamera
} from 'react-icons/md';
import Modal from '../components/Modal';

const ServiceVisits = () => {
    const [loading, setLoading] = useState(false);
    const [visits, setVisits] = useState([]);
    const [selectedVisit, setSelectedVisit] = useState(null);
    
    // Check-out Form State
    const [report, setReport] = useState('');
    const [billing, setBilling] = useState('Paid');
    const [expenses, setExpenses] = useState([]);
    const [expDesc, setExpDesc] = useState('');
    const [expQty, setExpQty] = useState(1);
    const [expRate, setExpRate] = useState('');
    const [nextAction, setNextAction] = useState('');
    const [productPhoto, setProductPhoto] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    
    // MGR5 Parts Catalog State
    const [mgr5Parts, setMgr5Parts] = useState([]);
    const [selectedMgr5PartId, setSelectedMgr5PartId] = useState('');
    const [isPartChange, setIsPartChange] = useState(true);
    
    // Signature drawing state
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Reschedule State
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleEngineer, setRescheduleEngineer] = useState('');
    const [rescheduleTicketType, setRescheduleTicketType] = useState('');
    const [engineers, setEngineers] = useState([]);
    const [rescheduling, setRescheduling] = useState(false);

    // Create New Visit State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [createTicketId, setCreateTicketId] = useState('');
    const [createEngineerId, setCreateEngineerId] = useState('');
    const [createScheduledDate, setCreateScheduledDate] = useState('');
    const [createBillingStatus, setCreateBillingStatus] = useState('Paid');
    const [creating, setCreating] = useState(false);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const res = await csmService.getVisits();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setVisits(data);
            if (data.length > 0 && !selectedVisit) {
                setSelectedVisit(data[0]);
            }
        } catch (error) {
            toast.error('Failed to load visits');
        } finally {
            setLoading(false);
        }
    };

    const fetchEngineers = async () => {
        try {
            const res = await csmService.getEngineers();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setEngineers(data);
        } catch (error) {
            console.error('Failed to load engineers', error);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await csmService.getTickets();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setTickets(data);
            return data;
        } catch (error) {
            console.error('Failed to load tickets', error);
            return [];
        }
    };

    const fetchMgr5Parts = async () => {
        try {
            const [mgrRes, prodRes] = await Promise.allSettled([
                mgrService.getAll('MGR5'),
                productService.getAll()
            ]);
            
            let combined = [];
            if (mgrRes.status === 'fulfilled') {
                const mgrData = Array.isArray(mgrRes.value.data) ? mgrRes.value.data : (mgrRes.value.data?.data || []);
                mgrData.forEach(m => {
                    combined.push({
                        id: m._id,
                        code: m.code,
                        name: m.description,
                        label: `[MGR5 Part] ${m.code} - ${m.description}`,
                        rate: 0,
                        source: 'MGR5'
                    });
                });
            }
            if (prodRes.status === 'fulfilled') {
                const prodData = Array.isArray(prodRes.value.data) ? prodRes.value.data : (prodRes.value.data?.data || []);
                prodData.forEach(p => {
                    const mgr5Badge = p.mgr5?.code ? ` (MGR5: ${p.mgr5.code})` : '';
                    combined.push({
                        id: p._id,
                        code: p.productCode,
                        name: p.productName,
                        label: `[Product] ${p.productName} (${p.productCode})${mgr5Badge}`,
                        rate: p.mrp || p.basePrice || 0,
                        source: 'Product'
                    });
                });
            }
            setMgr5Parts(combined);
        } catch (error) {
            console.error('Failed to load MGR5 catalog', error);
        }
    };

    useEffect(() => {
        fetchVisits();
        fetchEngineers();
        fetchTickets();
        fetchMgr5Parts();
    }, []);

    // Open create visit modal
    const handleOpenCreateModal = async (preselectedTicketId = '') => {
        const fetchedTickets = await fetchTickets();
        const currentTickets = (Array.isArray(fetchedTickets) && fetchedTickets.length > 0) ? fetchedTickets : (Array.isArray(tickets) ? tickets : []);
        const availableTicket = preselectedTicketId || (currentTickets.length > 0 ? currentTickets[0]._id : '');
        setCreateTicketId(availableTicket);
        setCreateEngineerId(engineers.length > 0 ? engineers[0]._id : '');
        const next = new Date(Date.now() + 2 * 3600 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const isoStr = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
        setCreateScheduledDate(isoStr);
        setCreateBillingStatus('Paid');
        setShowCreateModal(true);
    };

    const handleCreateVisit = async (e) => {
        e.preventDefault();
        if (!createTicketId || !createEngineerId || !createScheduledDate) {
            toast.error('Ticket, Engineer and Scheduled Date are required');
            return;
        }
        setCreating(true);
        try {
            const res = await csmService.createVisit({
                ticketId: createTicketId,
                engineerId: createEngineerId,
                scheduledDate: createScheduledDate,
                billingStatus: createBillingStatus
            });
            toast.success('Field Service Visit scheduled successfully!');
            setShowCreateModal(false);
            const updated = await csmService.getVisits();
            const data = updated.data || [];
            setVisits(data);
            if (res.data) {
                setSelectedVisit(res.data);
            }
        } catch (error) {
            const errMsg = error.response?.data?.message || 'Failed to schedule visit';
            toast.error(errMsg);
        } finally {
            setCreating(false);
        }
    };

    // Geolocation Check-in simulation
    const handleCheckIn = (visitId) => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            executeCheckIn(visitId, 18.5204, 73.8567, 'Shivajinagar, Pune (Fallback GPS)');
            return;
        }

        toast.info('Fetching GPS coordinates...');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                executeCheckIn(visitId, pos.coords.latitude, pos.coords.longitude, `GPS Coordinates Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
            },
            (err) => {
                console.warn('Geolocation error, falling back:', err);
                executeCheckIn(visitId, 18.5204, 73.8567, 'Pune Technical Service Hub (Default Fallback)');
            }
        );
    };

    const executeCheckIn = async (visitId, lat, lng, address) => {
        try {
            const res = await csmService.checkInVisit(visitId, { latitude: lat, longitude: lng, address });
            toast.success('Engineer Check-In stamp saved successfully!');
            fetchVisits();
            if (res.data) setSelectedVisit(res.data);
        } catch (error) {
            toast.error('Check-in stamp failed');
        }
    };

    // Canvas drawing helper functions
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSelectMgr5Part = (e) => {
        const partId = e.target.value;
        setSelectedMgr5PartId(partId);
        if (!partId) return;
        const found = mgr5Parts.find(p => p.id === partId);
        if (found) {
            setExpDesc(`${found.name} (${found.code})`);
            if (found.rate > 0) setExpRate(found.rate);
            setIsPartChange(true);
        }
    };

    const handleAddExpense = (e) => {
        e.preventDefault();
        if (!expDesc.trim()) {
            toast.error('Please select an MGR5 Part or enter Part/Charge name');
            return;
        }
        const qty = Number(expQty) || 1;
        const rate = Number(expRate) || 0;
        const amount = qty * rate;
        const selectedPart = mgr5Parts.find(p => p.id === selectedMgr5PartId);

        setExpenses([...expenses, { 
            description: expDesc.trim(), 
            quantity: qty, 
            rate: rate, 
            amount: amount,
            isPartChange: isPartChange,
            partCode: selectedPart ? selectedPart.code : '',
            partName: selectedPart ? selectedPart.name : expDesc.trim(),
            mgr5Id: (selectedPart && selectedPart.source === 'MGR5') ? selectedPart.id : null
        }]);
        setExpDesc('');
        setSelectedMgr5PartId('');
        setExpQty(1);
        setExpRate('');
        setIsPartChange(true);
    };

    const handleRemoveExpense = (idx) => {
        setExpenses(expenses.filter((_, i) => i !== idx));
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleDate || !rescheduleEngineer) {
            toast.error('Date and Engineer are mandatory');
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
            fetchVisits();
            if (res.data) setSelectedVisit(res.data);
        } catch (error) {
            const errMsg = error.response?.data?.message || 'Rescheduling failed';
            toast.error(errMsg);
        } finally {
            setRescheduling(false);
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const res = await uploadService.uploadImage(file);
            const photoUrl = res.data?.url || res.data?.imageUrl;
            if (photoUrl) {
                setProductPhoto(photoUrl);
                toast.success('Product photo uploaded successfully!');
            } else {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setProductPhoto(reader.result);
                    toast.success('Product photo attached!');
                };
                reader.readAsDataURL(file);
            }
        } catch (err) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductPhoto(reader.result);
                toast.success('Product photo attached!');
            };
            reader.readAsDataURL(file);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleCheckOut = async (actionType) => {
        if (!report.trim()) {
            toast.error('Visit Report / Actions Taken is required');
            return;
        }

        if (actionType === 'close_visit') {
            if (!nextAction.trim()) {
                toast.error('Please specify mandatory "Next Action / Next Step" to Close Visit');
                return;
            }
        }

        let signatureData = '';
        const canvas = canvasRef.current;
        if (canvas) {
            signatureData = canvas.toDataURL('image/png');
        }

        try {
            const res = await csmService.checkOutVisit(selectedVisit._id, {
                latitude: 18.5205,
                longitude: 73.8568,
                address: selectedVisit.checkIn?.location?.address || 'Site Location Address',
                visitReport: report,
                customerSignature: signatureData,
                productPhoto,
                billingStatus: billing,
                expenses,
                actionType,
                nextAction: actionType === 'close_visit' ? nextAction.trim() : ''
            });

            if (actionType === 'close_visit') {
                toast.success(`Visit closed! Next action "${nextAction.trim()}" logged to timeline. Complaint remains Open.`);
            } else {
                toast.success('Field Visit completed. Ticket closed permanently as resolved.');
            }

            setReport('');
            setNextAction('');
            setBilling('Paid');
            setExpenses([]);
            setProductPhoto('');
            fetchVisits();
            if (res.data) setSelectedVisit(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Check-out failed');
        }
    };

    useEffect(() => {
        if (selectedVisit && selectedVisit.status === 'Started') {
            setTimeout(() => {
                const canvas = canvasRef.current;
                if (canvas) {
                    canvas.width = 400;
                    canvas.height = 150;
                    const ctx = canvas.getContext('2d');
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                }
            }, 100);
        }
    }, [selectedVisit]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Field Service Visits Queue
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage service engineers visits, check-ins, reports, and customer approvals.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenCreateModal()}
                    className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 shrink-0"
                >
                    <MdAdd size={20} />
                    Schedule Field Visit
                </button>
            </div>

            {/* List & Simulator Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Queue list */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Visits...</p>
                            </div>
                        ) : visits.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 space-y-4">
                                <p className="text-lg font-bold">No field service visits scheduled.</p>
                                <p className="text-sm">Click below to schedule your first field service visit.</p>
                                <button
                                    onClick={() => handleOpenCreateModal()}
                                    className="px-4 py-2.5 bg-primary-600 text-white font-black uppercase text-xs rounded-xl shadow-md"
                                >
                                    + Schedule Field Visit
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                            <th className="px-6 py-4">Visit No</th>
                                            <th className="px-6 py-4">Ticket details</th>
                                            <th className="px-6 py-4">Engineer</th>
                                            <th className="px-6 py-4">Scheduled Date</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                        {visits.map((v) => {
                                            const isSelected = selectedVisit?._id === v._id;
                                            return (
                                                <tr 
                                                    key={v._id} 
                                                    className={`transition-colors cursor-pointer ${
                                                        isSelected 
                                                            ? 'bg-primary-50/60 border-l-4 border-l-primary-600 font-bold' 
                                                            : 'hover:bg-slate-50/50'
                                                    }`}
                                                    onClick={() => setSelectedVisit(v)}
                                                >
                                                    <td className="px-6 py-4 font-black text-slate-900">{v.visitNo}</td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-900">{v.ticketId?.ticketNo || 'N/A'}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-tight">{v.ticketId?.customerId?.customerName}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">{v.engineerId?.name || 'Unassigned'}</td>
                                                    <td className="px-6 py-4 text-slate-500">{new Date(v.scheduledDate).toLocaleString()}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${
                                                            v.status === 'Completed' ? 'bg-teal-50 text-teal-600 border-teal-200' :
                                                            v.status === 'Started' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                            v.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                            'bg-slate-50 text-slate-500 border-slate-200'
                                                        }`}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-center">
                                                            <button
                                                                onClick={() => setSelectedVisit(v)}
                                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                                                                    isSelected
                                                                        ? 'bg-primary-600 text-white shadow-sm'
                                                                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                                                                }`}
                                                            >
                                                                {isSelected ? 'Selected' : 'Select'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Simulator checkin/out panel */}
                <div className="lg:col-span-1">
                    {selectedVisit ? (
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-6 animate-scale-in">
                            <div className="border-b border-slate-50 pb-3 flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Active Service Dispatch</span>
                                    <h3 className="text-lg font-black text-slate-900 font-outfit uppercase -mt-0.5">{selectedVisit.visitNo}</h3>
                                    <p className="text-xs text-slate-400 font-bold">{selectedVisit.ticketId?.ticketNo} - {selectedVisit.ticketId?.issueTitle}</p>
                                    {selectedVisit.ticketId?.customerId?.customerName && (
                                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Customer: {selectedVisit.ticketId.customerId.customerName}</p>
                                    )}
                                </div>
                                {['Scheduled', 'In Transit', 'Started'].includes(selectedVisit.status) && (
                                    <button
                                        onClick={() => {
                                            setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                            setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
                                            setRescheduleTicketType(selectedVisit.ticketType || '');
                                            setShowRescheduleModal(true);
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-slate-200"
                                    >
                                        Reschedule
                                    </button>
                                )}
                            </div>

                            {/* Check-In Mode */}
                            {(selectedVisit.status === 'Scheduled' || selectedVisit.status === 'In Transit') && (
                                <div className="space-y-4 text-center py-6">
                                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto text-primary-600">
                                        <MdMyLocation size={32} />
                                    </div>
                                    <h4 className="font-outfit font-black text-slate-900 uppercase">Field Check-In Simulator</h4>
                                    <p className="text-xs text-slate-400 font-semibold px-4">
                                        Performs checking-in at site location. Click the button below to simulate matching GPS coordinate stamps.
                                    </p>
                                    <button
                                        onClick={() => handleCheckIn(selectedVisit._id)}
                                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        Stamp Check-In Location
                                    </button>
                                </div>
                            )}

                            {/* Check-Out Mode */}
                            {selectedVisit.status === 'Started' && (
                                <div className="space-y-4">
                                    <h4 className="font-outfit font-black text-slate-900 uppercase text-sm border-b border-slate-50 pb-2">
                                        Completion & Check-Out
                                    </h4>
                                    
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Status</label>
                                        <select
                                            value={billing}
                                            onChange={(e) => setBilling(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                                        >
                                            <option value="Paid">Paid Out-Of-Warranty Service</option>
                                            <option value="Under Warranty">Covered Under Warranty</option>
                                            <option value="Under AMC">Covered Under AMC Contract</option>
                                            <option value="Free Service">Complimentary Service</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visit Report / Actions Taken *</label>
                                        <textarea
                                            required
                                            placeholder="Troubleshooting steps and fix summary..."
                                            value={report}
                                            onChange={(e) => setReport(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-20"
                                        />
                                    </div>

                                    {/* Expenses Array Log */}
                                    <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60">
                                        <div className="flex justify-between items-center pb-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                PART CHANGE & EXPENSE LOG (MGR5 CATALOG)
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isPartChange} 
                                                    onChange={(e) => setIsPartChange(e.target.checked)} 
                                                    className="h-3.5 w-3.5 text-teal-600 rounded border-slate-300 cursor-pointer"
                                                />
                                                <span className="text-[10px] font-bold text-teal-800 uppercase">Replaced Spare Part</span>
                                            </label>
                                        </div>
                                        <div className="pb-1">
                                            <select
                                                value={selectedMgr5PartId}
                                                onChange={handleSelectMgr5Part}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white shadow-xs focus:ring-2 focus:ring-teal-500 outline-none"
                                            >
                                                <option value="">-- Select Replaced Spare Part from MGR5 Catalog --</option>
                                                {mgr5Parts.map(p => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-12 gap-1.5 items-center">
                                            <div className="col-span-4">
                                                <input 
                                                    type="text" 
                                                    placeholder="Part/Charge" 
                                                    value={expDesc} 
                                                    onChange={e => setExpDesc(e.target.value)} 
                                                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    placeholder="Qty" 
                                                    value={expQty} 
                                                    onChange={e => setExpQty(e.target.value)} 
                                                    className="w-full px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-center"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    placeholder="Rate" 
                                                    value={expRate} 
                                                    onChange={e => setExpRate(e.target.value)} 
                                                    className="w-full px-1.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-center"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <button 
                                                    type="button"
                                                    onClick={handleAddExpense}
                                                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-right px-1 pt-1">
                                            <span className="text-[10px] font-black uppercase text-slate-400">Amount (Auto): </span>
                                            <span className="text-xs font-black text-teal-700">₹{(Number(expQty) || 0) * (Number(expRate) || 0)}</span>
                                        </div>

                                        {expenses.length > 0 && (
                                            <div className="space-y-1.5 pt-2">
                                                {expenses.map((ex, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            {ex.isPartChange && (
                                                                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-black uppercase rounded tracking-wider">
                                                                    Part Changed
                                                                </span>
                                                            )}
                                                            <span className="text-slate-900 font-extrabold">{ex.description}</span>
                                                            <span className="text-[10px] text-slate-400 font-semibold ml-2">({ex.quantity || 1} x ₹{ex.rate || 0})</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-teal-700 font-black">₹{ex.amount}</span>
                                                            <button type="button" onClick={() => handleRemoveExpense(idx)} className="text-rose-500 hover:text-rose-700"><MdDelete /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Next Action / Next Step Field */}
                                    <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/60 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-[10px] font-black text-amber-800 uppercase tracking-widest">
                                                Next Action / Next Step <span className="text-rose-600 font-black">* (Mandatory for Close Visit)</span>
                                            </label>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="e.g. Need Painter, Need Material, Customer Not Available..."
                                            value={nextAction}
                                            onChange={(e) => setNextAction(e.target.value)}
                                            className="w-full px-3.5 py-2 rounded-xl border border-amber-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {['Need Painter', 'Need Material', 'Customer Not Available', 'Part Required', 'Follow-up Visit'].map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setNextAction(preset)}
                                                    className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border ${
                                                        nextAction === preset
                                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                            : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-100'
                                                    }`}
                                                >
                                                    + {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                     {/* ADD PRODUCT PICTURE */}
                                     <div className="space-y-1.5">
                                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                             ADD PRODUCT PICTURE
                                         </label>
                                         
                                         {productPhoto ? (
                                             <div className="relative p-2.5 bg-slate-50 border-2 border-dashed border-teal-300 rounded-2xl flex flex-col items-center justify-center space-y-2">
                                                 <img src={productPhoto} alt="Product Photo" className="max-h-40 rounded-xl object-contain shadow-xs" />
                                                 <div className="flex items-center gap-2">
                                                     <label className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs">
                                                         Change Photo
                                                         <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
                                                     </label>
                                                     <button 
                                                         type="button" 
                                                         onClick={() => setProductPhoto('')} 
                                                         className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all"
                                                     >
                                                         Remove
                                                     </button>
                                                 </div>
                                             </div>
                                         ) : (
                                             <label className="border-2 border-dashed border-slate-200 hover:border-teal-500 bg-slate-50/70 hover:bg-teal-50/30 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group text-center">
                                                 <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
                                                 <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 group-hover:text-teal-600 group-hover:border-teal-300 transition-all mb-2">
                                                     {uploadingPhoto ? (
                                                         <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                                     ) : (
                                                         <MdPhotoCamera size={26} />
                                                     )}
                                                 </div>
                                                 <span className="text-xs font-black text-slate-800 group-hover:text-teal-800">
                                                     {uploadingPhoto ? 'Uploading Photo...' : 'Upload Photo'}
                                                 </span>
                                                 <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                     Take photo of finished product
                                                 </span>
                                             </label>
                                         )}
                                     </div>

                                     {/* Canvas Signature Pad */}
                                     <div className="hidden">

                                        <canvas
                                            ref={canvasRef} style={{ display: 'none' }}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                            className="border border-slate-200 rounded-xl bg-slate-50 cursor-crosshair max-w-full"
                                        />
                                    </div>

                                    {/* Two Action Buttons */}
                                    <div className="pt-2 grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleCheckOut('close_visit')}
                                            className="py-3 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                        >
                                            <MdEvent size={16} />
                                            Close Visit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCheckOut('close_ticket')}
                                            className="py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                        >
                                            <MdCheckCircle size={16} />
                                            Close Ticket
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Completed Visit Summary View */}
                            {selectedVisit.status === 'Completed' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h4 className="font-outfit font-black text-slate-900 uppercase text-xs tracking-wider flex items-center gap-1.5 text-teal-700">
                                            <MdCheckCircle size={18} />
                                            Visit Report & Summary
                                        </h4>
                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-100 text-teal-800 border border-teal-200">
                                            Completed
                                        </span>
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs font-semibold">
                                        <div className="flex justify-between text-slate-500">
                                            <span>Billing Coverage:</span>
                                            <span className="font-bold text-slate-900">{selectedVisit.billingStatus || 'Paid'}</span>
                                        </div>
                                        {selectedVisit.checkIn?.time && (
                                            <div className="flex justify-between text-slate-500">
                                                <span>Check-In Time:</span>
                                                <span className="font-bold text-slate-900">{new Date(selectedVisit.checkIn.time).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {selectedVisit.checkOut?.time && (
                                            <div className="flex justify-between text-slate-500">
                                                <span>Check-Out Time:</span>
                                                <span className="font-bold text-slate-900">{new Date(selectedVisit.checkOut.time).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {selectedVisit.checkIn?.location?.address && (
                                            <div className="pt-1 text-[11px] text-slate-600">
                                                <span className="block text-[9px] font-black uppercase text-slate-400">GPS Location Stamp</span>
                                                <p className="font-medium text-slate-700">{selectedVisit.checkIn.location.address}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Visit Report / Work Done</span>
                                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed min-h-[60px]">
                                            {selectedVisit.visitReport || 'No written report attached.'}
                                        </div>
                                    </div>

                                    {selectedVisit.nextAction && (
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-0.5">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-amber-800">Next Action Logged</span>
                                            <p className="font-bold text-amber-950">{selectedVisit.nextAction}</p>
                                        </div>
                                    )}

                                    {selectedVisit.expenses && selectedVisit.expenses.length > 0 && (
                                        <div>
                                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Part Change & Expenses Logged</span>
                                            <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                                {selectedVisit.expenses.map((ex, idx) => (
                                                    <div key={idx} className="flex justify-between items-center font-bold text-slate-700">
                                                        <div className="flex items-center gap-2">
                                                            {ex.isPartChange && (
                                                                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-black uppercase rounded tracking-wider">
                                                                    Part Changed
                                                                </span>
                                                            )}
                                                            <span>{ex.description} ({ex.quantity || 1} x ₹{ex.rate || 0})</span>
                                                        </div>
                                                        <span className="text-teal-700">₹{ex.amount}</span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-slate-200 pt-1 flex justify-between font-black text-slate-900">
                                                    <span>Total Expense Amount:</span>
                                                    <span className="text-teal-800">₹{selectedVisit.expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedVisit.productPhoto && (
                                         <div>
                                             <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Finished Product Picture</span>
                                             <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                                                 <img src={selectedVisit.productPhoto} alt="Product Picture" className="max-h-48 object-contain rounded-lg shadow-xs" />
                                             </div>
                                         </div>
                                     )}

                                     {selectedVisit.customerSignature && selectedVisit.customerSignature.startsWith('data:image') && (
                                        <div>
                                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Sign Approval</span>
                                            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                                                <img src={selectedVisit.customerSignature} alt="Customer Signature" className="max-h-20 object-contain" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 space-y-2">
                                        <button
                                            onClick={() => handleOpenCreateModal(selectedVisit.ticketId?._id || selectedVisit.ticketId)}
                                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <MdAdd size={16} />
                                            Schedule New Visit for Ticket
                                        </button>
                                        <button
                                            onClick={() => {
                                                setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                                setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
                                                setShowRescheduleModal(true);
                                            }}
                                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200"
                                        >
                                            Re-open / Reschedule Visit
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Cancelled State View */}
                            {selectedVisit.status === 'Cancelled' && (
                                <div className="space-y-4 text-center py-6">
                                    <h4 className="font-outfit font-black text-rose-600 uppercase">Visit Cancelled</h4>
                                    <p className="text-xs text-slate-400 font-semibold px-4">
                                        This visit was marked as cancelled. You can reschedule it or schedule a new visit.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                            setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
                                            setShowRescheduleModal(true);
                                        }}
                                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Reschedule Visit
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="glass shadow-premium rounded-[2rem] p-8 bg-white border border-slate-100 text-center py-20 text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-4">
                                <MdLocalShipping size={32} />
                            </div>
                            <h4 className="font-outfit font-black text-slate-900 uppercase mb-2">No Active dispatch</h4>
                            <p className="text-xs text-slate-400 font-semibold px-4 mb-4">
                                Select a visit from the scheduled visits table to open the field service check-in / check-out dispatch simulator.
                            </p>
                            <button
                                onClick={() => handleOpenCreateModal()}
                                className="px-4 py-2.5 bg-primary-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md"
                            >
                                + Schedule Field Visit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Reschedule Visit Modal */}
            <Modal
                isOpen={showRescheduleModal}
                onClose={() => setShowRescheduleModal(false)}
                title="Reschedule Service Visit"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowRescheduleModal(false)}
                            className="flex-1 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="reschedule-visit-form"
                            disabled={rescheduling}
                            className="flex-1 w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {rescheduling ? 'Rescheduling...' : 'Reschedule'}
                        </button>
                    </>
                }
            >
                <form id="reschedule-visit-form" onSubmit={handleReschedule} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">New Date & Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign Service Engineer *</label>
                        <select
                            required
                            value={rescheduleEngineer}
                            onChange={(e) => setRescheduleEngineer(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">Select Engineer</option>
                            {engineers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type of Ticket (Manual Entry)</label>
                        <input
                            type="text"
                            placeholder="e.g. Product Breakdown, Maintenance, Installation, Repair..."
                            value={rescheduleTicketType}
                            onChange={(e) => setRescheduleTicketType(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-primary-600"
                        />
                    </div>
                </form>
            </Modal>

            {/* Schedule New Field Visit Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Schedule New Field Visit"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="create-visit-form"
                            disabled={creating}
                            className="flex-1 w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {creating ? 'Scheduling...' : 'Schedule Visit'}
                        </button>
                    </>
                }
            >
                <form id="create-visit-form" onSubmit={handleCreateVisit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Ticket / Complaint *</label>
                        <select
                            required
                            value={createTicketId}
                            onChange={(e) => setCreateTicketId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">-- Select Ticket --</option>
                            {(Array.isArray(tickets) ? tickets : []).map(t => (
                                <option key={t._id} value={t._id}>
                                    {t.ticketNo} - {t.issueTitle} ({t.customerId?.customerName || 'Customer'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment Date & Time *</label>
                        <input
                            type="datetime-local"
                            required
                            value={createScheduledDate}
                            onChange={(e) => setCreateScheduledDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign Service Engineer *</label>
                        <select
                            required
                            value={createEngineerId}
                            onChange={(e) => setCreateEngineerId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">-- Select Engineer --</option>
                            {(Array.isArray(engineers) ? engineers : []).map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Status</label>
                        <select
                            value={createBillingStatus}
                            onChange={(e) => setCreateBillingStatus(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="Paid">Paid Out-Of-Warranty Service</option>
                            <option value="Under Warranty">Covered Under Warranty</option>
                            <option value="Under AMC">Covered Under AMC Contract</option>
                            <option value="Free Service">Complimentary Service</option>
                        </select>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ServiceVisits;
