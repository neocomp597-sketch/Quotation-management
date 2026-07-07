const Contract = require('../models/Contract');
const ContractClause = require('../models/ContractClause');
const DocumentTheme = require('../models/DocumentTheme');
const ContractTemplate = require('../models/ContractTemplate');
const GeneratedDocument = require('../models/GeneratedDocument');
const ContractCategory = require('../models/ContractCategory');
const CompanySettings = require('../models/CompanySettings');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Seeding helper for default CLM templates, clauses, and themes
const seedCLMData = async (companyId) => {
    const templateCount = await ContractTemplate.countDocuments({ companyId });
    if (templateCount === 0) {
        const theme = await DocumentTheme.create({
            name: 'Corporate Indigo Theme',
            fonts: 'font-outfit',
            primaryColor: '#0f172a',
            secondaryColor: '#4f46e5',
            textColor: '#334155',
            logoAlignment: 'left',
            watermarkText: 'CONFIDENTIAL',
            companyId
        });

        await ContractClause.create([
            {
                title: 'Payment Terms',
                category: 'Payment',
                content: '<p>Payment shall be made within thirty (30) days from the invoice date. Late payments are subject to a 1.5% monthly interest fee.</p>',
                tags: ['payment', 'terms'],
                companyId
            },
            {
                title: 'Confidentiality Clause',
                category: 'Legal',
                content: '<p>Both parties agree to hold all proprietary and trade secret information in strict confidence and shall not disclose it to any third party.</p>',
                tags: ['nda', 'legal'],
                companyId
            },
            {
                title: 'Standard Warranty',
                category: 'Support',
                content: '<p>The company warrants that services will be performed in a professional manner. Support coverage is provided 9x5 during business days.</p>',
                tags: ['warranty', 'support'],
                companyId
            }
        ]);

        await ContractTemplate.create({
            name: 'Standard Service Agreement',
            category: 'Sales Agreement',
            htmlContent: `
            <div style="text-align: center; margin-bottom: 30px;">
                {{company.logo}}
                <h2>SERVICE LEVEL AGREEMENT</h2>
            </div>
            <p>This Agreement is entered into between <strong>{{company.name}}</strong> (the "Company") and <strong>{{customer.name}}</strong> (the "Customer") on <strong>{{contract.startDate}}</strong>.</p>
            <h3>1. Scope of Agreement</h3>
            <p>The Company agrees to provide custom locked rates on products listed below under Contract Number: <strong>{{contract.number}}</strong>.</p>
            {{products_table}}
            <h3>2. Terms & Conditions</h3>
            <p>This agreement is active until <strong>{{contract.endDate}}</strong>. Standard clauses apply below:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <strong>Warranty & Support:</strong>
                {{clause.StandardWarranty}}
            </div>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <strong>Payment Clauses:</strong>
                {{clause.PaymentTerms}}
            </div>
            <p>IN WITNESS WHEREOF, the parties hereto have executed this Agreement.</p>
            <table style="width: 100%; margin-top: 50px;">
                <tr>
                    <td style="width: 50%;">
                        ___________________________<br>
                        <strong>For {{company.name}}</strong><br>
                        Authorized Signatory
                    </td>
                    <td style="width: 50%; text-align: right;">
                        ___________________________<br>
                        <strong>For {{customer.name}}</strong><br>
                        Client Representative
                    </td>
                </tr>
            </table>`,
            cssContent: 'h3 { margin-top: 25px; border-left: 4px solid #4f46e5; padding-left: 8px; }',
            themeId: theme._id,
            paperSize: 'A4',
            orientation: 'Portrait',
            marginTop: 20,
            marginBottom: 20,
            marginLeft: 20,
            marginRight: 20,
            status: 'Active',
            companyId
        });
    }

    const catCount = await ContractCategory.countDocuments({ companyId });
    if (catCount === 0) {
        await ContractCategory.create([
            { name: 'Sales Agreement', companyId },
            { name: 'AMC', companyId },
            { name: 'NDA', companyId },
            { name: 'Vendor Agreement', companyId }
        ]);
    }
};

