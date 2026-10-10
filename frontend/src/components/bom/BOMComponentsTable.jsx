import React from 'react';

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const MgrCell = ({ mgr }) => (
    mgr
        ? <span title={mgr.code}>{mgr.description || mgr.code}</span>
        : <span className="text-slate-300">-</span>
);

// Display-only list of BOM components, in the BOM relationship sheet's columns
// (Item Code, Item Name, UOM, Quantity) followed by MGR1-MGR5 from Product Master.
// Deliberately has no edit/delete controls. With onOpen, a component that has a BOM of its own
// (an assembly) opens it when clicked.
const BOMComponentsTable = ({ items = [], compact = false, onOpen }) => {
    const cell = compact ? 'px-3 py-2' : 'p-4';

    if (!items.length) {
        return <p className="p-6 text-center text-sm font-medium text-slate-400">This BOM has no components.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50">
                        {['#', 'Item Code', 'Item Name', 'UOM', 'Drawing No', 'Rev', 'Quantity', 'MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'].map((label) => (
                            <th key={label} className={`${cell} text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ${label === 'Quantity' ? 'text-right' : ''}`}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => {
                        const open = onOpen && item.subBomId ? () => onOpen(item.subBomId) : null;
                        return (
                        <tr
                            key={item._id || index}
                            onClick={open || undefined}
                            className={`border-b last:border-0 border-slate-50 text-sm ${open ? 'cursor-pointer hover:bg-slate-50/70' : ''}`}
                        >
                            <td className={`${cell} text-slate-400 font-bold whitespace-nowrap`}>{item.seqNo || item.lineNo || index + 1}</td>
                            <td className={`${cell} font-bold whitespace-nowrap ${open ? 'text-primary-600 underline decoration-dotted underline-offset-4' : 'text-slate-800'}`}>
                                {item.itemCode}
                                {open && (
                                    <span className="ml-2 inline-block rounded-md bg-primary-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-600 no-underline">
                                        Assembly · {item.subBomComponents || 0}
                                    </span>
                                )}
                            </td>
                            <td className={`${cell} text-slate-600 min-w-[16rem]`}>
                                {item.itemDescription || '-'}
                                {!item.inProductMaster && (
                                    <span
                                        className="ml-2 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600"
                                        title="Item code not found in Product Master; showing the name from the BOM"
                                    >
                                        Not in master
                                    </span>
                                )}
                            </td>
                            <td className={`${cell} text-slate-600 whitespace-nowrap`}>{item.uom || '-'}</td>
                            <td className={`${cell} text-slate-600 whitespace-nowrap`}>{item.drawingNo || '-'}</td>
                            <td className={`${cell} text-slate-600 whitespace-nowrap`}>{item.revisionNo || '-'}</td>
                            <td className={`${cell} font-bold text-slate-700 text-right whitespace-nowrap`}>{item.qty}</td>
                            {MGR_KEYS.map((key) => (
                                <td key={key} className={`${cell} text-slate-600 whitespace-nowrap`}><MgrCell mgr={item[key]} /></td>
                            ))}
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BOMComponentsTable;
