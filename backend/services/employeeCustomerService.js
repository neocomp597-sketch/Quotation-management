const Customer = require('../models/Customer');
const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Every employee is also a customer in Customer Master (client, 2026-11-15), so company assets such
 * as laptops can be allocated to employees in Invoice Bulk Upload and Serial No Transfer, and
 * tickets raised for them.
 *
 * The customer is linked to the employee (Customer.employeeProfileId) and created when the
 * employee is: name, Employee ID as the customer code, mobile, email, the employee's home branch,
 * Segment "Employee". Later edits of the employee keep the name, mobile, email and status in step
 * (Resigned = Inactive); the code and branch are not changed once set, since serial numbers and
 * tickets point at them. Deleting an employee leaves the customer. Vacant positions get none.
 *
 * An existing customer is used instead of a new one when it is clearly the same person: the same
 * customer code with the same name or email, or (without a code) the same email and name. When the
 * Employee ID is already the code of a different customer, the new customer is created without a
 * code rather than taking it.
 *
 * Queries name the company and look across branches: the sync runs inside requests (where the
 * active branch would otherwise filter Customer) and at server startup (no tenant context).
 */

const ANY_BRANCH = { bypassBranch: true };
const EMPLOYEE_SEGMENT = 'Employee';

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const sameText = (a, b) => Boolean(clean(a)) && clean(a).toLowerCase() === clean(b).toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (value) => value?._id || value || null;

// A vacant position is not a person and gets no customer.
const isPerson = (employee) => Boolean(employee && clean(employee.name) && employee.companyId
    && !employee.isVacant && employee.status !== 'Vacant');

const isSamePerson = (customer, employee) => sameText(customer.companyName, employee.name)
    || sameText(customer.customerName, employee.name)
    || (clean(employee.email) && sameText(customer.email, employee.email));

// The fields that follow the employee on every sync.
const followedFields = (employee) => {
    const fields = {
        customerName: clean(employee.name),
        companyName: clean(employee.name),
        contactPerson: clean(employee.name),
        status: employee.status === 'Resigned' ? 'Inactive' : 'Active'
    };
    if (clean(employee.mobile)) fields.mobile = clean(employee.mobile);
    if (clean(employee.email)) fields.email = clean(employee.email).toLowerCase();
    return fields;
};

/**
 * The employee's customer: the linked one, else an unlinked customer that is clearly the same
 * person. `codeTaken` says the Employee ID is the code of a different customer.
 */
const findCustomerFor = async (employee) => {
    const companyId = employee.companyId;
    const linked = await Customer.findOne({ companyId, employeeProfileId: employee._id }).setOptions(ANY_BRANCH);
    if (linked) return { customer: linked, codeTaken: false };

    const code = clean(employee.employeeId);
    let codeTaken = false;
    if (code) {
        const byCode = await Customer.findOne({ companyId, externalCode: code })
            .collation(Customer.CUSTOMER_CODE_COLLATION)
            .setOptions(ANY_BRANCH);
        if (byCode) {
            if (!byCode.employeeProfileId && isSamePerson(byCode, employee)) return { customer: byCode, codeTaken: false };
            codeTaken = true;
        }
    }
    const email = clean(employee.email);
    if (email) {
        const byEmail = await Customer.find({
            companyId,
            employeeProfileId: null,
            email: new RegExp(`^${escapeRegex(email)}$`, 'i')
        }).setOptions(ANY_BRANCH).limit(5);
        const match = byEmail.find((customer) => isSamePerson(customer, employee)
            && (!clean(customer.externalCode) || !code || sameText(customer.externalCode, code)));
        if (match) return { customer: match, codeTaken };
    }
    return { customer: null, codeTaken };
};

/**
 * Creates or updates the customer of one employee (a document, a lean object or an id). Never
 * throws: a failure is logged and the employee's own save stands. Resolves to
 * { customer, action }: action is created, linked (an existing customer taken over), updated,
 * unchanged or skipped (a vacant position, or the sync failed).
 */
const syncOne = async (employeeOrId) => {
    try {
        let employee = employeeOrId;
        if (!employee || typeof employee !== 'object' || !employee.name) {
            employee = await EmployeeProfile.findById(idOf(employeeOrId)).setOptions(ANY_BRANCH).lean();
        }
        if (!isPerson(employee)) return { customer: null, action: 'skipped' };

        const { customer, codeTaken } = await findCustomerFor(employee);
        const fields = followedFields(employee);
        const code = clean(employee.employeeId);

        if (customer) {
            const update = { ...fields, employeeProfileId: employee._id };
            // A customer without a code takes the Employee ID, unless another customer has it.
            if (!clean(customer.externalCode) && code && !codeTaken) {
                const holder = await Customer.findOne({ companyId: employee.companyId, externalCode: code, _id: { $ne: customer._id } })
                    .collation(Customer.CUSTOMER_CODE_COLLATION)
                    .setOptions(ANY_BRANCH)
                    .select('_id')
                    .lean();
                if (!holder) update.externalCode = code;
            }
            const action = customer.employeeProfileId ? 'updated' : 'linked';
            const changed = Object.entries(update).some(([key, value]) => String(customer[key] ?? '') !== String(value ?? ''));
            if (!changed) return { customer, action: 'unchanged' };
            const save = () => Customer.findOneAndUpdate({ _id: customer._id, companyId: employee.companyId }, { $set: update }, { new: true })
                .setOptions(ANY_BRANCH);
            try {
                return { customer: await save(), action };
            } catch (error) {
                if (error?.code !== 11000 || !update.externalCode) throw error;
                delete update.externalCode; // taken meanwhile: keep the customer without a code
                return { customer: await save(), action };
            }
        }

        const branchId = idOf(employee.branchId) || idOf(employee.assignedBranches?.[0]) || null;
        const doc = {
            ...fields,
            externalCode: code && !codeTaken ? code : '',
            segment: EMPLOYEE_SEGMENT,
            industry: 'Other',
            employeeProfileId: employee._id,
            branchId,
            companyId: employee.companyId
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

/**
 * Makes sure every employee (of one company, or all) has a customer. Used at server startup, so
 * employees that existed before this feature get theirs, and after an employee upload.
 */
const syncCustomersForExistingEmployees = async (companyId = null) => {
    const filter = { isVacant: { $ne: true }, status: { $ne: 'Vacant' } };
    if (companyId) filter.companyId = companyId;
    const employees = await EmployeeProfile.find(filter)
        .select('name email mobile employeeId branchId assignedBranches status isVacant companyId')
        .setOptions({ ...ANY_BRANCH, bypassTenant: true })
        .lean();
    const counts = { employees: employees.length, created: 0, linked: 0, updated: 0, unchanged: 0, skipped: 0 };
    for (const employee of employees) {
        const { action } = await syncOne(employee);
        counts[action] += 1;
    }
    if (counts.created || counts.linked || counts.updated) {
        console.log(`[Employee -> Customer sync] ${counts.employees} employees: ${counts.created} customers created, ${counts.linked} existing customers linked, ${counts.updated} updated`);
    }
    return counts;
};

module.exports = { syncCustomerForEmployee, syncCustomersForExistingEmployees, EMPLOYEE_SEGMENT };
