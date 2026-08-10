import React from 'react';
import { Link } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import { MdVpnKey, MdBook, MdRocketLaunch, MdArrowForward, MdShield } from 'react-icons/md';

const Overview = () => {
    const systemApis = [
        { title: 'Customers', icon: '👥', desc: 'Manage customer profiles, corporate accounts, GSTINs, and billing addresses.', endpoint: 'GET /api/v1/customers' },
        { title: 'Contacts', icon: '📇', desc: 'Corporate contact directory, designations, decision makers, and phone numbers.', endpoint: 'GET /api/v1/contacts' },
        { title: 'Leads & Inquiries', icon: '🎯', desc: 'Capture web inquiries, project lead stages, requirements, and assignees.', endpoint: 'GET /api/v1/leads' },
        { title: 'Deals & Pipeline', icon: '💼', desc: 'Track sales pipeline deals, valuations, win probabilities, and forecasts.', endpoint: 'GET /api/v1/deals' },
        { title: 'Quotations', icon: '📄', desc: 'Retrieve generated quotations, line items, grand totals, and validity dates.', endpoint: 'GET /api/v1/quotations' },
        { title: 'Product Catalog', icon: '📦', desc: 'Fetch product catalog items, HSN codes, GST percentages, and UOM pricing.', endpoint: 'GET /api/v1/products' },
        { title: 'Vendors', icon: '🏢', desc: 'Manage vendor master directory, supplier catalogs, and item quotes.', endpoint: 'GET /api/v1/vendors' },
        { title: 'Sales Orders', icon: '🛒', desc: 'Track confirmed customer sales orders, tax invoices, and vouchers.', endpoint: 'GET /api/v1/orders' },
        { title: 'Meetings & Schedule', icon: '📅', desc: 'Schedule customer visits, demo logs, follow-up dates, and activity notes.', endpoint: 'GET /api/v1/meetings' },
        { title: 'Branch & Territory', icon: '📍', desc: 'Access office branches, territory pin-codes, and regional boundaries.', endpoint: 'GET /api/v1/branches' }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-[#006c49] via-[#059669] to-[#10b981] p-8 rounded-3xl text-white space-y-4 shadow-xl shadow-[#006c49]/15 relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-[10px] tracking-widest uppercase border border-white/30">
                    <MdRocketLaunch size={14} />
                    <span>Enterprise Developer Portal</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                    ARCRM Enterprise Public API Platform
                </h1>
                <p className="text-emerald-100 text-sm max-w-2xl font-semibold leading-relaxed">
                    Build bi-directional enterprise integrations, automate CRM workflows, and sync customer data between ARCRM and external applications using standardized JSON REST endpoints.
                </p>
                <div className="pt-2 flex flex-wrap gap-4">
                    <Link
                        to="/developer/api-reference"
                        className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-[#006c49] font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 active:scale-95"
                    >
                        <MdBook size={16} />
                        <span>Interactive API Explorer</span>
                        <MdArrowForward size={16} />
                    </Link>
                    <Link
                        to="/developer/api-keys"
                        className="px-6 py-3 rounded-2xl bg-emerald-900/40 hover:bg-emerald-900/60 border border-white/30 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <MdVpnKey size={16} />
                        <span>Generate Access Key</span>
                    </Link>
                </div>
            </div>

            {/* Base Endpoint URL Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Environment Base Endpoint URLs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 font-mono text-xs">
                        <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Production Environment</div>
                        <div className="font-bold text-[#006c49] text-sm">https://arcrm.co.in/api/v1</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 font-mono text-xs">
                        <div className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Sandbox Environment</div>
                        <div className="font-bold text-amber-700 text-sm">https://sandbox.arcrm.co.in/api/v1</div>
                    </div>
                </div>
            </div>

            {/* Standard API Envelope Response Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Standard API Response Envelope</h3>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">Standard JSON</span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    All API responses conform strictly to the standard JSON response envelope featuring <code className="text-[#006c49] font-mono">succeeded</code> status boolean, <code className="text-[#006c49] font-mono">message</code> summary, <code className="text-[#006c49] font-mono">data</code> payload array, and <code className="text-[#006c49] font-mono">pagination</code> parameters.
                </p>
                <CodeBlock code={`{
  "succeeded": true,
  "message": "Operation completed successfully",
  "data": [
    {
      "id": "65cb7f92a10e82c1",
      "customerName": "Acme Global Solutions",
      "companyName": "Acme Corp",
      "email": "contact@acme.com",
      "mobile": "+91 9876543210",
      "status": "Active"
    }
  ],
  "pagination": {
    "pageIndex": 1,
    "pageSize": 25,
    "totalCount": 1,
    "totalPages": 1
  }
}`} language="json" title="Standard Response Format" />
            </div>

            {/* Public Resources Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">System APIs Directory</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore endpoints across all 10 system modules.</p>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                        {systemApis.length} API Modules
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {systemApis.map(api => (
                        <div key={api.title} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#006c49]/30 transition-all space-y-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#006c49]/10 text-[#006c49] flex items-center justify-center font-black text-lg border border-[#006c49]/20">
                                {api.icon}
                            </div>
                            <h3 className="text-base font-black text-slate-900">{api.title}</h3>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed min-h-[40px]">
                                {api.desc}
                            </p>
                            <div className="text-[11px] font-mono text-[#006c49] font-bold pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span>{api.endpoint}</span>
                                <Link to="/developer/api-reference" className="text-[10px] uppercase font-bold text-slate-400 hover:text-[#006c49] font-sans">Docs ➔</Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Overview;
