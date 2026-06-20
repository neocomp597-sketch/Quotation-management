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

const runWithTenant = (companyId, callback, storeData = {}) => 
    tenantStorage.run({ companyId, ...storeData }, callback);

module.exports = {
    tenantStorage,
    getTenantId,
    isTenantBypassed,
    runWithTenant
};
