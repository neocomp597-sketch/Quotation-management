const mongoose = require('mongoose');
const EmployeeProfile = require('../../../models/EmployeeProfile');
const Branch = require('../../../models/Branch');
const { getActiveBranchId, isBranchBypassed, runWithTenant, tenantStorage } = require('../../../middlewares/tenantContext');

// Employee Master import (Payroll > Employees). The column names each field accepts are the
// ones the original importer (importController.importEmployees) read, in the same order, so
// the template, the Employees export and HR's "Employee Report Writer" files keep matching.
//
// Which employee a row updates:
//   1. the employee with the same EMP code (Employee ID or EMP code on the Employees screen);
//   2. otherwise the employee with the same name, as the original importer did - unless that
//      employee already has a different EMP code (then it may be another person with the same
//      name, which HR files have: three "Shubham Singh" with three codes), or several
//      employees share the name. Those rows are shown to the user instead of guessing.
// The original importer does not generate Employee IDs: a row without an EMP code creates an
// employee without one (the Employees screen can assign it later), and so does this import.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
// How the original importer compared a Location with the branches: letters and digits only.
const branchKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

// Spellings of two Stelmec branch names that the original importer accepted either way.
const BRANCH_SPELLINGS = { usgoan: 'usgaon', usgaon: 'usgoan', ularia: 'ullaria', ullaria: 'ularia' };

const STATUS_OPTIONS = ['Active', 'Hold', 'Resigned', 'Vacant'];

const salaryField = (key, label, aliases) => ({
    key, label, type: 'number', min: 0, aliases,
    description: `Monthly ${label}. Blank on a new employee = 0; blank on an existing one keeps the amount.`
});

const FIELDS = [
    {
        key: 'employeeCode', label: 'EMP Code',
        aliases: ['Employee code', 'Employee Code', 'employeeCode', 'EMP Code', 'empCode', 'Emp Code'],
        description: 'The employee code. A code that already exists updates that employee.'
    },
    {
        key: 'name', label: 'Employee Name', required: true,
        aliases: ['Employee Name', 'employeeName', 'Name'],
        requiredMessage: 'Employee name is missing.',
        requiredHint: 'Fill in the employee name.'
    },
    {
        key: 'email', label: 'Email', type: 'email', strict: true,
        aliases: ['Email', 'EMAIL', 'Email ID', 'EMAIL ID', 'Email Id', 'Official Email', 'Personal Email'],
        description: 'Becomes the employee\'s login. Blank = a login is made from the EMP code.'
    },
    {
        key: 'mobile', label: 'Mobile', type: 'phone',
        aliases: ['Mobile', 'MOBILE', 'Mobile Number', 'MOBILE NO', 'Mobile No.', 'Phone', 'PHONE', 'Phone Number', 'Contact', 'CONTACT NO', 'Contact No.', 'Cell', 'CONTACT']
    },
    {
        key: 'location', label: 'Location',
        aliases: ['Location', 'LOCATION', 'Branch Location', 'Branch'],
        description: 'Branch name, code, prefix or city. Not found = the OTHER branch.'
    },
    { key: 'pan', label: 'PAN', type: 'upperText', aliases: ['PAN', 'pan'] },
    { key: 'aadhaar', label: 'Aadhaar', aliases: ['Aadhaar', 'aadhaar'] },
    { key: 'uan', label: 'UAN', aliases: ['UAN', 'uan'] },
    { key: 'pfNumber', label: 'PF Number', aliases: ['PF Number', 'pfNumber'] },
    { key: 'esiNumber', label: 'ESI Number', aliases: ['ESI Number', 'esiNumber'] },
    { key: 'bankName', label: 'Bank Name', aliases: ['Bank Name', 'bank'] },
    { key: 'accountNumber', label: 'Account Number', aliases: ['Account Number', 'account'] },
    { key: 'ifscCode', label: 'IFSC Code', type: 'upperText', aliases: ['IFSC Code', 'ifsc'] },
    {
        key: 'joiningDate', label: 'Joining Date', type: 'date', aliases: ['Joining Date', 'joiningDate'],
        description: 'Blank on a new employee = today.'
    },
    { key: 'dob', label: 'DOB', type: 'date', aliases: ['DOB', 'dob'] },
    { key: 'department', label: 'Department', aliases: ['Department', 'dept'] },
    { key: 'designation', label: 'Designation', aliases: ['Designation', 'desig'] },
    { key: 'workerType', label: 'Worker Type', default: 'PERMANENT WORKER', aliases: ['Worker Type', 'workerType'] },
    { key: 'employeeType', label: 'Employee Type', default: 'ONSITE', aliases: ['Employee Type', 'employeeType'] },
    { key: 'status', label: 'Status', type: 'option', options: STATUS_OPTIONS, default: 'Active', aliases: ['Status', 'status'] },
    salaryField('basic', 'Basic Salary', ['Basic Salary', 'basic']),
    salaryField('hra', 'HRA', ['HRA', 'hra']),
    salaryField('da', 'DA', ['DA', 'da']),
    salaryField('specialAllowance', 'Special Allowance', ['Special Allowance', 'specialAllowance'])
];

