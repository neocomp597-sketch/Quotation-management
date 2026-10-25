const Vendor = require('../../../models/Vendor');

// Vendor Master import (was importController.importVendors). Each field accepts the column names
// the original importer read, in the same order; headings are compared without case, spaces or
// punctuation, so "vendorName" and "Vendor Name" are the same column.
//
// The original importer never created vendor logins (services/vendorUserService.js is only used
// by the Vendors screen), so neither does this one.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const FIELDS = [
    {
        key: 'name', label: 'Vendor Name', required: true,
        aliases: ['Vendor Name', 'Name', 'Company Name'],
        requiredMessage: 'Vendor name is missing.',
        requiredHint: 'Fill in the vendor name.',
        description: 'A vendor with the same name (capitals do not matter) is updated.'
    },
    { key: 'contactPerson', label: 'Contact Person', aliases: ['Contact Person', 'Contact', 'Person'] },
    { key: 'phone', label: 'Phone', type: 'phone', aliases: ['Phone', 'Mobile', 'Mobile Phone', 'Telephone'] },
    { key: 'email', label: 'Email', type: 'email', aliases: ['Email', 'E-Mail'] },
    { key: 'address', label: 'Address', aliases: ['Address', 'Street', 'Location'] },
    { key: 'gstin', label: 'GSTIN', type: 'upperText', aliases: ['GSTIN', 'GST No', 'GST Number'] },
    {
        key: 'isActive', label: 'Active', type: 'boolean', default: true,
        aliases: ['Active', 'IsActive'],
        description: 'Yes or No. Empty means Yes for a new vendor and leaves an existing vendor as it is.'
    }
];

const SAVED_FIELDS = FIELDS.map((field) => field.key);

const pickSupplied = (data) => {
    const doc = {};
    SAVED_FIELDS.forEach((key) => {
        if (data[key] !== undefined) doc[key] = data[key];
    });
    return doc;
};

module.exports = {
    key: 'vendors',
    label: 'Vendors',
    recordLabel: 'vendor',
    recordLabelPlural: 'vendors',
    permissionKey: 'master_vendors',
    permissions: [['master_vendors', 'create']],
    model: Vendor,
    fields: FIELDS,

    identityKeys(data) {
        return data.name ? [{ key: `name:${matchKey(data.name)}`, field: 'name', label: 'vendor name' }] : [];
    },

    async loadContext() {
        // Scoped to the company of the request by tenantPlugin (vendors carry no branch).
        const vendors = await Vendor.find({}).select('name').lean();
        const byName = new Map();
        // Two vendors with the same name: the importer has always updated the last one.
        vendors.forEach((vendor) => {
            const key = matchKey(vendor.name);
            if (key) byName.set(key, vendor);
        });
        return { byName };
    },

    match(data, context) {
        const record = data.name && context.byName.get(matchKey(data.name));
        return record ? { record, by: 'vendor name', field: 'name' } : null;
    },

    describe(record) {
        return record.name || '';
    },

    toCreate(data) {
        return pickSupplied(data);
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        return pickSupplied(data);
    }
};
