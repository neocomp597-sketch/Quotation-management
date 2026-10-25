const ProductAttribute = require('../../../models/ProductAttribute');
const Product = require('../../../models/Product');
const { getTenantId } = require('../../../middlewares/tenantContext');

// Product attribute values import (was importController.importAttributes): one row sets the
// value of one attribute of one product. A row for a product + attribute code that already
// has a value replaces that value, otherwise the value is added - the same key the original
// importer (and the product screen, POST /api/product-attributes) uses.
//
// Values are stored by product code, so the code must belong to a product of this company;
// the value is saved under the product's code exactly as the Product Master spells it (the
// product screen reads the values of a product by its exact code).

const FIELDS = [
    {
        key: 'productCode', label: 'Product Code', required: true,
        aliases: ['Product Code', 'productCode'],
        description: 'The code of a product in the Product Master.'
    },
    {
        key: 'attributeCode', label: 'Attribute Code', required: true,
        aliases: ['Attribute Code', 'attributeCode'],
        description: 'A product that already has this attribute gets the new value.'
    },
    { key: 'attributeValue', label: 'Attribute Value', required: true, aliases: ['Attribute Value', 'attributeValue'] }
];

const upper = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

// The stored record a row replaces: same product code (as stored) and same attribute code.
const recordKey = (productCode, attributeCode) => `${productCode}\u0000${String(attributeCode ?? '').trim()}`;

const companyOf = (user) => getTenantId() || user?.companyId || null;

module.exports = {
    key: 'attributes',
    label: 'Product Attributes',
    recordLabel: 'product attribute',
    recordLabelPlural: 'product attributes',
    permissionKey: 'master_products',
    // Like POST /api/product-attributes: adding or changing values of products.
    permissions: [['master_products', 'create'], ['master_products', 'modify']],
    model: ProductAttribute,
    fields: FIELDS,

    /** The products named in the file and the values they already have, in two queries. */
    async loadContext({ user, rows }) {
        const companyId = companyOf(user);
        if (!companyId) throw new Error('Product attribute import needs a company context');

        const codes = [...new Set(rows.map((row) => row.productCode).filter(Boolean))];
        const productsByCode = new Map();
        const existing = new Map();
        if (!codes.length) return { productsByCode, existing };

        const products = await Product.find({ companyId, productCode: { $in: codes } })
            .collation({ locale: 'en', strength: 2 })
            .select('_id productCode productName')
            .sort({ _id: 1 })
            .lean();
        products.forEach((product) => {
            const key = upper(product.productCode);
            if (!productsByCode.has(key)) productsByCode.set(key, []);
            productsByCode.get(key).push(product);
        });

        const storedCodes = [...new Set(products.map((product) => product.productCode))];
        if (storedCodes.length) {
            // Oldest first: the record the original importer's findOneAndUpdate changed.
            const values = await ProductAttribute.find({ companyId, productCode: { $in: storedCodes } })
                .select('_id productCode attributeCode attributeValue')
                .sort({ _id: 1 })
                .lean();
            values.forEach((value) => {
                const key = recordKey(value.productCode, value.attributeCode);
                if (!existing.has(key)) existing.set(key, value);
            });
        }
        return { productsByCode, existing };
    },

    validate(data, { context }) {
        if (data.productCode === undefined) return [];
        const candidates = context.productsByCode.get(upper(data.productCode)) || [];
        // Codes that differ only in capitals: the one written exactly like the file wins.
        const product = candidates.find((candidate) => candidate.productCode === data.productCode)
            || (candidates.length === 1 ? candidates[0] : null);
        if (!candidates.length) {
            return [{
                field: 'productCode', code: 'NOT_FOUND',
                message: `Product code "${data.productCode}" was not found in the Product Master.`,
                hint: 'Check the code, or add the product first.'
            }];
        }
        if (!product) {
            return [{
                field: 'productCode', code: 'AMBIGUOUS_CODE',
                message: `More than one product has the code "${data.productCode}" in different capitals (${candidates.slice(0, 3).map((candidate) => candidate.productCode).join(', ')}).`,
                hint: 'Write the code exactly as the product has it.'
            }];
        }
        data.productCode = product.productCode;
        data.productId = String(product._id);
        return [];
    },

    identityKeys(data) {
        if (!data.productCode || !data.attributeCode) return [];
        return [{
            key: `${upper(data.productCode)}\u0000${data.attributeCode}`,
            field: 'attributeCode',
            label: 'product and attribute code'
        }];
    },

    match(data, context) {
        if (!data.productId || !data.attributeCode) return null;
        const record = context.existing.get(recordKey(data.productCode, data.attributeCode));
        return record ? { record, by: 'product and attribute code', field: 'attributeCode' } : null;
    },

    describe(record) {
        return [record.productCode, record.attributeCode].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        return { productCode: data.productCode, attributeCode: data.attributeCode, attributeValue: data.attributeValue };
    },

    toUpdate(data) {
        return { attributeValue: data.attributeValue };
    }
};
