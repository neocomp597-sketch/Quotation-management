import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdSearch } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PaginationControls from '../components/PaginationControls';
import { BOMBanner, BOMButton, StatusBadge } from '../components/bom/BOMLayout';
import { STAGE_LABELS, apiErrorMessage, formatCurrency, formatDate } from '../components/bom/bomUi';

const LIST_PAGE_SIZE = 20;
const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending My Approval' },
    { key: 'Draft', label: 'Draft' },
    { key: 'Revision Required', label: 'Revision Required' },
    { key: 'review', label: 'In Approval' },
    { key: 'Active', label: 'Active' },
    { key: 'Obsolete', label: 'Obsolete' }
];

const tabParams = (tab) => {
    if (tab === 'all') return {};
    if (tab === 'pending') return { pendingMine: 'true' };
    if (tab === 'review') return { status: 'Submitted,Under Review' };
    return { status: tab };
};

const BOMList = () => {
    const navigate = useNavigate();
    const { hasAccess } = useAuth();
    const [tab, setTab] = useState('all');
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Loading whenever the rows on screen belong to a different request.
    const requestKey = `${tab}|${page}|${debouncedSearch}`;
    const [loadedKey, setLoadedKey] = useState(null);
    const loading = loadedKey !== requestKey;

    useEffect(() => {
        let cancelled = false;
        const params = { page, limit: LIST_PAGE_SIZE, search: debouncedSearch || undefined, ...tabParams(tab) };
        bomService.getAll(params)
            .then((res) => {
                if (cancelled) return;
                setRows(res.data.data || []);
                setPagination(res.data.pagination);
            })
            .catch((err) => { if (!cancelled) toast.error(apiErrorMessage(err, 'Failed to load BOMs')); })
            .finally(() => { if (!cancelled) setLoadedKey(requestKey); });
        return () => { cancelled = true; };
    }, [tab, page, debouncedSearch, requestKey]);

    const offset = (pagination.page - 1) * pagination.limit;

    return (
        <div className="mx-auto max-w-[1450px] text-[#263238]">
            <BOMBanner title="BOM Master" subtitle="Multi-level Bills of Materials for Finished Goods, with approval and revision control.">
                {hasAccess('bom_create') && (
                    <BOMButton variant="light" onClick={() => navigate('/bom-master/new')}><MdAdd className="-mt-0.5 mr-1 inline" size={18} />New BOM</BOMButton>
                )}
            </BOMBanner>

            <div className="rounded-b-xl border-x border-b border-[#d7dee7] bg-white">
                <div className="flex flex-col gap-3 border-b border-[#eef5fb] p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {TABS.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => { setTab(item.key); setPage(1); }}
                                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === item.key ? 'bg-[#1f4e78] text-white' : 'bg-[#e9eef3] text-[#263238] hover:bg-[#dde5ec]'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-80">
                        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search BOM no., FG code or description"
                            className="w-full rounded-md border border-[#c9d2dc] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#1f4e78]"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto p-4">
                    {loading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1f4e78] border-t-transparent"></div>
                        </div>
                    ) : (
                        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                            <thead>
                                <tr>
                                    {['Sr', 'BOM No.', 'Rev', 'FG Material', 'Plant', 'Status', 'Effective From', 'Est. Cost', 'Prepared By', 'Updated'].map((label) => (
                                        <th key={label} className="whitespace-nowrap border border-[#d7dee7] bg-[#eaf2f9] px-3 py-2 text-[11px] font-bold uppercase text-[#244c6c]">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((bom, index) => (
                                    <tr key={bom._id} onClick={() => navigate(`/bom-master/${bom._id}`)} className="cursor-pointer hover:bg-[#f7f9fb]">
                                        <td className="border border-[#d7dee7] px-3 py-2 text-slate-500">{offset + index + 1}</td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-3 py-2 font-semibold text-[#1f4e78]">{bom.bomNumber}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{bom.revision}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">
                                            <span className="font-semibold">{bom.fgItemCode}</span>
                                            <span className="block text-xs text-slate-500">{bom.fgDescription}</span>
                                        </td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{bom.plantName}{bom.alternativeBom ? ` (Alt ${bom.alternativeBom})` : ''}</td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-3 py-2">
                                            <StatusBadge status={bom.status} />
                                            {bom.currentStage && <span className="mt-1 block text-[11px] text-slate-500">Waiting: {STAGE_LABELS[bom.currentStage]}</span>}
                                        </td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-3 py-2">{formatDate(bom.effectiveFrom)}</td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-3 py-2 text-right">{formatCurrency(bom.cost?.total)}</td>
                                        <td className="border border-[#d7dee7] px-3 py-2">{bom.preparedByName}</td>
                                        <td className="whitespace-nowrap border border-[#d7dee7] px-3 py-2">{formatDate(bom.updatedAt)}</td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="border border-[#d7dee7] px-3 py-10 text-center text-slate-400">
                                            {tab === 'pending' ? 'Nothing is waiting for your approval.' : debouncedSearch ? 'No BOMs match your search.' : 'No BOMs yet. Click New BOM to create one.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                    <PaginationControls pagination={pagination} onPageChange={setPage} />
                </div>
            </div>
        </div>
    );
};

export default BOMList;
