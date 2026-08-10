import React, { useState, useEffect } from 'react';
import { developerService } from '../../../services/api';
import { toast } from 'react-toastify';
import { MdListAlt, MdRefresh } from 'react-icons/md';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const fetchLogs = async (pageNum = 1) => {
        try {
            setLoading(true);
            const res = await developerService.getLogs({ page: pageNum, limit: 25 });
            setLogs(res.data?.data || []);
            setPagination(res.data?.pagination || null);
        } catch (error) {
            console.error('Failed to load API request logs:', error);
            toast.error('Failed to load API request logs');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <MdListAlt className="text-[#006c49]" size={26} />
                        API Request Activity Logs
                    </h1>
                    <p className="text-slate-500 text-xs font-medium mt-1">
                        Real-time audit log of external API traffic for your company.
                    </p>
                </div>
                <button
                    onClick={() => fetchLogs(page)}
                    className="p-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-all border border-slate-200/80 shadow-sm"
                    title="Refresh logs"
                >
                    <MdRefresh size={18} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        Loading Request Logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium text-xs">
                        No API request logs recorded yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-mono text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500">
                                    <th className="py-4 px-6">Timestamp</th>
                                    <th className="py-4 px-6">Request ID</th>
                                    <th className="py-4 px-6">Key Name</th>
                                    <th className="py-4 px-6">Method</th>
                                    <th className="py-4 px-6">Endpoint</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Latency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-4 px-6 text-slate-500 font-sans">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="py-4 px-6 text-[#006c49] font-bold">
                                            {log.requestId}
                                        </td>
                                        <td className="py-4 px-6 text-slate-900 font-sans font-bold">
                                            {log.keyName}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-black text-[10px] text-[#006c49] uppercase">
                                                {log.method}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-700 font-semibold">
                                            {log.endpoint}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                                log.statusCode >= 200 && log.statusCode < 300 
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                            }`}>
                                                {log.statusCode}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500">
                                            {log.responseTimeMs} ms
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-sans font-bold">
                        <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)</span>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(prev => prev - 1)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= pagination.totalPages}
                                onClick={() => setPage(prev => prev + 1)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Logs;
