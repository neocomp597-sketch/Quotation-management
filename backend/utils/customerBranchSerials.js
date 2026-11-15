const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const { getActiveBranchId } = require('../middlewares/tenantContext');

/**
 * Which serial numbers (Invoice Bulk Upload Asset records) a branch works with: the serials it
 * holds, and also the serials whose current customer belongs to it in Customer Master, whichever
 * branch sold them. A sale can be made by any branch; the customer is looked after by their own
 * branch, so an EPC customer's serial sold by Nashik shows, and can get a ticket, in EPC.
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
    const customers = await Customer.find(branchFilter).select('_id').setOptions(ANY_BRANCH).lean();
    const customerIds = customers.map((customer) => customer._id);
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
