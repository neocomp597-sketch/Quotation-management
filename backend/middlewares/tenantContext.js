const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

const getTenantId = () => {
    const store = tenantStorage.getStore();
    return store ? store.companyId : null;
};

const runWithTenant = (companyId, callback) => tenantStorage.run({ companyId }, callback);

module.exports = {
    tenantStorage,
    getTenantId,
    runWithTenant
};