// 1. Dashboard Controller
const getCLMDashboard = async (req, res) => {
    try {
        const companyId = req.user?.companyId;

        // Auto-seed CLM default setup
        await seedCLMData(companyId);

        // Fetch all contracts for the tenant
        const contracts = await Contract.find({ companyId }).lean();

        // Calculations
        const total = contracts.length;
        const active = contracts.filter(c => c.status === 'Active').length;
        const pending = contracts.filter(c => c.status === 'Pending Approval' || c.approvalStatus === 'Pending Approval').length;
        const draft = contracts.filter(c => c.status === 'Draft').length;
        const expired = contracts.filter(c => c.status === 'Expired').length;
        const renewed = contracts.filter(c => c.status === 'Renewed').length;
        const terminated = contracts.filter(c => c.status === 'Terminated').length;

        const totalValue = contracts.reduce((acc, c) => acc + (c.value || 0), 0);
        
        // Dynamic calculations
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);

        const expiring30Days = contracts.filter(c => {
            if (c.status !== 'Active') return false;
            const end = new Date(c.endDate);
            return end >= today && end <= next30Days;
        }).length;

        // Group by status
        const statusData = {
            Active: active,
            Draft: draft,
            'Pending Approval': pending,
            Expired: expired,
            Renewed: renewed,
            Terminated: terminated
        };

        // Monthly Revenue (sum of active contract values grouped by start month in FY 2026/27)
        const monthlyRevenue = Array(12).fill(0);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        contracts.forEach(c => {
            if (c.startDate && (c.status === 'Active' || c.status === 'Renewed')) {
                const monthIdx = new Date(c.startDate).getMonth();
                monthlyRevenue[monthIdx] += (c.value || 0) / 12; // divide value by 12 for estimated monthly share
            }
        });

        const revenueChartData = months.map((m, idx) => ({ month: m, revenue: Math.round(monthlyRevenue[idx]) }));

        // Category distributions
        const categoryCounts = {};
        contracts.forEach(c => {
            const cat = c.category || 'Sales Agreement';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        // Top Customers
        const customerIds = [...new Set(contracts.map(c => c.customerId?.toString()).filter(Boolean))];
        const customersList = await Customer.find({ _id: { $in: customerIds } }).select('companyName customerName').lean();
        const customerValueMap = {};
        contracts.forEach(c => {
            if (c.customerId) {
                const cid = c.customerId.toString();
                customerValueMap[cid] = (customerValueMap[cid] || 0) + (c.value || 0);
            }
        });

        const topCustomers = customersList.map(cust => ({
            name: cust.companyName || cust.customerName || 'Unknown',
            value: customerValueMap[cust._id.toString()] || 0
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        res.json({
            metrics: {
                total,
                active,
                pending,
                draft,
                expired,
                renewed,
                terminated,
                totalValue,
                expiring30Days
            },
            charts: {
                statusDistribution: Object.entries(statusData).map(([name, value]) => ({ name, value })),
                revenueTrend: revenueChartData,
                categoryDistribution: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
                topCustomers
            }
        });
    } catch (err) {
        console.error('CLM Dashboard error:', err);
        res.status(500).json({ message: err.message || 'Error loading CLM Dashboard' });
    }
};

// 2. Clause Controller
const getClauses = async (req, res) => {
    try {
        const clauses = await ContractClause.find({ companyId: req.user?.companyId }).sort({ sortOrder: 1, title: 1 });
        res.json(clauses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createClause = async (req, res) => {
    try {
        const clause = await ContractClause.create({
            ...req.body,
            companyId: req.user?.companyId
        });
        res.status(201).json(clause);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const updateClause = async (req, res) => {
    try {
        const clause = await ContractClause.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!clause) return res.status(404).json({ message: 'Clause not found' });
        res.json(clause);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const deleteClause = async (req, res) => {
    try {
        const clause = await ContractClause.findByIdAndDelete(req.params.id);
        if (!clause) return res.status(404).json({ message: 'Clause not found' });
        res.json({ message: 'Clause deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 3. Theme Controller
const getThemes = async (req, res) => {
    try {
        const themes = await DocumentTheme.find({ companyId: req.user?.companyId }).sort({ name: 1 });
        res.json(themes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createTheme = async (req, res) => {
    try {
        const theme = await DocumentTheme.create({
            ...req.body,
            companyId: req.user?.companyId
        });
        res.status(201).json(theme);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const updateTheme = async (req, res) => {
    try {
        const theme = await DocumentTheme.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!theme) return res.status(404).json({ message: 'Theme not found' });
        res.json(theme);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const deleteTheme = async (req, res) => {
    try {
        const theme = await DocumentTheme.findByIdAndDelete(req.params.id);
        if (!theme) return res.status(404).json({ message: 'Theme not found' });
        res.json({ message: 'Theme deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 4. Template Controller
const getTemplates = async (req, res) => {
    try {
        const templates = await ContractTemplate.find({ companyId: req.user?.companyId })
            .populate('themeId')
            .sort({ name: 1 });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createTemplate = async (req, res) => {
    try {
        const template = await ContractTemplate.create({
            ...req.body,
            companyId: req.user?.companyId
        });
        res.status(201).json(template);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const updateTemplate = async (req, res) => {
    try {
        const template = await ContractTemplate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!template) return res.status(404).json({ message: 'Template not found' });
        res.json(template);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const template = await ContractTemplate.findByIdAndDelete(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });
        res.json({ message: 'Template deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 5. Document Pipeline
const generateDocument = async (req, res) => {
    try {
        const { contractId, templateId } = req.body;
        const companyId = req.user?.companyId;

        // Fetch contract, template, customer, and company settings
        const contract = await Contract.findById(contractId);
        if (!contract) return res.status(404).json({ message: 'Contract not found' });

        const template = await ContractTemplate.findById(templateId).populate('themeId');
        if (!template) return res.status(404).json({ message: 'Template not found' });

        const customer = await Customer.findById(contract.customerId);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        const companySettings = await CompanySettings.findOne({ companyId });
        if (!companySettings) return res.status(404).json({ message: 'Company settings not found' });

        const theme = template.themeId;

        // Load Mapped Products Table
        const productIds = Array.from(contract.lockedPrices.keys());
        const products = await Product.find({ _id: { $in: productIds } }).lean();

        let productsTableHtml = `
        <table class="products-table" style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif;">
            <thead>
                <tr style="background-color: ${theme?.tableHeaderBg || '#f8fafc'}; color: ${theme?.tableHeaderColor || '#475569'}; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">Product Name</th>
                    <th style="padding: 10px; border: 1px solid #e2e8f0;">Product Code</th>
                    <th style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Locked Price</th>
                </tr>
            </thead>
            <tbody>`;

        for (const [prodId, price] of contract.lockedPrices.entries()) {
            const product = products.find(p => p._id.toString() === prodId);
            productsTableHtml += `
            <tr style="font-size: 12px; color: ${theme?.textColor || '#334155'}; border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${product?.productName || 'Unknown Product'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${product?.productCode || '-'}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${price.toLocaleString()}</td>
            </tr>`;
        }
        productsTableHtml += `</tbody></table>`;

        // Format dates
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

        // Variable Replacer Map
        const variables = {
            '{{company.name}}': companySettings.companyName || '',
            '{{company.logo}}': companySettings.logoUrl ? `<img src="${companySettings.logoUrl}" style="max-height: 50px;" />` : '',
            '{{company.gst}}': companySettings.gstin || '',
            '{{company.pan}}': companySettings.pan || '',
            '{{company.email}}': companySettings.email || '',
            '{{company.phone}}': companySettings.phone || '',
            '{{company.address}}': `${companySettings.address?.line1 || ''}, ${companySettings.address?.city || ''}, ${companySettings.address?.state || ''} - ${companySettings.address?.pincode || ''}`,
            '{{customer.name}}': customer.companyName || customer.customerName || '',
            '{{customer.contact}}': customer.customerName || '',
            '{{customer.gst}}': customer.gstin || '',
            '{{customer.pan}}': customer.pan || '',
            '{{customer.email}}': customer.email || '',
            '{{customer.phone}}': customer.mobile || '',
            '{{customer.address}}': `${customer.billingAddress?.line1 || ''}, ${customer.billingAddress?.city || ''}, ${customer.billingAddress?.state || ''} - ${customer.billingAddress?.pincode || ''}`,
            '{{contract.number}}': contract.contractNumber || '',
            '{{contract.title}}': contract.title || '',
            '{{contract.value}}': `₹${(contract.value || 0).toLocaleString()}`,
            '{{contract.startDate}}': formatDate(contract.startDate),
            '{{contract.endDate}}': formatDate(contract.endDate),
            '{{contract.category}}': contract.category || '',
            '{{products_table}}': productsTableHtml,
            '{{products}}': productsTableHtml
        };

        // Merge values
        let mergedHtml = template.htmlContent || '';
        Object.entries(variables).forEach(([token, val]) => {
            const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            mergedHtml = mergedHtml.replace(new RegExp(escapedToken, 'g'), val);
        });

        // Insert clauses if specified in variables (e.g. {{clause.PaymentTerms}})
        const clausesList = await ContractClause.find({ companyId });
        clausesList.forEach(cl => {
            const token = `{{clause.${cl.title.replace(/\s+/g, '')}}}`;
            const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            mergedHtml = mergedHtml.replace(new RegExp(escapedToken, 'g'), cl.content || '');
        });

        // Wrap full HTML document inside styling context
        const compiledHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@300;400;600;700&display=swap');
                
                body {
                    font-family: ${theme?.fonts === 'font-outfit' ? "'Outfit', sans-serif" : "'Inter', sans-serif"};
                    color: ${theme?.textColor || '#334155'};
                    margin: 0;
                    padding: 0;
                    line-height: 1.6;
                }
                .document-container {
                    padding: ${template.marginTop || 20}mm ${template.marginRight || 20}mm ${template.marginBottom || 20}mm ${template.marginLeft || 20}mm;
                    position: relative;
                }
                h1, h2, h3 {
                    color: ${theme?.primaryColor || '#0f172a'};
                    font-family: 'Outfit', sans-serif;
                    font-weight: 800;
                }
                h1 { font-size: 24px; border-bottom: 2px solid ${theme?.secondaryColor || '#4f46e5'}; padding-bottom: 8px; }
                h2 { font-size: 18px; margin-top: 20px; }
                ${template.cssContent || ''}
            </style>
        </head>
        <body>
            <div class="document-container">
                ${mergedHtml}
            </div>
        </body>
        </html>`;

        // Render PDF (Puppeteer check or fallback to mock)
        let pdfBuffer;
        try {
            const puppeteer = require('puppeteer');
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(compiledHtml, { waitUntil: 'networkidle0' });
            pdfBuffer = await page.pdf({
                format: template.paperSize || 'A4',
                landscape: template.orientation === 'Landscape',
                printBackground: true
            });
            await browser.close();
        } catch (err) {
            console.warn('Puppeteer not available, generating fallback mock document buffer:', err.message);
            pdfBuffer = Buffer.from(compiledHtml); // Store compiled HTML as mock buffer
        }

        // Increment version
        const docCount = await GeneratedDocument.countDocuments({ contractId });
        const newVersion = docCount + 1;

        // Store snapshot
        const doc = await GeneratedDocument.create({
            contractId,
            templateId,
            htmlSnapshot: compiledHtml,
            pdfUrl: '', // Locally mock pdf download, so we send the HTML or mock buffer directly
            version: newVersion,
            generatedBy: req.user?.id,
            companyId
        });

        // Update Contract status and link active document
        await Contract.findByIdAndUpdate(contractId, {
            versionNumber: newVersion,
            status: 'Active' // activate contract upon document compilation
        });

        res.json({
            message: 'Document generated successfully',
            document: doc
        });
    } catch (err) {
        console.error('Document compilation error:', err);
        res.status(500).json({ message: err.message || 'Error generating contract document' });
    }
};

const getDocumentVersions = async (req, res) => {
    try {
        const docs = await GeneratedDocument.find({ contractId: req.params.contractId })
            .select('version createdAt generatedBy')
            .populate('generatedBy', 'name email')
            .sort({ version: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getDocumentVersionHtml = async (req, res) => {
    try {
        const doc = await GeneratedDocument.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document version not found' });
        res.setHeader('Content-Type', 'text/html');
        res.send(doc.htmlSnapshot);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 6. Contracts Extra Handlers
const getCLMContracts = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim();
        const category = String(req.query.category || '').trim();

        const filter = { companyId };

        if (status) {
            filter.status = status;
        }

        if (category) {
            filter.category = category;
        }

        if (search) {
            filter.$or = [
                { contractNumber: new RegExp(search, 'i') },
                { title: new RegExp(search, 'i') }
            ];
        }

        const contracts = await Contract.find(filter)
            .populate('customerId', 'companyName customerName email')
            .populate('owner', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(contracts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createCLMContract = async (req, res) => {
    try {
        const contract = await Contract.create({
            ...req.body,
            owner: req.user?.id || req.body.owner,
            companyId: req.user?.companyId
        });
        res.status(201).json(contract);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const getCategories = async (req, res) => {
    try {
        const list = await ContractCategory.find({ companyId: req.user?.companyId }).sort({ name: 1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const cat = await ContractCategory.create({
            ...req.body,
            companyId: req.user?.companyId
        });
        res.status(201).json(cat);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const cat = await ContractCategory.findByIdAndDelete(req.params.id);
        if (!cat) return res.status(404).json({ message: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getCLMDashboard,
    getClauses,
    createClause,
    updateClause,
    deleteClause,
    getThemes,
    createTheme,
    updateTheme,
    deleteTheme,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    generateDocument,
    getDocumentVersions,
    getDocumentVersionHtml,
    getCLMContracts,
    createCLMContract,
    getCategories,
    createCategory,
    deleteCategory
};
