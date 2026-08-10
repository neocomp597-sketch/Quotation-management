import React from 'react';
import CodeBlock from '../components/CodeBlock';
import { MdShield, MdLock } from 'react-icons/md';

const Authentication = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <MdShield className="text-[#006c49]" size={26} />
                    API Authentication
                </h1>
                <p className="text-slate-500 text-xs font-medium mt-1">Authenticate all public REST API requests using HTTP Bearer Tokens.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <MdLock className="text-[#006c49]" size={18} />
                    Bearer Token Header Format
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Pass your API key in the HTTP <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#006c49] font-mono">Authorization</code> header using the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#006c49] font-mono">Bearer</code> scheme:
                </p>

                <CodeBlock code={`Authorization: Bearer arcrm_live_xxxxxxxxxxxxxxxxxxxxxxxx`} language="http" title="HTTP Request Header" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                        ⚠️
                    </div>
                    <h3 className="text-sm font-black text-slate-900">Keep Your Keys Secret</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Never embed production API keys in front-end client code, mobile apps, or public GitHub repositories. Perform API requests from secure backend servers.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center font-bold">
                        🔒
                    </div>
                    <h3 className="text-sm font-black text-slate-900">Granular Scopes</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Assign minimal required scopes to each key (e.g. read-only <code className="text-[#006c49] font-mono">customers.read</code> vs full <code className="text-[#006c49] font-mono">customers.write</code>) to enforce the principle of least privilege.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Authentication;
