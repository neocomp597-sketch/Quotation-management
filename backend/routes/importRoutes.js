const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/authMiddleware');
const {
    importProducts,
    importCustomers,
    importAttributes,
    getProductTemplate,
    getCustomerTemplate,
    getAttributeTemplate,
    importAttributeMaster,
    getAttributeMasterTemplate,
    importPlanning,
    getPlanningTemplate,
    importWarranties,
    importAmcs,
    getWarrantyTemplate,
    getAmcTemplate,
    importTickets,
    getTicketTemplate,
    importVendors,
    getVendorTemplate,
    importPriceBooks,
    getPriceBookTemplate,
    importPriceBookItems,
    getPriceBookItemTemplate,
    importEmployees,
    getEmployeeTemplate,
    importContacts,
    getContactTemplate,
    importContracts,
    getContractTemplate,
    importTenders,
    getTenderTemplate
} = require('../controllers/importController');

// Multer memory storage for Excel/CSV files
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'text/csv', // csv
            'application/csv'
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'), false);
        }
    }
});

// Import routes
router.post('/products', protect, upload.single('file'), importProducts);
router.post('/customers', protect, upload.single('file'), importCustomers);
router.post('/attributes', protect, upload.single('file'), importAttributes);
router.post('/attribute-master', protect, upload.single('file'), importAttributeMaster);
router.post('/planning', protect, upload.single('file'), importPlanning);
router.post('/warranties', protect, upload.single('file'), importWarranties);
router.post('/amcs', protect, upload.single('file'), importAmcs);
router.post('/tickets', protect, upload.single('file'), importTickets);
router.post('/vendors', protect, upload.single('file'), importVendors);
router.post('/price-books', protect, upload.single('file'), importPriceBooks);
router.post('/price-book-items/:priceBookId', protect, upload.single('file'), importPriceBookItems);

router.post('/employees', protect, upload.single('file'), importEmployees);
router.post('/contacts', protect, upload.single('file'), importContacts);
router.post('/contracts', protect, upload.single('file'), importContracts);
router.post('/tenders', protect, upload.single('file'), importTenders);

router.get('/cleanup-rr-techgrove', async (req, res) => {
    const { cleanupRRTechgroveEmployees } = require('../services/cleanupRRTechgroveEmployees');
    const result = await cleanupRRTechgroveEmployees();
    res.json(result);
});

