const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const EmployeeProfile = require('../models/EmployeeProfile');
const { getActiveBranchId } = require('../middlewares/tenantContext');

/**
 * Which serial numbers (Invoice Bulk Upload Asset records) a branch works with: the serials it
 * holds, and also the serials whose current customer belongs to it in Customer Master, whichever
 * branch sold them. A sale can be made by any branch; the customer is looked after by their own
 * branch, so an EPC customer's serial sold by Nashik shows, and can get a ticket, in EPC. A
 * customer linked to an employee belongs to the employee's home branch in Employee Master instead
 * (branchCustomerIds).
 *
 * Used by Serial No Transfer and by the Raise Ticket serial lookup. Invoice Bulk Upload keeps
 * showing only the serials the branch holds.
 */

// For records already checked to be visible (a serial found through serialBranchScope, its history).
const ANY_BRANCH = { bypassBranch: true };

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

const activeBranchFilter = () => {
    const branchId = getActiveBranchId();
    return branchId && mongoose.Types.ObjectId.isValid(branchId)
        ? { branchId: new mongoose.Types.ObjectId(branchId) }
        : null;
};

/**
 * The customers whose serials the branches (ObjectIds; `branchFilter` selects them) work with
 * wherever the serials are held: their customers in Customer Master, except that a customer linked
 * to an employee goes with the employee's home branch in Employee Master (client, 2026-11-19: staff
 * customer records were filed in the branch they were first uploaded in, e.g. 408 of DANI PARK's
 * 422 belong to staff of other branches, whose NASHIK and ULARIA serials were counted in DANI
 * PARK). An employee without a home branch, or no longer in Employee Master, leaves the customer
 * in its Customer Master branch.
 */
const branchCustomerIds = async (branchFilter, branchIds) => {
    const [own, staff] = await Promise.all([
        Customer.find(branchFilter).select('_id employeeProfileId').setOptions(ANY_BRANCH).lean(),
        EmployeeProfile.find({ branchId: { $in: branchIds } }).select('_id').setOptions(ANY_BRANCH).lean()
    ]);
    const linked = own.filter((customer) => customer.employeeProfileId).map((customer) => customer.employeeProfileId);
    const [employees, staffCustomers] = await Promise.all([
        linked.length ? EmployeeProfile.find({ _id: { $in: linked } }).select('branchId').setOptions(ANY_BRANCH).lean() : [],
        staff.length ? Customer.find({ employeeProfileId: { $in: staff.map((employee) => employee._id) } }).select('_id').setOptions(ANY_BRANCH).lean() : []
    ]);
    const shown = new Set(branchIds.map(String));
    const homeOf = new Map(employees.map((employee) => [String(employee._id), employee.branchId ? String(employee.branchId) : null]));
    const ids = new Map();
    for (const customer of own) {
        const home = customer.employeeProfileId ? homeOf.get(String(customer.employeeProfileId)) : null;
        if (!home || shown.has(home)) ids.set(String(customer._id), customer._id);
    }
    for (const customer of staffCustomers) ids.set(String(customer._id), customer._id);
    return [...ids.values()];
};

/**
 * The rule for the request's active branch, or for `branchIds` when given (several branches shown
 * together; the caller has checked the user may use them). `condition` is null when there is
 * neither, and tenantPlugin's own filter applies as before. Otherwise `condition` replaces the
 * plugin's branch filter (which would hide the serials of other branches), so every Asset query
 * using it must also pass `options`. `customerIds` are ObjectIds, so `condition` also works in
 * aggregations.
 */
const serialBranchScope = async (branchIds = null) => {
    const ids = Array.isArray(branchIds) && branchIds.length ? branchIds.map(toObjectId) : null;
    const branchFilter = ids ? (ids.length === 1 ? { branchId: ids[0] } : { branchId: { $in: ids } }) : activeBranchFilter();
    if (!branchFilter) return { condition: null, options: {}, branchFilter: null, customerIds: [] };
    // The filter names its branches; the plugin would add the active branch on top of it.
    const customerIds = await branchCustomerIds(branchFilter, ids || [branchFilter.branchId]);
    return {
        condition: customerIds.length ? { $or: [branchFilter, { customerId: { $in: customerIds } }] } : branchFilter,
        options: ANY_BRANCH,
        branchFilter,
        customerIds
    };
};

/**
 * The same rule over every branch the user may use (req.user.allowedBranchIds; null = every
 * branch of the company): for one serial opened from a list that shows several branches.
 */
const myBranchesScope = async (req) => {
    const allowed = req.user?.allowedBranchIds;
    if (allowed === null) return { condition: null, options: ANY_BRANCH, branchFilter: null, customerIds: [] };
    if (!Array.isArray(allowed) || !allowed.length) return serialBranchScope();
    return serialBranchScope(allowed.filter((id) => mongoose.Types.ObjectId.isValid(String(id))));
};

/** `query` limited to the serials of `scope` (from serialBranchScope). */
const inScope = (query, scope) => (scope.condition ? { $and: [query, scope.condition] } : query);

module.exports = { ANY_BRANCH, activeBranchFilter, serialBranchScope, myBranchesScope, inScope };