const PLAIN_FIELDS = [
    'name', 'email', 'mobile', 'pan', 'aadhaar', 'uan', 'pfNumber', 'esiNumber', 'bankName', 'accountNumber',
    'ifscCode', 'joiningDate', 'dob', 'department', 'designation', 'workerType', 'employeeType', 'status'
];
const SALARY_FIELDS = ['basic', 'hra', 'da', 'specialAllowance'];

const toObjectId = (id) => (id ? new mongoose.Types.ObjectId(String(id)) : null);

const centuryBack = (date) => new Date(Date.UTC(date.getUTCFullYear() - 100, date.getUTCMonth(), date.getUTCDate()));

/** The branch a new record gets when nothing else gives one, as tenantPlugin does on create. */
const activeBranch = () => {
    if (isBranchBypassed()) return null;
    const id = getActiveBranchId();
    return id && mongoose.Types.ObjectId.isValid(id) ? toObjectId(id) : null;
};

const codesOf = (employee) => [...new Set([employee.employeeId, employee.externalEmployeeCode].map(matchKey).filter(Boolean))];

const codeLabel = (employee) => employee.employeeId || employee.externalEmployeeCode || '';

/**
 * The existing employee a row updates, or the reason it cannot be decided.
 * Returns { record, by, field } | { issue } | {}.
 */
const findEmployee = (data, context) => {
    const code = matchKey(data.employeeCode);
    if (code) {
        const sameCode = context.byCode.get(code) || [];
        if (sameCode.length === 1) return { record: sameCode[0], by: 'EMP code', field: 'employeeCode' };
        if (sameCode.length > 1) {
            return {
                issue: {
                    field: 'employeeCode',
                    code: 'AMBIGUOUS_MATCH',
                    message: `${sameCode.length} employees already have EMP code ${data.employeeCode}.`,
                    hint: 'Correct the duplicate codes on the Employees screen, then check this row again.'
                }
            };
        }
    }

    const sameName = context.byName.get(matchKey(data.name)) || [];
    if (!sameName.length) return {};
    if (sameName.length > 1) {
        return {
            issue: {
                field: code ? 'employeeCode' : 'name',
                code: 'AMBIGUOUS_MATCH',
                message: code
                    ? `${sameName.length} employees are named ${data.name}, and none has EMP code ${data.employeeCode}.`
                    : `${sameName.length} employees are named ${data.name}.`,
                hint: code
                    ? 'Use the EMP code of the employee to update. A new person with the same name is added on the Employees screen.'
                    : 'Fill in the EMP code so the right employee is updated.'
            }
        };
    }
    const [record] = sameName;
    if (code && codesOf(record).length) {
        return {
            issue: {
                field: 'employeeCode',
                code: 'CODE_MISMATCH',
                message: `${record.name} is already on the Employees screen with EMP code ${codeLabel(record)}, but this row has ${data.employeeCode}.`,
                hint: `Same person: change the code to ${codeLabel(record)} or clear it. A different person with the same name is added on the Employees screen.`
            }
        };
    }
    return { record, by: 'employee name', field: 'name' };
};

