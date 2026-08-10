import React from 'react';
import CodeBlock from '../components/CodeBlock';
import { MdSpeed } from 'react-icons/md';

const RateLimits = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <MdSpeed className="text-[#006c49]" size={26} />
                    Rate Limits & Quotas
                </h1>
                <p className="text-slate-500 text-xs font-medium mt-1">Understanding request rate limits, sliding window behavior, and HTTP response headers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <div className="text-3xl font-black text-[#006c49] font-mono">100</div>
                    <h3 className="text-sm font-black text-slate-900">Requests Per Minute</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Default sliding-window quota per API key across all <code className="text-[#006c49] font-mono">/api/v1/*</code> endpoints.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
                    <div className="text-3xl font-black text-amber-600 font-mono">HTTP 429</div>
                    <h3 className="text-sm font-black text-slate-900">Too Many Requests</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Requests beyond quota return status code 429 with retry reset time information.
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900">Rate Limit Headers</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Every API response includes rate limit headers allowing client applications to dynamically throttle requests:
                </p>

                <CodeBlock code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 1723327200`} language="http" title="HTTP Rate Limit Response Headers" />
            </div>
        </div>
    );
};

export default RateLimits;
