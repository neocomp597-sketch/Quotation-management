import React from 'react';
import CodeBlock from '../components/CodeBlock';
import { MdWebhook, MdShield } from 'react-icons/md';

const Webhooks = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <MdWebhook className="text-[#006c49]" size={26} />
                    Webhooks & Real-time Events
                </h1>
                <p className="text-slate-500 text-xs font-medium mt-1">Receive immediate HTTP POST notifications when key CRM events occur in ARCRM.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900">Supported Event Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                        <div className="text-xs font-mono text-[#006c49] font-bold">customer.created</div>
                        <p className="text-[11px] text-slate-500 font-medium">Triggered whenever a new customer entry is added.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                        <div className="text-xs font-mono text-[#006c49] font-bold">lead.created</div>
                        <p className="text-[11px] text-slate-500 font-medium">Triggered when a new sales inquiry or lead arrives.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                        <div className="text-xs font-mono text-[#006c49] font-bold">deal.updated</div>
                        <p className="text-[11px] text-slate-500 font-medium">Triggered when a deal stage or status changes.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <MdShield className="text-[#006c49]" size={18} />
                    Webhook Signature Verification
                </h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    ARCRM signs every outgoing webhook payload with an HMAC-SHA256 signature passed in the <code className="text-[#006c49] font-mono font-bold">X-ARCRM-Signature</code> header.
                </p>
                <CodeBlock code={`const crypto = require('crypto');

function verifyWebhook(payload, signatureHeader, webhookSecret) {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader), 
    Buffer.from(expectedSignature)
  );
}`} language="javascript" title="Node.js Signature Verification" />
            </div>
        </div>
    );
};

export default Webhooks;
