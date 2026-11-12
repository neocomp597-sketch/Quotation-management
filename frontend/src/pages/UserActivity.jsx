import React, { useState, useEffect } from 'react';
import { MdSearch, MdArrowUpward, MdArrowDownward, MdFileDownload, MdPictureAsPdf } from 'react-icons/md';
import { toast } from 'react-toastify';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PaginationControls from '../components/PaginationControls';
import { plural, saveBlob } from '../components/import/importHelpers';
import { formatDateTime } from '../utils/helpers';

const LIST_PAGE_SIZE = 20;
// The most one list request returns
const MAX_LIST_PAGE_SIZE = 200;
const NO_USERS_MESSAGE = 'No users to download for this search.';
const CHANGE_NOTE = "Every change is recorded from this screen's release onward. For earlier changes, only password, permission, MGR access and branch access changes are known. Signing in and switching branch do not count as changes.";

const COLUMN_CLASS = 'p-3 md:p-4 text-xs font-black text-slate-400 uppercase tracking-widest md:whitespace-nowrap';
// On a phone the row is the user and the two dates; the rest needs sideways scrolling to fit.
const DESKTOP_ONLY = 'hidden md:table-cell';

const SortHeader = ({ field, sort, onSort, children }) => (
    <th className={COLUMN_CLASS} aria-sort={sort.sortBy === field ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 text-left uppercase tracking-widest font-black hover:text-slate-600">
            {children}
            {sort.sortBy === field && (sort.order === 'asc' ? <MdArrowUpward size={14} /> : <MdArrowDownward size={14} />)}
        </button>
    </th>
);

// Every user matching the filters, not just the page on screen.
const loadAllUsers = async (filters) => {
    const users = [];
    let page = 1;
    let pages = 1;
    do {
        const { data } = await userService.getActivity({ ...filters, page, limit: MAX_LIST_PAGE_SIZE });
        users.push(...(data.data || []));
        pages = data.pagination?.pages || 1;
        page += 1;
    } while (page <= pages);
    return users;
};

const UserActivity = () => {
    const { activeBranch } = useAuth();
    const [downloading, setDownloading] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState({ sortBy: 'modifiedAt', order: 'desc' });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        userService.getActivity({ ...sort, page, limit: LIST_PAGE_SIZE, ...(debouncedSearch && { search: debouncedSearch }) })
            .then((res) => {
                if (ignore) return;
                setUsers(res.data.data || []);
                setPagination(res.data.pagination);
            })
            .catch((err) => {
                if (ignore) return;
                console.error('Error fetching user activity:', err);
                toast.error('Failed to load user activity');
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => { ignore = true; };
    }, [sort, page, debouncedSearch]);

    const toggleSort = (sortBy) => {
        setSort((current) => ({
            sortBy,
            order: current.sortBy === sortBy && current.order === 'desc' ? 'asc' : 'desc',
        }));
        setPage(1);
    };

    // The file follows the search box and sort as they are now, whichever page is on screen.
    const download = async (format, run) => {
        const term = search.trim();
        setDownloading(format);
        try {
            await run({ ...sort, ...(term && { search: term }) });
        } catch (err) {
            console.error(`Error downloading user activity ${format}:`, err);
            toast.error(`Failed to download the ${format} file`);
        } finally {
            setDownloading('');
        }
    };

    const downloadExcel = () => download('Excel', async (filters) => {
        const res = await userService.exportActivity(filters);
        const count = Number(res.headers?.['x-total-count']);
        if (count === 0) {
            toast.info(NO_USERS_MESSAGE);
            return;
        }
        const fileName = /filename="([^"]+)"/.exec(res.headers?.['content-disposition'] || '')?.[1] || 'User_Activity.xlsx';
        saveBlob(res.data, fileName);
        toast.success(`${fileName} downloaded${count ? ` (${plural(count, 'user', 'users')})` : ''}`);
    });

    const downloadPdf = () => download('PDF', async (filters) => {
        const allUsers = await loadAllUsers(filters);
        if (allUsers.length === 0) {
            toast.info(NO_USERS_MESSAGE);
            return;
        }
        const { buildUserActivityPdf } = await import('../utils/userActivityPdf');
        const doc = await buildUserActivityPdf({
            users: allUsers,
            branch: activeBranch?.name,
            search: filters.search,
            sort,
            note: CHANGE_NOTE,
        });
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
        const fileName = `User_Activity_${today}.pdf`;
        doc.save(fileName);
        toast.success(`${fileName} downloaded (${plural(allUsers.length, 'user', 'users')})`);
    });

    const downloadDisabled = Boolean(downloading) || pagination.total === 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">User Activity</h1>
                    <p className="text-slate-500 font-medium">When each user of the selected branch was created and last modified.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={downloadExcel}
                        disabled={downloadDisabled}
                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md shadow-teal-600/10"
                    >
                        <MdFileDownload size={18} /> {downloading === 'Excel' ? 'Preparing...' : 'Download Excel'}
                    </button>
                    <button
                        type="button"
                        onClick={downloadPdf}
                        disabled={downloadDisabled}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md shadow-rose-600/10"
                    >
                        <MdPictureAsPdf size={18} /> {downloading === 'PDF' ? 'Preparing...' : 'Download PDF'}
                    </button>
                </div>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                    </div>

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
                                        <tr className="bg-slate-50 rounded-xl">
                                            <SortHeader field="name" sort={sort} onSort={toggleSort}>User</SortHeader>
                                            <th className={`${COLUMN_CLASS} ${DESKTOP_ONLY}`}>Role</th>
                                            <th className={`${COLUMN_CLASS} ${DESKTOP_ONLY}`}>Branch</th>
                                            <th className={`${COLUMN_CLASS} ${DESKTOP_ONLY}`}>Status</th>
                                            <SortHeader field="createdAt" sort={sort} onSort={toggleSort}>Created On</SortHeader>
                                            <SortHeader field="modifiedAt" sort={sort} onSort={toggleSort}>Last Modified</SortHeader>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 md:p-4">
                                                    <div className="text-sm font-bold text-slate-800">{user.name}</div>
                                                    <div className="text-xs font-medium text-slate-500 break-all">{user.email}</div>
                                                </td>
                                                <td className={`p-4 text-sm font-medium text-slate-600 capitalize ${DESKTOP_ONLY}`}>{user.role}</td>
                                                <td className={`p-4 text-sm font-medium text-slate-600 ${DESKTOP_ONLY}`}>{user.branch || '-'}</td>
                                                <td className={`p-4 ${DESKTOP_ONLY}`}>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${user.isActive
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200'
                                                    }`}>
                                                        {user.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="p-3 md:p-4 text-sm font-medium text-slate-600 md:whitespace-nowrap">{formatDateTime(user.createdAt)}</td>
                                                <td className="p-3 md:p-4 text-sm font-medium text-slate-600 md:whitespace-nowrap">{formatDateTime(user.modifiedAt, 'No change recorded')}</td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="py-16 text-center text-sm font-medium text-slate-400">No users found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={pagination} onPageChange={setPage} />
                            <p className="text-xs font-medium text-slate-400">{CHANGE_NOTE}</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserActivity;
