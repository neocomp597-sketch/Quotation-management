const PriceBook = require('../../../models/PriceBook');

// Price book import (was importController.importPriceBooks). Each field accepts the column names
// the original importer read, in the same order (headings are compared without case, spaces or
// punctuation). A row whose book name already exists, capitals aside, updates that book.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// The same list as PriceBook.type.
const BOOK_TYPES = ['Standard', 'Customer', 'Region', 'Dealer', 'Project', 'Contract', 'Promotional', 'Opportunity'];

const FIELDS = [
    {
        key: 'name', label: 'Book Name', required: true,
        aliases: ['Book Name', 'Name', 'PriceBook Name'],
        requiredMessage: 'Book name is missing.',
        requiredHint: 'Fill in the name of the price book.',
        description: 'A price book with the same name (capitals do not matter) is updated.'
    },
    { key: 'description', label: 'Description', aliases: ['Description'] },
    {
        key: 'type', label: 'Book Type', type: 'option', options: BOOK_TYPES, default: 'Standard',
        aliases: ['Book Type', 'Type'],
        description: 'Empty means Standard for a new price book.'
    },
    { key: 'targetId', label: 'Target ID', aliases: ['Target ID', 'TargetValue', 'Target'] },
    { key: 'currency', label: 'Currency', type: 'upperText', default: 'INR', aliases: ['Currency'] },
    { key: 'validFrom', label: 'Valid From', type: 'date', aliases: ['Valid From'] },
    { key: 'validTo', label: 'Valid To', type: 'date', aliases: ['Valid To'] },
    {
        key: 'isActive', label: 'Active', type: 'boolean', default: true,
        aliases: ['Active', 'IsActive'],
        description: 'Yes or No. Empty means Yes for a new price book and leaves an existing one as it is.'
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
    key: 'price-books',
    label: 'Price Books',
    recordLabel: 'price book',
    recordLabelPlural: 'price books',
    permissionKey: 'sales_price_management',
    permissions: [['sales_price_management', 'create']],
    model: PriceBook,
    fields: FIELDS,

    identityKeys(data) {
        return data.name ? [{ key: `name:${matchKey(data.name)}`, field: 'name', label: 'book name' }] : [];
    },

    async loadContext() {
        // Scoped to the company of the request by tenantPlugin.
        const books = await PriceBook.find({}).select('name type').lean();
        const byName = new Map();
        // Two books with the same name: the importer has always updated the last one.
        books.forEach((book) => {
            const key = matchKey(book.name);
            if (key) byName.set(key, book);
        });
        return { byName };
    },

    match(data, context) {
        const record = data.name && context.byName.get(matchKey(data.name));
        return record ? { record, by: 'book name', field: 'name' } : null;
    },

    describe(record) {
        return [record.name, record.type].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        return pickSupplied(data);
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        return { ...pickSupplied(data), updatedAt: new Date() };
    }
};
