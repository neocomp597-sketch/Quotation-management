import React from 'react';
import { MdDownload } from 'react-icons/md';
import { formatToIndian } from '../utils/formatters';
import * as XLSX from 'xlsx';

const StatusBreakdown = ({ data, financialYear }) => {
    if (!data || !data.segmentWiseBreakdown) {
        return (
            <div className="p-10 text-center text-slate-400 font-bold">
                No status breakdown data available. Add planning entries to generate.
            </div>
        );
    }

    const breakdown = data.segmentWiseBreakdown;
    const segments = ['Utility', 'UC', 'Industry'];
    const statuses = data.statusColumns || ['Firm', 'Invoice', 'B & B', 'MFC', 'Others'];
    const monthYear = data.monthYear;

    const exportStatusBreakdown = () => {
        const workbook = XLSX.utils.book_new();
        const wsData = [
            ['Status Breakdown - Segment Wise', `FY ${financialYear}`],
            [],
            ['Segment', ...statuses, 'Total']
        ];

        if (monthYear) {
            wsData.push([monthYear]);
        }

        segments.forEach((segment) => {
            const segmentData = breakdown[segment];
            if (!segmentData) return;

            const row = [segment];
            statuses.forEach((status) => {
                const statusData = segmentData[status];
                row.push(statusData?.total || 0);
            });
            row.push(segmentData?.total || 0);
            wsData.push(row);
        });

        const sheet = XLSX.utils.aoa_to_sheet(wsData);
        sheet['!cols'] = [{ wch: 15 }, ...statuses.map(() => ({ wch: 12 })), { wch: 10 }];
        XLSX.utils.book_append_sheet(workbook, sheet, 'Status Breakdown');
        XLSX.writeFile(workbook, `Status-Breakdown-${monthYear || financialYear}.xlsx`);
    };

    return (
        <div className="overflow-x-auto rounded-2xl border border-indigo-100 shadow-sm bg-white">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
                        <th className="px-4 py-3 font-black text-indigo-900 text-xs min-w-[120px] uppercase tracking-wider">Segment</th>
                        {statuses.map((status) => (
                            <th key={status} className="px-4 py-3 font-black text-indigo-900 text-right text-xs min-w-[100px] uppercase tracking-wider">
                                {status}
                            </th>
                        ))}
                        <th className="px-4 py-3 font-black text-indigo-950 text-right text-xs min-w-[100px] bg-indigo-100/50 uppercase tracking-wider">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/50">
                    {segments.map((segment) => {
                        const segmentData = breakdown[segment];
                        if (!segmentData) return null;

                        return (
                            <tr key={segment} className="hover:bg-indigo-50/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800 text-sm">
                                    {segment}
                                </td>
                                {statuses.map((status) => {
                                    const statusData = segmentData[status];
                                    return (
                                        <td key={status} className="px-4 py-3 text-right font-semibold text-slate-600">
                                            {formatToIndian(statusData?.total || 0, 2)}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-right font-black text-indigo-900 bg-indigo-50/30">
                                    {formatToIndian(segmentData?.total || 0, 2)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default StatusBreakdown;
