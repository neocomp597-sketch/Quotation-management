// Daily HR & Manpower Report module loaded
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { closeBullMq } = require("./config/bullmq");
const { startAuthSessionWorker } = require("./queues/authSessionQueue");
const { startCacheInvalidationWorker } = require("./queues/cacheInvalidationQueue");

const app = express();

let lastServerError = null;
global.setLastServerError = (err) => {
    lastServerError = {
        message: err?.message || String(err),
        stack: err?.stack || null,
        time: new Date().toISOString()
    };
};

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    global.setLastServerError(reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    global.setLastServerError(error);
});

// Connect to Database
const dbStartupPromise = connectDB().then(async () => {
  try {
    const fixMobileAndEmail = require("./scratch/fix_sbu2_mobile_email");
    await fixMobileAndEmail();
    const assignSBU2Branch = require("./scratch/assign_sbu2_branch");
    await assignSBU2Branch();
    const clearRohitHead = require("./scratch/clear_rohit_dixit_head");
    await clearRohitHead();
    const fixCompanyIds = require("./scratch/fix_dept_designation_company_id");
    await fixCompanyIds();
  } catch (err) {
    console.error("[Startup SBU2 Sync] Error:", err.message);
  }
});
const redisStartupPromise = connectRedis().then(() => {
  console.log("Redis connected");
  return true;
}).catch(() => {
  console.warn("Redis unavailable at startup; Redis-backed features will retry per request.");
  return false;
});

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean)
  : [
      "https://arcrm.co.in",
      "https://www.arcrm.co.in",
      "http://localhost:5173",
      "http://localhost:3000",
    ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const slowThresholdMs = Number(process.env.SLOW_API_THRESHOLD_MS || 500);
    if (duration >= slowThresholdMs) {
      console.warn(`[Slow API] ${req.method} ${req.originalUrl} ${duration}ms ${res.statusCode}`);
    } else if (process.env.LOG_API_TIMINGS === "true") {
      console.log(`[API] ${req.method} ${req.originalUrl} ${duration}ms ${res.statusCode}`);
    }
  });
  next();
});
app.use((req, res, next) => {
  const timeoutMs = Number(process.env.API_REQUEST_TIMEOUT_MS || 30000);
  req.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(503).json({ message: "Request timed out" });
    }
  });
  next();
});

