const mongoose = require('mongoose');
const Warranty = require('../../../models/Warranty');
const Asset = require('../../../models/Asset');
const { getActiveBranchId } = require('../../../middlewares/tenantContext');
const { formatDate } = require('../../../utils/dateFormat');
const shared = require('./csmShared');

// Warranty import (Warranty & AMC screen). Column names, lookups and matching are those of the
// original importer (importController.importWarranties): a serial number that already has a
// warranty updates it, otherwise a warranty is added. The serial number entry (Invoice Bulk
// Upload) is linked to the customer and product of the row, and added when it does not exist.

const WARRANTY_STATUSES = Warranty.schema.path('status').enumValues;

const FIELDS = [
    {
        key: 'customer', label: 'Customer Code', required: true,
        aliases: ['Customer Code', 'Customer Name', 'customerId', 'customer'],
        requiredMessage: 'Customer is missing.',
        requiredHint: 'Fill in the customer code (or the customer name) from Customer Master.',
        description: 'Customer code, customer name or company name from Customer Master.'
    },
    {
        key: 'product', label: 'Product Code', required: true,
        aliases: ['Product Code', 'Product Name', 'productId', 'product'],
        requiredMessage: 'Product is missing.',
        requiredHint: 'Fill in the product code (or the product name) from Product Master.'
    },
    {
        key: 'serialNumber', label: 'Serial Number', required: true,
        aliases: ['Serial Number', 'serialNumber', 'serial'],
        requiredMessage: 'Serial number is missing.',
        requiredHint: 'Fill in the serial number of the product.',
        description: 'A serial number that already has a warranty updates that warranty.'
    },
    {
        key: 'purchaseDate', label: 'Purchase Date', type: 'date', required: true,
        aliases: ['Purchase Date', 'purchaseDate'],
        requiredMessage: 'Purchase date is missing.',
        requiredHint: 'Fill in the purchase date, for example 01/04/2025.'
    },
    {
        key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true,
        aliases: ['Expiry Date', 'expiryDate'],
        requiredMessage: 'Expiry date is missing.',
        requiredHint: 'Fill in the date the warranty ends, for example 31/03/2027.'
    },
    {
        key: 'status', label: 'Status', type: 'option', options: WARRANTY_STATUSES, default: 'Active',
        aliases: ['Status', 'status'],
        description: 'Active or Expired. Blank = Active for a new warranty; an existing one keeps its status.'
    }
];

