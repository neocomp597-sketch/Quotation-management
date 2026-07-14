import React, { useEffect, useState, useRef } from 'react';
import { csmService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdLocalShipping, MdMyLocation, MdCheckCircle, 
    MdAssignment, MdEvent, MdAttachMoney, MdDelete 
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
    const [expAmt, setExpAmt] = useState('');
    
    // Signature drawing state
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Reschedule State
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleEngineer, setRescheduleEngineer] = useState('');
    const [engineers, setEngineers] = useState([]);
    const [rescheduling, setRescheduling] = useState(false);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const res = await csmService.getVisits();
            setVisits(res.data || []);
        } catch (error) {
            toast.error('Failed to load visits');
        } finally {
            setLoading(false);
        }
    };

    const fetchEngineers = async () => {
        try {
            const res = await csmService.getEngineers();
            setEngineers(res.data || []);
        } catch (error) {
            console.error('Failed to load engineers', error);
        }
    };

    useEffect(() => {
        fetchVisits();
        fetchEngineers();
    }, []);

    // Geolocation Check-in simulation
    const handleCheckIn = (visitId) => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            // Mock checkin
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
            await csmService.checkInVisit(visitId, { latitude: lat, longitude: lng, address });
            toast.success('Engineer Check-In stamp saved successfully!');
            fetchVisits();
            setSelectedVisit(null);
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
        
        // Handle touch vs mouse coordinates
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

    const handleAddExpense = (e) => {
        e.preventDefault();
        if (!expDesc.trim() || !expAmt) return;
        setExpenses([...expenses, { description: expDesc.trim(), amount: Number(expAmt) }]);
        setExpDesc('');
        setExpAmt('');
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
            await csmService.rescheduleVisit(selectedVisit._id, {
                scheduledDate: rescheduleDate,
                engineerId: rescheduleEngineer
            });
            toast.success('Service Visit rescheduled successfully');
            setShowRescheduleModal(false);
            fetchVisits();
            setSelectedVisit(null);
        } catch (error) {
            const errMsg = error.response?.data?.message || 'Rescheduling failed';
            toast.error(errMsg);
        } finally {
            setRescheduling(false);
        }
    };

    const handleCheckOut = async (e) => {
        e.preventDefault();
        
        // Extract signature canvas to base64
        let signatureData = '';
        const canvas = canvasRef.current;
        if (canvas) {
            signatureData = canvas.toDataURL('image/png');
        }

        try {
            await csmService.checkOutVisit(selectedVisit._id, {
                latitude: 18.5205,
                longitude: 73.8568,
                address: selectedVisit.checkIn?.location?.address || 'Site Location Address',
                visitReport: report,
                customerSignature: signatureData,
                billingStatus: billing,
                expenses
            });

            toast.success('Field Visit closed. Ticket status set to Resolved.');
            setSelectedVisit(null);
            setReport('');
            setBilling('Paid');
            setExpenses([]);
            fetchVisits();
        } catch (error) {
            toast.error('Check-out failed');
        }
    };

    // Prepare canvas dimensions on mount/render
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
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                    Field Service Visits Queue
                </h1>
                <p className="text-slate-500 font-semibold text-sm">
                    Manage service engineers visits, check-ins, reports, and customer approvals.
                </p>
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
                            <div className="text-center py-20 text-slate-400">
                                <p className="text-lg font-bold">No field service visits scheduled.</p>
                                <p className="text-sm">Create visits directly inside Ticket Details screens.</p>
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
                                        {visits.map((v) => (
                                            <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-black text-slate-900">{v.visitNo}</td>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900">{v.ticketId?.ticketNo || 'N/A'}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-tight">{v.ticketId?.customerId?.customerName}</p>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{v.engineerId?.name}</td>
                                                <td className="px-6 py-4 text-slate-500">{new Date(v.scheduledDate).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${
                                                        v.status === 'Completed' ? 'bg-teal-50 text-teal-600 border-teal-200' :
                                                        v.status === 'Started' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                        'bg-slate-50 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {v.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => setSelectedVisit(v)}
                                                            disabled={v.status === 'Completed'}
                                                            className="px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none"
                                                        >
                                                            Select
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
                                </div>
                                {['Scheduled', 'In Transit', 'Started'].includes(selectedVisit.status) && (
                                    <button
                                        onClick={() => {
                                            setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
                                            setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
                                            setShowRescheduleModal(true);
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-slate-200"
                                    >
                                        Reschedule
                                    </button>
                                )}
                            </div>

                            {/* Check-In Mode */}
                            {selectedVisit.status === 'Scheduled' && (
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
                                <form onSubmit={handleCheckOut} className="space-y-4">
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
                                    <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Log Expense (Parts/Allowance)</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Part/Charge" 
                                                value={expDesc} 
                                                onChange={e => setExpDesc(e.target.value)} 
                                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Amt" 
                                                value={expAmt} 
                                                onChange={e => setExpAmt(e.target.value)} 
                                                className="w-20 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                            />
                                            <button 
                                                type="button"
                                                onClick={handleAddExpense}
                                                className="px-3 bg-slate-800 text-white rounded-lg text-xs font-bold"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {expenses.length > 0 && (
                                            <div className="space-y-1 pt-2">
                                                {expenses.map((ex, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                                                        <span>{ex.description}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span>₹{ex.amount}</span>
                                                            <button type="button" onClick={() => handleRemoveExpense(idx)} className="text-red-500"><MdDelete /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Canvas Signature Pad */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Approval Signature *</label>
                                            <button 
                                                type="button" 
                                                onClick={clearCanvas} 
                                                className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                                            >
                                                Clear Sign
                                            </button>
                                        </div>
                                        <canvas
                                            ref={canvasRef}
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

                                    <button
                                        type="submit"
                                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        Complete & Check-Out
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="glass shadow-premium rounded-[2rem] p-8 bg-white border border-slate-100 text-center py-20 text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-4">
                                <MdLocalShipping size={32} />
                            </div>
                            <h4 className="font-outfit font-black text-slate-900 uppercase mb-2">No Active dispatch</h4>
                            <p className="text-xs text-slate-400 font-semibold px-4">
                                Select a visit from the scheduled visits table to open the field service check-in / check-out dispatch simulator.
                            </p>
                        </div>
                    )}
                </div>
            </div>

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
                </form>
            </Modal>
        </div>
    );
};

export default ServiceVisits;
