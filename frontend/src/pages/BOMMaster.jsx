import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdEdit, MdSearch, MdVisibility } from 'react-icons/md';
import { toast } from 'react-toastify';
import { bomService } from '../services/api';
import PaginationControls from '../components/PaginationControls';

const LIST_PAGE_SIZE = 20;

const BOMMaster = () => {
    const navigate = useNavigate();
    const [boms, setBoms] = useState([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // The list is loading whenever the rows on screen belong to a different request.
    const requestKey = `${page}|${debouncedSearch}`;
    const [loadedKey, setLoadedKey] = useState(null);
    const loading = loadedKey !== requestKey;

    useEffect(() => {
        let cancelled = false;
        bomService.getAll({ page, limit: LIST_PAGE_SIZE, search: debouncedSearch || undefined })
            .then((res) => {
                if (cancelled) return;
                setBoms(res.data?.data || []);
                setPagination(res.data?.pagination || { page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
            })
            .catch((err) => {
                if (!cancelled) toast.error(err.response?.data?.message || 'Failed to load BOMs');
            })
            .finally(() => {
                if (!cancelled) setLoadedKey(requestKey);
            });
        return () => { cancelled = true; };
    }, [page, debouncedSearch, requestKey]);

    const offset = (pagination.page - 1) * pagination.limit;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">BOM Master</h1>
                    <p className="text-slate-500 font-medium">Bill of materials for each finished-good serial number.</p>
                </div>
                <button
                    onClick={() => navigate('/bom-master/new')}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>New BOM</span>
                </button>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-4 border-b border-slate-100 bg-slate-50">
                    <div className="relative max-w-md">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search FG serial number or item code"
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium"
                        />
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            {['Sr No', 'FG Item Code', 'FG Serial Number', 'Components', 'Status', 'Last Updated'].map((label) => (
                                                <th key={label} className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</th>
                                            ))}
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boms.map((bom, index) => (
                                            <tr
                                                key={bom._id}
                                                onClick={() => navigate(`/bom-master/${bom._id}`)}
                                                className="cursor-pointer border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="p-4 text-sm font-bold text-slate-400">{offset + index + 1}</td>
                                                <td className="p-4 text-sm">
                                                    <span className="font-bold text-slate-800">{bom.fgItemCode}</span>
                                                    {bom.fgItemDescription && <span className="block text-xs text-slate-500">{bom.fgItemDescription}</span>}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-700">{bom.fgSerialNumber}</td>
                                                <td className="p-4 text-sm font-bold text-slate-700">{bom.componentCount}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${bom.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {bom.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                                    {bom.updatedAt ? new Date(bom.updatedAt).toLocaleDateString('en-IN') : '-'}
                                                </td>
                                                <td className="p-4 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/bom-master/${bom._id}`); }}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="View"
                                                    >
                                                        <MdVisibility size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/bom-master/${bom._id}/edit`); }}
                                                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {boms.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                    {debouncedSearch ? 'No BOMs match your search.' : 'No BOMs yet. Click New BOM to add one.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={pagination} onPageChange={setPage} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BOMMaster;