router.get('/inspect-employees-now', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const Company = require('../models/Company');
        const EmployeeProfile = require('../models/EmployeeProfile');
        const RolePermission = require('../models/RolePermission');
        const { syncAllEngineers } = require('../services/engineerSyncService');
        const { syncUsersForExistingEmployees } = require('../services/employeeUserService');

        const User = require('../models/User');
        const superUser = await User.findOne({ email: 'super@gmail.com' }).lean();
        const superCompany = await Company.findOne({ $or: [{ name: /super/i }, { slug: /super/i }] }).lean();
        const companyId = req.user?.companyId || superUser?.companyId || superCompany?._id;

        const files = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            'D:/tally/Quotations/AR CRM Roaster.xlsx'
        ];

        const fileSummaries = {};
        let totalCreated = 0;
        let totalUpdated = 0;
        const processedEmployees = [];

        for (const filePath of files) {
            if (!fs.existsSync(filePath)) {
                fileSummaries[path.basename(filePath)] = { status: 'File not found' };
                continue;
            }

            const wb = XLSX.readFile(filePath);
            let fileCreated = 0;
            let fileUpdated = 0;

            for (const sheetName of wb.SheetNames) {
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const name = String(
                        row['Employee Name'] || row['employeename'] || row['Name'] || row['name'] ||
                        row['EMPLOYEE NAME'] || row['Emp Name'] || row['EMPLOYEE'] || ''
                    ).trim();

                    if (!name || name.toLowerCase().includes('total') || name.toLowerCase().includes('header')) continue;

                    const email = String(row['Email'] || row['email'] || row['EMAIL'] || '').trim();
                    const pan = String(row['PAN'] || row['pan'] || '').trim();
                    const aadhaar = String(row['Aadhaar'] || row['aadhaar'] || row['Aadhar'] || '').trim();
                    const uan = String(row['UAN'] || row['uan'] || '').trim();
                    const pfNumber = String(row['PF Number'] || row['pfNumber'] || row['PF NO'] || '').trim();
                    const esiNumber = String(row['ESI Number'] || row['esiNumber'] || row['ESI NO'] || '').trim();
                    const bankName = String(row['Bank Name'] || row['bank'] || row['BANK NAME'] || '').trim();
                    const accountNumber = String(row['Account Number'] || row['account'] || row['ACC NO'] || row['A/C NO'] || '').trim();
                    const ifscCode = String(row['IFSC Code'] || row['ifsc'] || row['IFSC'] || '').trim();
                    const department = String(row['Department'] || row['dept'] || row['DEPARTMENT'] || row['SBU'] || 'General').trim();
                    const designation = String(row['Designation'] || row['desig'] || row['DESIGNATION'] || row['Role'] || 'Employee').trim();
                    const workerType = String(row['Worker Type'] || row['workerType'] || 'PERMANENT WORKER').trim();
                    const employeeType = String(row['Employee Type'] || row['employeeType'] || 'ONSITE').trim();
                    const status = String(row['Status'] || row['status'] || 'Active').trim();

                    const joiningDateStr = row['Joining Date'] || row['joiningDate'] || row['DOJ'];
                    const dobStr = row['DOB'] || row['dob'] || row['Date of Birth'];

                    const joiningDate = joiningDateStr ? new Date(joiningDateStr) : new Date();
                    const dob = dobStr ? new Date(dobStr) : null;

                    const basic = Number(row['Basic Salary'] || row['basic'] || row['BASIC'] || 0) || 0;
                    const hra = Number(row['HRA'] || row['hra'] || 0) || 0;
                    const da = Number(row['DA'] || row['da'] || 0) || 0;
                    const specialAllowance = Number(row['Special Allowance'] || row['specialAllowance'] || row['SPECIAL ALLOWANCE'] || 0) || 0;

                    const empObj = {
                        name,
                        email: email || undefined,
                        pan,
                        aadhaar,
                        uan,
                        pfNumber,
                        esiNumber,
                        bankName,
                        accountNumber,
                        ifscCode,
                        joiningDate,
                        dob,
                        department,
                        designation,
                        workerType,
                        employeeType,
                        status: status === 'Inactive' ? 'Inactive' : 'Active',
                        salaryStructure: { basic, hra, da, specialAllowance },
                        companyId
                    };

                    const existing = await EmployeeProfile.findOne({
                        companyId,
                        $or: [
                            { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                            ...(email ? [{ email: email.toLowerCase() }] : [])
                        ]
                    });

                    if (existing) {
                        await EmployeeProfile.findByIdAndUpdate(existing._id, empObj);
                        fileUpdated++;
                        totalUpdated++;
                    } else {
                        await EmployeeProfile.create(empObj);
                        fileCreated++;
                        totalCreated++;
                    }
                    processedEmployees.push({ name, email, department, designation });
                }
            }

            fileSummaries[path.basename(filePath)] = { created: fileCreated, updated: fileUpdated };
        }

        let engineerSyncResult = null;
        let userSyncResult = null;
        if (companyId) {
            engineerSyncResult = await syncAllEngineers(companyId);
            userSyncResult = await syncUsersForExistingEmployees(companyId);
        }

        // Configure Admin Permissions matrix as requested
        const adminPermissions = {
            dashboard: true, dashboard_overview: true,
            master: true, master_customers: true, payroll_org_chart: true, payroll_org_chart_full: true, master_vendors: true, master_products: true, master_mgrs: true, master_attributes: true, master_statuses: true, master_terms: true, master_territories: true, master_branches: true, master_serials: true, state_master_create: true, state_master_edit: true, state_master_delete: true,
            flowchart: true, flowchart_view: true, flowchart_create: true, flowchart_edit: true, flowchart_delete: true,
            enquiry: true, enquiry_leads: true, enquiry_analytics: true,
            sales_pipeline: true, sales_dashboard: true, sales_deals: true, sales_pipelines: true, sales_forecasting: true, sales_activities: true, sales_targets: true, sales_reports: true, sales_analytics: true,
            meetings: true, meetings_list: true,
            quotation: true, sales_catalog: true, sales_price_management: true, sales_cpq: true, quotation_list: true, sales_approvals: true, sales_contracts: true, sales_orders: true, sales_revenue_analytics: true, sales_competitors: true, sales_ai_pricing: true,
            sale: true,
            purchase: true, purchase_grn: true,
            inventory: true, inventory_dashboard: true, inventory_items: true, inventory_warehouses: true, inventory_stock_in: true, inventory_stock_out: true, inventory_transfers: true, inventory_adjustments: true, inventory_stock_counts: true, inventory_alerts: true, inventory_reports: true,
            planning: true, planning_screen: true, planning_simulations: true, planning_edit_prev_year: true, planning_view_sbu_wise: true, planning_view_segment_wise: true, planning_view_status_breakdown: true,
            reports: true, reports_main: true,
            settings: true, settings_profile: true,
            admin: true, admin_authorization: true, admin_salespersons: true,
            payroll: true, payroll_payslips: true, payroll_employees: true, payroll_masters: true, payroll_runs: true, payroll_payments: true, payroll_settings: true, payroll_letters: true, payroll_reports: true,
            csm: true, csm_dashboard: true, csm_tickets: true, csm_visits: true, csm_warranties_amc: true, csm_kb: true, csm_masters: true, csm_reports: true,
            tender: true, tender_dashboard: true, tender_register: true, tender_reports: true
        };

        const rolePermission = companyId ? await RolePermission.findOneAndUpdate(
            { role: 'admin', companyId },
            { role: 'admin', companyId, menuVisibility: adminPermissions },
            { upsert: true, returnDocument: 'after' }
        ) : null;

        const responsePayload = {
            success: true,
            message: `Employee import & Admin permissions processing complete. Total Created: ${totalCreated}, Total Updated: ${totalUpdated}`,
            summary: {
                totalCreated,
                totalUpdated,
                fileSummaries,
                engineerSyncResult,
                userSyncResult,
                adminRolePermissions: rolePermission ? rolePermission.role : 'Updated'
            },
            processedEmployees
        };

        fs.writeFileSync('D:/tally/Quotations/scratch_import_result.json', JSON.stringify(responsePayload, null, 2));
        res.json(responsePayload);
    } catch (err) {
        console.error('Error in inspect-employees-now:', err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});


