import React from 'react';

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const MgrCell = ({ mgr }) => (
    mgr
        ? <span title={mgr.code}>{mgr.description || mgr.code}</span>
        : <span className="text-slate-300">-</span>
);

// Display-only list of BOM components. Deliberately has no edit/delete controls.
const BOMComponentsTable = ({ items = [], compact = false }) => {
    const cell = compact ? 'px-3 py-2' : 'p-4';

    if (!items.length) {
        return <p className="p-6 text-center text-sm font-medium text-slate-400">This BOM has no components.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50">
                        {['#', 'Item Code', 'Description', 'Qty', 'Batch', 'Serial No', 'Remarks', 'MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'].map((label) => (
                            <th key={label} className={`${cell} text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap`}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item._id} className="border-b last:border-0 border-slate-50 text-sm">
                            <td className={`${cell} text-slate-400 font-bold`}>{item.lineNo || index + 1}</td>
                            <td className={`${cell} font-bold text-slate-800 whitespace-nowrap`}>{item.itemCode}</td>
                            <td className={`${cell} text-slate-600 min-w-[12rem]`}>
                                {item.itemDescription || '-'}
                                {!item.inProductMaster && (
                                    <span
                                        className="ml-2 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600"
                                        title="Item code not found in Product Master; showing the entered description"
                                    >
                                        Not in master
                                    </span>
                                )}
                            </td>
                            <td className={`${cell} font-bold text-slate-700`}>{item.qty}</td>
                            <td className={`${cell} text-slate-600 whitespace-nowrap`}>{item.batchNumber || '-'}</td>
                            <td className={`${cell} text-slate-600 whitespace-nowrap`}>{item.componentSerialNumber || '-'}</td>
                            <td className={`${cell} text-slate-500 min-w-[10rem]`}>{item.remarks || '-'}</td>
                            {MGR_KEYS.map((key) => (
                                <td key={key} className={`${cell} text-slate-600 whitespace-nowrap`}><MgrCell mgr={item[key]} /></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BOMComponentsTable;
