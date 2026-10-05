const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

const getTenantId = () => {
    const store = tenantStorage.getStore();
    return store ? store.companyId : null;
};

const isTenantBypassed = () => {
    const store = tenantStorage.getStore();
    return store ? Boolean(store.bypassTenant) : false;
};

/**
 * True when the current request must not be branch-filtered at all (platform
 * level super admin screens, background jobs). Independent from the tenant
 * bypass: a super admin bypasses the company filter but is still scoped to
 * the branch they selected in the header.
 */
const isBranchBypassed = () => {
    const store = tenantStorage.getStore();
    return store ? Boolean(store.bypassBranch) : false;
};

/**
 * Branch scoping for the current request.
 *
 * When the user has picked an active branch (header / persisted on the user),
 * this is exactly that one branch, for every role including super admin.
 * Without an active branch, non-admin users are limited to their assigned
 * branches and admins see every branch. Models that carry a `branchId` are
 * filtered to these branches automatically (see tenantPlugin).
 * Returns null when the request is not branch-scoped.
 */
const getScopedBranches = () => {
    const store = tenantStorage.getStore();
    if (!store || !store.branchScoped) return null;
    const ids = store.branchIds;
    return Array.isArray(ids) && ids.length > 0 ? ids : null;
};

/** The single branch selected for this request, or null. */
const getActiveBranchId = () => {
    const store = tenantStorage.getStore();
    if (!store || !store.activeBranchId) return null;
    return store.activeBranchId.toString();
};

const runWithTenant = (companyId, callback, storeData = {}) =>
    tenantStorage.run({ companyId, ...storeData }, callback);

module.exports = {
    tenantStorage,
    getTenantId,
    isTenantBypassed,
    isBranchBypassed,
    getScopedBranches,
    getActiveBranchId,
    runWithTenant
};
