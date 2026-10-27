const mongoose = require('mongoose');
const { tenantStorage } = require('../middlewares/tenantContext');
const { getSelectableBranchIds } = require('./branchScope');

/**
 * Who may move serial numbers between branches, and who sees those moves
 * (Serial No Transfer > Branch Transfer).
 *
 * SERIAL_BRANCH_TRANSFER_ACCESS
 *   unset / "all"  While the client is testing: serials of any branch of the company can be moved
 *                  to any other branch, and every branch transfer is listed in every branch.
 *   "branch"       Branch-level access: a user moves serials only out of the branch they are working
 *                  in (with no active branch, out of the branches they may select) and sees only the
 *                  transfers out of or into those branches.
 *
 * Only this file reads the setting, so turning branch-level access on needs no other change.
 * The destination may be any active branch of the company in both modes.
 */
const isBranchLevel = () => String(process.env.SERIAL_BRANCH_TRANSFER_ACCESS || '').trim().toLowerCase() === 'branch';

/** Branch ids the request is limited to, or null for every branch of the company. */
const limitedBranchIds = (req) => {
    if (!isBranchLevel()) return null;
    if (req.user?.activeBranchId) return [String(req.user.activeBranchId)];
    const ids = getSelectableBranchIds(req.user);
    return ids ? ids.map(String) : null;
};

/** Whether the request may move serials out of `branchId`. */
const canMoveFrom = (req, branchId) => {
    const ids = limitedBranchIds(req);
    return !ids || ids.includes(String(branchId));
};

/** Condition on SerialBranchTransfer for the transfers the request may see, or null for all of them. */
const visibleTransfersCondition = (req) => {
    const ids = limitedBranchIds(req);
    if (!ids) return null;
    const branchIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
    return { $or: [{ fromBranchId: { $in: branchIds } }, { toBranchId: { $in: branchIds } }] };
};

/**
 * Runs the rest of the request without tenantPlugin's active-branch filter; the company filter
 * stays. A branch transfer reads the serials of the chosen source branch and moves them into the
 * destination, and neither has to be the branch in the header; the rules above decide instead.
 */
const acrossBranches = (req, res, next) => {
    const store = tenantStorage.getStore();
    if (!store) return next();
    return tenantStorage.run({ ...store, bypassBranch: true }, next);
};

module.exports = {
    isBranchLevel,
    limitedBranchIds,
    canMoveFrom,
    visibleTransfersCondition,
    acrossBranches
};
