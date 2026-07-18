import React, { useState, useEffect, useCallback, useRef } from 'react';
import { salesService, customerService, userService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MdAdd, MdClose, MdBusiness, MdPerson, MdCalendarToday, MdAttachMoney, MdFilterList, MdViewKanban, MdExpandMore, MdSearch } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PortalDropdown from '../components/PortalDropdown';
import SearchableSelect from '../components/SearchableSelect';

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
};

// Deal Card Component
const DealCard = ({ deal, onClick }) => {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
        id: deal._id,
        data: { deal }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(deal)}
            className="bg-white rounded-xl border border-slate-100 p-4 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group"
        >
            <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors">{deal.title}</h4>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                <MdBusiness size={14} className="text-slate-400" />
                <span className="truncate">{deal.customerId?.companyName || deal.customerId?.customerName || '—'}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
                <span className="text-sm font-black text-slate-900">{formatCurrency(deal.value)}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold">{deal.probability}%</span>
            </div>
            {deal.expectedCloseDate && (
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                    <MdCalendarToday size={12} />
                    <span>{new Date(deal.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
            )}
            {deal.ownerId?.name && (
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                    <MdPerson size={12} />
                    <span>{deal.ownerId.name}</span>
                </div>
            )}
        </div>
    );
};

// Stage Column Component
const StageColumn = ({ stage, onDealClick, onAddDeal }) => {
    return (
        <div className="flex-shrink-0 w-72 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100 max-h-[calc(100vh-260px)]">
            {/* Column Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h3 className="font-bold text-slate-900 text-sm">{stage.name}</h3>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-lg font-bold text-slate-500 border border-slate-100">{stage.count}</span>
                    </div>
                    <button
                        onClick={() => onAddDeal(stage)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                    >
                        <MdAdd size={14} />
                    </button>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-1">{formatCurrency(stage.totalValue)}</p>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                <SortableContext items={stage.deals.map(d => d._id)} strategy={verticalListSortingStrategy}>
                    {stage.deals.map(deal => (
                        <DealCard key={deal._id} deal={deal} onClick={onDealClick} />
                    ))}
                </SortableContext>
                {stage.deals.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                        <p>No deals</p>
                        <button
                            onClick={() => onAddDeal(stage)}
                            className="mt-2 text-indigo-600 font-bold hover:underline"
                        >
                            + Add deal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const DealBoard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pipelines, setPipelines] = useState([]);
    const [selectedPipeline, setSelectedPipeline] = useState('');
    const [boardData, setBoardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [createStage, setCreateStage] = useState(null);
    const [activeDeal, setActiveDeal] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState([]);
    const [filterOwner, setFilterOwner] = useState('');

    const [customerSearch, setCustomerSearch] = useState('');
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
    const customerAnchorRef = useRef(null);

    const [sources, setSources] = useState([]);

    // Create form state
    const [form, setForm] = useState({
        title: '', customerId: '', value: '', expectedCloseDate: '', source: 'Other', notes: ''
    });

    const handleAddSource = async (name) => {
        if (!name.trim()) return;
        try {
            const res = await salesService.createSource({ name });
            toast.success('Source added successfully');
            const sourcesRes = await salesService.getSources();
            setSources(sourcesRes.data || []);
            setForm(prev => ({ ...prev, source: res.data.name }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add source');
        }
    };

    const handleDeleteSource = async (option) => {
        if (!window.confirm(`Are you sure you want to delete the source "${option.label}"?`)) return;
        try {
            await salesService.deleteSource(option.id);
            toast.success('Source deleted successfully');
            const sourcesRes = await salesService.getSources();
            setSources(sourcesRes.data || []);
            if (form.source === option.value) {
                setForm(prev => ({ ...prev, source: 'Other' }));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete source');
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    useEffect(() => {
        loadPipelines();
        loadSupport();
    }, []);

    useEffect(() => {
        if (selectedPipeline) loadBoard();
    }, [selectedPipeline, filterOwner]);

    const loadPipelines = async () => {
        try {
            const res = await salesService.getPipelines();
            setPipelines(res.data);
            if (res.data.length > 0) {
                const defaultPipeline = res.data.find(p => p.isDefault) || res.data[0];
                setSelectedPipeline(defaultPipeline._id);
            } else {
                // Auto-seed
                await salesService.seedPipelines();
                const res2 = await salesService.getPipelines();
                setPipelines(res2.data);
                if (res2.data.length > 0) {
                    setSelectedPipeline(res2.data[0]._id);
                }
            }
        } catch (err) {
            toast.error('Failed to load pipelines');
        }
    };

    const loadSupport = async () => {
        try {
            const [custRes, userRes, sourceRes] = await Promise.all([
                customerService.getAll({ limit: 500 }),
                userService.getAll(),
                salesService.getSources()
            ]);
            setCustomers(custRes.data?.data || custRes.data || []);
            setUsers(Array.isArray(userRes.data) ? userRes.data : userRes.data?.users || []);
            setSources(sourceRes.data || []);
        } catch (err) {
            console.error('Failed to load support data:', err);
        }
    };

    const loadBoard = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filterOwner) params.ownerId = filterOwner;
            const res = await salesService.getDealBoard(selectedPipeline, params);
            setBoardData(res.data);
        } catch (err) {
            toast.error('Failed to load board');
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event) => {
        const { active } = event;
        const deal = active.data.current?.deal;
        setActiveDeal(deal);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveDeal(null);

        if (!over || !active) return;

        const dealId = active.id;
        const deal = active.data.current?.deal;
        if (!deal) return;

        // Find the target stage by checking which stage column the deal was dropped into
        const overDeal = boardData?.stages?.flatMap(s => s.deals).find(d => d._id === over.id);
        const targetStageId = overDeal
            ? boardData.stages.find(s => s.deals.some(d => d._id === over.id))?._id?.toString()
            : null;

        // If dropped on a different deal in the same stage, ignore
        if (!targetStageId || targetStageId === deal.stageId) {
            // Check if it was dropped on a column header or empty area
            // Try to find stage from over.id matching a stage _id
            const directStage = boardData?.stages?.find(s => s._id.toString() === over.id);
            if (directStage && directStage._id.toString() !== deal.stageId) {
                try {
                    await salesService.updateDealStage(dealId, directStage._id.toString());
                    toast.success(`Moved to ${directStage.name}`);
                    loadBoard();
                } catch (err) {
                    toast.error('Failed to move deal');
                }
            }
            return;
        }

        if (targetStageId !== deal.stageId) {
            try {
                await salesService.updateDealStage(dealId, targetStageId);
                const stageName = boardData.stages.find(s => s._id.toString() === targetStageId)?.name;
                toast.success(`Moved to ${stageName}`);
                loadBoard();
            } catch (err) {
                toast.error('Failed to move deal');
            }
        }
    };

    const handleDragOver = (event) => {
        // We handle the reordering in handleDragEnd
    };

    const handleCreateDeal = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error('Deal title is required');

        try {
            await salesService.createDeal({
                ...form,
                value: parseFloat(form.value) || 0,
                pipelineId: selectedPipeline,
                stageId: createStage?._id?.toString() || boardData?.stages?.[0]?._id?.toString(),
            });
            toast.success('Deal created');
            setShowCreate(false);
            setForm({ title: '', customerId: '', value: '', expectedCloseDate: '', source: 'Other', notes: '' });
            setCustomerSearch('');
            loadBoard();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create deal');
        }
    };

    const handleDealClick = (deal) => {
        navigate(`/sales/deals/${deal._id}`);
    };

    const openCreateModal = (stage) => {
        setCreateStage(stage);
        setForm({ title: '', customerId: '', value: '', expectedCloseDate: '', source: 'Other', notes: '' });
        setCustomerSearch('');
        setShowCreate(true);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
                        <MdViewKanban size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Deal Board</h1>
                        <p className="text-xs text-slate-500">Drag deals between stages</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Pipeline Selector */}
                    <select
                        value={selectedPipeline}
                        onChange={(e) => setSelectedPipeline(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        {pipelines.map(p => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Owner Filter */}
                    <select
                        value={filterOwner}
                        onChange={(e) => setFilterOwner(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        <option value="">All Owners</option>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => openCreateModal(null)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-1.5"
                    >
                        <MdAdd size={18} /> New Deal
                    </button>
                </div>
            </div>

            {/* Board */}
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : boardData ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                >
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {boardData.stages.map(stage => (
                            <StageColumn
                                key={stage._id}
                                stage={stage}
                                onDealClick={handleDealClick}
                                onAddDeal={openCreateModal}
                            />
                        ))}
                    </div>
                    <DragOverlay>
                        {activeDeal ? (
                            <div className="bg-white rounded-xl border-2 border-indigo-500 p-4 shadow-2xl w-72 rotate-2">
                                <h4 className="font-bold text-slate-900 text-sm">{activeDeal.title}</h4>
                                <p className="text-sm font-black text-indigo-600 mt-2">{formatCurrency(activeDeal.value)}</p>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            ) : (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg font-bold">No pipeline selected</p>
                </div>
            )}

            {/* Create Deal Modal */}
            <Modal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                title="New Deal"
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleCreateDeal} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deal Title *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="e.g. ABC Ltd - Enterprise License"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative" ref={customerAnchorRef}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer</label>
                            <input
                                type="text"
                                value={customerDropdownOpen ? customerSearch : (customers.find(c => c._id === form.customerId)?.companyName || customers.find(c => c._id === form.customerId)?.customerName || '')}
                                onFocus={() => {
                                    setCustomerDropdownOpen(true);
                                    const currentName = customers.find(c => c._id === form.customerId)?.companyName || customers.find(c => c._id === form.customerId)?.customerName || '';
                                    setCustomerSearch(currentName);
                                }}
                                onBlur={() => {
                                    setTimeout(() => {
                                        setCustomerDropdownOpen(false);
                                    }, 200);
                                }}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                }}
                                placeholder="Search & Select Customer..."
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                            />
                            <PortalDropdown isOpen={customerDropdownOpen} anchorRef={customerAnchorRef}>
                                <ul className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-50 overflow-hidden">
                                    {customers
                                        .filter(c => {
                                            const query = customerSearch.toLowerCase();
                                            return (
                                                c.companyName?.toLowerCase().includes(query) ||
                                                c.customerName?.toLowerCase().includes(query)
                                            );
                                        })
                                        .map(c => (
                                            <li
                                                key={c._id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setForm(prev => ({ ...prev, customerId: c._id }));
                                                    setCustomerSearch(c.companyName || c.customerName);
                                                    setCustomerDropdownOpen(false);
                                                }}
                                                className="px-5 py-3.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm font-bold text-slate-700 transition-colors"
                                            >
                                                <div className="font-bold text-slate-900 text-sm">{c.companyName || c.customerName}</div>
                                                {(c.companyName && c.customerName) && (
                                                    <div className="text-[10px] text-slate-500 font-semibold">{c.customerName}</div>
                                                )}
                                            </li>
                                        ))}
                                    {customers.filter(c => {
                                        const query = customerSearch.toLowerCase();
                                        return (
                                            c.companyName?.toLowerCase().includes(query) ||
                                            c.customerName?.toLowerCase().includes(query)
                                        );
                                    }).length === 0 && (
                                        <li className="px-5 py-4 text-center text-sm text-slate-400 font-semibold">
                                            No customers found
                                        </li>
                                    )}
                                </ul>
                            </PortalDropdown>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deal Value (₹)</label>
                            <input
                                type="number"
                                value={form.value}
                                onChange={e => setForm({ ...form, value: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expected Close</label>
                            <input
                                type="date"
                                value={form.expectedCloseDate}
                                onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source</label>
                            <SearchableSelect
                                options={sources.map(s => ({ value: s.name, label: s.name, id: s._id }))}
                                value={form.source}
                                onChange={val => setForm({ ...form, source: val })}
                                placeholder="Select Source"
                                onAddOption={handleAddSource}
                                onDeleteOption={handleDeleteSource}
                            />
                        </div>
                    </div>
                    {createStage && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: createStage.color }} />
                            Stage: <span className="font-bold text-slate-700">{createStage.name}</span> ({createStage.probability}%)
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25"
                        >
                            Create Deal
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DealBoard;
