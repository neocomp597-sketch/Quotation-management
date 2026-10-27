import React, { useEffect, useState, useRef } from 'react';
import { csmService, mgrService, productService, uploadService } from '../services/api';
import { formatDate, formatDateTime } from '../utils/helpers';
import { toast } from 'react-toastify';
import {
    MdLocalShipping, MdMyLocation, MdCheckCircle,
    MdEvent, MdDelete, MdAdd, MdCalendarMonth, MdPhotoCamera,
    MdMap, MdOpenInNew, MdSearch, MdClose, MdExpandMore, MdBuild, MdInventory2, MdEdit, MdPushPin,
    MdRefresh, MdArrowBack
} from 'react-icons/md';
import Modal from '../components/Modal';
import { fetchAccurateLocation } from '../utils/reverseGeocode';
import DateInput from '../components/DateInput';
import usePermission from '../hooks/usePermission';

const visitStatusClass = (status) => (
    status === 'Completed' ? 'bg-teal-50 text-teal-600 border-teal-200' :
    status === 'Started' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
    status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-200' :
    'bg-slate-50 text-slate-500 border-slate-200'
);

const VisitInfoField = ({ label, value }) => (
    <div className="min-w-0">
        <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt>
        <dd className="mt-0.5 text-sm font-bold text-slate-900 break-words">{value || '—'}</dd>
    </div>
);

