import React from 'react';
import CodeBlock from '../components/CodeBlock';
import { MdWarning } from 'react-icons/md';

const Errors = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <MdWarning className="text-amber-500" size={26} />
                    Error Codes & Statuses
                </h1>
                <p className="text-slate-500 text-xs font-medium mt-1">Predictable HTTP status codes and standardized error payload format.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900">Standard Error Format</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    All non-200 responses return a consistent error object containing a machine-readable <code className="text-[#006c49] font-mono">code</code>, human-readable <code className="text-[#006c49] font-mono">message</code>, and a unique <code className="text-[#006c49] font-mono">requestId</code> for audit tracking.
                </p>

                <CodeBlock code={`{
  "error": {
    "code": "invalid_api_key",
    "message": "The API key is invalid or has been revoked",
    "requestId": "req_01j8f3a1b7c"
  }
}`} language="json" title="401 Unauthorized Error Payload" />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500">
                            <th className="py-3.5 px-6">Status</th>
                            <th className="py-3.5 px-6">Code</th>
                            <th className="py-3.5 px-6">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                        <tr>
                            <td className="py-3.5 px-6 font-bold text-amber-600">400</td>
                            <td className="py-3.5 px-6 text-[#006c49] font-bold">validation_error</td>
                            <td className="py-3.5 px-6 text-slate-700 font-sans font-medium">Request payload is missing required fields or has invalid format.</td>
                        </tr>
                        <tr>
                            <td className="py-3.5 px-6 font-bold text-amber-600">401</td>
                            <td className="py-3.5 px-6 text-[#006c49] font-bold">missing_api_key / invalid_api_key</td>
                            <td className="py-3.5 px-6 text-slate-700 font-sans font-medium">Missing Bearer token or key is invalid/revoked/expired.</td>
                        </tr>
                        <tr>
                            <td className="py-3.5 px-6 font-bold text-amber-600">403</td>
                            <td className="py-3.5 px-6 text-[#006c49] font-bold">insufficient_permissions</td>
                            <td className="py-3.5 px-6 text-slate-700 font-sans font-medium">API key lacks required scope for the requested endpoint.</td>
                        </tr>
                        <tr>
                            <td className="py-3.5 px-6 font-bold text-rose-600">404</td>
                            <td className="py-3.5 px-6 text-[#006c49] font-bold">resource_not_found</td>
                            <td className="py-3.5 px-6 text-slate-700 font-sans font-medium">Requested customer/contact/lead/deal ID was not found.</td>
                        </tr>
                        <tr>
                            <td className="py-3.5 px-6 font-bold text-rose-600">429</td>
                            <td className="py-3.5 px-6 text-[#006c49] font-bold">rate_limit_exceeded</td>
                            <td className="py-3.5 px-6 text-slate-700 font-sans font-medium">Exceeded maximum 100 requests per minute limit.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Errors;