// Template download routes
router.get('/template/products', getProductTemplate);

router.get('/template/customers', getCustomerTemplate);
router.get('/template/attributes', getAttributeTemplate);
router.get('/template/attribute-master', getAttributeMasterTemplate);
router.get('/template/planning', protect, getPlanningTemplate);
router.get('/template/warranties', protect, getWarrantyTemplate);
router.get('/template/amcs', protect, getAmcTemplate);
router.get('/template/tickets', protect, getTicketTemplate);
router.get('/template/vendors', getVendorTemplate);
router.get('/template/price-books', getPriceBookTemplate);
router.get('/template/employees', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const Company = require('../models/Company');
        const EmployeeProfile = require('../models/EmployeeProfile');
        const RolePermission = require('../models/RolePermission');
        const { syncAllEngineers } = require('../services/engineerSyncService');
        const { syncUsersForExistingEmployees } = require('../services/employeeUserService');

        const User = require('../models/User');
        const superUser = await User.findOne({ email: 'super@gmail.com' }).lean();
        const superCompany = await Company.findOne({ $or: [{ name: /super/i }, { slug: /super/i }] }).lean();
        const companyId = req.user?.companyId || superUser?.companyId || superCompany?._id;

        const files = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            'D:/tally/Quotations/AR CRM Roaster.xlsx'
        ];

        const fileSummaries = {};
        let totalCreated = 0;
        let totalUpdated = 0;
        const processedEmployees = [];

        for (const filePath of files) {
            if (!fs.existsSync(filePath)) {
                fileSummaries[path.basename(filePath)] = { status: 'File not found' };
                continue;
            }

            const wb = XLSX.readFile(filePath);
            let fileCreated = 0;
            let fileUpdated = 0;

            for (const sheetName of wb.SheetNames) {
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const name = String(
                        row['Employee Name'] || row['employeename'] || row['Name'] || row['name'] ||
                        row['EMPLOYEE NAME'] || row['Emp Name'] || row['EMPLOYEE'] || ''
                    ).trim();

                    if (!name || name.toLowerCase().includes('total') || name.toLowerCase().includes('header')) continue;

                    const email = String(row['Email'] || row['email'] || row['EMAIL'] || '').trim();
                    const pan = String(row['PAN'] || row['pan'] || '').trim();
                    const aadhaar = String(row['Aadhaar'] || row['aadhaar'] || row['Aadhar'] || '').trim();
                    const uan = String(row['UAN'] || row['uan'] || '').trim();
                    const pfNumber = String(row['PF Number'] || row['pfNumber'] || row['PF NO'] || '').trim();
                    const esiNumber = String(row['ESI Number'] || row['esiNumber'] || row['ESI NO'] || '').trim();
                    const bankName = String(row['Bank Name'] || row['bank'] || row['BANK NAME'] || '').trim();
                    const accountNumber = String(row['Account Number'] || row['account'] || row['ACC NO'] || row['A/C NO'] || '').trim();
                    const ifscCode = String(row['IFSC Code'] || row['ifsc'] || row['IFSC'] || '').trim();
                    const department = String(row['Department'] || row['dept'] || row['DEPARTMENT'] || row['SBU'] || 'General').trim();
                    const designation = String(row['Designation'] || row['desig'] || row['DESIGNATION'] || row['Role'] || 'Employee').trim();
                    const workerType = String(row['Worker Type'] || row['workerType'] || 'PERMANENT WORKER').trim();
                    const employeeType = String(row['Employee Type'] || row['employeeType'] || 'ONSITE').trim();
                    const status = String(row['Status'] || row['status'] || 'Active').trim();

                    const joiningDateStr = row['Joining Date'] || row['joiningDate'] || row['DOJ'];
                    const dobStr = row['DOB'] || row['dob'] || row['Date of Birth'];

                    const joiningDate = joiningDateStr ? new Date(joiningDateStr) : new Date();
                    const dob = dobStr ? new Date(dobStr) : null;

                    const basic = Number(row['Basic Salary'] || row['basic'] || row['BASIC'] || 0) || 0;
                    const hra = Number(row['HRA'] || row['hra'] || 0) || 0;
                    const da = Number(row['DA'] || row['da'] || 0) || 0;
                    const specialAllowance = Number(row['Special Allowance'] || row['specialAllowance'] || row['SPECIAL ALLOWANCE'] || 0) || 0;

                    const empObj = {
                        name,
                        email: email || undefined,
                        pan,
                        aadhaar,
                        uan,
                        pfNumber,
                        esiNumber,
                        bankName,
                        accountNumber,
                        ifscCode,
                        joiningDate,
                        dob,
                        department,
                        designation,
                        workerType,
                        employeeType,
                        status: status === 'Inactive' ? 'Inactive' : 'Active',
                        salaryStructure: { basic, hra, da, specialAllowance },
                        companyId
                    };

                    const existing = await EmployeeProfile.findOne({
                        companyId,
                        $or: [
                            { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                            ...(email ? [{ email: email.toLowerCase() }] : [])
                        ]
                    });

                    if (existing) {
                        await EmployeeProfile.findByIdAndUpdate(existing._id, empObj);
                        fileUpdated++;
                        totalUpdated++;
                    } else {
                        await EmployeeProfile.create(empObj);
                        fileCreated++;
                        totalCreated++;
                    }
                    processedEmployees.push({ name, email, department, designation });
                }
            }

            fileSummaries[path.basename(filePath)] = { created: fileCreated, updated: fileUpdated };
        }

        let engineerSyncResult = null;
        let userSyncResult = null;
        if (companyId) {
            engineerSyncResult = await syncAllEngineers(companyId);
            userSyncResult = await syncUsersForExistingEmployees(companyId);
        }

        // Configure Admin Permissions matrix as requested
        const adminPermissions = {
            dashboard: true, dashboard_overview: true,
            master: true, master_customers: true, payroll_org_chart: true, payroll_org_chart_full: true, master_vendors: true, master_products: true, master_mgrs: true, master_attributes: true, master_statuses: true, master_terms: true, master_territories: true, master_branches: true, master_serials: true, state_master_create: true, state_master_edit: true, state_master_delete: true,
            flowchart: true, flowchart_view: true, flowchart_create: true, flowchart_edit: true, flowchart_delete: true,
            enquiry: true, enquiry_leads: true, enquiry_analytics: true,
            sales_pipeline: true, sales_dashboard: true, sales_deals: true, sales_pipelines: true, sales_forecasting: true, sales_activities: true, sales_targets: true, sales_reports: true, sales_analytics: true,
            meetings: true, meetings_list: true,
            quotation: true, sales_catalog: true, sales_price_management: true, sales_cpq: true, quotation_list: true, sales_approvals: true, sales_contracts: true, sales_orders: true, sales_revenue_analytics: true, sales_competitors: true, sales_ai_pricing: true,
            sale: true,
            purchase: true, purchase_grn: true,
            inventory: true, inventory_dashboard: true, inventory_items: true, inventory_warehouses: true, inventory_stock_in: true, inventory_stock_out: true, inventory_transfers: true, inventory_adjustments: true, inventory_stock_counts: true, inventory_alerts: true, inventory_reports: true,
            planning: true, planning_screen: true, planning_simulations: true, planning_edit_prev_year: true, planning_view_sbu_wise: true, planning_view_segment_wise: true, planning_view_status_breakdown: true,
            reports: true, reports_main: true,
            settings: true, settings_profile: true,
            admin: true, admin_authorization: true, admin_salespersons: true,
            payroll: true, payroll_payslips: true, payroll_employees: true, payroll_masters: true, payroll_runs: true, payroll_payments: true, payroll_settings: true, payroll_letters: true, payroll_reports: true,
            csm: true, csm_dashboard: true, csm_tickets: true, csm_visits: true, csm_warranties_amc: true, csm_kb: true, csm_masters: true, csm_reports: true,
            tender: true, tender_dashboard: true, tender_register: true, tender_reports: true
        };

        const rolePermission = companyId ? await RolePermission.findOneAndUpdate(
            { role: 'admin', companyId },
            { role: 'admin', companyId, menuVisibility: adminPermissions },
            { upsert: true, returnDocument: 'after' }
        ) : null;

        const responsePayload = {
            success: true,
            message: `Employee import & Admin permissions processing complete. Total Created: ${totalCreated}, Total Updated: ${totalUpdated}`,
            summary: {
                totalCreated,
                totalUpdated,
                fileSummaries,
                engineerSyncResult,
                userSyncResult,
                adminRolePermissions: rolePermission ? rolePermission.role : 'Updated'
            },
            processedEmployeesCount: processedEmployees.length,
            processedEmployeesSample: processedEmployees.slice(0, 15)
        };

        res.json(responsePayload);
    } catch (err) {
        console.error('Error in template/employees:', err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});