module.exports = {
    key: 'employees',
    label: 'Employees',
    recordLabel: 'employee',
    recordLabelPlural: 'employees',
    permissionKey: 'payroll_employees',
    // The same right as the old POST /api/import/employees (config/apiPermissions.js).
    permissions: [['payroll_employees', 'create']],
    model: EmployeeProfile,
    fields: FIELDS,

    /** Two rows are the same employee when they have the same EMP code, else the same name. */
    identityKeys(data) {
        const code = matchKey(data.employeeCode);
        if (code) return [{ key: `code:${code}`, field: 'employeeCode', label: 'EMP code' }];
        const name = matchKey(data.name);
        return name ? [{ key: `name:${name}`, field: 'name', label: 'employee name' }] : [];
    },

    async loadContext({ user }) {
        // Employees of every branch: an employee is one person whichever branch is open on the
        // screen (the original importer only saw the open branch and added the others again).
        const [employees, branches] = await Promise.all([
            EmployeeProfile.find({})
                .select('name employeeId externalEmployeeCode branchId assignedBranches')
                .setOptions({ bypassBranch: true })
                .lean(),
            Branch.find({ companyId: user?.companyId }).select('name code branchPrefix city').lean()
        ]);

        const byCode = new Map();
        const byName = new Map();
        const add = (map, key, employee) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(employee);
        };
        employees.forEach((employee) => {
            codesOf(employee).forEach((code) => add(byCode, code, employee));
            add(byName, matchKey(employee.name), employee);
        });

        // Location -> branch, exactly as the original importer compared them: the first branch
        // (in Branch Master order) whose name, code, prefix or city reads the same.
        const branchByKey = new Map();
        branches.forEach((branch) => {
            const name = branchKey(branch.name);
            [name, branchKey(branch.code), branchKey(branch.branchPrefix), branchKey(branch.city), BRANCH_SPELLINGS[name]]
                .filter(Boolean)
                .forEach((key) => {
                    if (!branchByKey.has(key)) branchByKey.set(key, branch);
                });
        });
        const otherBranch = branches.find((branch) => branchKey(branch.name) === 'other'
            || ['oth', 'other'].includes(branchKey(branch.code))) || null;

        // Branches this user may work in (null = all, as for admins).
        const allowed = Array.isArray(user?.allowedBranchIds) ? new Set(user.allowedBranchIds.map(String)) : null;
        const reachable = (employee) => {
            if (!allowed) return true;
            const ids = [employee.branchId, ...(employee.assignedBranches || [])].filter(Boolean).map(String);
            return !ids.length || ids.some((id) => allowed.has(id));
        };

        return { byCode, byName, branchByKey, otherBranch, reachable };
    },

    validate(data, { context }) {
        const issues = [];

        // Two-digit years read as 20YY, but the Employees export writes 20.MAY.90 for a 1990
        // birthday. A birth date in the future, or a joining date from 2050 on, is a 19YY date.
        if (data.dob instanceof Date && data.dob > new Date()) data.dob = centuryBack(data.dob);
        if (data.joiningDate instanceof Date && data.joiningDate.getUTCFullYear() >= 2050) data.joiningDate = centuryBack(data.joiningDate);

        // The email becomes the login, so it must be one address.
        if (data.email && /[\s,;]/.test(data.email)) {
            issues.push({
                field: 'email',
                code: 'INVALID_EMAIL',
                message: 'Email must be one address.',
                hint: `"${data.email}" has more than one. Keep the employee's own address - it becomes the login.`
            });
        }

        if (data.location !== undefined) {
            const branch = context.branchByKey.get(branchKey(data.location)) || context.otherBranch;
            if (branch) {
                data.branch = { id: String(branch._id), prefix: branch.branchPrefix || null, fromLocation: true };
            } else {
                issues.push({
                    field: 'location',
                    code: 'NOT_FOUND',
                    message: `Location "${data.location}" does not match any branch.`,
                    hint: 'Use a branch name, code or city from Branch Master, or leave Location blank.'
                });
            }
        } else if (context.otherBranch) {
            // A new employee without a Location goes to the OTHER branch; an existing one keeps its branch.
            data.branch = { id: String(context.otherBranch._id), prefix: context.otherBranch.branchPrefix || null, fromLocation: false };
        }

        const found = findEmployee(data, context);
        if (found.issue) issues.push(found.issue);
        else if (found.record && !context.reachable(found.record)) {
            issues.push({
                field: found.field,
                code: 'NO_ACCESS',
                message: `${found.record.name} belongs to a branch you do not work in.`,
                hint: 'Ask an admin to import this row, or skip it.'
            });
        }
        return issues;
    },

    match(data, context) {
        const found = findEmployee(data, context);
        return found.record ? { record: found.record, by: found.by, field: found.field } : null;
    },

    describe(record) {
        return [codeLabel(record), record.name].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        const doc = {};
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) doc[field] = data[field];
        });
        if (data.employeeCode) {
            doc.employeeId = data.employeeCode;
            doc.externalEmployeeCode = data.employeeCode;
        }
        // Joining date is required on an employee; the original importer used the import day.
        if (!doc.joiningDate) doc.joiningDate = new Date();
        doc.location = data.location || '';

        const branchId = data.branch ? toObjectId(data.branch.id) : null;
        doc.branchId = branchId || activeBranch();
        doc.assignedBranches = branchId ? [branchId] : [];
        doc.branchPrefix = data.branch ? data.branch.prefix : null;

        doc.salaryStructure = {};
        SALARY_FIELDS.forEach((field) => {
            doc.salaryStructure[field] = data[field] ?? 0;
        });
        return doc;
    },

    /**
     * Only the values the row supplies: a blank cell leaves the stored value unchanged, and
     * the other parts of the salary structure (PF, ESI, TDS...) are never touched.
     */
    toUpdate(data) {
        const set = {};
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        if (data.employeeCode) {
            set.employeeId = data.employeeCode;
            set.externalEmployeeCode = data.employeeCode;
        }
        if (data.location !== undefined && data.branch?.fromLocation) {
            const branchId = toObjectId(data.branch.id);
            set.location = data.location;
            set.branchId = branchId;
            set.assignedBranches = [branchId];
            set.branchPrefix = data.branch.prefix;
        }
        SALARY_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[`salaryStructure.${field}`] = data[field];
        });
        return set;
    },

    /**
     * The follow-up the original importer ran: Engineers Master and login accounts for the
     * employees. The logins are made for the employees of every branch, because rows can put
     * employees in other branches than the one open on the screen.
     */
    async afterImport({ user }) {
        const companyId = user?.companyId;
        if (!companyId) return;
        try {
            const { syncAllEngineers } = require('../../engineerSyncService');
            await syncAllEngineers(companyId, { returnEngineers: false });
        } catch (error) {
            console.error('Employee import: engineer sync failed:', error);
        }
        try {
            const { syncUsersForExistingEmployees } = require('../../employeeUserService');
            const store = tenantStorage.getStore() || {};
            await runWithTenant(companyId, async () => await syncUsersForExistingEmployees(companyId), { ...store, companyId, bypassBranch: true });
        } catch (error) {
            console.error('Employee import: login sync failed:', error);
        }
    }
};
