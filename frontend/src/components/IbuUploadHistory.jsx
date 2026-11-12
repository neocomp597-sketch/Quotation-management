import React, { useEffect, useState } from 'react';
import { MdSync } from 'react-icons/md';
import Modal from './Modal';
import { csmService } from '../services/api';

const IST = { timeZone: 'Asia/Kolkata' };
const dateTime = (value) => (value
    ? new Date(value).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-');
const timeOnly = (value) => (value ? new Date(value).toLocaleTimeString('en-IN', { ...IST, hour: '2-digit', minute: '2-digit' }) : '');
const dayLabel = (day) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

const Th = ({ children, right }) => (
    <th className={`px-3 py-2 font-black text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td = ({ children, right, strong }) => (
    <td className={`px-3 py-2 ${right ? 'text-right' : ''} ${strong ? 'font-black' : 'font-semibold'}`}>{children}</td>
);

/**
 * Upload History of Invoice Bulk Upload, for administrators: who added serial numbers, when and
 * to which branch, in every branch (GET /csm/assets/upload-history). Excel uploads of the last 30
 * days with their file, and entries added per day over the last 90 days (uploads and single entries).
 */
const IbuUploadHistory = ({ isOpen, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await csmService.getUploadHistory();
            setData(res.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load the upload history.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload History" maxWidth="max-w-5xl">
            <div className="space-y-6 text-xs text-slate-700 dark:text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-slate-500 dark:text-slate-400 font-semibold">
                        Who added Invoice Bulk Upload data, when and to which branch, in every branch. Times are Indian time.
                    </p>
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                        <MdSync size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {error && <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">{error}</p>}
                {loading && !data && <p className="text-slate-400 font-semibold">Loading...</p>}

                {data && (
                    <>
                        <section className="space-y-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                Excel uploads <span className="font-semibold text-slate-400">(last {data.jobRetentionDays} days)</span>
                            </h4>
                            {data.uploads.length ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-800">
                                            <tr><Th>When</Th><Th>Uploaded by</Th><Th>Branch</Th><Th>File</Th><Th right>Added</Th><Th right>Updated</Th><Th right>Failed</Th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {data.uploads.map((row, index) => (
                                                <tr key={`${row.at}-${index}`}>
                                                    <Td>{dateTime(row.at)}</Td>
                                                    <Td strong>{row.by || '-'}</Td>
                                                    <Td>{row.branch || '-'}</Td>
                                                    <Td><span className="break-all">{row.file || '-'}</span></Td>
                                                    <Td right strong>{row.created}</Td>
                                                    <Td right>{row.updated}</Td>
                                                    <Td right>{row.failed ? <span className="text-rose-600 font-black">{row.failed}</span> : 0}</Td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-slate-400 font-semibold">No Excel uploads in the last {data.jobRetentionDays} days.</p>
                            )}
                        </section>

                        <section className="space-y-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                Serial numbers added per day <span className="font-semibold text-slate-400">(last {data.days} days, uploads and single entries)</span>
                            </h4>
                            {data.daily.length ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-800">
                                            <tr><Th>Day</Th><Th>Added by</Th><Th>Branch</Th><Th>How</Th><Th right>Serials</Th><Th>Between</Th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {data.daily.map((row, index) => (
                                                <tr key={`${row.day}-${index}`}>
                                                    <Td>{dayLabel(row.day)}</Td>
                                                    <Td strong>{row.by || 'Unknown'}</Td>
                                                    <Td>{row.branch || '-'}</Td>
                                                    <Td>{row.how}</Td>
                                                    <Td right strong>{row.entries}</Td>
                                                    <Td>{timeOnly(row.first) === timeOnly(row.last) ? timeOnly(row.first) : `${timeOnly(row.first)} - ${timeOnly(row.last)}`}</Td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-slate-400 font-semibold">No serial numbers added in the last {data.days} days.</p>
                            )}
                        </section>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default IbuUploadHistory;