// Route Imports
const quotationRoutes = require("./routes/quotationRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const termsRoutes = require("./routes/termsRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const salespersonRoutes = require("./routes/salespersonRoutes");
const siteRoutes = require("./routes/siteRoutes");
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const importRoutes = require("./routes/importRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const companySettingsRoutes = require("./routes/companySettingsRoutes");
const mgrRoutes = require("./routes/mgrRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const productAttributeRoutes = require("./routes/productAttributeRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const systemUpdateRoutes = require("./routes/systemUpdateRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const planningRoutes = require("./routes/planningRoutes");
const authorizationRoutes = require("./routes/authorizationRoutes");
const statusRoutes = require("./routes/statusRoutes");
const territoryRoutes = require("./routes/territoryRoutes");
const footerPageRoutes = require("./routes/footerPageRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const contactRoutes = require("./routes/contactRoutes");
const salesPipelineRoutes = require("./routes/salesPipelineRoutes");
const dealRoutes = require("./routes/dealRoutes");
const salesTargetRoutes = require("./routes/salesTargetRoutes");
const forecastRoutes = require("./routes/forecastRoutes");
const salesAnalyticsRoutes = require("./routes/salesAnalyticsRoutes");
const csmRoutes = require("./routes/csmRoutes");
const cpqRoutes = require("./routes/cpqRoutes");
const orderRoutes = require("./routes/orderRoutes");
const clmRoutes = require("./routes/clmRoutes");
const tenderRoutes = require("./routes/tenderRoutes");
const branchRoutes = require("./routes/branchRoutes");
const stateMasterRoutes = require("./routes/stateMasterRoutes");
const cityMasterRoutes = require("./routes/cityMasterRoutes");
const vendorCatalogRoutes = require("./routes/vendorCatalogRoutes");
const flowchartRoutes = require("./routes/flowchartRoutes");
const landingPlanRoutes = require("./routes/landingPlanRoutes");
const developerRoutes = require("./routes/developerRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const publicApiV1 = require("./routes/public-api/v1");
const scheduler = require("./utils/scheduler");

// API Routes (Reload triggered)
app.use("/api/v1", publicApiV1);
app.use("/api/developer", developerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/landing-plans", landingPlanRoutes);
app.use("/api/city-master", cityMasterRoutes);
app.use("/api/flowcharts", flowchartRoutes);
app.use("/api/state-master", stateMasterRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/salespersons", salespersonRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/import", importRoutes);
app.use("/api/company-settings", companySettingsRoutes);
app.use("/api/mgrs", mgrRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/product-attributes", productAttributeRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/vendor-catalog", vendorCatalogRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system-updates", systemUpdateRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/authorization", authorizationRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/territories", territoryRoutes);
app.use("/api/footer-pages", footerPageRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/sales/pipelines", salesPipelineRoutes);
app.use("/api/sales/deals", dealRoutes);
app.use("/api/sales/targets", salesTargetRoutes);
app.use("/api/sales/forecast", forecastRoutes);
app.use("/api/sales/analytics", salesAnalyticsRoutes);
app.use("/api/csm", csmRoutes);
app.use("/api/cpq", cpqRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/clm", clmRoutes);

app.get('/api/seed-super-employees', async (req, res) => {
    try {
        const { seedSuperEmployees } = require('./services/seedSuperEmployeesService');
        const result = await seedSuperEmployees();
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/trigger-seed-landing', async (req, res) => {
    try {
        const landingPlanController = require('./controllers/landingPlanController');
        await landingPlanController.seedLandingPlans(req, res);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/run-employee-inspect', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const files = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            'D:/tally/Quotations/AR CRM Roaster.xlsx'
        ];
        const output = {};
        for (const file of files) {
            if (fs.existsSync(file)) {
                try {
                    const wb = XLSX.readFile(file);
                    output[path.basename(file)] = {};
                    wb.SheetNames.forEach(sheet => {
                        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
                        output[path.basename(file)][sheet] = rows.slice(0, 50); // first 50 rows
                    });
                } catch (e) {
                    output[path.basename(file)] = { error: e.message };
                }
            } else {
                output[path.basename(file)] = { status: 'File does not exist' };
            }
        }
        res.json(output);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




app.get('/api/trigger-seed', async (req, res) => {
    try {
        const seedData = require('./seed_data_direct');
        await seedData();
        res.send('Seeded successfully');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/debug-updates', async (req, res) => {
    try {
        const SystemUpdate = require('./models/SystemUpdate');
        const updates = await SystemUpdate.find({}).lean();
        res.json({ success: true, count: updates.length, updates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});

app.get('/api/temp-migration-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        const Company = require('./models/Company');
        const bcrypt = require('bcryptjs');

        // 1. Find a valid company (e.g. first company in DB)
        const company = await Company.findOne().lean();
        if (!company) {
            return res.status(404).send('No company found in database to assign to Admin@gmail.com');
        }
        const companyId = company._id;

        // 2. Find or update Admin@gmail.com to normal admin with companyId
        let adminUser = await User.findOne({ email: /Admin@gmail.com/i });
        if (adminUser) {
            adminUser.role = 'admin';
            adminUser.companyId = companyId;
            adminUser.isActive = true;
            adminUser.status = true;
            await adminUser.save();
        } else {
            // Create Admin@gmail.com if it doesn't exist
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('123456', salt);
            adminUser = await User.create({
                name: 'Admin User',
                email: 'Admin@gmail.com',
                passwordHash,
                role: 'admin',
                companyId,
                isActive: true,
                status: true
            });
        }

        // 3. Find or create admin@arcrm.in with role SUPER_ADMIN and password 1235678
        const salt2 = await bcrypt.genSalt(10);
        const passwordHash2 = await bcrypt.hash('1235678', salt2);

        let superAdminUser = await User.findOne({ email: /admin@arcrm.in/i });
        if (superAdminUser) {
            superAdminUser.passwordHash = passwordHash2;
            superAdminUser.role = 'SUPER_ADMIN';
            superAdminUser.companyId = undefined; // Super Admins don't have companyId
            superAdminUser.isActive = true;
            superAdminUser.status = true;
            await superAdminUser.save();
        } else {
            superAdminUser = await User.create({
                name: 'Super Admin',
                email: 'admin@arcrm.in',
                passwordHash: passwordHash2,
                role: 'SUPER_ADMIN',
                isActive: true,
                status: true
            });
        }

        res.json({
            message: 'Migration completed successfully',
            adminUser: {
                id: adminUser._id,
                email: adminUser.email,
                role: adminUser.role,
                companyId: adminUser.companyId
            },
            superAdminUser: {
                id: superAdminUser._id,
                email: superAdminUser.email,
                role: superAdminUser.role
            }
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/seed-statuses', async (req, res) => {
    try {
        const Status = require('./models/Status');
        const DEFAULT_STATUSES = [
            { name: 'Budget', color: '#6366f1', isActive: true }, 
            { name: 'Firm', color: '#10b981', isActive: true }, 
            { name: 'MFC', color: '#f59e0b', isActive: true }, 
            { name: 'B & B', color: '#3b82f6', isActive: true }, 
            { name: 'Others', color: '#64748b', isActive: true }, 
            { name: 'Order Received', color: '#8b5cf6', isActive: true }, 
            { name: 'Invoice', color: '#ec4899', isActive: true }, 
            { name: 'Lost', color: '#ef4444', isActive: true }, 
            { name: 'Parked', color: '#84cc16', isActive: true }
        ];

        let added = 0;
        for (const statusData of DEFAULT_STATUSES) {
            const existing = await Status.findOne({ name: { $regex: new RegExp(`^${statusData.name}$`, 'i') } }).select('_id').lean();
            if (!existing) {
                await Status.create(statusData);
                added++;
            }
        }
        res.json({ message: `Statuses seeded successfully! Added ${added} new statuses.` });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/do-employee-import-now', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const Company = require('./models/Company');
        const EmployeeProfile = require('./models/EmployeeProfile');
        const RolePermission = require('./models/RolePermission');
        const { syncAllEngineers } = require('./services/engineerSyncService');
        const { syncUsersForExistingEmployees } = require('./services/employeeUserService');

        const defaultCompany = await Company.findOne().lean();
        const companyId = defaultCompany ? defaultCompany._id : null;

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

        // Configure Admin Permissions matrix
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

        const rolePermission = await RolePermission.findOneAndUpdate(
            { role: 'admin' },
            { role: 'admin', permissions: adminPermissions },
            { upsert: true, returnDocument: 'after' }
        );

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
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});



app.get('/api/run-employee-inspect', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const files = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            'D:/tally/Quotations/AR CRM Roaster.xlsx'
        ];
        const output = {};
        for (const file of files) {
            if (fs.existsSync(file)) {
                try {
                    const wb = XLSX.readFile(file);
                    output[path.basename(file)] = {};
                    wb.SheetNames.forEach(sheet => {
                        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
                        output[path.basename(file)][sheet] = rows.slice(0, 50); // first 50 rows
                    });
                } catch (e) {
                    output[path.basename(file)] = { error: e.message };
                }
            } else {
                output[path.basename(file)] = { status: 'File does not exist' };
            }
        }
        fs.writeFileSync('D:/tally/Quotations/scratch_inspect.txt', JSON.stringify(output, null, 2));
        res.json({ message: 'Inspection saved', keys: Object.keys(output) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/debug-last-error', (req, res) => {
    res.json({ success: true, lastServerError });
});

app.get('/api/debug-quotations', async (req, res) => {
    try {
        const Quotation = require('./models/Quotation');
        const quotations = await Quotation.find({}).lean();
        res.json(quotations);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/cleanup-data', async (req, res) => {
    try {
        const Planning = require('./models/Planning');
        const result = await Planning.deleteMany({});
        res.json({ message: 'Deleted all planning entries', result });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/check-excel', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const rowLabels = [];
        for (let i = 0; i < Math.min(100, rows.length); i++) {
            if (rows[i] && rows[i][0]) {
                rowLabels.push(rows[i][0]);
            }
        }
        res.json({ rowLabels });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/read-revenue-plan', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const filePath = 'D:/tally/Quotations/Ularia_1+3M FY27 Revenue Plan_09_04_26R.xlsx';
        const workbook = XLSX.readFile(filePath);
        const result = { sheetNames: workbook.SheetNames, sheets: {} };
        workbook.SheetNames.forEach(name => {
            const ws = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            result.sheets[name] = rows.slice(0, 80);
        });
        res.json(result);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get('/api/git-revert', (req, res) => {
    const { exec } = require('child_process');
    exec('git checkout -- d:/tally/Quotations/frontend/src/pages/Reports.jsx', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: err.message, stderr });
        }
        res.json({ message: 'Git revert successful', stdout });
    });
});

// Start Scheduler
const startBackgroundServices = async () => {
  await dbStartupPromise;
  const redisReady = await redisStartupPromise;

  // Seed employees for super@gmail.com organisation
  try {
    const { seedSuperEmployees } = require("./services/seedSuperEmployeesService");
    await seedSuperEmployees();
  } catch (err) {
    console.error("Error auto-seeding super@gmail.com employees:", err);
  }

  // Seed current platform release notes
  try {
    const SystemUpdate = require("./models/models/SystemUpdate" ? "./models/SystemUpdate" : "./models/SystemUpdate");
    await SystemUpdate.deleteOne({ version: "v2.8.1" });
    await SystemUpdate.findOneAndUpdate(
      { version: "v2.9.0" },
      {
        version: "v2.9.0",
        title: "Enquiry Register & Partner Workflow",
        message: "The enquiry module has been refreshed with a cleaner creation flow, partner tracking, reliable product row selection, and a proper enquiry register.",
        releaseNotes: [
          "Added Enquiry Register with view, edit, delete, filtering, and partner count visibility",
          "Removed extra enquiry reference fields from the create/edit form for faster entry",
          "Added partner details to enquiries, including company, contact, mobile, email, and notes",
          "Fixed product dropdown selection so every product row updates correctly, not only the first row",
          "Added system update release history to the notification bell",
          "Improved system updates history loading and latest release access"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-15T12:00:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.0.0-meetings" },
      {
        version: "v3.0.0-meetings",
        title: "CRM Meetings Module Architecture Plan",
        message: "The Meetings module plan has been revised with UTC ISO scheduling, reminder tracking, soft deletes, conflict warnings, modular reports, and premium list, calendar, and agenda views.",
        releaseNotes: [
          "Store meeting startDateTime and endDateTime directly as UTC ISO Date fields",
          "Track one-day and thirty-minute reminders with remindersSent flags to prevent duplicate alerts",
          "Use soft deletes with isDeleted, deletedAt, and deletedBy instead of hard removal",
          "Add backend conflict detection for organizers and participants, with allowConflict override support",
          "Capture meeting outcomes for completed meetings and audit all status changes in statusHistory",
          "Split reporting into stats, user-summary, monthly-summary, and client-history endpoints",
          "Add notification support for meeting created, updated, cancelled, rescheduled, and reminder events",
          "Add frontend Meetings list, visual calendar, agenda, reporting dashboard, and create/edit conflict warning flow"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-16T21:22:39+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.1.0-appointments" },
      {
        version: "v3.1.0-appointments",
        title: "Appointments, Discussion Notes & Reporting Visibility",
        message: "The Meetings module has been renamed to Appointments with discussion notes, Report To visibility, and senior/team appointment tracking.",
        releaseNotes: [
          "Renamed the Meetings module and register labels to Appointments",
          "Added Discussion Notes so users can record what was discussed in each appointment",
          "Added Report To on users and appointments so senior users can see team appointments",
          "Added Report To visibility in the appointments register and appointment details",
          "Removed the visible delete action from the appointments register and appointment popup",
          "Improved Report To display by falling back to the organizer's assigned senior for older appointments",
          "Added Redis outage handling so BullMQ startup failures no longer crash the backend"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-17T21:35:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.2.0-contacts" },
      {
        version: "v3.2.0-contacts",
        title: "Contact Management Module",
        message: "A new lightweight Contact Management module has been added to manage customers, prospects, vendors and partners with simple CRUD operations and a table view.",
        releaseNotes: [
          "Added Contact Management page under Master with full CRUD operations",
          "Auto-generated Contact IDs (C001, C002...) for each new contact",
          "Contact form with Name, Company, Email, Phone, Designation, Customer Type, Last Interaction Date, and Notes",
          "Contact list table with search by name, company, email or phone",
          "Filter contacts by Customer Type (Customer, Prospect, Vendor, Partner)",
          "Color-coded Customer Type badges in the contact list",
          "Export contacts to Excel (.xlsx) with one click",
          "Added Contacts link in sidebar under Master section",
          "Added master_contacts permission for role-based access control"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-18T21:25:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.3.0-deals" },
      {
        version: "v3.3.0-deals",
        title: "Sales Pipeline Customer Dropdown & Modal Enhancements",
        message: "We have upgraded the Deal creation and edit flow with a searchable customer dropdown, paginated list support, and a larger modal interface for a more spacious user experience.",
        releaseNotes: [
          "Changed the New Deal modal width on the Kanban board to max-w-2xl for better layout visibility",
          "Replaced standard customer select boxes with custom input fields powered by PortalDropdown",
          "Added search filtering inside customer selection dropdown in both Deal Board and Deal Detail pages",
          "Fixed backend pagination parsing (custRes.data?.data) to support larger customer directories up to 500+ records",
          "Refined event bubbling and focus states to ensure smooth dropdown selection without premature closing"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-19T21:20:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.4.0-csm" },
      {
        version: "v3.4.0-csm",
        title: "Customer Service Management (CSM) & Dynamic Masters",
        message: "We have rolled out the Customer Service Management (CSM) module upgrades, database seeding shortcuts, and customizable Deal Source masters.",
        releaseNotes: [
          "Dynamic Deal Source Master: manage lead source entries inline with search, add, and delete controls directly inside forms",
          "CSM Analytics Dashboard: visual glassmorphism cards, live SLA compliance donut charts, and top engineering performance charts",
          "Maharashtra Power Utility Seed: realistic MSEDCL/MSETCL customer substations, switchgear assets, AMCs, and active tickets",
          "CSM Knowledge Base Seed: step-by-step guides for SF6 switchgear refill, oil BDV tests, and numerical relay logs",
          "Unified Modal Architecture: all edit and publication forms follow standardized Modal component formatting",
          "System Seeding Shortcuts: trigger demo data seeding directly from the notifications bell dropdown or the What's New updates popup"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-20T23:30:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.5.0-csm-autoassign" },
      {
        version: "v3.5.0-csm-autoassign",
        title: "Pincode Validation & Territory Sales Rep Auto-Assignment",
        message: "We have added mandatory pincode verification during ticket registration, and implemented Territory-based automatic sales representative assignment.",
        releaseNotes: [
          "Mandatory Pincode: Ensured Pincode is a required field on support tickets and manual ticket creation",
          "Customer Auto-Fill: Selected customers automatically pre-populate the pincode field from their billing address",
          "Territory Master Mapping: Assigned active salespeople to specific territories inside the Salesperson Master",
          "Automatic Salesperson Routing: Tickets are automatically assigned to the designated sales representative based on their registered pincode",
          "Assignee Dashboard View: Displayed the auto-assigned sales rep profile directly on the ticket list, details, and Assign Case section",
          "Export Masters: Exported Customer and Product Masters directly to Excel (.xlsx) from the catalog headers"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-04T20:15:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.6.0-clm" },
      {
        version: "v3.6.0-clm",
        title: "Contract Lifecycle Management (CLM) & Document Engine",
        message: "We have launched the new Enterprise Contract Lifecycle Management (CLM) module, featuring a Document Generation Engine, Clause Library, Approvals Workflow, Renewal Kanban Center, and custom category Mini Master.",
        releaseNotes: [
          "Integrated full-width CLM Workspace under dedicated Contract Management sidebar group",
          "Introduced Document Builder with dynamic templates, variables merging, and HTML/PDF compilation",
          "Added Category Mini Master for inline creation and dynamic selection of agreement types",
          "Built Clause Library for drag-and-drop reusable terms with styling toolbars and plain text formatting helpers",
          "Developed lane-based Renewal Kanban Center for tracking expiring agreements (90/60/30/7/Today days)",
          "Created 14 live-calculated CLM Reports (Operational, Financial, Renewal, and Management) with Excel exports",
          "Added Excel imports and exports for Employees, Contacts, and Contracts to accelerate onboarding"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-07T20:52:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.7.0-crm-analytics" },
      {
        version: "v3.7.0-crm-analytics",
        title: "Customer CRM Analytics & 360 Workspace Upgrade",
        message: "We have introduced a comprehensive Customer Analytics Dashboard and a dedicated Salesforce-style Customer 360 Workspace to enhance client visibility, perform dynamic health diagnostics, and streamline workflow operations.",
        releaseNotes: [
          "Customer Analytics Dashboard: Added sub-dashboards for growth, retention, segmentations, financial metrics, and operational reports under Reports & Analytics",
          "Customer 360 Workspace: Standalone view showing Overview, Contacts, Premises, Opportunities, Quotes, Contracts, Orders, Invoices, and SLA tickets",
          "7-Dimension Weighted Health Score: Real-time client health index computed from frequency, payment timing, tickets, CSAT, and activity",
          "Chronological Interaction Timeline: Combined history log showing all client milestones in a Salesforce-style activity feed",
          "Custom Saved Filter Presets: Save, apply, and clear custom multi-dimensional client segments directly on the directory list",
          "Mongoose Performance Indexing: Added DB indexes for owner, status, segment, and industry to ensure zero-lag dashboard loads",
          "Secure Access Control: Embedded strict role-based data boundaries on the 360 Workspace and analytics endpoints"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-12T17:45:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.8.0-tenders" },
      {
        version: "v3.8.0-tenders",
        title: "Tender Management & Excel Import/Export Center",
        message: "We have launched the new Tender Management module, featuring a business-focused dashboard, a comprehensive register, automated PDF validity rules, and full Excel/CSV imports/exports.",
        releaseNotes: [
          "Tenders Main Dashboard: Added KPI cards for active/submitted/won/lost count, value, win rate, donut charts, and monthly trends",
          "Tenders Register: Added detailed list with status, value, owner, client, and department tracking",
          "Progression Log: Integrated real-time timeline auditing to track status transitions and value changes on tenders",
          "Automated Quotation Expiry: Implemented 30-day validity auto-expiry rules that reject pending approval quotes after 30 days",
          "Excel Data Import: Created Excel/CSV import handlers supporting smart matches for clients, departments, and owners",
          "Excel Data Export: Built client-side Excel export for both the register view and all 8 Tender Management reports",
          "Portal-based Modals: Aligned all modals and details sidebars to use the shared Portal-based component following system teal aesthetics"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-13T21:30:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.9.0-csm-engineers" },
      {
        version: "v3.9.0-csm-engineers",
        title: "Engineer-Wise Complaint Visibility & Service Engineer Auto-Sync",
        message: "We have implemented engineer-wise access control for support complaints and auto-synchronization of Service Engineer employees to the Engineers Master module.",
        releaseNotes: [
          "Engineer-Wise Complaint Visibility: Support tickets/complaints are restricted so each service engineer only views and manages complaints assigned to them",
          "Admin & Supervisor Oversight: Users with Admin or Manager roles retain full access to view, filter, and reassign all system complaints across engineers",
          "Reassignment Protection: Restricted complaint reassignment privileges exclusively to Admin and Manager roles with 403 Forbidden enforcement",
          "Service Engineer Auto-Sync: Employees created or updated in Employee Master with designation 'Service Engineer' automatically sync to Engineers Master with Name, Email, Mobile, and Status",
          "Dynamic Inactive Sync: Changing an employee's designation away from 'Service Engineer' or marking them Inactive/Resigned automatically updates their status to Inactive in Engineers Master",
          "Quotation Version Snapshot Fix: Resolved QuotationVersion snapshot creation during quotation edits to ensure smooth quotation revisions and zero HTTP 500 errors"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-22T21:00:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.0.0-emp-service-enhancements" },
      {
        version: "v4.0.0-emp-service-enhancements",
        title: "Auto User Account Creation, Employee Reporting To & Partial Serial No. Search",
        message: "We have implemented auto user account creation on employee addition, 'Reporting To' supervisor selection in Employee Master, and partial serial number search with auto-fill in the Service Module.",
        releaseNotes: [
          "Auto User Account Creation: Adding a new employee in Employee Master automatically creates a User account using their Email ID as Login ID and '123456' as default password.",
          "First Login Password Enforcement: New user accounts created with default password '123456' are prompted to update their password upon first login.",
          "Reporting To Field in Employee Master: Added a 'Reporting To' supervisor dropdown in Basic Info between Employee Name and Email Address, listing active employees excluding self.",
          "Partial Serial No. Search: Service Ticket registration now supports partial serial number search (e.g. typing '1002' displays matching serial numbers like CE1002, JH1002, FV1002).",
          "Auto-Fill Ticket Information: Selecting a Serial No from the search dropdown automatically populates Customer Name, Linked Invoice, Pincode, Linked Product, and Contact details."
        ],
        detailedChanges: [
          { date: "2026-07-23", module: "Payroll & HR", submodule: "Employee Master", changes: "Added Auto User Account creation with default password 123456 and Reporting To supervisor dropdown field." },
          { date: "2026-07-23", module: "Authentication", submodule: "User Login & Password", changes: "Enforced first login password change modal for accounts with default password." },
          { date: "2026-07-23", module: "CSM Support", submodule: "Ticket Registration", changes: "Implemented partial serial number search with auto-completion and full ticket details auto-fill." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-23T21:00:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.1.0-floating-notepad-settings" },
      {
        version: "v4.1.0-floating-notepad-settings",
        title: "Floating Notepad Widget & Company Settings Management",
        message: "We have introduced an app-wide Floating Notepad with sticky notes for rapid note taking, along with enhanced Company Settings for organization logo, address, and billing defaults.",
        releaseNotes: [
          "Floating Notepad Widget: Quick-access floating note taker available on all pages with rich formatting, color coding, and quick toggle features.",
          "Personal & Dashboard Notes: Organize notes into personal lists and pin critical notes directly to the main Executive Dashboard.",
          "Company Branding & Settings: Updated Company Settings module to manage company logo, address, state, GSTIN, phone, and official domain defaults.",
          "Header & Document Branding Sync: Automatically propagate company logo and business profile to application headers and printable document footers."
        ],
        detailedChanges: [
          { date: "2026-07-25", module: "Dashboard", submodule: "Notepad Widget", changes: "Added Floating Notepad component with color tags, pin-to-dashboard, and persistent notes per user." },
          { date: "2026-07-25", module: "Authentication", submodule: "Company Settings", changes: "Added Company logo upload, GSTIN/Tax ID configuration, and official address preferences in System Settings." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-25T21:42:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.2.0-multi-branch-master" },
      {
        version: "v4.2.0-multi-branch-master",
        title: "Branch Master & Multi-Branch Enterprise Location Tagging",
        message: "We have launched the new Branch Master module under Master Management, allowing organizations to manage multiple branch locations, assign branch tags across system entities, and filter records by branch.",
        releaseNotes: [
          "Branch Master Page: Added Branch Master CRUD interface with Branch Code (e.g. BR001), Name, Location, Address, Manager, and Status.",
          "Multi-Branch Data Association: Tagged Users, Employees, Customers, Quotations, Enquiries, and CSM Support Tickets with branch references.",
          "Branch Filtering & Access Control: Enabled location-wise filtering on Customer Directory, Quotation Register, Ticket Center, and Employee Master.",
          "Branch Dropdown Integration: Integrated searchable PortalDropdown for Branch selection across all creation and edit modals."
        ],
        detailedChanges: [
          { date: "2026-07-26", module: "Master Management", submodule: "Branch Master", changes: "Created Branch model, API controller, and Branch Master page with full CRUD and status controls." },
          { date: "2026-07-26", module: "CRM Core", submodule: "Multi-Branch Tagging", changes: "Added branchId tagging to Users, Customers, Enquiries, Quotations, and CSM Support Tickets." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-26T20:45:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.3.0-org-chart-hierarchy" },
      {
        version: "v4.3.0-org-chart-hierarchy",
        title: "Interactive Organizational Hierarchy Chart & Employee ID Helper",
        message: "We have added an interactive visual Organization Chart (Org Chart), an automated unique Employee ID generator, and enhanced hierarchical reporting synchronization.",
        releaseNotes: [
          "Interactive Org Chart: Dynamic hierarchy tree view visualizing leadership, department heads, managers, and reporting staff with search and expandable nodes.",
          "Automated Employee ID Generator: Implemented employeeIdHelper utility to automatically format and issue unique sequential Employee IDs (e.g., EMP001, EMP002).",
          "Employee ID Migration & Sanitation: Automatically fixed duplicate Employee ID entries across database records with clean sequential backfill.",
          "Hierarchical Reporting Sync: Synchronized 'Reporting To' supervisor relationships between HR Employee Profiles and User authentication accounts."
        ],
        detailedChanges: [
          { date: "2026-07-27", module: "Payroll & HR", submodule: "Org Chart", changes: "Built interactive OrgChart page with tree layout, supervisor search, and expandable team nodes." },
          { date: "2026-07-27", module: "Employee Master", submodule: "Employee ID Helper", changes: "Integrated unique Employee ID auto-generation helper and resolved legacy duplicate ID conflicts." },
          { date: "2026-07-27", module: "Payroll & HR", submodule: "Reporting To Sync", changes: "Linked EmployeeProfile reporting lines with User accounts for org chart and reporting visibility." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-07-27T21:00:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.4.0-360-workspaces-role-controls" },
      {
        version: "v4.4.0-360-workspaces-role-controls",
        title: "Vendor & Contact 360 Workspaces, Invoiced Product Filtering & Settings Role Access Controls",
        message: "We have introduced dedicated Vendor 360 and Contact 360 Workspaces, invoice-based product filtering in Customer 360, and role-based access restrictions on Company Settings.",
        releaseNotes: [
          "Vendor 360 Workspace: Full interactive 360° profile view for vendors featuring overview, supplied catalog products, purchase vouchers, linked quotations, and interaction timeline.",
          "Contact 360 Workspace: Interactive 360° profile view for contact persons featuring contact details, scheduled meetings, support tickets, and interaction history.",
          "Customer 360 Product Details Filter: Refined the Product Details list in Customer 360 to display only products included in the customer's billing invoices (excluding unassigned in-stock inventory).",
          "Settings Role-Based Access Control: Restricted access to Company Settings configuration tabs (Company Info, Address, Banking, Terms & Signatory, Branding, Footer Pages) exclusively to Admin and Manager roles.",
          "Clickable Vendor & Contact Names: Made vendor and contact names in master list tables interactive links navigating directly to their respective 360 degree workspace pages."
        ],
        detailedChanges: [
          { date: "2026-08-02", module: "Master Management", submodule: "Vendor 360 Workspace", changes: "Created Vendor360Workspace component and getVendor360Data API endpoint (/api/vendors/:id/360)." },
          { date: "2026-08-02", module: "Master Management", submodule: "Contact 360 Workspace", changes: "Created Contact360Workspace component and getContact360Data API endpoint (/api/contacts/:id/360)." },
          { date: "2026-08-02", module: "Customer 360", submodule: "Product Details Filter", changes: "Updated getCustomer360Data backend controller to filter sold items directly from customer billing invoices." },
          { date: "2026-08-02", module: "Settings & System", submodule: "Role Access Control", changes: "Restricted company settings tabs to Admin and Manager roles only in Settings page." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-02T22:42:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.5.0-arc-crm-enhancements" },
      {
        version: "v4.5.0-arc-crm-enhancements",
        title: "ARC CRM Enhancements: Family Info Accordions, City Master, Complaint Reassignment, Vendor Portal, Contacts Redesign & GST Formatting",
        message: "We have released major CRM updates including Family Info accordions, City Master, Service Engineer complaint reassignment, Vendor portal isolation, Contacts redesign with Anniversary Date, and standardized GST formatting.",
        releaseNotes: [
          "Employee Family Information Enhancement: Redesigned Family Details into a compact collapsible accordion view with 2-column grid layout (Relation, Name, Mobile, Aadhaar, PAN, Email, DOB, Gender, Emergency Contact) and strict validations.",
          "New City Master Module: Integrated complete City Master under Master Management with country, state, district, area, city, 6-digit numeric pincode validation, and duplicate district checks.",
          "Org Chart Universal Employee Access: Enabled Org Chart view for all authenticated employee accounts to view reporting hierarchy, managers, subordinates, and reporting chains.",
          "Complaint Reassignment for Service Engineers: Service Engineers can reassign support complaints when absent or unavailable with select reasons (Leave, Sick, Emergency, Workload, Other), transfer notes, history audit log, and automated notifications.",
          "Purchase Voucher Renamed to Invoice Voucher: Standardized Purchase Voucher naming to 'Invoice Voucher' globally across models, UI tabs, breadcrumbs, vouchers register, and reports.",
          "Dedicated Vendor Login Portal & Scoping: Provided vendor login access scoped strictly to Product Catalog management (CRUD) and Read-Only Invoice Vouchers view with full CRM isolation.",
          "GST Code Formatting: Formatted single-digit state GST prefix codes with leading zeroes (e.g. 01, 02, 04, 07, 09, 27) with auto-population in State Master.",
          "Contacts Module Redesign & Validations: Redesigned Create/Edit Contact form into 5 structured sections matching contacts.html with Anniversary Date next to DOB, 10-digit mobile, 15-char GSTIN, 6-digit PIN, and non-future date validations."
        ],
        detailedChanges: [
          { date: "2026-08-05", module: "Payroll & HR", submodule: "Family Information", changes: "Redesigned family member UI into accordion with 2-column grid, emergency contact badges, and validations." },
          { date: "2026-08-05", module: "Master Management", submodule: "City Master", changes: "Created CityMaster model, controller, routes, frontend page, and menu link under Master." },
          { date: "2026-08-05", module: "Payroll & HR", submodule: "Org Chart", changes: "Granted Org Chart access permission to all authenticated employee user accounts." },
          { date: "2026-08-05", module: "Customer Service", submodule: "Complaint Reassignment", changes: "Added reassign endpoint, reassignmentHistory schema array, reasons modal, timeline log, and engineer notification." },
          { date: "2026-08-05", module: "Finance & Vouchers", submodule: "Invoice Voucher", changes: "Renamed Purchase Voucher to Invoice Voucher in Voucher model, UI forms, filters, and reports." },
          { date: "2026-08-05", module: "Vendor Portal", submodule: "Role Scoping", changes: "Added vendor credentials schema and scoped sidebar/permissions strictly to Product Catalog and Read-Only Invoice Vouchers." },
          { date: "2026-08-05", module: "Master Management", submodule: "GST Formatting", changes: "Added formatGstPrefix helper formatting single-digit state codes with leading zeroes (01, 04, 09)." },
          { date: "2026-08-05", module: "CRM Contacts", submodule: "Contacts Redesign", changes: "Expanded Contact schema and redesigned Contacts.jsx form matching contacts.html with Anniversary Date next to DOB and field validations." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-05T21:30:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.6.0-enquiry-sales-executive-assignment" },
      {
        version: "v4.6.0-enquiry-sales-executive-assignment",
        title: "Enquiry Module Sales Executive Assignment, Hierarchy Scope Tabs & Executive Resolution",
        message: "We have released a major feature update to the Enquiry module introducing Sales Executive assignment, role-based scope tabs (My Enquiries, Team Enquiries, All Enquiries), automatic reassignment ownership transfer, and dual-collection executive resolution.",
        releaseNotes: [
          "Sales Executive Assignment: Added Sales Executive selection dropdown during enquiry creation/edit and quick one-click Reassign modal directly from Enquiry Register table and View details modal.",
          "Role & Hierarchy Scope Tabs: Implemented tabbed scope views ('My Enquiries', 'Team Enquiries', 'All Enquiries') filtering records according to employee reporting hierarchy trees and user permissions.",
          "Reassignment Ownership Transfer: Reassigning an enquiry to another executive automatically transfers ownership so it displays in the new assignee's My Enquiries tab.",
          "Dual-Collection Executive Resolver: Built fallback resolver querying both User and Salesperson collections to display executive names, emails, roles, and avatar badges seamlessly across all views.",
          "Data Sanitization & Bug Fixes: Fixed query parameter casting and payload unwrapping for empty string ObjectIds to prevent CastError exceptions on update and filter operations."
        ],
        detailedChanges: [
          { date: "2026-08-16", module: "Enquiry Register", submodule: "Sales Executive Assignment", changes: "Added assignedTo field, Sales Executive dropdown in Create/Edit, and quick Reassign modal." },
          { date: "2026-08-16", module: "Enquiry Register", submodule: "Hierarchy Scope Tabs", changes: "Added My Enquiries, Team Enquiries, and All Enquiries tabbed navigation with hierarchy resolution." },
          { date: "2026-08-16", module: "Enquiry Register", submodule: "Executive Resolver", changes: "Implemented populateAssignedToFallback querying User and Salesperson collections." },
          { date: "2026-08-16", module: "Enquiry Register", submodule: "Data Sanitization", changes: "Cleaned empty string ObjectIds in backend cleanEnquiryBody and frontend api service." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-16T00:15:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.7.0-enquiry-enhancements" },
      {
        version: "v4.7.0-enquiry-enhancements",
        title: "Enquiry Module Manual Product Entry, Role Filtering & Automated Calculations",
        message: "We have enhanced the Enquiry module with manual product entry, restricted sales executive role assignment, standardized 7-stage enquiry status workflow, and automated line-item and grand total calculations.",
        releaseNotes: [
          "Manual Product Entry: Option to enter non-mastered products manually with free-text item code and description",
          "Sales Executive Role Filtering: Restricted Assign to Sales Executive dropdown to display only users with the Sales Executive role",
          "Standardized Status Workflow: Expanded status workflow to Open, Assigned, In Progress, Pending Customer, Resolved, Closed, and Cancelled",
          "Automated Calculations: Real-time calculation of product line item values (Quantity × Price − Discount) and header total summaries"
        ],
        detailedChanges: [
          { date: "2026-08-16", module: "CRM Core", submodule: "Manual Product Entry", changes: "Added custom product option and free-text code/description entry for non-mastered items." },
          { date: "2026-08-16", module: "CRM Core", submodule: "Role Filtering", changes: "Filtered assigned executive selection exclusively to users with Sales Executive role." },
          { date: "2026-08-16", module: "CRM Core", submodule: "Enquiry Status Workflow", changes: "Standardized status dropdown with Open, Assigned, In Progress, Pending Customer, Resolved, Closed, Cancelled enums." },
          { date: "2026-08-16", module: "CRM Core", submodule: "Product Value Calculation", changes: "Automated line item values and header summary totals (Subtotal, Freight, Other Charges, Grand Total)." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-16T17:20:00Z"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.8.0-auth-granularity-darkmode" },
      {
        version: "v4.8.0-auth-granularity-darkmode",
        title: "Individual User Permission Overrides, Accordion UI, Vendor Login Split & Dark Mode Standardization",
        message: "We have introduced granular per-user permission overrides, collapsible accordion permission cards, a dedicated Vendor Login management tab, and completed full dark-mode UI standardization across Authorization, Enquiry Visit Management, and Vouchers.",
        releaseNotes: [
          "Individual User Permission Overrides: Added custom permissions support for individual team users beyond default role permissions with automatic permission count calculation.",
          "Collapsible Accordion Permission UI: Converted all role and user permission cards into smooth accordion components with zero blank-space collapsed views.",
          "Vendor Logins Separation: Decoupled vendor user accounts from Team Users into a dedicated 'Vendor Logins' tab under Authorization management.",
          "Granular Merging Engine: Updated authorization backend controller to merge role defaults with custom user permissions in real-time.",
          "Application-Wide Dark Mode Standardization: Fully audited and applied Tailwind CSS dark mode utilities across Authorization matrix, Enquiry Detail, Visit Management, and Voucher records.",
          "Standalone Visit Management: Integrated full-page visit scheduling and logging interface with GPS reverse geocoding and visit history tracking."
        ],
        detailedChanges: [
          { date: "2026-08-20", module: "Admin & System", submodule: "Authorization Matrix", changes: "Implemented individual user custom permissions map, permission merging logic, accordion card UI, and dedicated Vendor Logins tab." },
          { date: "2026-08-20", module: "UI & Aesthetics", submodule: "Dark Mode Audit", changes: "Standardized slate dark mode theme across Authorization, Enquiry Detail, Schedule Visit, and Vouchers." },
          { date: "2026-08-19", module: "Vendor Portal", submodule: "Authentication Sync", changes: "Automated vendor user account linkage with Vendor Master profiles." },
          { date: "2026-08-18", module: "Enquiry Module", submodule: "Visit Management", changes: "Created standalone Enquiry Visit scheduling page with GPS reverse geocoding and complete visit history." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-20T21:18:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v4.9.0-enquiry-auth-gstin-refinements" },
      {
        version: "v4.9.0-enquiry-auth-gstin-refinements",
        title: "Enquiry Executive Deduplication, Authorization Password Management & Unified GSTIN Validation",
        message: "We have deduplicated executive entries in Enquiry registers, restored authorization password management, cleaned redundant landing page spinners, and unified GSTIN state code validations across all modules.",
        releaseNotes: [
          "Deduplicated Sales Executive dropdown and register entries across Enquiry management",
          "Restored password update modal and password reset workflow inside Authorization dashboard",
          "Removed redundant background loading spinners on landing and dashboard routes",
          "Standardized GSTIN regex validation to support all valid Indian state codes (01-37, 38, 97, 99) across Branch, Contact, Customer, Vendor, and Enquiry forms"
        ],
        detailedChanges: [
          { date: "22.08.2026", module: "CRM Core", submodule: "Enquiry Register", changes: "Deduplicated Sales Executive list entries in Enquiry creation and filtering." },
          { date: "22.08.2026", module: "Authentication", submodule: "Authorization Dashboard", changes: "Restored user password update functionality into the Authorization management panel." },
          { date: "22.08.2026", module: "Master Management", submodule: "GSTIN Validation", changes: "Updated GSTIN regex standard across validation.js, BranchMaster, Contacts, Customers, Vendors, and CreateEnquiry." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-22T18:00:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v5.0.0-reports-dark-mode-standardization" },
      {
        version: "v5.0.0-reports-dark-mode-standardization",
        title: "Reports Module Dark Mode Standardization & Theme-Aware Analytics",
        message: "We have completed the application-wide Dark Mode transition for the Reports module, featuring theme-aware Recharts data visualizations, dynamic dark financial spreadsheet tables, and standardized contrast styling.",
        releaseNotes: [
          "Completed full Dark Mode styling across all Reports tab renderers: Quotations, Enquiries, Vendors, Products, Planning, Revenue Plan, and Follow-Ups",
          "Integrated theme-aware Recharts configurations with dark grid lines, subtle tick colors, and #0f172a dark tooltip cards",
          "Implemented REVENUE_PLAN_DARK_COLORS and dynamic theme detection for financial spreadsheet tables and Excel export parity",
          "Standardized all report container card backgrounds to dark:bg-slate-900/60, borders to dark:border-slate-800, and row hover states to dark:hover:bg-slate-800/40"
        ],
        detailedChanges: [
          { date: "23.08.2026", module: "Reports", submodule: "Tab Renderers Dark Mode", changes: "Applied Tailwind dark: utility classes to container cards, stats, tables, and tab navigation." },
          { date: "23.08.2026", module: "Reports", submodule: "Recharts Visualization", changes: "Configured theme-aware CartesianGrid, XAxis, YAxis, and Tooltip styling for all report charts." },
          { date: "23.08.2026", module: "Reports", submodule: "Revenue Plan Spreadsheet", changes: "Added REVENUE_PLAN_DARK_COLORS palette and dynamic dark theme background detection in cell fill functions." }
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-08-23T18:00:00+05:30"),
        isActive: true
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error("[Release Seed Error] Failed to seed system update:", err.message);
  }

  // Database Migration for 'Sept' month entries
  try {
    const Planning = require("./models/Planning");
    const FY_MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const entries = await Planning.find({
      $or: [
        { monthYear: /Sept/i },
        { month: { $lt: 1 } },
        { month: { $gt: 12 } },
        { month: null }
      ]
    });
    if (entries.length > 0) {
      console.log(`[Migration] Found ${entries.length} planning documents with invalid months. Correcting...`);
      let updatedCount = 0;
      for (const entry of entries) {
        let changed = false;
        if (entry.monthYear && entry.monthYear.toLowerCase().startsWith('sept')) {
          const parts = entry.monthYear.split('-');
          const yearSuffix = parts[1];
          entry.monthYear = `Sep-${yearSuffix}`;
          changed = true;
        }
        if (entry.monthYear) {
          const prefix = entry.monthYear.split('-')[0].substring(0, 3);
          const expectedMonth = FY_MONTH_NAMES.findIndex(
            m => m.toLowerCase() === prefix.toLowerCase()
          ) + 1;
          if (expectedMonth > 0 && entry.month !== expectedMonth) {
            entry.month = expectedMonth;
            changed = true;
          }
        }
        if (changed) {
          await entry.save();
          updatedCount++;
        }
      }
      console.log(`[Migration] Successfully updated ${updatedCount} planning documents.`);
    } else {
      console.log("[Migration] No invalid planning documents found.");
    }
  } catch (migErr) {
    console.error("[Migration] Error during startup migration:", migErr.message);
  }

  try {
      const RolePermission = require("./models/RolePermission");
      await RolePermission.collection.dropIndex('role_1');
      console.log('[Migration] Dropped old role_1 index successfully.');
  } catch (err) {
      // Ignore if index doesn't exist
  }

  try {
      const Counter = require("./models/Counter");
      await Counter.collection.dropIndex('type_1_prefix_1_year_1');
      console.log('[Migration] Dropped old type_1_prefix_1_year_1 index on counters successfully.');
  } catch (err) {
      // Ignore if index doesn't exist
  }

  try {
      const { syncUsersForExistingEmployees } = require("./services/employeeUserService");
      await syncUsersForExistingEmployees();
  } catch (syncErr) {
      console.error('[Auto User Sync Startup Error]:', syncErr.message);
  }

  try {
      const { syncUsersForExistingVendors } = require("./services/vendorUserService");
      await syncUsersForExistingVendors();
  } catch (vendorSyncErr) {
      console.error('[Vendor User Sync Startup Error]:', vendorSyncErr.message);
  }

  if (redisReady) {
    await startCacheInvalidationWorker();
    await startAuthSessionWorker();
    await scheduler.startScheduler();
  } else {
    console.warn("[Background] Redis unavailable; skipping BullMQ workers and starting scheduler fallback.");
    await scheduler.startScheduler({ preferFallback: true });
  }
};

// Serve Static Files
// Serve Static Files with logging
app.use(
  "/uploads",
  (req, res, next) => {
    console.log(`[Static] Serving file: ${req.path}`);
    next();
  },
  express.static(path.join(__dirname, "uploads")),
);

// Serve Static Files - Frontend (Production & Deployment)
const rootDir = path.resolve();
app.use(express.static(path.join(rootDir, "dist")));

// SPA fallback — Only in production or if dist exists
app.get(/.*/, (req, res, next) => {
  // If it's an API route that reached here, it's a 404 for API
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: `API route ${req.path} not found` });
  }

  const indexPath = path.join(rootDir, "dist", "index.html");
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development, if we reach here, it's a 404
    res.status(404).send("Not Found");
  }
});

const { initSocket } = require("./config/socket");

const PORT = process.env.PORT || 4003;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.timeout = Number(process.env.API_REQUEST_TIMEOUT_MS || 30000);
  
  // Initialize Socket.io real-time server
  initSocket(server);

  startBackgroundServices().catch((error) => {
    console.error("Failed to start background services:", error.message);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Closing server...`);
    server.close(async () => {
      scheduler.stopScheduler();
      await closeBullMq();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Temporary Debug: Inspect quotations and products in DB
(async () => {
    try {
        require('fs').writeFileSync(require('path').join(__dirname, 'test_run.txt'), 'Hello at ' + new Date().toISOString());
        await dbStartupPromise;
        
        // Auto-seed LandingPlan model if empty
        const LandingPlan = require('./models/LandingPlan');
        const landingPlanCount = await LandingPlan.countDocuments();
        if (landingPlanCount === 0) {
            const landingPlanController = require('./controllers/landingPlanController');
            await landingPlanController.seedLandingPlans();
            console.log('[SEED] Auto-seeded LandingPlan collection!');
        }
        const Quotation = require('./models/Quotation');
        const quotations = await Quotation.find({}).lean();
        const output = quotations.map(q => `ID: ${q._id}, quotationNo: ${q.quotationNo}, companyId: ${q.companyId}, status: ${q.status}`).join('\n');
        require('fs').writeFileSync(require('path').join(__dirname, 'debug_output.txt'), `Total quotations: ${quotations.length}\n${output}`);
        console.log("[DEBUG] Written quotations to debug_output.txt");

        const Product = require('./models/Product');
        const pipeProducts = await Product.find({
            $or: [
                { productName: { $regex: /pipe/i } },
                { productCode: { $regex: /85076000|84137090/i } }
            ]
        }).lean();
        require('fs').writeFileSync(
            require('path').join(__dirname, 'debug_pipe_products.json'),
            JSON.stringify(pipeProducts, null, 2)
        );
        console.log('[DEBUG] Written pipe products to debug_pipe_products.json, count:', pipeProducts.length);
        // Auto sync vendor users
        const { syncUsersForExistingVendors } = require('./services/vendorUserService');
        const syncRes = await syncUsersForExistingVendors();
        require('fs').writeFileSync(require('path').join(__dirname, 'vendor_sync_debug.txt'), JSON.stringify(syncRes, null, 2));
        console.log('[DEBUG] Vendor user sync completed:', syncRes);

        // Auto Employee Import & Admin Permissions Seed
        try {
            const XLSX = require('xlsx');
            const fs = require('fs');
            const path = require('path');
            const Company = require('./models/Company');
            const EmployeeProfile = require('./models/EmployeeProfile');
            const RolePermission = require('./models/RolePermission');
            const { syncAllEngineers } = require('./services/engineerSyncService');
            const { syncUsersForExistingEmployees } = require('./services/employeeUserService');

            const defaultCompany = await Company.findOne().lean();
            const companyId = defaultCompany ? defaultCompany._id : null;

            // 1. Inspect Excel files
            const files = [
                'D:/tally/Quotations/Employee detail - SBU2.xlsx',
                'D:/tally/Quotations/AR CRM Roaster.xlsx'
            ];
            const debugSheetData = {};
            for (const filePath of files) {
                if (fs.existsSync(filePath)) {
                    const wb = XLSX.readFile(filePath);
                    debugSheetData[path.basename(filePath)] = {};
                    wb.SheetNames.forEach(sheet => {
                        debugSheetData[path.basename(filePath)][sheet] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
                    });
                }
            }
            fs.writeFileSync(path.join(__dirname, 'debug_emp_sheets.json'), JSON.stringify(debugSheetData, null, 2));
            console.log('[EMPLOYEE IMPORT] Dumped spreadsheet contents to debug_emp_sheets.json');

            // 2. Perform Employee Import if data exists in Employee detail - SBU2.xlsx
            const sbu2Rows = debugSheetData['Employee detail - SBU2.xlsx'] ? Object.values(debugSheetData['Employee detail - SBU2.xlsx'])[0] || [] : [];
            const roasterRows = debugSheetData['AR CRM Roaster.xlsx'] ? Object.values(debugSheetData['AR CRM Roaster.xlsx'])[0] || [] : [];
            const allImportRows = [...sbu2Rows, ...roasterRows];

            let importedCount = 0;
            let updatedCount = 0;

            for (let i = 0; i < allImportRows.length; i++) {
                const row = allImportRows[i];
                const name = String(row['Employee Name'] || row['employeename'] || row['Name'] || row['name'] || row['EMPLOYEE NAME'] || row['Emp Name'] || '').trim();
                if (!name || name.toLowerCase().includes('total')) continue;

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
                    updatedCount++;
                } else {
                    await EmployeeProfile.create(empObj);
                    importedCount++;
                }
            }

            console.log(`[EMPLOYEE IMPORT] Completed employee import: ${importedCount} created, ${updatedCount} updated.`);

            if (companyId) {
                await syncAllEngineers(companyId);
                await syncUsersForExistingEmployees(companyId);
                console.log('[EMPLOYEE IMPORT] Engineer sync and User accounts sync completed successfully.');
            }

            // 3. Update Admin Role Permissions
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

            await RolePermission.findOneAndUpdate(
                { role: 'admin' },
                { role: 'admin', permissions: adminPermissions },
                { upsert: true, returnDocument: 'after' }
            );
            console.log('[AUTH SEED] Admin role permissions successfully configured with full menu access.');

        } catch (empImportErr) {
            console.error('[EMPLOYEE IMPORT ERROR]', empImportErr);
        }
    } catch (err) {
        require('fs').writeFileSync(require('path').join(__dirname, 'debug_error.txt'), `Error: ${err.message}\nStack: ${err.stack}`);
        console.error("[DEBUG] Error writing quotations/products:", err);
    }
})();


// Trigger nodemon reload - force reload csm routes
module.exports = app;
// Force nodemon reload: 2026-07-30T23:21:00 (Flowchart centering X=500 updated)
