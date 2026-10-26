const PriceBook = require('../../../models/PriceBook');
const PriceBookItem = require('../../../models/PriceBookItem');
const Product = require('../../../models/Product');
const { ImportJobError } = require('../errors');

// Prices of one price book (was importController.importPriceBookItems, which took the book from
// the URL). The book is a screen setting here: params.priceBookId, checked by resolveParams.
// Each field accepts the column names the original importer read, in the same order. A product
// that already has a price in the book gets the new price; other products are added.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const FIELDS = [
    {
        key: 'productCode', label: 'Product Code', required: true,
        aliases: ['Product Code', 'Code'],
        requiredMessage: 'Product code is missing.',
        requiredHint: 'Fill in the product code as it is in the Product Master.',
        description: 'The code of a product in the Product Master.'
    },
    {
        key: 'price', label: 'Price', type: 'number', min: 0, required: true,
        aliases: ['Price', 'Custom Price', 'Rate'],
        requiredMessage: 'Price is missing.',
        requiredHint: 'Fill in the price (0 or more).'
    },
    {
        key: 'currency', label: 'Currency', type: 'upperText',
        aliases: ['Currency'],
        description: "Empty means the price book's currency for a new price, and leaves an existing price's currency as it is."
    }
];

const bookNotFound = () => new ImportJobError(
    'PRICE_BOOK_NOT_FOUND',
    'This price book was not found.',
    'It may have been deleted. Refresh the page and open the price book again.',
    400
);

module.exports = {
    key: 'price-book-items',
    label: 'Price Book Prices',
    recordLabel: 'price',
    recordLabelPlural: 'prices',
    permissionKey: 'sales_price_management',
    // The original route needed Modify on Price Management (config/apiPermissions.js).
    permissions: [['sales_price_management', 'modify']],
    model: PriceBookItem,
    fields: FIELDS,

    /** The price book the prices go into: it must be a book of this company. */
    async resolveParams(raw) {
        const id = String(raw?.priceBookId ?? '').trim();
        if (!id) {
            throw new ImportJobError('PRICE_BOOK_REQUIRED', 'Choose a price book first.', 'Open the price book the prices belong to, then import.', 400);
        }
        if (!OBJECT_ID.test(id)) throw bookNotFound();
        // Scoped to the company of the request by tenantPlugin.
        const book = await PriceBook.findOne({ _id: id }).select('name').lean();
        if (!book) throw bookNotFound();
        // The name is kept for the screen ("Price book: Retail 2026"); describeParams cannot look it up.
        return { priceBookId: String(book._id), priceBookName: book.name || '' };
    },

    // Recent imports are listed per book; the name is only for display (books can be renamed).
    paramsKeyFields: ['priceBookId'],

    describeParams(params) {
        return params.priceBookName ? `Price book: ${params.priceBookName}` : '';
    },

    async loadContext({ params, rows }) {
        const book = await PriceBook.findOne({ _id: params.priceBookId }).select('name currency').lean();
        const codes = [...new Set(rows.map((data) => String(data.productCode ?? '').trim()).filter(Boolean))];

        // Codes compared without capitals, as the importer always did; one query for the file.
        const byCode = new Map();
        if (codes.length) {
            const products = await Product.find({ productCode: { $in: codes } })
                .collation({ locale: 'en', strength: 2 })
                .select('productCode productName')
                .lean();
            // Two products whose codes differ only in capitals: the importer used the last one.
            products.forEach((product) => byCode.set(matchKey(product.productCode), product));
        }

        const byProduct = new Map();
        if (book && byCode.size) {
            const codeOf = new Map([...byCode.values()].map((product) => [String(product._id), product.productCode]));
            const items = await PriceBookItem.find({ priceBookId: book._id, productId: { $in: [...codeOf.keys()] } })
                .select('productId price currency')
                .lean();
            items.forEach((item) => byProduct.set(String(item.productId), { ...item, productCode: codeOf.get(String(item.productId)) }));
        }
        return { book, byCode, byProduct };
    },

    validate(data, { context, issues }) {
        const found = [];
        if (!context.book) {
            found.push({
                field: 'productCode',
                code: 'PRICE_BOOK_NOT_FOUND',
                message: 'This price book no longer exists.',
                hint: 'Close the import, refresh the page and open the price book again.'
            });
            return found;
        }
        // Filled from the book, so a new price gets the book's currency (see toCreate).
        data.bookCurrency = context.book.currency || 'INR';

        if (data.productCode !== undefined && !issues.some((issue) => issue.field === 'productCode')) {
            const product = context.byCode.get(matchKey(data.productCode));
            if (product) {
                data.productId = String(product._id);
            } else {
                found.push({
                    field: 'productCode',
                    code: 'NOT_FOUND',
                    message: `Product code "${data.productCode}" was not found.`,
                    hint: 'Check the code against the Product Master, or add the product there first.'
                });
            }
        }
        return found;
    },

    identityKeys(data) {
        return data.productCode ? [{ key: `product:${matchKey(data.productCode)}`, field: 'productCode', label: 'product code' }] : [];
    },

    match(data, context) {
        const record = data.productId && context.byProduct.get(data.productId);
        return record ? { record, by: 'product code', field: 'productCode' } : null;
    },

    describe(record) {
        return [record.productCode, record.price !== undefined ? `${record.currency || ''} ${record.price}`.trim() : ''].filter(Boolean).join(' · ');
    },

    toCreate(data, { params }) {
        return {
            priceBookId: params.priceBookId,
            productId: data.productId,
            price: data.price,
            currency: data.currency || data.bookCurrency || 'INR'
        };
    },

    /** The new price; the currency only when the row has one. */
    toUpdate(data) {
        const set = { price: data.price, updatedAt: new Date() };
        if (data.currency !== undefined) set.currency = data.currency;
        return set;
    }
};