// Fixated MGR5 Search Select Component with 2 distinct sections (MGR5 Spare Parts & Products Catalog)
const Mgr5SearchSelect = ({ mgr5Parts, selectedId, onSelect, isCustomDesc }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedItem = mgr5Parts.find(p => p.id === selectedId);

    const q = query.trim().toLowerCase();
    const spareParts = mgr5Parts.filter(p => p.source === 'MGR5' && (
        !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    ));
    const productParts = mgr5Parts.filter(p => p.source === 'Product' && (
        !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    ));

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {/* Header Badge indicating MGR5 Fixated Spares */}
            <div className="flex items-center justify-between mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider border border-amber-300/80 shadow-2xs">
                    <MdPushPin className="text-amber-600" size={12} />
                    MGR5 FIXATED CATALOG → SPARES (DEFAULT)
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                    {mgr5Parts.length} Configured Products Available
                </span>
            </div>

            {/* Selection Trigger / Default Active Badge */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-teal-500 transition-all group"
            >
                <div className="flex items-center gap-2 truncate pr-2">
                    <MdSearch className="text-slate-400 group-hover:text-teal-600 transition-colors shrink-0" size={18} />
                    <div className="truncate text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                            MGR5 SPARE
                        </span>
                        <span className="font-extrabold text-slate-900 truncate">SPARES (SPRS)</span>
                        {selectedItem && (
                            <span className="text-teal-700 font-bold ml-1 truncate">
                                → {selectedItem.name} ({selectedItem.code})
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {(selectedItem || isCustomDesc) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect('');
                                setQuery('');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Clear Selection"
                        >
                            <MdClose size={14} />
                        </button>
                    )}
                    <MdExpandMore className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-600' : ''}`} size={20} />
                </div>
            </div>

            {/* Dropdown Menu with 2 Distinct Sections */}
            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 sm:min-w-[320px]">
                    {/* Live Search Filter Input */}
                    <div className="p-2.5 bg-slate-50/90 border-b border-slate-100">
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type to search parts, products or codes..."
                                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <MdClose size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable List with 2 Sections */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        
                        {/* SECTION 1: MGR5 SPARE PARTS */}
                        <div className="p-2">
                            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50/70 rounded-lg flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5">
                                    <MdBuild size={13} className="text-amber-600" />
                                    Section 1: MGR5 Spare Parts ({spareParts.length})
                                </span>
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.2 rounded">Fixated</span>
                            </div>
                            {spareParts.length === 0 ? (
                                <div className="px-3 py-1.5 text-xs text-slate-400 italic">No MGR5 spare parts found</div>
                            ) : (
                                spareParts.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                onSelect(item);
                                                setIsOpen(false);
                                            }}
                                            className={`px-3 py-2 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between ${
                                                isSelected 
                                                    ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200' 
                                                    : 'hover:bg-amber-50/50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-black text-[9px] rounded uppercase shrink-0">
                                                    MGR5
                                                </span>
                                                <div className="truncate">
                                                    <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">Code: {item.code}</span>
                                                </div>
                                            </div>
                                            {item.rate > 0 && (
                                                <span className="text-xs font-black text-teal-700 shrink-0">₹{item.rate}</span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* SECTION 2: PRODUCTS CATALOG */}
                        <div className="p-2">
                            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50/70 rounded-lg flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5">
                                    <MdInventory2 size={13} className="text-indigo-600" />
                                    Section 2: Products Catalog ({productParts.length})
                                </span>
                                <span className="text-[9px] font-bold text-indigo-800 bg-indigo-200/60 px-1.5 py-0.2 rounded">Catalog</span>
                            </div>
                            {productParts.length === 0 ? (
                                <div className="px-3 py-1.5 text-xs text-slate-400 italic">No products found</div>
                            ) : (
                                productParts.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                onSelect(item);
                                                setIsOpen(false);
                                            }}
                                            className={`px-3 py-2 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between ${
                                                isSelected 
                                                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' 
                                                    : 'hover:bg-indigo-50/40 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-black text-[9px] rounded uppercase shrink-0">
                                                    Product
                                                </span>
                                                <div className="truncate">
                                                    <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">Code: {item.code}</span>
                                                </div>
                                            </div>
                                            {item.rate > 0 && (
                                                <span className="text-xs font-black text-teal-700 shrink-0">₹{item.rate}</span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* CUSTOM MANUAL ENTRY OPTION */}
                        <div className="p-2 bg-slate-50/70 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect('__custom__');
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-100/60 transition-all flex items-center gap-2"
                            >
                                <MdEdit size={14} className="text-amber-600" />
                                <span>✍️ Custom Manual Entry...</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ServiceVisits = () => {
    const canvasRef = useRef(null);
    const { canCreate, canModify } = usePermission('csm_visits');

    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [visits, setVisits] = useState([]);
    // The visit open in the full-width workspace; null shows the queue
    const [selectedVisit, setSelectedVisit] = useState(null);
    // Last visit opened (or scheduled) from the queue, highlighted and scrolled back into view
    const [lastOpenedVisitId, setLastOpenedVisitId] = useState(null);
    const [engineers, setEngineers] = useState([]);
    const [tickets, setTickets] = useState([]);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createTicketId, setCreateTicketId] = useState('');
    const [createScheduledDate, setCreateScheduledDate] = useState('');
    const [createEngineerId, setCreateEngineerId] = useState('');
    const [createBillingStatus, setCreateBillingStatus] = useState('Paid');
    const [creating, setCreating] = useState(false);

    // Reschedule Modal State
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleEngineer, setRescheduleEngineer] = useState('');
    const [rescheduleTicketType, setRescheduleTicketType] = useState('');
    const [rescheduling, setRescheduling] = useState(false);

    // Completion / Check-out & Parts State
    const [report, setReport] = useState('');
    const [nextAction, setNextAction] = useState('');
    const [billing, setBilling] = useState('Paid');
    const [expenses, setExpenses] = useState([]);
    const [productPhoto, setProductPhoto] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [mgr5Parts, setMgr5Parts] = useState([]);
    const [selectedMgr5PartId, setSelectedMgr5PartId] = useState('');
    const [expDesc, setExpDesc] = useState('');
    const [expQty, setExpQty] = useState(1);
    const [expRate, setExpRate] = useState('');
    const [isPartChange, setIsPartChange] = useState(true);
    const [isCustomExpDesc, setIsCustomExpDesc] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);

    const resetCompletionForm = () => {
        setReport('');
        setNextAction('');
        setBilling('Paid');
        setExpenses([]);
        setProductPhoto('');
        setHasSignature(false);
    };

    const hasUnsavedCompletion = selectedVisit?.status === 'Started' && Boolean(
        report.trim() || nextAction.trim() || expenses.length > 0 || productPhoto || hasSignature || billing !== 'Paid'
    );

    const handleSelectVisit = (v) => {
        resetCompletionForm();
        setSelectedVisit(v);
        setLastOpenedVisitId(v._id);
        window.scrollTo({ top: 0 });
    };

    const handleBackToQueue = () => {
        if (hasUnsavedCompletion && !window.confirm('Discard the unsaved visit report, parts and signature for this visit?')) return;
        resetCompletionForm();
        setSelectedVisit(null);
    };

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const res = await csmService.getVisits();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setVisits(data);
            setLoadError('');
            // Keep the open workspace on the same visit, refreshed from the populated list
            setSelectedVisit((prev) => (prev ? data.find((v) => v._id === prev._id) || prev : prev));
            return data;
        } catch (error) {
            setLoadError(error.response?.data?.message || 'Failed to load visits');
            toast.error('Failed to load visits');
            return [];
        } finally {
            setLoading(false);
        }
    };

    // Action responses come back unpopulated: show the new status straight away while keeping
    // the populated ticket/engineer, then reload the list so the open visit is fully current.
    const applyVisitUpdate = (updated) => {
        if (updated?._id) {
            setSelectedVisit((prev) => (prev && prev._id === updated._id
                ? {
                    ...updated,
                    ticketId: prev.ticketId,
                    engineerId: typeof updated.engineerId === 'object'
                        ? updated.engineerId
                        : engineers.find((e) => e._id === updated.engineerId) || prev.engineerId
                }
                : prev));
        }
        fetchVisits();
    };

    const openRescheduleModal = () => {
        if (hasUnsavedCompletion && !window.confirm('Rescheduling resets this visit to Scheduled and discards the unsaved visit report, parts and signature. Continue?')) return;
        setRescheduleDate(selectedVisit.scheduledDate ? new Date(selectedVisit.scheduledDate).toISOString().slice(0, 16) : '');
        setRescheduleEngineer(selectedVisit.engineerId?._id || selectedVisit.engineerId || '');
        setRescheduleTicketType(selectedVisit.ticketType || '');
        setShowRescheduleModal(true);
    };

    // Back on the queue: bring the visit that was just open (or just scheduled) into view
    const isWorkspaceOpen = Boolean(selectedVisit);
    useEffect(() => {
        if (isWorkspaceOpen || !lastOpenedVisitId) return;
        const rows = document.querySelectorAll(`[data-visit-id="${lastOpenedVisitId}"]`);
        [...rows].find((el) => el.offsetParent !== null)?.scrollIntoView({ block: 'center' });
    }, [isWorkspaceOpen, lastOpenedVisitId]);

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
                productService.getAll({ limit: 1000 })
            ]);
            
            let sparesMgr5Id = null;
            if (mgrRes.status === 'fulfilled') {
                const mgrData = Array.isArray(mgrRes.value.data) ? mgrRes.value.data : (mgrRes.value.data?.data || []);
                const sparesItem = mgrData.find(m => 
                    (m.code || '').toLowerCase().includes('spr') || 
                    (m.description || m.name || '').toLowerCase().includes('spare')
                ) || mgrData[0];
                if (sparesItem) sparesMgr5Id = sparesItem._id;
            }

            let prodList = [];
            if (prodRes.status === 'fulfilled') {
                const prodData = Array.isArray(prodRes.value.data) ? prodRes.value.data : (prodRes.value.data?.data || []);
                
                // Filter products configured under Product Grouping -> MGR5 -> Spares
                const productsUnderMgr5Spares = prodData.filter(p => {
                    if (!p.mgr5 && !p.mgr5Id) return false;
                    const mgr5Obj = p.mgr5 || p.mgr5Id;
                    if (typeof mgr5Obj === 'object') {
                        const code = (mgr5Obj.code || '').toLowerCase();
                        const desc = (mgr5Obj.description || mgr5Obj.name || '').toLowerCase();
                        if (sparesMgr5Id && (mgr5Obj._id === sparesMgr5Id || mgr5Obj.id === sparesMgr5Id)) return true;
                        return code.includes('spr') || desc.includes('spare');
                    }
                    if (typeof mgr5Obj === 'string') {
                        return (sparesMgr5Id && mgr5Obj === sparesMgr5Id) || mgr5Obj.toLowerCase().includes('spr') || mgr5Obj.toLowerCase().includes('spare');
                    }
                    return false;
                });

                // Use products under MGR5 -> Spares, fallback to prodData if empty
                const listToUse = productsUnderMgr5Spares.length > 0 ? productsUnderMgr5Spares : prodData;

                listToUse.forEach(p => {
                    prodList.push({
                        id: p._id,
                        code: p.productCode,
                        name: p.productName,
                        label: `${p.productName} (${p.productCode})`,
                        rate: p.mrp || p.basePrice || 0,
                        source: 'Product'
                    });
                });
            }

            setMgr5Parts(prodList);

            // Pre-select MGR5 Spares product by default when opening
            if (prodList.length > 0 && !selectedMgr5PartId) {
                const defaultProd = prodList[0];
                setSelectedMgr5PartId(defaultProd.id);
                setExpDesc(`${defaultProd.name}${defaultProd.code ? ` (${defaultProd.code})` : ''}`);
                if (defaultProd.rate > 0) setExpRate(defaultProd.rate);
                setIsPartChange(true);
            }
        } catch (error) {
            console.error('Failed to load MGR5 catalog products', error);
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
            const data = await fetchVisits();
            const created = data.find((v) => v._id === res.data?._id);
            if (created) {
                // Scheduled from a visit's workspace: move the workspace to the new visit.
                // Scheduled from the queue: stay on the queue with the new visit highlighted.
                if (selectedVisit) handleSelectVisit(created);
                else setLastOpenedVisitId(created._id);
            }
        } catch (error) {
            const errMsg = error.response?.data?.message || 'Failed to schedule visit';
            toast.error(errMsg);
        } finally {
            setCreating(false);
        }
    };

    // Resolves to the device's GPS position with a reverse-geocoded address, or null if unavailable
    const getDeviceLocation = () => new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const locData = await fetchAccurateLocation(lat, lng);
                resolve({ lat, lng, address: `${locData.address} (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})` });
            },
            (err) => {
                console.warn('Geolocation error:', err);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });

    const GPS_UNAVAILABLE = 'GPS location unavailable';

    const handleCheckIn = async (visitId) => {
        toast.info('Locking onto high-precision GPS location...');
        const loc = await getDeviceLocation();
        if (!loc) {
            toast.warn('Could not get GPS location. Check-in recorded without location - please allow location access.');
            executeCheckIn(visitId, null, null, GPS_UNAVAILABLE);
            return;
        }
        executeCheckIn(visitId, loc.lat, loc.lng, loc.address);
    };

    const executeCheckIn = async (visitId, lat, lng, address) => {
        try {
            const res = await csmService.checkInVisit(visitId, { latitude: lat, longitude: lng, address });
            toast.success('Engineer Check-In stamp saved successfully!');
            applyVisitUpdate(res.data);
        } catch (error) {
            toast.error('Check-in stamp failed');
        }
    };

    // Canvas drawing helper functions
    // The canvas is stretched to its box, so scale the pointer position to canvas pixels
    const getCanvasPoint = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const point = e.touches ? e.touches[0] : e;
        return {
            x: (point.clientX - rect.left) * (canvas.width / rect.width),
            y: (point.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasPoint(e, canvas);

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasSignature(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasPoint(e, canvas);

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSelectMgr5Part = (itemOrId) => {
        if (typeof itemOrId === 'string') {
            if (itemOrId === '__custom__') {
                setIsCustomExpDesc(true);
                setSelectedMgr5PartId('');
                setExpDesc('');
                return;
            }
            setSelectedMgr5PartId(itemOrId);
            if (!itemOrId) {
                setExpDesc('');
                setExpRate('');
                return;
            }
            const found = mgr5Parts.find(p => p.id === itemOrId);
            if (found) {
                setExpDesc(`${found.name} (${found.code})`);
                if (found.rate > 0) setExpRate(found.rate);
                setIsPartChange(true);
                setIsCustomExpDesc(false);
            }
        } else if (itemOrId && typeof itemOrId === 'object') {
            setSelectedMgr5PartId(itemOrId.id);
            setExpDesc(`${itemOrId.name} (${itemOrId.code})`);
            if (itemOrId.rate > 0) setExpRate(itemOrId.rate);
            setIsPartChange(true);
            setIsCustomExpDesc(false);
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
        setIsCustomExpDesc(false);
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
            // The visit goes back to Scheduled, so any half-filled completion form no longer applies
            resetCompletionForm();
            applyVisitUpdate(res.data);
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

        if (!productPhoto) {
            toast.error('Product photo is mandatory to close visit or close ticket');
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

        // The GPS fix can take several seconds; don't let a second click submit the visit twice
        setCheckingOut(true);
        try {
            const loc = await getDeviceLocation();
            if (!loc) {
                toast.warn('Could not get GPS location. Check-out recorded without location - please allow location access.');
            }
            const res = await csmService.checkOutVisit(selectedVisit._id, {
                latitude: loc ? loc.lat : null,
                longitude: loc ? loc.lng : null,
                address: loc ? loc.address : GPS_UNAVAILABLE,
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

            resetCompletionForm();
            applyVisitUpdate(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Check-out failed');
        } finally {
            setCheckingOut(false);
        }
    };

    // Keyed on id + status so refreshing the open visit doesn't wipe a signature being drawn
    const signatureVisitKey = selectedVisit?.status === 'Started' ? selectedVisit._id : null;
    useEffect(() => {
        if (signatureVisitKey) {
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
    }, [signatureVisitKey]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {!selectedVisit ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-outfit uppercase">
                                Field Service Visits
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
                                Manage field engineer dispatches, visit check-ins, service reports and visit completion.
                            </p>
                        </div>
                        {canCreate && (
                            <button
                                onClick={() => handleOpenCreateModal()}
                                className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-xs tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 shrink-0"
                            >
                                <MdAdd size={20} />
                                Schedule Field Visit
                            </button>
                        )}
                    </div>

                    {/* Service Visits Queue */}
                    <div className="glass shadow-premium rounded-[2rem] p-4 sm:p-6 bg-white border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
                                <MdLocalShipping size={18} className="text-primary-600" />
                                Service Visits Queue
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                                    {visits.length}
                                </span>
                            </h2>
                            {loading && visits.length > 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Refreshing...</span>
                            )}
                        </div>
                        {loading && visits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Visits...</p>
                            </div>
                        ) : loadError && visits.length === 0 ? (
                            <div className="text-center py-20 space-y-4">
                                <p className="text-lg font-bold text-rose-600">Could not load service visits.</p>
                                <p className="text-sm text-slate-400">{loadError}</p>
                                <button
                                    onClick={() => fetchVisits()}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-black uppercase text-xs rounded-xl shadow-md inline-flex items-center gap-1.5"
                                >
                                    <MdRefresh size={16} />
                                    Retry
                                </button>
                            </div>
                        ) : visits.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 space-y-4">
                                <p className="text-lg font-bold">No field service visits scheduled.</p>
                                {canCreate && (
                                    <>
                                        <p className="text-sm">Click below to schedule your first field service visit.</p>
                                        <button
                                            onClick={() => handleOpenCreateModal()}
                                            className="px-4 py-2.5 bg-primary-600 text-white font-black uppercase text-xs rounded-xl shadow-md"
                                        >
                                            + Schedule Field Visit
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards View (Phone Screens) */}
                                <div className="space-y-3 block sm:hidden">
                                    {visits.map((v) => {
                                        const isLastOpened = lastOpenedVisitId === v._id;
                                        return (
                                            <div
                                                key={v._id}
                                                data-visit-id={v._id}
                                                onClick={() => handleSelectVisit(v)}
                                                className={`csm-mobile-card border transition-all cursor-pointer ${
                                                    isLastOpened
                                                        ? 'bg-primary-50/70 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="font-black text-slate-900 text-sm">{v.visitNo}</span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-wider ${visitStatusClass(v.status)}`}>
                                                        {v.status}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 mb-3 text-xs font-semibold">
                                                    <p className="font-black text-slate-800">{v.ticketId?.ticketNo || 'N/A'} - {v.ticketId?.issueTitle}</p>
                                                    <p className="text-slate-500">
                                                        {v.ticketId?.customerId?.customerName}
                                                        {v.branchId?.name && <span className="ml-1.5 text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider bg-purple-50 text-purple-700 border border-purple-200">📍 {v.branchId.name}</span>}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 mt-2">
                                                        <span>Eng: {v.engineerId?.name || 'Unassigned'}</span>
                                                        <span>{formatDate(v.scheduledDate)}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSelectVisit(v); }}
                                                    className="csm-mobile-btn-full font-black uppercase rounded-xl transition-all bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                                                >
                                                    Select & View Details
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop & Tablet Table View */}
                                <div className="overflow-x-auto hidden sm:block">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                                <th className="px-4 py-4">Visit No</th>
                                                <th className="px-4 py-4">Ticket Details</th>
                                                <th className="px-4 py-4">Engineer</th>
                                                <th className="px-4 py-4">Scheduled Date</th>
                                                <th className="px-4 py-4">Status</th>
                                                <th className="px-4 py-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                            {visits.map((v) => {
                                                const isLastOpened = lastOpenedVisitId === v._id;
                                                return (
                                                    <tr
                                                        key={v._id}
                                                        data-visit-id={v._id}
                                                        className={`transition-colors cursor-pointer ${
                                                            isLastOpened
                                                                ? 'bg-primary-50/60 border-l-4 border-l-primary-600'
                                                                : 'hover:bg-slate-50/50'
                                                        }`}
                                                        onClick={() => handleSelectVisit(v)}
                                                    >
                                                        <td className="px-4 py-4 font-black text-slate-900 whitespace-nowrap">
                                                            {v.visitNo}
                                                            {v.branchId?.name && (
                                                                <span className="block w-fit mt-1 text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                                                    📍 {v.branchId.name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-bold text-slate-900">{v.ticketId?.ticketNo || 'N/A'}</p>
                                                            {v.ticketId?.issueTitle && (
                                                                <p className="text-xs text-slate-600 line-clamp-3 break-words leading-snug" title={v.ticketId.issueTitle}>{v.ticketId.issueTitle}</p>
                                                            )}
                                                            <p className="text-[10px] text-slate-400 uppercase tracking-tight">{v.ticketId?.customerId?.customerName}</p>
                                                        </td>
                                                        <td className="px-4 py-4 text-slate-500">{v.engineerId?.name || 'Unassigned'}</td>
                                                        <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{formatDateTime(v.scheduledDate)}</td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${visitStatusClass(v.status)}`}>
                                                                {v.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex justify-center">
                                                                <button
                                                                    onClick={() => handleSelectVisit(v)}
                                                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white"
                                                                >
                                                                    Select
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : (
                /* Full-width workspace for the selected visit */
                <div className="space-y-6 animate-scale-in">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleBackToQueue}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200 active:scale-95 shadow-2xs"
                        >
                            <MdArrowBack size={18} />
                            Back to Service Visits
                        </button>
                        {canModify && ['Scheduled', 'In Transit', 'Started'].includes(selectedVisit.status) && (
                            <button
                                type="button"
                                onClick={openRescheduleModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200 active:scale-95 shadow-2xs"
                            >
                                <MdCalendarMonth size={16} />
                                Reschedule
                            </button>
                        )}
                    </div>

                    {/* Visit Information */}
                    <div className="glass shadow-premium rounded-[2rem] p-4 sm:p-6 bg-white border border-slate-100 space-y-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Active Service Dispatch</span>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-outfit uppercase break-words">{selectedVisit.visitNo}</h1>
                                {selectedVisit.ticketId?.issueTitle && (
                                    <p className="text-sm text-slate-500 font-bold break-words">{selectedVisit.ticketId.issueTitle}</p>
                                )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${visitStatusClass(selectedVisit.status)}`}>
                                {selectedVisit.status}
                            </span>
                        </div>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                            <VisitInfoField label="Ticket No" value={selectedVisit.ticketId?.ticketNo} />
                            <VisitInfoField label="Customer" value={selectedVisit.ticketId?.customerId?.customerName || selectedVisit.ticketId?.customerId?.companyName} />
                            <VisitInfoField label="Service Engineer" value={selectedVisit.engineerId?.name || 'Unassigned'} />
                            <VisitInfoField label="Scheduled Date & Time" value={selectedVisit.scheduledDate && formatDateTime(selectedVisit.scheduledDate)} />
                        </dl>
                    </div>

                    {/* Check-in, completion & check-out, or the visit summary, depending on status */}
                    <div className="glass shadow-premium rounded-[2rem] p-4 sm:p-6 bg-white border border-slate-100 space-y-6">
                        {/* Check-In Mode */}
                        {(selectedVisit.status === 'Scheduled' || selectedVisit.status === 'In Transit') && (
                            <div className="space-y-4 text-center py-6 max-w-md mx-auto">
                                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto text-primary-600">
                                    <MdMyLocation size={32} />
                                </div>
                                <h4 className="font-outfit font-black text-slate-900 uppercase">Field Check-In Simulator</h4>
                                <p className="text-xs text-slate-400 font-semibold px-4">
                                    Performs checking-in at site location. Click the button below to simulate matching GPS coordinate stamps.
                                </p>
                                {canModify && (
                                    <button
                                        onClick={() => handleCheckIn(selectedVisit._id)}
                                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                    >
                                        Stamp Check-In Location
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Check-Out Mode */}
                        {canModify && selectedVisit.status === 'Started' && (
                            <div className="space-y-6">
                                <h4 className="font-outfit font-black text-slate-900 uppercase text-sm border-b border-slate-50 pb-2">
                                    Completion & Check-Out
                                </h4>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                                    <div className="space-y-4">
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
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-32"
                                            />
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
                                    </div>

                                    {/* Expenses Array Log */}
                                    <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                                        <div className="flex flex-wrap justify-between items-center gap-2 pb-1">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                    PART CHANGE & EXPENSE LOG
                                                </label>
                                                <p className="text-[10px] text-slate-400 font-semibold">Select MGR5 parts or products to log field expenses</p>
                                            </div>
                                            <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isPartChange} 
                                                    onChange={(e) => setIsPartChange(e.target.checked)} 
                                                    className="h-3.5 w-3.5 text-teal-600 rounded border-slate-300 cursor-pointer"
                                                />
                                                <span className="text-[10px] font-black text-teal-800 uppercase">Replaced Spare Part</span>
                                            </label>
                                        </div>

                                        {/* Full-width Search Select for MGR5 (Fixated, with 2 sections: MGR5 Parts & Products Catalog) */}
                                        <Mgr5SearchSelect
                                            mgr5Parts={mgr5Parts}
                                            selectedId={selectedMgr5PartId}
                                            onSelect={handleSelectMgr5Part}
                                            isCustomDesc={isCustomExpDesc}
                                        />

                                        {/* Line Input Row (Part Description, Qty, Rate, Add Button) */}
                                        <div className="grid grid-cols-12 gap-2 items-center pt-1">
                                            <div className="col-span-12 sm:col-span-5">
                                                {isCustomExpDesc ? (
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Custom Part / Charge Name" 
                                                            value={expDesc} 
                                                            onChange={e => setExpDesc(e.target.value)} 
                                                            className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsCustomExpDesc(false)}
                                                            className="absolute right-2 text-slate-400 hover:text-slate-600"
                                                            title="Switch to MGR5 Dropdown"
                                                        >
                                                            <MdExpandMore size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <select 
                                                        value={selectedMgr5PartId || ''} 
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            if (val === '__custom__') {
                                                                setIsCustomExpDesc(true);
                                                                setSelectedMgr5PartId('');
                                                                setExpDesc('');
                                                                return;
                                                            }
                                                            if (!val) {
                                                                setSelectedMgr5PartId('');
                                                                setExpDesc('');
                                                                setExpRate('');
                                                                return;
                                                            }
                                                            const found = mgr5Parts.find(p => p.id === val);
                                                            if (found) {
                                                                handleSelectMgr5Part(found);
                                                            }
                                                        }} 
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer truncate"
                                                    >
                                                        <option value="">-- Select Spare / Product (MGR5 → Spares) --</option>
                                                        {mgr5Parts.map(item => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.source === 'Product' ? '📦 ' : '🔧 '}
                                                                {item.name} {item.code ? `(${item.code})` : ''} {item.rate > 0 ? `- ₹${item.rate}` : ''}
                                                            </option>
                                                        ))}
                                                        <option value="__custom__">✍️ Custom Manual Entry...</option>
                                                    </select>
                                                )}
                                            </div>
                                            <div className="col-span-4 sm:col-span-2">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    placeholder="Qty" 
                                                    value={expQty} 
                                                    onChange={e => setExpQty(e.target.value)} 
                                                    className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 text-center bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-4 sm:col-span-2">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    placeholder="Rate ₹" 
                                                    value={expRate} 
                                                    onChange={e => setExpRate(e.target.value)} 
                                                    className="w-full px-2 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 text-center bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-4 sm:col-span-3">
                                                <button 
                                                    type="button"
                                                    onClick={handleAddExpense}
                                                    className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
                                                >
                                                    <MdAdd size={16} />
                                                    Add Item
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
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                                     {/* CUSTOMER SIGNATURE */}
                                     <div className="space-y-1.5 pt-1">
                                         <div className="flex items-center justify-between">
                                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                 CUSTOMER SIGNATURE
                                             </label>
                                             <button
                                                 type="button"
                                                 onClick={clearSignature}
                                                 className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline"
                                             >
                                                 Clear Signature
                                             </button>
                                         </div>
                                         <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-2 flex justify-center">
                                             <canvas
                                                 ref={canvasRef}
                                                 width={380}
                                                 height={130}
                                                 onMouseDown={startDrawing}
                                                 onMouseMove={draw}
                                                 onMouseUp={stopDrawing}
                                                 onMouseLeave={stopDrawing}
                                                 onTouchStart={startDrawing}
                                                 onTouchMove={draw}
                                                 onTouchEnd={stopDrawing}
                                                 className="border border-slate-200 rounded-xl bg-slate-50/80 cursor-crosshair w-full max-w-full touch-none"
                                             />
                                         </div>
                                     </div>
                                </div>

                                {/* Two Action Buttons */}
                                <div className="pt-2 grid grid-cols-2 gap-3 sm:max-w-md sm:ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => handleCheckOut('close_visit')}
                                        disabled={checkingOut}
                                        className="py-3 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <MdEvent size={16} />
                                        Close Visit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCheckOut('close_ticket')}
                                        disabled={checkingOut}
                                        className="py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                            <span className="font-bold text-slate-900">{formatDateTime(selectedVisit.checkIn.time)}</span>
                                        </div>
                                    )}
                                    {selectedVisit.checkOut?.time && (
                                        <div className="flex justify-between text-slate-500">
                                            <span>Check-Out Time:</span>
                                            <span className="font-bold text-slate-900">{formatDateTime(selectedVisit.checkOut.time)}</span>
                                        </div>
                                    )}
                                    {selectedVisit.checkIn?.location && (
                                        <div className="pt-1 text-[11px] text-slate-600 flex items-center justify-between gap-2">
                                            <div>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">GPS Location Stamp</span>
                                                <p className="font-medium text-slate-700">{selectedVisit.checkIn.location.address || `Lat: ${selectedVisit.checkIn.location.lat}, Lng: ${selectedVisit.checkIn.location.lng}`}</p>
                                            </div>
                                            {(selectedVisit.checkIn.location.lat || selectedVisit.checkIn.location.latitude) && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${selectedVisit.checkIn.location.lat || selectedVisit.checkIn.location.latitude},${selectedVisit.checkIn.location.lng || selectedVisit.checkIn.location.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-bold transition-all shrink-0 shadow-2xs group"
                                                    title="Open in Google Maps"
                                                >
                                                    <MdMap size={14} className="text-teal-600 group-hover:scale-110 transition-transform" />
                                                    <span>Open Map</span>
                                                    <MdOpenInNew size={11} />
                                                </a>
                                            )}
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

                                <div className="pt-2 flex flex-col sm:flex-row sm:justify-end gap-2">
                                    {canCreate && (
                                        <button
                                            onClick={() => handleOpenCreateModal(selectedVisit.ticketId?._id || selectedVisit.ticketId)}
                                            className="w-full sm:w-auto sm:px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <MdAdd size={16} />
                                            Schedule New Visit for Ticket
                                        </button>
                                    )}
                                    {canModify && (
                                        <button
                                            onClick={openRescheduleModal}
                                            className="w-full sm:w-auto sm:px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200"
                                        >
                                            Re-open / Reschedule Visit
                                        </button>
                                    )}
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
                                {canModify && (
                                    <button
                                        onClick={openRescheduleModal}
                                        className="w-full sm:w-auto sm:px-10 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Reschedule Visit
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                        <DateInput
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
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type of Ticket</label>
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
                        <DateInput
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
