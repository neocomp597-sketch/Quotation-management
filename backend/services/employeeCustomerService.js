const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Every employee is also a customer in Customer Master (client, 2026-11-15), so company assets such
 * as laptops can be allocated to employees in Invoice Bulk Upload and Serial No Transfer, and
 * tickets raised for them. Invoice Bulk Upload is mostly used for these internal assets, with the
 * employee's code and name as the customer (e.g. HO758 / Ratna Bagade); its real customers are
 * left as they are.
 *
 * One customer per employee (Customer.employeeProfileId), never two (client, 2026-11-15: "do not
 * create duplicate entry"):
 *   - An unlinked customer that is the employee is taken over: one whose code is the Employee ID
 *     (or the employee's external code) with a compatible name or the same email, or, without a
 *     code match, the only customer with a compatible name, no GSTIN, that no other employee shares.
 *     Compatible names: the same, or the same first and last name ("Anish Nadar" for
 *     "Anish Thangaswamy Nadar").
 *   - If the employee already has a customer as well, the two are merged: everything that refers
 *     to one (serial numbers, their history, tickets, ...) is moved to the other, which stays
 *     linked, and the other is deleted. The kept one has the most serial numbers (usually the one
 *     Invoice Bulk Upload uses), then the linked one, then the oldest.
 *   - Otherwise a customer is created: name, Employee ID as the code (unless another customer has
 *     it), mobile, email, home branch, Segment "Employee".
 * Later syncs keep the name, mobile, email, segment and status (Resigned = Inactive) in step; the
 * code and branch are not changed once set. Deleting an employee leaves the customer. Vacant
 * positions get none.
 *
 * Queries name the company and look across branches: the sync runs inside requests (where the
 * active branch would otherwise filter Customer) and at server startup (no tenant context).
 */

const ANY_BRANCH = { bypassBranch: true };
const EVERYWHERE = { bypassBranch: true, bypassTenant: true };
const EMPLOYEE_SEGMENT = 'Employee';
const PERSON_FILTER = { isVacant: { $ne: true }, status: { $ne: 'Vacant' } };

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const sameText = (a, b) => Boolean(clean(a)) && clean(a).toLowerCase() === clean(b).toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (value) => value?._id || value || null;

// A vacant position is not a person and gets no customer.
const isPerson = (employee) => Boolean(employee && clean(employee.name) && employee.companyId
    && !employee.isVacant && employee.status !== 'Vacant');

const nameTokens = (value) => clean(value).toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
// The same person's name written two ways: identical, or the same first and last name.
const namesMatch = (a, b) => {
    const ta = nameTokens(a);
    const tb = nameTokens(b);
    if (!ta.length || !tb.length) return false;
    if (ta.join(' ') === tb.join(' ')) return true;
    return ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
};
// A database pattern finding the names namesMatch may accept (checked again with namesMatch).
const namePattern = (name) => {
    const tokens = nameTokens(name);
    if (!tokens.length) return null;
    if (tokens.length === 1) return new RegExp(`^\\s*${escapeRegex(tokens[0])}\\s*$`, 'i');
    return new RegExp(`^\\s*${escapeRegex(tokens[0])}\\b.*\\b${escapeRegex(tokens[tokens.length - 1])}\\.?\\s*$`, 'i');
};
const customerNamed = (customer, name) => namesMatch(customer.companyName, name) || namesMatch(customer.customerName, name);
// Invoice Bulk Upload sheets sometimes have the employee's email in the customer name column.
const customerNamedByEmail = (customer, email) => Boolean(clean(email))
    && (sameText(customer.companyName, email) || sameText(customer.customerName, email));
const employeeCodes = (employee) => [...new Set([employee.employeeId, employee.externalEmployeeCode].map(clean).filter(Boolean))];
const codePatterns = (codes) => codes.map((code) => new RegExp(`^\\s*${escapeRegex(code)}\\s*$`, 'i'));

// The fields that follow the employee on every sync.
const followedFields = (employee) => {
    const fields = {
        customerName: clean(employee.name),
        companyName: clean(employee.name),
        contactPerson: clean(employee.name),
        segment: EMPLOYEE_SEGMENT,
        status: employee.status === 'Resigned' ? 'Inactive' : 'Active'
    };
    if (clean(employee.mobile)) fields.mobile = clean(employee.mobile);
    if (clean(employee.email)) fields.email = clean(employee.email).toLowerCase();
    return fields;
};

/** Unlinked customers that are this employee (see the top of this file), excluding `excludeId`. */
const findSamePersonCustomers = async (employee, excludeId = null) => {
    const companyId = employee.companyId;
    const found = new Map();
    const add = (customer) => { if (String(customer._id) !== String(excludeId)) found.set(String(customer._id), customer); };

    const codes = employeeCodes(employee);
    if (codes.length) {
        const byCode = await Customer.find({ companyId, employeeProfileId: null, externalCode: { $in: codePatterns(codes) } }).setOptions(ANY_BRANCH);
        byCode.filter((customer) => customerNamed(customer, employee.name) || customerNamedByEmail(customer, employee.email)
            || (clean(employee.email) && sameText(customer.email, employee.email))).forEach(add);
    }
    const email = clean(employee.email);
    if (email) {
        const emailPattern = new RegExp(`^\\s*${escapeRegex(email)}\\s*$`, 'i');
        const byEmail = await Customer.find({
            companyId, employeeProfileId: null, $or: [{ email: emailPattern }, { companyName: emailPattern }, { customerName: emailPattern }]
        }).setOptions(ANY_BRANCH).limit(5);
        byEmail.filter((customer) => (customerNamed(customer, employee.name) || customerNamedByEmail(customer, email)) && !clean(customer.gstin)).forEach(add);
    }
    if (!found.size) {
        // By name alone only when exactly one customer has it and no other employee has it too.
        const pattern = namePattern(employee.name);
        const byName = pattern
            ? (await Customer.find({ companyId, employeeProfileId: null, $or: [{ companyName: pattern }, { customerName: pattern }] }).setOptions(ANY_BRANCH).limit(10))
                .filter((customer) => customerNamed(customer, employee.name) && !clean(customer.gstin) && String(customer._id) !== String(excludeId))
            : [];
        if (byName.length === 1) {
            const candidate = byName[0];
            const others = await EmployeeProfile.find({ companyId, _id: { $ne: employee._id }, ...PERSON_FILTER, name: namePattern(candidate.companyName) || pattern })
                .select('name').setOptions(ANY_BRANCH).lean();
            if (!others.some((other) => customerNamed(candidate, other.name))) add(candidate);
        }
    }
    return [...found.values()];
};

// Every path of every model that refers to a Customer: [{ model, path, isArray }].
const customerReferencePaths = () => {
    const paths = [];
    for (const name of mongoose.modelNames()) {
        const model = mongoose.model(name);
        model.schema.eachPath((path, type) => {
            if (type.instance === 'ObjectId' && type.options?.ref === 'Customer') paths.push({ model, path, isArray: false });
            else if (type.instance === 'Array' && (type.caster?.options?.ref === 'Customer' || type.options?.type?.[0]?.ref === 'Customer')) paths.push({ model, path, isArray: true });
        });
    }
    return paths;
};
const countAssets = (customerId) => mongoose.model('Asset').countDocuments({ customerId }).setOptions(EVERYWHERE);

/**
 * Moves everything that refers to `drop` to `keep` and deletes `drop`. Serial numbers also take
 * `keep`'s code and name as their customer. If a reference cannot be moved, `drop` is kept but
 * unlinked and made Inactive, so nothing is left pointing at a deleted customer.
 */
const mergeCustomerInto = async (drop, keep, employee) => {
    const Asset = mongoose.model('Asset');
    await Asset.updateMany({ customerId: drop._id }, {
        $set: { customerId: keep._id, customerCode: clean(keep.externalCode), customerNameStr: clean(keep.companyName || keep.customerName) }
    }).setOptions(EVERYWHERE);
    let complete = true;
    for (const { model, path, isArray } of customerReferencePaths()) {
        if (model.modelName === 'Customer' && path === '_id') continue;
        try {
            if (isArray) {
                await model.updateMany({ [path]: drop._id }, { $set: { [`${path}.$[ref]`]: keep._id } }, { arrayFilters: [{ ref: drop._id }] }).setOptions(EVERYWHERE);
            } else {
                await model.updateMany({ [path]: drop._id }, { $set: { [path]: keep._id } }).setOptions(EVERYWHERE);
            }
        } catch (error) {
            complete = false;
            console.error(`[Employee -> Customer sync] could not move ${model.modelName}.${path} from customer ${drop._id}:`, error.message);
        }
    }
    if (complete) {
        await Customer.deleteOne({ _id: drop._id }).setOptions(EVERYWHERE);
    } else {
        await Customer.updateOne({ _id: drop._id }, { $set: { employeeProfileId: null, status: 'Inactive' } }).setOptions(EVERYWHERE);
    }
    try {
        const AuditLog = mongoose.model('AuditLog');
        const actor = await mongoose.model('User').findOne({ companyId: employee.companyId, role: { $in: ['admin', 'Admin', 'super_admin'] } }).select('_id').setOptions(EVERYWHERE).lean();
        if (actor) {
            await AuditLog.create({
                action: 'CUSTOMER_MERGED',
                entityType: 'Customer',
                entityId: keep._id,
                userId: actor._id,
                userName: 'Employee -> Customer sync',
                oldValue: { customerId: drop._id, code: drop.externalCode || '', name: drop.companyName || drop.customerName || '' },
                newValue: { customerId: keep._id, code: keep.externalCode || '', name: keep.companyName || keep.customerName || '' },
                reason: `Same person as employee ${employee.name}${employee.employeeId ? ` (${employee.employeeId})` : ''}${complete ? '' : '; old customer kept as Inactive'}`,
                companyId: employee.companyId
            });
        }
    } catch (error) {
        console.error('[Employee -> Customer sync] merge audit failed:', error.message);
    }
    console.log(`[Employee -> Customer sync] merged customer "${drop.companyName}" (${drop.externalCode || 'no code'}) into "${keep.companyName}" (${keep.externalCode || 'no code'}) for employee ${employee.name}`);
};

// Which of an employee's customers stays: the one with the most serial numbers (usually the one
// Invoice Bulk Upload uses, with the code the uploads carry), then the linked one, then the oldest.
const pickSurvivor = async (linked, others) => {
    const all = [linked, ...others].filter(Boolean);
    const withCounts = await Promise.all(all.map(async (customer) => ({ customer, assets: await countAssets(customer._id) })));
    const isLinked = (customer) => Boolean(linked) && String(customer._id) === String(linked._id);
    withCounts.sort((a, b) => (b.assets - a.assets)
        || (Number(isLinked(b.customer)) - Number(isLinked(a.customer)))
        || (new Date(a.customer.createdAt || 0) - new Date(b.customer.createdAt || 0)));
    return withCounts[0].customer;
};

/**
 * Creates, links, merges or updates the customer of one employee (a document, a lean object or an
 * id). Never throws: a failure is logged and the employee's own save stands. Resolves to
 * { customer, action }: created, linked (an existing customer taken over), merged (two customers
 * of the employee made one), updated, unchanged or skipped (a vacant position, or a failure).
 */
const syncOne = async (employeeOrId) => {
    try {
        let employee = employeeOrId;
        if (!employee || typeof employee !== 'object' || !employee.name) {
            employee = await EmployeeProfile.findById(idOf(employeeOrId)).setOptions(ANY_BRANCH).lean();
        }
        if (!isPerson(employee)) return { customer: null, action: 'skipped' };
        const companyId = employee.companyId;

        const linked = await Customer.findOne({ companyId, employeeProfileId: employee._id }).setOptions(ANY_BRANCH);
        const samePerson = await findSamePersonCustomers(employee, linked?._id);
        let customer = linked;
        let action = linked ? 'updated' : 'linked';
        if (samePerson.length) {
            const survivor = await pickSurvivor(linked, samePerson);
            for (const other of [linked, ...samePerson].filter(Boolean)) {
                if (String(other._id) !== String(survivor._id)) await mergeCustomerInto(other, survivor, employee);
            }
            customer = await Customer.findById(survivor._id).setOptions(ANY_BRANCH);
            action = linked ? 'merged' : 'linked';
        }

        const fields = followedFields(employee);
        const code = clean(employee.employeeId);
        const codeHolder = code
            ? await Customer.findOne({ companyId, externalCode: code, ...(customer ? { _id: { $ne: customer._id } } : {}) })
                .collation(Customer.CUSTOMER_CODE_COLLATION).setOptions(ANY_BRANCH).select('_id').lean()
            : null;

        if (customer) {
            const update = { ...fields, employeeProfileId: employee._id };
            // A customer without a code takes the Employee ID, unless another customer has it.
            if (!clean(customer.externalCode) && code && !codeHolder) update.externalCode = code;
            const changed = Object.entries(update).some(([key, value]) => String(customer[key] ?? '') !== String(value ?? ''));
            if (!changed) return { customer, action: action === 'updated' ? 'unchanged' : action };
            const save = () => Customer.findOneAndUpdate({ _id: customer._id, companyId }, { $set: update }, { new: true }).setOptions(ANY_BRANCH);
            try {
                return { customer: await save(), action };
            } catch (error) {
                if (error?.code !== 11000 || !update.externalCode) throw error;
                delete update.externalCode; // taken meanwhile: keep the customer without a code
                return { customer: await save(), action };
            }
        }

        const doc = {
            ...fields,
            externalCode: code && !codeHolder ? code : '',
            industry: 'Other',
            employeeProfileId: employee._id,
            branchId: idOf(employee.branchId) || idOf(employee.assignedBranches?.[0]) || null,
            companyId
        };
        try {
            const [created] = await Customer.create([doc]);
            return { customer: created, action: 'created' };
        } catch (error) {
            if (error?.code !== 11000 || !doc.externalCode) throw error;
            const [created] = await Customer.create([{ ...doc, externalCode: '' }]);
            return { customer: created, action: 'created' };
        }
    } catch (error) {
        console.error('[Employee -> Customer sync] failed for employee', String(idOf(employeeOrId)), error.message);
        return { customer: null, action: 'skipped' };
    }
};

/** The customer of one employee, created or brought up to date (see syncOne); null for none. */
const syncCustomerForEmployee = async (employeeOrId) => (await syncOne(employeeOrId)).customer;

const EMPLOYEE_SELECT = 'name email mobile employeeId externalEmployeeCode branchId assignedBranches status isVacant companyId';

/**
 * Makes sure every employee (of one company, or all) has exactly one customer. Used at server
 * startup, after an employee upload and after an Invoice Bulk Upload import (which may have added
 * customers that are employees).
 */
const syncCustomersForExistingEmployees = async (companyId = null) => {
    const filter = { ...PERSON_FILTER };
    if (companyId) filter.companyId = companyId;
    const employees = await EmployeeProfile.find(filter).select(EMPLOYEE_SELECT).setOptions(EVERYWHERE).lean();
    const counts = { employees: employees.length, created: 0, linked: 0, merged: 0, updated: 0, unchanged: 0, skipped: 0 };
    for (const employee of employees) {
        const { action } = await syncOne(employee);
        counts[action] += 1;
    }
    if (counts.created || counts.linked || counts.merged || counts.updated) {
        console.log(`[Employee -> Customer sync] ${counts.employees} employees: ${counts.created} customers created, ${counts.linked} existing customers linked, ${counts.merged} duplicates merged, ${counts.updated} updated`);
    }
    return counts;
};

/**
 * The customer of the employee that a customer code / name stands for, when exactly one employee
 * matches (the code is the Employee ID or external code with a compatible name, or the name alone
 * is unique); null otherwise. Invoice Bulk Upload uses it before adding a new customer, so an entry
 * for an employee goes to that employee's customer.
 */
const customerForEmployeeMatch = async ({ companyId, code = '', name = '' }) => {
    const cleanCode = clean(code);
    const cleanName = clean(name);
    if (!companyId || (!cleanCode && !cleanName)) return null;
    const or = [];
    if (cleanCode) or.push({ employeeId: codePatterns([cleanCode])[0] }, { externalEmployeeCode: codePatterns([cleanCode])[0] });
    const pattern = cleanName ? namePattern(cleanName) : null;
    if (pattern) or.push({ name: pattern });
    if (cleanName.includes('@')) or.push({ email: new RegExp(`^\\s*${escapeRegex(cleanName)}\\s*$`, 'i') });
    const candidates = await EmployeeProfile.find({ companyId, ...PERSON_FILTER, $or: or }).select(EMPLOYEE_SELECT).setOptions(ANY_BRANCH).lean();
    const isNamed = (e) => namesMatch(e.name, cleanName) || sameText(e.email, cleanName);
    const byCode = cleanCode ? candidates.filter((e) => employeeCodes(e).some((c) => sameText(c, cleanCode)) && (!cleanName || isNamed(e))) : [];
    const byName = cleanName ? candidates.filter(isNamed) : [];
    const match = byCode.length === 1 ? byCode[0] : (!byCode.length && byName.length === 1 ? byName[0] : null);
    return match ? syncCustomerForEmployee(match) : null;
};

/**
 * How employees are shown as the Current User of a serial, by employee id: `title` is
 * "<External Employee ID> - <Name>" (the name alone without an external ID), `subtitle` the email.
 */
const employeeHolderLabels = async (employeeIds) => {
    const ids = [...new Set(employeeIds.filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const employees = await EmployeeProfile.find({ _id: { $in: ids } }).select('name email externalEmployeeCode').setOptions(ANY_BRANCH).lean();
    return new Map(employees.map((employee) => {
        const name = clean(employee.name);
        const email = clean(employee.email);
        const externalCode = clean(employee.externalEmployeeCode);
        return [String(employee._id), {
            title: [externalCode, name].filter(Boolean).join(' - '),
            subtitle: sameText(email, name) ? '' : email,
            name,
            email,
            externalCode
        }];
    }));
};

module.exports = {
    employeeHolderLabels,
    syncCustomerForEmployee,
    syncCustomersForExistingEmployees,
    customerForEmployeeMatch,
    namesMatch,
    EMPLOYEE_SEGMENT
};
