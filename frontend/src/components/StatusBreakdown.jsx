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
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 font-black text-slate-700 text-xs min-w-[120px]">Segment</th>
                        {statuses.map((status) => (
                            <th key={status} className="px-4 py-3 font-black text-slate-700 text-right text-xs min-w-[100px]">
                                {status}
                            </th>
                        ))}
                        <th className="px-4 py-3 font-black text-slate-900 text-right text-xs min-w-[100px] bg-slate-100">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {segments.map((segment) => {
                        const segmentData = breakdown[segment];
                        if (!segmentData) return null;

                        return (
                            <tr key={segment} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900 text-sm">
                                    {segment}
                                </td>
                                {statuses.map((status) => {
                                    const statusData = segmentData[status];
                                    return (
                                        <td key={status} className="px-4 py-3 text-right font-semibold text-slate-700">
                                            {formatToIndian(statusData?.total || 0, 2)}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-right font-black text-slate-900 bg-slate-50/50">
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
