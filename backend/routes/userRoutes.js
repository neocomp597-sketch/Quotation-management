const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Ensure you have this controller or remove if not needed yet
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/seed-employees-admin', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const fs = require('fs');
        const path = require('path');
        const Company = require('../models/Company');
        const EmployeeProfile = require('../models/EmployeeProfile');
        const RolePermission = require('../models/RolePermission');
        const { syncAllEngineers } = require('../services/engineerSyncService');
        const { syncUsersForExistingEmployees } = require('../services/employeeUserService');

        const defaultCompany = await Company.findOne().lean();
        const companyId = defaultCompany ? defaultCompany._id : null;

        const files = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            'D:/tally/Quotations/AR CRM Roaster.xlsx'
        ];

        const fileSummaries = {};
        let totalCreated = 0;
        let totalUpdated = 0;

        for (const filePath of files) {
            if (!fs.existsSync(filePath)) {
                fileSummaries[path.basename(filePath)] = { status: 'File not found' };
                continue;
            }

            const wb = XLSX.readFile(filePath);
            const sheetName = wb.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

            let fileCreated = 0;
            let fileUpdated = 0;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const name = String(row['Employee Name'] || row['employeename'] || row['Name'] || row['name'] || row['EMPLOYEE NAME'] || row['Emp Name'] || '').trim();
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
            }

            fileSummaries[path.basename(filePath)] = { rows: rows.length, created: fileCreated, updated: fileUpdated };
        }

        let engineerSyncResult = null;
        let userSyncResult = null;
        if (companyId) {
            engineerSyncResult = await syncAllEngineers(companyId);
            userSyncResult = await syncUsersForExistingEmployees(companyId);
        }

        // Configure Admin Permissions
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

        res.json({
            success: true,
            message: 'Employee import and Admin permissions successfully initialized',
            summary: {
                totalCreated,
                totalUpdated,
                fileSummaries,
                engineerSyncResult,
                userSyncResult,
                adminPermissionsUpdated: Boolean(rolePermission)
            }
        });
    } catch (err) {
        console.error('Error in seed-employees-admin:', err);
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});

// Define user routes here
router.get('/', protect, userController.getAllUsers);
router.post('/', protect, admin, userController.createUser);
router.get('/note', protect, userController.getUserNote);
router.put('/note', protect, userController.updateUserNote);
router.put('/profile', protect, userController.updateUserProfile);
router.put('/:id', protect, admin, userController.updateUser);
router.put('/:id/permissions', protect, admin, userController.updateUserPermissions);
router.patch('/:id/role', protect, admin, userController.updateUserRole);
router.delete('/:id', protect, admin, userController.deleteUser);

module.exports = router;
