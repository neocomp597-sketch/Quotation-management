const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Company = require('../models/Company');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quotation_db');
        console.log('Connected to MongoDB');

        // 1. Find RR Techgrove company
        const rrCompany = await Company.findOne({
            $or: [
                { name: /rr techgrove/i },
                { companyName: /rr techgrove/i },
                { slug: /rr-techgrove/i }
            ]
        }).lean();

        console.log('RR Techgrove Company:', rrCompany);

        if (!rrCompany) {
            console.log('Searching all companies to find matching name...');
            const allCompanies = await Company.find().lean();
            console.log('All companies in DB:', allCompanies.map(c => ({ id: c._id, name: c.name || c.companyName })));
            await mongoose.disconnect();
            return;
        }

        const rrCompanyId = rrCompany._id;

        // 2. Read Employee detail - SBU2.xlsx
        const excelPath = 'D:/tally/Quotations/Employee detail - SBU2.xlsx';
        if (!fs.existsSync(excelPath)) {
            console.log('Excel file not found at:', excelPath);
            await mongoose.disconnect();
            return;
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

        console.log(`Found ${empNames.size} names and ${empEmails.size} emails in SBU2 excel.`);

        // 3. Find EmployeeProfile records in RR Techgrove company that match
        const rrEmployees = await EmployeeProfile.find({ companyId: rrCompanyId }).lean();
        console.log(`Total EmployeeProfiles in RR Techgrove: ${rrEmployees.length}`);

        const toDeleteEmpIds = [];
        const toDeleteUserEmails = [];
        const toDeleteEngineerIds = [];

        for (const emp of rrEmployees) {
            const nameMatch = emp.name && empNames.has(emp.name.toLowerCase());
            const emailMatch = emp.email && empEmails.has(emp.email.toLowerCase());

            if (nameMatch || emailMatch) {
                toDeleteEmpIds.push(emp._id);
                if (emp.email) toDeleteUserEmails.push(emp.email.toLowerCase());
            }
        }

        console.log(`Matching employees to delete from RR Techgrove: ${toDeleteEmpIds.length}`);

        if (toDeleteEmpIds.length > 0) {
            const delEmps = await EmployeeProfile.deleteMany({ _id: { $in: toDeleteEmpIds } });
            console.log(`Deleted ${delEmps.deletedCount} EmployeeProfiles from RR Techgrove.`);
        }

        // Also delete Users created for these employees in RR Techgrove (do NOT delete super@gmail.com or main admin)
        if (toDeleteUserEmails.length > 0) {
            const delUsers = await User.deleteMany({
                companyId: rrCompanyId,
                email: { $in: toDeleteUserEmails.map(e => new RegExp('^' + e.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i')) },
                role: { $ne: 'super_admin' }
            });
            console.log(`Deleted ${delUsers.deletedCount} Users from RR Techgrove.`);
        }

        // Also delete Engineers created for these employees in RR Techgrove
        const delEngineers = await Engineer.deleteMany({
            companyId: rrCompanyId,
            $or: [
                { email: { $in: Array.from(empEmails) } },
                { name: { $in: Array.from(empNames).map(n => new RegExp('^' + n.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i')) } }
            ]
        });
        console.log(`Deleted ${delEngineers.deletedCount} Engineers from RR Techgrove.`);

        console.log('Cleanup completed successfully.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

cleanup();
