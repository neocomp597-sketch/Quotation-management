const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const Company = require('../models/Company');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const RolePermission = require('../models/RolePermission');
const { syncAllEngineers } = require('./engineerSyncService');
const { syncUsersForExistingEmployees } = require('./employeeUserService');

/**
 * Seeds employees from Employee detail - SBU2.xlsx into the organisation of user super@gmail.com
 */
const seedSuperEmployees = async () => {
    try {
        console.log('[SeedSuperEmployees] Starting employee seeding process for super@gmail.com organisation...');

        const targetEmail = 'super@gmail.com';
        const escapedTargetEmail = targetEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // 1. Find or create super@gmail.com user and company
        let superUser = await User.findOne({
            email: { $regex: new RegExp('^' + escapedTargetEmail + '$', 'i') }
        });

        let targetCompanyId = null;

        if (superUser && superUser.companyId) {
            targetCompanyId = superUser.companyId;
            console.log(`[SeedSuperEmployees] Found super@gmail.com user with existing CompanyId: ${targetCompanyId}`);
        } else {
            // Find or create Company for super@gmail.com
            let company = await Company.findOne({
                $or: [
                    { name: /super/i },
                    { slug: /super/i }
                ]
            });

            if (!company) {
                // Create a dedicated Company for super@gmail.com
                company = await Company.create({
                    name: 'Super Organisation',
                    slug: 'super-organisation',
                    status: 'ACTIVE',
                    isActive: true
                });
                console.log(`[SeedSuperEmployees] Created new Company: Super Organisation (${company._id})`);
            } else {
                console.log(`[SeedSuperEmployees] Using existing Super Company: ${company.name} (${company._id})`);
            }

            targetCompanyId = company._id;

            if (superUser) {
                superUser.companyId = targetCompanyId;
                await superUser.save();
                console.log(`[SeedSuperEmployees] Updated existing super@gmail.com user with CompanyId: ${targetCompanyId}`);
            } else {
                // Create super@gmail.com user
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash('123456', salt);
                superUser = await User.create({
                    name: 'Super Admin',
                    email: targetEmail,
                    passwordHash,
                    mustChangePassword: false,
                    role: 'admin',
                    companyId: targetCompanyId,
                    status: true,
                    isActive: true
                });
                console.log(`[SeedSuperEmployees] Created super@gmail.com user with admin role and password '123456'`);
            }
        }

        const companyId = targetCompanyId;

        // 2. Read Employee detail - SBU2.xlsx
        const possiblePaths = [
            'D:/tally/Quotations/Employee detail - SBU2.xlsx',
            path.join(__dirname, '../../Employee detail - SBU2.xlsx'),
            path.join(__dirname, '../Employee detail - SBU2.xlsx')
        ];

        let filePath = possiblePaths.find(p => fs.existsSync(p));

        if (!filePath) {
            console.error(`[SeedSuperEmployees Error] Could not find Excel file 'Employee detail - SBU2.xlsx' in candidate paths.`);
            return {
                success: false,
                message: "File 'Employee detail - SBU2.xlsx' not found.",
                targetEmail,
                companyId
            };
        }

        console.log(`[SeedSuperEmployees] Reading Excel file: ${filePath}`);
        const wb = XLSX.readFile(filePath);

        let totalCreated = 0;
        let totalUpdated = 0;
        const fileSummaries = {};
        const processedEmployees = [];

        let empSeqCounter = 1001;

        for (const sheetName of wb.SheetNames) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
            console.log(`[SeedSuperEmployees] Sheet "${sheetName}": ${rows.length} rows found.`);

            let sheetCreated = 0;
            let sheetUpdated = 0;

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
                    email: email ? email.toLowerCase() : undefined,
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
                    status: status.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
                    salaryStructure: { basic, hra, da, specialAllowance },
                    companyId
                };

                const searchConditions = [{ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }];
                if (email) {
                    searchConditions.push({ email: email.toLowerCase() });
                }

                const existing = await EmployeeProfile.findOne({
                    companyId,
                    $or: searchConditions
                });

                if (existing) {
                    await EmployeeProfile.findByIdAndUpdate(existing._id, empObj);
                    sheetUpdated++;
                    totalUpdated++;
                } else {
                    empObj.employeeId = `EMP${empSeqCounter++}`;
                    await EmployeeProfile.create(empObj);
                    sheetCreated++;
                    totalCreated++;
                }

                processedEmployees.push({ name, email, department, designation });
            }

            fileSummaries[sheetName] = { created: sheetCreated, updated: sheetUpdated };
        }

        console.log(`[SeedSuperEmployees] Employee Profiles: Created = ${totalCreated}, Updated = ${totalUpdated}`);

        // 3. Sync Engineers
        const syncedEngineers = await syncAllEngineers(companyId);
        console.log(`[SeedSuperEmployees] Synced ${syncedEngineers ? syncedEngineers.length : 0} Engineers`);

        // 4. Sync User Accounts
        const userSyncResult = await syncUsersForExistingEmployees(companyId);
        console.log(`[SeedSuperEmployees] User accounts synced: ${JSON.stringify(userSyncResult)}`);

        // 5. Configure Admin Role Permissions
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
            { role: 'admin', companyId },
            { role: 'admin', companyId, menuVisibility: adminPermissions },
            { upsert: true, returnDocument: 'after' }
        );

        const resultPayload = {
            success: true,
            message: `Successfully seeded employees from 'Employee detail - SBU2.xlsx' into super@gmail.com organisation!`,
            superUser: {
                id: superUser._id,
                email: superUser.email,
                companyId: targetCompanyId
            },
            summary: {
                totalCreated,
                totalUpdated,
                fileSummaries,
                syncedEngineersCount: syncedEngineers ? syncedEngineers.length : 0,
                userSyncResult,
                adminPermissionsUpdated: Boolean(rolePermission)
            },
            processedEmployeesCount: processedEmployees.length,
            processedEmployeesSample: processedEmployees.slice(0, 15)
        };

        console.log(`[SeedSuperEmployees] SEEDING COMPLETE! Total Created: ${totalCreated}, Total Updated: ${totalUpdated}`);
        return resultPayload;
    } catch (err) {
        console.error('[SeedSuperEmployees Error]:', err);
        return {
            success: false,
            error: err.message,
            stack: err.stack
        };
    }
};

module.exports = {
    seedSuperEmployees
};
