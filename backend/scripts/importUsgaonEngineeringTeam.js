const path = require('path');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Branch = require('../models/Branch');
const EmployeeProfile = require('../models/EmployeeProfile');
const { syncUserForEmployee } = require('../services/employeeUserService');
const { syncEmployeeToEngineer } = require('../services/engineerSyncService');
const { generateNextUniqueEmployeeId } = require('../utils/employeeIdHelper');

const workbookPath = 'C:\\Users\\wagho\\Downloads\\Data for Software.xlsx';
const clean = (value) => String(value ?? '').trim().replace(/>$/, '');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadTeam = () => {
    const workbook = xlsx.readFile(workbookPath);
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    const team = [];

    for (let index = 2; index < rows.length; index += 1) {
        const row = rows[index];
        if (!Number.isFinite(Number(row[0])) || !clean(row[1]) || !clean(row[3])) continue;
        team.push({
            externalEmployeeCode: clean(row[1]).replace(/\s+/g, '').toUpperCase(),
            name: clean(row[3]),
            mobile: clean(row[4]),
            email: clean(row[8]).toLowerCase(),
            location: clean(row[9]) || 'Usgaon',
            designation: team.length < 3 ? 'Team Leader' : 'Service Engineer'
        });
    }
    return team;
};

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const branch = await Branch.findOne({
            $or: [{ name: /^usgoan$/i }, { name: /^usgaon$/i }, { code: /^sbu-?ii$/i }]
        }).setOptions({ bypassBranch: true }).lean();
        if (!branch) throw new Error('Usgaon branch was not found.');

        const team = loadTeam();
        if (team.length !== 36) throw new Error(`Expected 36 employees, found ${team.length}.`);

        const summary = { created: 0, updated: 0, teamLeaders: 0, serviceEngineers: 0 };
        for (const row of team) {
            const existing = await EmployeeProfile.findOne({
                companyId: branch.companyId,
                $or: [
                    { externalEmployeeCode: new RegExp(`^${escapeRegex(row.externalEmployeeCode)}$`, 'i') },
                    { name: new RegExp(`^${escapeRegex(row.name)}$`, 'i') }
                ]
            });
            const fields = {
                ...row, companyId: branch.companyId, department: 'Engineering', status: 'Active',
                branchId: branch._id, assignedBranches: [branch._id], branchPrefix: branch.branchPrefix
            };
            let employee;
            if (existing) {
                employee = await EmployeeProfile.findByIdAndUpdate(existing._id, { $set: fields }, { new: true });
                summary.updated += 1;
            } else {
                const identity = await generateNextUniqueEmployeeId(branch.companyId, branch._id);
                employee = await EmployeeProfile.create({ ...fields, employeeId: identity.employeeId, joiningDate: new Date() });
                summary.created += 1;
            }
            await syncUserForEmployee(employee);
            if (row.designation === 'Service Engineer') {
                await syncEmployeeToEngineer(employee);
                summary.serviceEngineers += 1;
            } else summary.teamLeaders += 1;
        }
        console.log(JSON.stringify({ branch: branch.name, total: team.length, ...summary }, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
