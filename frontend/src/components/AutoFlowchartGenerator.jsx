import React, { useState } from 'react';
import { MdAutoGraph, MdFlashOn, MdLightbulb } from 'react-icons/md';
import { flowchartService } from '../services/api';
import { toast } from 'react-toastify';

const SAMPLE_STEPS = `Receive Customer Support Ticket
Check Warranty & AMC Status
If Active Warranty
Dispatch Service Engineer
Perform Component Replacement
Else
Generate Out-of-Warranty Estimate
If Estimate Approved
Dispatch Service Engineer & Collect Payment
Else
Close Ticket as Unapproved
Close Ticket with Service Report`;

const AutoFlowchartGenerator = ({ onGenerated, onClose }) => {
    const [stepText, setStepText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!stepText.trim()) {
            toast.error('Please enter process steps before generating.');
            return;
        }

        setLoading(true);
        try {
            const res = await flowchartService.generate(stepText);
            if (res.data && res.data.data) {
                toast.success('Flowchart automatically generated from steps!');
                onGenerated({
                    nodes: res.data.data.nodes || [],
                    edges: res.data.data.edges || [],
                    rawSteps: stepText
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to auto-generate flowchart');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadSample = () => {
        setStepText(SAMPLE_STEPS);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200">
                <span>Enter Process Steps (One step per line)</span>
                <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1.5 font-extrabold"
                >
                    <MdLightbulb size={16} className="text-amber-500" /> Load Sample Process
                </button>
            </div>

            <textarea
                rows={10}
                value={stepText}
                onChange={(e) => setStepText(e.target.value)}
                placeholder={`Example:\nStep 1: Receive customer order\nStep 2: Check stock availability\nIf Stock Available\nProcess Shipment\nElse\nNotify Supplier & Backorder\nEnd Process`}
                className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all shadow-inner"
            />

            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-extrabold text-sm flex items-center gap-1.5">
                    <MdFlashOn className="text-amber-500" size={16} /> Smart Keyword Formatting Engine:
                </p>
                <p className="text-xs leading-relaxed">
                    Use <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-bold">If [Condition]</code> to generate a decision diamond node with <strong>Yes</strong> and <strong>No / Else</strong> branching paths. Keywords like <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-bold">Check</code>, <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-bold">Verify</code>, <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-bold">Database</code>, <code className="bg-amber-100 dark:bg-amber-900/80 px-1.5 py-0.5 rounded font-bold">Document</code> are automatically assigned visual color-coded shapes.
                </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading || !stepText.trim()}
                    className="px-7 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs shadow-lg shadow-primary-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                    <MdAutoGraph size={18} />
                    {loading ? 'Auto-Generating...' : 'Convert to Flowchart'}
                </button>
            </div>
        </div>
    );
};

export default AutoFlowchartGenerator;
