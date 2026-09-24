import React from 'react';
import { hasChildren, levelStyle, formatCurrency } from './bomUi';

const fmtQty = (value) => (value === null || value === undefined || value === '' ? '-' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 4 }));

// Display-only multi-level component list. Deliberately has no edit/delete controls.
const BOMComponentsTable = ({ components = [], showCost = true, compact = false }) => {
    const cell = compact ? 'px-2 py-1.5' : 'px-3 py-2';

    if (!components.length) {
        return <p className="p-6 text-center text-sm font-medium text-slate-400">This BOM has no components.</p>;
    }

    const headers = ['Level', 'Component Code', 'Description', 'Type', 'Qty', 'UOM', 'Scrap %', 'Total Qty', 'Operation', 'Mandatory',
        ...(showCost ? ['Rate', 'Amount'] : []), 'Remarks'];

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead>
                    <tr>
                        {headers.map((label) => (
                            <th key={label} className={`${cell} border border-[#d7dee7] bg-[#eaf2f9] text-[11px] font-bold uppercase text-[#244c6c] whitespace-nowrap`}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {components.map((component, index) => {
                        const style = levelStyle(component.level);
                        const parent = hasChildren(components, index);
                        return (
                            <tr key={component._id || index} className={style.row}>
                                <td className={`${cell} border border-[#d7dee7] text-center`}>
                                    <span className={`inline-block min-w-[2rem] rounded px-1.5 py-0.5 text-xs font-bold ${style.badge}`}>L{component.level}</span>
                                </td>
                                <td className={`${cell} border border-[#d7dee7] whitespace-nowrap`}>
                                    <div className={`border-l-4 ${style.border} pl-2 font-semibold text-slate-800`} style={{ marginLeft: `${(Number(component.level) - 1) * 18}px` }}>
                                        {component.componentCode}
                                    </div>
                                </td>
                                <td className={`${cell} border border-[#d7dee7] ${parent ? 'font-semibold' : ''}`}>{component.description || '-'}</td>
                                <td className={`${cell} border border-[#d7dee7] whitespace-nowrap`}>{component.componentType}</td>
                                <td className={`${cell} border border-[#d7dee7] text-right`}>{fmtQty(component.qty)}</td>
                                <td className={`${cell} border border-[#d7dee7]`}>{component.uom || '-'}</td>
                                <td className={`${cell} border border-[#d7dee7] text-right`}>{fmtQty(component.scrapPercent)}</td>
                                <td className={`${cell} border border-[#d7dee7] text-right`}>{fmtQty(component.totalQty)}</td>
                                <td className={`${cell} border border-[#d7dee7]`}>{component.operationNo || '-'}</td>
                                <td className={`${cell} border border-[#d7dee7]`}>{component.mandatory === false ? 'No' : 'Yes'}</td>
                                {showCost && (
                                    <>
                                        <td className={`${cell} border border-[#d7dee7] text-right whitespace-nowrap`}>{parent ? '-' : formatCurrency(component.rate)}</td>
                                        <td className={`${cell} border border-[#d7dee7] text-right whitespace-nowrap`}>{parent ? <span className="text-xs text-slate-400">from children</span> : formatCurrency(component.amount)}</td>
                                    </>
                                )}
                                <td className={`${cell} border border-[#d7dee7] text-slate-600`}>{component.remarks || ''}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BOMComponentsTable;
