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
 * Branch scoping for the current request.
 *
 * Admins and super admins are not branch-scoped and see every branch. For anyone
 * else this returns the branches assigned to them, and models that carry a
 * `branchId` are filtered to those branches automatically (see tenantPlugin).
 * Returns null when the request is not branch-scoped.
 */
const getScopedBranches = () => {
    const store = tenantStorage.getStore();
    if (!store || !store.branchScoped) return null;
    const ids = store.branchIds;
    return Array.isArray(ids) && ids.length > 0 ? ids : null;
};

const runWithTenant = (companyId, callback, storeData = {}) => 
    tenantStorage.run({ companyId, ...storeData }, callback);

module.exports = {
    tenantStorage,
    getTenantId,
    isTenantBypassed,
    getScopedBranches,
    runWithTenant
};