module.exports = {
    key: 'warranties',
    label: 'Warranties',
    recordLabel: 'warranty',
    recordLabelPlural: 'warranties',
    permissionKey: 'csm_warranties_amc',
    permissions: [['csm_warranties_amc', 'create']],
    model: Warranty,
    fields: FIELDS,

    identityKeys(data) {
        return data.serialNumber ? [{ key: `serial:${shared.serialKey(data.serialNumber)}`, field: 'serialNumber', label: 'serial number' }] : [];
    },

    async loadContext({ rows }) {
        const serials = shared.distinctValues(rows, 'serialNumber');
        const [customers, products, assets, warranties] = await Promise.all([
            shared.loadCustomers(shared.distinctValues(rows, 'customer')),
            shared.loadProducts(shared.distinctValues(rows, 'product')),
            shared.loadAssets(serials),
            // Warranties of the branches the user works in (tenantPlugin), as the original importer.
            serials.length
                ? shared.findByValues(Warranty, ['serialNumber'], serials, { select: '_id serialNumber expiryDate status branchId' })
                : []
        ]);
        const warrantiesBySerial = new Map();
        warranties.forEach((warranty) => {
            const key = shared.serialKey(warranty.serialNumber);
            if (key && !warrantiesBySerial.has(key)) warrantiesBySerial.set(key, warranty);
        });
        const inScope = shared.scopeChecker();
        const otherBranchAssets = [...assets.values()].filter((asset) => !inScope(asset));
        const branchNames = await shared.loadBranchNames(otherBranchAssets.map((asset) => asset.branchId));
        return { customers, products, assets, warrantiesBySerial, inScope, branchNames };
    },

    validate(data, { context }) {
        const issues = [];
        shared.resolveCustomerAndProduct(data, context, issues);

        if (data.serialNumber) {
            const asset = context.assets.get(shared.serialKey(data.serialNumber));
            if (asset && !context.inScope(asset)) {
                const branch = context.branchNames.get(String(asset.branchId));
                issues.push({
                    field: 'serialNumber',
                    code: 'OTHER_BRANCH',
                    message: `Serial number ${data.serialNumber} belongs to another branch${branch ? ` (${branch})` : ''}.`,
                    hint: 'Select that branch in the header and import this row there.'
                });
            }
        }

        if (data.purchaseDate instanceof Date && data.expiryDate instanceof Date && data.expiryDate <= data.purchaseDate) {
            issues.push({
                field: 'expiryDate',
                code: 'INVALID_DATE',
                message: 'Expiry date must be after the purchase date.',
                hint: `The file has purchase date ${formatDate(data.purchaseDate)} and expiry date ${formatDate(data.expiryDate)}.`
            });
        }
        return issues;
    },

    match(data, context) {
        const warranty = data.serialNumber && context.warrantiesBySerial.get(shared.serialKey(data.serialNumber));
        return warranty ? { record: warranty, by: 'serial number', field: 'serialNumber' } : null;
    },

    describe(record) {
        const until = record.expiryDate ? formatDate(record.expiryDate, '') : '';
        return [record.serialNumber, until && `valid until ${until}`].filter(Boolean).join(' · ');
    },

    /**
     * Custom saving: the serial number entry first (linked to the row's customer and product,
     * added when missing), then the warranty. A row whose serial entry could not be saved does
     * not get a warranty.
     */
    async write(plans, { user, companyId }) {
        const errors = new Map();
        const branchId = getActiveBranchId() || null;
        const inScope = shared.scopeChecker();

        const assets = await shared.loadAssets(plans.map((plan) => plan.data.serialNumber));
        const assetInserts = [];
        const assetUpdates = [];
        plans.forEach((plan) => {
            const { data } = plan;
            const key = shared.serialKey(data.serialNumber);
            const asset = assets.get(key);
            if (asset) {
                if (!inScope(asset)) {
                    errors.set(plan.rowId, `Serial number ${data.serialNumber} belongs to another branch. Import this row in that branch.`);
                    return;
                }
                plan.assetId = asset._id;
                assetUpdates.push({
                    id: plan.rowId,
                    filter: { _id: asset._id, companyId },
                    set: { customerId: data.customerId, productId: data.productId, installationDate: data.purchaseDate }
                });
            } else {
                plan.assetId = new mongoose.Types.ObjectId();
                assetInserts.push({
                    id: plan.rowId,
                    doc: {
                        _id: plan.assetId,
                        companyId,
                        customerId: data.customerId,
                        // New serial entries and warranties belong to the branch selected in the header.
                        branchId,
                        productId: data.productId,
                        serialNumber: data.serialNumber,
                        serialNumberKey: key,
                        installationDate: data.purchaseDate,
                        createdBy: user?.id || null
                    }
                });
            }
        });
        (await shared.insertDocs(Asset, assetInserts, 'serial number entry')).forEach((message, rowId) => errors.set(rowId, message));
        (await shared.updateDocs(Asset, assetUpdates, 'serial number entry')).forEach((message, rowId) => errors.set(rowId, message));

        const pending = plans.filter((plan) => !errors.has(plan.rowId));
        const creates = pending.filter((plan) => plan.action === 'create');
        const updates = pending.filter((plan) => plan.action === 'update');

        (await shared.insertDocs(Warranty, creates.map((plan) => ({
            id: plan.rowId,
            doc: {
                _id: plan.recordId,
                companyId,
                customerId: plan.data.customerId,
                branchId,
                productId: plan.data.productId,
                assetId: plan.assetId,
                serialNumber: plan.data.serialNumber,
                purchaseDate: plan.data.purchaseDate,
                expiryDate: plan.data.expiryDate,
                status: plan.data.status || 'Active'
            }
        })), 'warranty')).forEach((message, rowId) => errors.set(rowId, message));

        // Only the values the row supplies: a blank Status keeps the stored one.
        (await shared.updateDocs(Warranty, updates.map((plan) => ({
            id: plan.rowId,
            filter: { _id: plan.recordId, companyId },
            set: {
                customerId: plan.data.customerId,
                productId: plan.data.productId,
                assetId: plan.assetId,
                purchaseDate: plan.data.purchaseDate,
                expiryDate: plan.data.expiryDate,
                ...(plan.data.status !== undefined ? { status: plan.data.status } : {})
            }
        })), 'warranty')).forEach((message, rowId) => errors.set(rowId, message));

        // An update whose warranty was deleted after the checks matched nothing.
        const updated = updates.filter((plan) => !errors.has(plan.rowId));
        if (updated.length) {
            const found = await Warranty.find({ _id: { $in: updated.map((plan) => plan.recordId) } })
                .select('_id')
                .setOptions({ bypassBranch: true })
                .lean();
            const foundIds = new Set(found.map((doc) => String(doc._id)));
            updated.forEach((plan) => {
                if (!foundIds.has(String(plan.recordId))) errors.set(plan.rowId, 'This warranty was deleted while the import was running.');
            });
        }
        return errors;
    },

    async afterImport({ user }) {
        // Serial number entries were added or relinked.
        const { invalidateAssetCaches } = require('../../../utils/cacheInvalidation');
        await invalidateAssetCaches(user?.companyId);
    }
};
