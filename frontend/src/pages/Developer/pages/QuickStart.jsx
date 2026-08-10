import React, { useState } from 'react';
import CodeBlock from '../components/CodeBlock';
import { Link } from 'react-router-dom';

const curlSnippet = `curl -X GET "https://arcrm.co.in/api/v1/customers?limit=10" \\
  -H "Authorization: Bearer arcrm_live_YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json"`;

const nodeSnippet = `const axios = require('axios');

async function getCustomers() {
  try {
    const response = await axios.get('https://arcrm.co.in/api/v1/customers', {
      headers: {
        'Authorization': 'Bearer arcrm_live_YOUR_SECRET_KEY',
        'Content-Type': 'application/json'
      }
    });
    console.log('Customers:', response.data.data);
    console.log('Pagination:', response.data.pagination);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
}

getCustomers();`;

const pythonSnippet = `import requests

url = "https://arcrm.co.in/api/v1/customers"
headers = {
    "Authorization": "Bearer arcrm_live_YOUR_SECRET_KEY",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    data = response.json()
    print("Fetched Customers:", len(data["data"]))
else:
    print("API Error:", response.json())`;

const QuickStart = () => {
    const [tab, setTab] = useState('curl');

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quick Start Guide</h1>
                <p className="text-slate-500 text-xs font-medium mt-1">Make your first API call to ARCRM in under 5 minutes.</p>
            </div>

            {/* Step 1 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#006c49]/10 text-[#006c49] font-black text-xs flex items-center justify-center border border-[#006c49]/20">
                        1
                    </div>
                    <h3 className="text-base font-black text-slate-900">Generate an API Key</h3>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed pl-11">
                    Head over to the <Link to="/developer/api-keys" className="text-[#006c49] font-bold underline">API Keys Manager</Link> and generate a key with <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#006c49] font-mono">customers.read</code> permissions. Copy your key secret immediately.
                </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#006c49]/10 text-[#006c49] font-black text-xs flex items-center justify-center border border-[#006c49]/20">
                            2
                        </div>
                        <h3 className="text-base font-black text-slate-900">Execute a Test Request</h3>
                    </div>

                    {/* Language Switcher Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
                        <button
                            onClick={() => setTab('curl')}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${tab === 'curl' ? 'bg-[#006c49] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            cURL
                        </button>
                        <button
                            onClick={() => setTab('node')}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${tab === 'node' ? 'bg-[#006c49] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Node.js
                        </button>
                        <button
                            onClick={() => setTab('python')}
                            className={`px-3 py-1 rounded-lg font-bold transition-all ${tab === 'python' ? 'bg-[#006c49] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Python
                        </button>
                    </div>
                </div>

                {tab === 'curl' && <CodeBlock code={curlSnippet} language="bash" title="cURL Command" />}
                {tab === 'node' && <CodeBlock code={nodeSnippet} language="javascript" title="Node.js Example" />}
                {tab === 'python' && <CodeBlock code={pythonSnippet} language="python" title="Python Example" />}
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#006c49]/10 text-[#006c49] font-black text-xs flex items-center justify-center border border-[#006c49]/20">
                        3
                    </div>
                    <h3 className="text-base font-black text-slate-900">Expected JSON Response</h3>
                </div>
                <CodeBlock code={`{
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
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}`} language="json" title="200 OK Response Payload" />
            </div>
        </div>
    );
};

export default QuickStart;
