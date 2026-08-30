const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Company = require('../models/Company');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');

const cleanupRRTechgroveEmployees = async () => {
    try {
        console.log('[CleanupRRTechgrove] Running comprehensive SBU2 employee cleanup across non-super companies...');

        // 1. Find Super Organisation / super@gmail.com company ID
        const superUser = await User.findOne({ email: 'super@gmail.com' }).lean();
        const superCompany = await Company.findOne({ $or: [{ name: /super/i }, { slug: /super/i }] }).lean();
        const superCompanyId = superUser?.companyId?.toString() || superCompany?._id?.toString();

        console.log('[CleanupRRTechgrove] Super CompanyId:', superCompanyId);

        // 2. Read Employee detail - SBU2.xlsx
        const excelPath = 'D:/tally/Quotations/Employee detail - SBU2.xlsx';
        if (!fs.existsSync(excelPath)) {
            const errRes = { success: false, message: 'SBU2 excel file not found at D:/tally/Quotations/Employee detail - SBU2.xlsx' };
            fs.writeFileSync(path.join(__dirname, '../cleanup_result.json'), JSON.stringify(errRes, null, 2));
            return errRes;
        }

        const wb = XLSX.readFile(excelPath);
        const empNames = new Set();
        const empEmails = new Set();

        for (const sheetName of wb.SheetNames) {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
            for (const row of rows) {
                const name = String(row['Employee Name'] || row['employeename'] || row['Name'] || row['name'] || row['EMPLOYEE NAME'] || row['Emp Name'] || '').trim();
                if (!name || name.toLowerCase().includes('total') || name.toLowerCase().includes('header')) continue;
                empNames.add(name.toLowerCase());
                const email = String(row['Email'] || row['email'] || row['EMAIL'] || '').trim().toLowerCase();
                if (email) empEmails.add(email);
            }
        }

        console.log(`[CleanupRRTechgrove] Read ${empNames.size} names from SBU2 Excel.`);

        // 3. Query all EmployeeProfiles matching these names
        const regexNames = Array.from(empNames).map(n => new RegExp('^' + n.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i'));
        
        // Find all matching EmployeeProfiles where companyId is NOT superCompanyId
        const allMatchingEmps = await EmployeeProfile.find({
            name: { $in: regexNames }
        }).lean();

        console.log(`[CleanupRRTechgrove] Total EmployeeProfiles in DB matching SBU2 names: ${allMatchingEmps.length}`);

        const toDeleteIds = [];
        const toDeleteEmails = [];
        const matchedDetails = [];

        for (const emp of allMatchingEmps) {
            const empCompId = emp.companyId ? emp.companyId.toString() : null;
            // If the employee is NOT in the super company, mark for deletion
            if (empCompId !== superCompanyId) {
                toDeleteIds.push(emp._id);
                if (emp.email) toDeleteEmails.push(emp.email.toLowerCase());
                matchedDetails.push({ id: emp._id, name: emp.name, companyId: empCompId });
            }
        }

        console.log(`[CleanupRRTechgrove] EmployeeProfiles to delete outside Super company: ${toDeleteIds.length}`);

        let deletedEmployeesCount = 0;
        if (toDeleteIds.length > 0) {
            const delRes = await EmployeeProfile.deleteMany({ _id: { $in: toDeleteIds } });
            deletedEmployeesCount = delRes.deletedCount;
        }

        // Delete Users created for these employees outside Super Company
        let deletedUsersCount = 0;
        if (toDeleteEmails.length > 0) {
            const delUsers = await User.deleteMany({
                companyId: { $ne: superCompanyId },
                email: { $in: toDeleteEmails.map(e => new RegExp('^' + e.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i')) },
                role: { $nin: ['super_admin', 'superadmin'] }
            });
            deletedUsersCount = delUsers.deletedCount;
        }

        // Delete Engineers created for these employees outside Super Company
        let deletedEngineersCount = 0;
        const delEngineers = await Engineer.deleteMany({
            companyId: { $ne: superCompanyId },
            name: { $in: regexNames }
        });
        deletedEngineersCount = delEngineers.deletedCount;

        const summary = {
            timestamp: new Date().toISOString(),
            superCompanyId,
            matchedCount: allMatchingEmps.length,
            toDeleteCount: toDeleteIds.length,
            matchedDetails: matchedDetails.slice(0, 20),
            deletedEmployeesCount,
            deletedUsersCount,
            deletedEngineersCount
        };

        console.log('[CleanupRRTechgrove] Comprehensive Cleanup Completed:', summary);
        fs.writeFileSync(path.join(__dirname, '../cleanup_result.json'), JSON.stringify({ success: true, summary }, null, 2));
        return { success: true, summary };
    } catch (err) {
        console.error('[CleanupRRTechgrove Error]:', err);
        const errObj = { success: false, error: err.message, stack: err.stack };
        try {
            fs.writeFileSync(path.join(__dirname, '../cleanup_result.json'), JSON.stringify(errObj, null, 2));
        } catch (e) {}
        return errObj;
    }
};

module.exports = {
    cleanupRRTechgroveEmployees
};