// Debug endpoint to read Excel headers
router.post('/debug-headers', upload.single('file'), (req, res) => {
    try {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        res.json({ headers: data[0], sample: data.slice(1, 11) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/missing-codes/:filename', (req, res) => {
    const { filename } = req.params;
    const validFilenames = ['missing_customer_codes.txt', 'missing_product_codes.txt', 'missing_mgr1_codes.txt', 'missing_mgr2_codes.txt'];
    
    if (!validFilenames.includes(filename)) {
        return res.status(400).json({ message: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
    }
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.sendFile(filePath);
});

// Specialized seeding endpoint for Tally Sales Register
router.post('/seed-file', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const path = require('path');
        const Planning = require('../models/Planning');
        const Customer = require('../models/Customer');
        const Product = require('../models/Product');
        const MGR = require('../models/MGR');
        
        const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row && (row.includes('Date') || row.includes('Particulars'))) {
                headerIdx = i;
                break;
            }
        }
        
        if (headerIdx === -1) throw new Error('Could not find headers in Excel file');
        
        const headers = rows[headerIdx];
        const dataRows = rows.slice(headerIdx + 1);
        const colMap = {};
        headers.forEach((h, idx) => {
            const sh = String(h || '').trim();
            if (sh === 'Date') colMap.date = idx;
            if (sh === 'Particulars') colMap.particulars = idx;
            if (sh === 'Quantity' || sh === 'Qty') colMap.qty = idx;
            if (sh === 'Rate') colMap.rate = idx;
            if (sh === 'Value' || sh === 'Amount') colMap.value = idx;
        });

        const sbus = ['EPC', 'SBU1', 'SBU2', 'SBU3'];
        const segments = ['Export', 'Industry', 'UC', 'Utility'];
        
        const defaultProduct = await Product.findOne();
        const defaultCustomer = await Customer.findOne();

        // Clear existing for 2026-27 to start fresh
        await Planning.deleteMany({ financialYear: '2026-27' });

        const entries = [];
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || !row[colMap.date] || !row[colMap.particulars]) continue;
            
            let dateObj = typeof row[colMap.date] === 'number' 
                ? new Date((row[colMap.date] - 25569) * 86400 * 1000)
                : new Date(row[colMap.date]);
            
            if (isNaN(dateObj.getTime())) continue;
            
            // Shift to 2026-27 for current report view
            const month = dateObj.getMonth();
            const year = 2026 + (month < 3 ? 1 : 0);
            const financialYear = '2026-27';
            const monthYear = `${dateObj.toLocaleString('default', { month: 'short' })}-${String(year).slice(-2)}`;
            const monthNum = ((month - 3 + 12) % 12) + 1;

            const qty = Math.abs(Number(row[colMap.qty]) || 1);
            const value = Math.abs(Number(row[colMap.rate] || row[colMap.value]) || 1000);
            
            const particulars = String(row[colMap.particulars]).trim();
            let customer = await Customer.findOne({ 
                $or: [{ companyName: new RegExp(`^${particulars}$`, 'i') }, { customerName: new RegExp(`^${particulars}$`, 'i') }]
            });
            if (!customer) customer = defaultCustomer;

            // Distribute across SBUs and Segments for the report representation
            const sbu = sbus[i % sbus.length];
            const segment = segments[Math.floor(i / sbus.length) % segments.length];

            entries.push({
                monthYear,
                financialYear,
                month: monthNum,
                customerId: customer._id,
                customerName: customer.companyName || customer.customerName,
                productId: defaultProduct._id,
                productName: defaultProduct.productName,
                qty,
                value,
                totalValue: qty * value,
                mgrCode: sbu,
                mgrCode2: segment,
                status: 'Invoice',
                createdBy: null
            });
        }
        
        if (entries.length === 0) throw new Error('No valid entries found to seed');
        
        await Planning.insertMany(entries);
        res.json({ message: `Successfully seeded ${entries.length} entries for FY 2026-27` });
    } catch (err) {
        console.error('Seeding error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
