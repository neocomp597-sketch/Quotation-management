import React, { useState } from 'react';
import { MdContentCopy, MdCheck } from 'react-icons/md';

const CodeBlock = ({ code, language = 'bash', title = '' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden my-4 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs text-slate-400 font-mono">
                <span>{title || language.toUpperCase()}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
                >
                    {copied ? <MdCheck size={14} className="text-emerald-400" /> : <MdContentCopy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    );
};

export default CodeBlock;
