import React, { useState } from 'react';
import { MdDownload, MdKeyboardArrowDown } from 'react-icons/md';
import { formatToIndian } from '../utils/formatters';
import * as XLSX from 'xlsx';

const SegmentWise = ({ data, financialYear }) => {
    const [expandedMonths, setExpandedMonths] = useState({});
    const [expandedSegments, setExpandedSegments] = useState({});

    if (!data || !data.segmentWiseBreakdown) {
        return (
            <div className="p-10 text-center text-slate-400 font-bold">
                No segment-wise data available. Add planning entries to view the breakdown.
            </div>
        );
    }

    const segments = ['Utility', 'UC', 'Industry'];
    const statuses = data.statusColumns || [];
    const sbuCodes = data.mgrCodes || [];
    const breakdown = data.segmentWiseBreakdown;

    const toggleMonth = (month) => {
        setExpandedMonths((prev) => ({
            ...prev,
            [month]: !prev[month]
        }));
    };

    const toggleSegment = (segmentKey) => {
        setExpandedSegments((prev) => ({
            ...prev,
            [segmentKey]: !prev[segmentKey]
        }));
    };

    const exportSegmentBreakdown = () => {
        const workbook = XLSX.utils.book_new();
        const wsData = [
            ['Segment Wise Status Breakdown', data.monthYear || `FY ${financialYear}`],
            [],
            ['Particulars', ...sbuCodes, 'Total']
        ];

        // Add data for each segment
        const monthYear = data.monthYear;
        if (monthYear) {
            wsData.push([monthYear]);

            segments.forEach((segment) => {
                const segmentData = breakdown[segment];
                if (!segmentData) return;

                wsData.push([segment]);

                statuses.forEach((status) => {
                    const statusData = segmentData[status];
                    const sbuSplit = statusData?.sbuSplit || {};

                    wsData.push([
                        `  ${status}`,
                        ...sbuCodes.map((sbu) => sbuSplit[sbu] || 0),
                        statusData?.total || 0
                    ]);
                });
            });

            const totalData = breakdown.Total;
            wsData.push([
                'TOTAL',
                ...sbuCodes.map((sbu) => totalData?.segmentSplit?.[sbu] || 0),
                totalData?.total || 0
            ]);
        }

        const sheet = XLSX.utils.aoa_to_sheet(wsData);
        sheet['!cols'] = [{ wch: 25 }, ...sbuCodes.map(() => ({ wch: 15 })), { wch: 15 }];

        XLSX.utils.book_append_sheet(workbook, sheet, 'Segment Wise');
        XLSX.writeFile(workbook, `Segment-Wise-Breakdown-${monthYear || financialYear}.xlsx`);
    };

    const monthYear = data.monthYear;

    if (!monthYear) {
        return (
            <div className="p-10 text-center text-slate-400 font-bold">
                Select a month to view segment-wise status breakdown details.
            </div>
        );
    }

    return (
        <div className="space-y-0 rounded-2xl border border-slate-100 overflow-hidden bg-white">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Segment Wise Status Breakdown</h3>
                    <p className="text-xs font-bold text-slate-600 mt-1">{monthYear}</p>
                </div>
                <button
                    onClick={exportSegmentBreakdown}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                >
                    <MdDownload size={16} />
                    Export
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3 font-black text-slate-700 text-xs min-w-[200px]">Particulars</th>
                            {sbuCodes.map((sbu) => (
                                <th key={sbu} className="px-4 py-3 font-black text-slate-700 text-right text-xs min-w-[100px]">
                                    {sbu}
                                </th>
                            ))}
                            <th className="px-4 py-3 font-black text-slate-900 text-right text-xs bg-slate-100 min-w-[100px]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* Month Row */}
                        <tr className="bg-blue-50 hover:bg-blue-100/50 transition-colors border-b-2 border-slate-200">
                            <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                <MdKeyboardArrowDown
                                    size={20}
                                    className={`text-blue-600 transition-transform duration-300 ${!expandedMonths[monthYear] ? '-rotate-90' : ''}`}
                                />
                                {monthYear}
                            </td>
                            {sbuCodes.map((sbu) => (
                                <td key={sbu} className="px-4 py-4 text-right font-bold text-slate-900">
                                    {formatToIndian(
                                        segments.reduce((sum, seg) => {
                                            const segData = breakdown[seg];
                                            return sum + (statuses.reduce((statusSum, status) => {
                                                return statusSum + (segData?.[status]?.sbuSplit?.[sbu] || 0);
                                            }, 0));
                                        }, 0),
                                        2
                                    )}
                                </td>
                            ))}
                            <td className="px-4 py-4 text-right font-black text-slate-900 bg-slate-50">
                                {formatToIndian(breakdown.Total?.total || 0, 2)}
                            </td>
                        </tr>

                        {/* Segments */}
                        {expandedMonths[monthYear] && segments.map((segment) => {
                            const segmentData = breakdown[segment];
                            if (!segmentData) return null;

                            const segmentKey = `${monthYear}_${segment}`;
                            const isSegmentExpanded = expandedSegments[segmentKey];
                            const segmentTotal = segmentData.total || 0;

                            return (
                                <React.Fragment key={segment}>
                                    {/* Segment Row */}
                                    <tr className="bg-slate-50 hover:bg-slate-100/50 transition-colors">
                                        <td
                                            onClick={() => toggleSegment(segmentKey)}
                                            className="px-6 py-3 font-bold text-slate-700 flex items-center gap-2 cursor-pointer"
                                        >
                                            <MdKeyboardArrowDown
                                                size={20}
                                                className={`text-slate-500 transition-transform duration-300 ${!isSegmentExpanded ? '-rotate-90' : ''}`}
                                            />
                                            <span className="pl-2">{segment}</span>
                                        </td>
                                        {sbuCodes.map((sbu) => (
                                            <td key={sbu} className="px-4 py-3 text-right font-bold text-slate-700">
                                                {formatToIndian(
                                                    statuses.reduce((sum, status) => {
                                                        return sum + (segmentData[status]?.sbuSplit?.[sbu] || 0);
                                                    }, 0),
                                                    2
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-100/60">
                                            {formatToIndian(segmentTotal, 2)}
                                        </td>
                                    </tr>

                                    {/* Status Rows */}
                                    {isSegmentExpanded && statuses.map((status) => {
                                        const statusData = segmentData[status];
                                        const sbuSplit = statusData?.sbuSplit || {};

                                        return (
                                            <tr key={status} className="bg-white hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3 pl-20 font-semibold text-slate-600 text-sm">{status}</td>
                                                {sbuCodes.map((sbu) => (
                                                    <td key={sbu} className="px-4 py-3 text-right text-slate-700 font-semibold">
                                                        {formatToIndian(sbuSplit[sbu] || 0, 2)}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-right text-slate-900 font-bold bg-slate-50/50">
                                                    {formatToIndian(statusData?.total || 0, 2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}

                        {/* Total Row */}
                        <tr className="bg-amber-50 border-t-2 border-t-amber-200">
                            <td className="px-6 py-4 font-black text-slate-900 uppercase">Total</td>
                            {sbuCodes.map((sbu) => (
                                <td key={sbu} className="px-4 py-4 text-right font-black text-slate-900">
                                    {formatToIndian(breakdown.Total?.segmentSplit?.[sbu] || 0, 2)}
                                </td>
                            ))}
                            <td className="px-4 py-4 text-right font-black text-slate-900 bg-amber-100">
                                {formatToIndian(breakdown.Total?.total || 0, 2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SegmentWise;

