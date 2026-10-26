// Modules that import through the shared engine. A module describes its fields and how a row
// becomes a record (see customers.js); the engine does the rest. The other masters still use
// the single-step importers in controllers/importController.js until they are moved here.
const IMPORT_MODULES = {
    customers: require('./customers'),
    products: require('./products'),
    attributes: require('./attributes'),
    'attribute-master': require('./attributeMaster'),
    assets: require('./assets'),
    employees: require('./employees'),
    contacts: require('./contacts'),
    planning: require('./planning'),
    vendors: require('./vendors'),
    'price-books': require('./priceBooks'),
    'price-book-items': require('./priceBookItems'),
    contracts: require('./contracts'),
    tenders: require('./tenders'),
    tickets: require('./tickets'),
    warranties: require('./warranties'),
    amcs: require('./amcs')
};

const getImportModule = (key) => (
    Object.prototype.hasOwnProperty.call(IMPORT_MODULES, key) ? IMPORT_MODULES[key] : null
);

module.exports = { IMPORT_MODULES, getImportModule };
