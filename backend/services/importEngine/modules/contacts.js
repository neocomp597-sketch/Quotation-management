const mongoose = require('mongoose');
const Contact = require('../../../models/Contact');
const { getActiveBranchId, isBranchBypassed } = require('../../../middlewares/tenantContext');

// Contacts import (Master > Contacts). The column names each field accepts are the ones the
// original importer (importController.importContacts) read, in the same order, so the template
// and the Contacts export keep matching.
//
// Which contact a row updates (contacts of the branch open on the screen, as before):
//   1. the contact with the same Contact ID;
//   2. otherwise the contact with the same name, as the original importer did - unless that
//      contact already has a different Contact ID (it may be another person with the same
//      name), or several contacts share the name. Those rows are shown instead of guessing.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// The checks Contact (models/Contact.js) makes when a contact is saved.
const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;

const FIELDS = [
    {
        key: 'contactName', label: 'Contact Name', required: true,
        aliases: ['Contact Name', 'contactName', 'Name'],
        requiredMessage: 'Contact name is missing.',
        requiredHint: 'Fill in the contact name.'
    },
    {
        key: 'contactId', label: 'Contact ID', aliases: ['Contact ID', 'contactId'],
        description: 'A Contact ID that already exists updates that contact.'
    },
    { key: 'company', label: 'Company', aliases: ['Company', 'company'] },
    { key: 'email', label: 'Email', type: 'email', strict: true, aliases: ['Email', 'email'] },
    { key: 'phone', label: 'Phone', type: 'phone', aliases: ['Phone', 'phone'] },
    { key: 'designation', label: 'Designation', aliases: ['Designation', 'designation'] },
    {
        key: 'customerType', label: 'Customer Type', type: 'option',
        options: ['Customer', 'Prospect', 'Vendor', 'Partner'],
        aliases: ['Customer Type', 'customerType']
    },
    { key: 'notes', label: 'Notes', aliases: ['Notes', 'notes'] }
];

const PLAIN_FIELDS = ['contactName', 'contactId', 'company', 'email', 'phone', 'designation', 'customerType', 'notes'];

/** The branch a new contact gets, as tenantPlugin gives it on create: the branch open on the screen. */
const activeBranch = () => {
    if (isBranchBypassed()) return null;
    const id = getActiveBranchId();
    return id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
};

/** The existing contact a row updates, or the reason it cannot be decided. */
const findContact = (data, context) => {
    const id = matchKey(data.contactId);
    if (id) {
        const sameId = context.byId.get(id) || [];
        if (sameId.length === 1) return { record: sameId[0], by: 'Contact ID', field: 'contactId' };
        if (sameId.length > 1) {
            return {
                issue: {
                    field: 'contactId',
                    code: 'AMBIGUOUS_MATCH',
                    message: `${sameId.length} contacts already have Contact ID ${data.contactId}.`,
                    hint: 'Correct the duplicate Contact IDs on the Contacts screen, then check this row again.'
                }
            };
        }
    }

    const sameName = context.byName.get(matchKey(data.contactName)) || [];
    if (!sameName.length) return {};
    if (sameName.length > 1) {
        return {
            issue: {
                field: id ? 'contactId' : 'contactName',
                code: 'AMBIGUOUS_MATCH',
                message: id
                    ? `${sameName.length} contacts are named ${data.contactName}, and none has Contact ID ${data.contactId}.`
                    : `${sameName.length} contacts are named ${data.contactName}.`,
                hint: id
                    ? 'Use the Contact ID of the contact to update. A new person with the same name is added on the Contacts screen.'
                    : 'Fill in the Contact ID so the right contact is updated.'
            }
        };
    }
    const [record] = sameName;
    if (id && matchKey(record.contactId)) {
        return {
            issue: {
                field: 'contactId',
                code: 'CODE_MISMATCH',
                message: `${record.contactName} is already on the Contacts screen with Contact ID ${record.contactId}, but this row has ${data.contactId}.`,
                hint: `Same person: change the Contact ID to ${record.contactId} or clear it. A different person with the same name is added on the Contacts screen.`
            }
        };
    }
    return { record, by: 'contact name', field: 'contactName' };
};

module.exports = {
    key: 'contacts',
    label: 'Contacts',
    recordLabel: 'contact',
    recordLabelPlural: 'contacts',
    permissionKey: 'master_contacts',
    // The same right as the old POST /api/import/contacts (config/apiPermissions.js).
    permissions: [['master_contacts', 'create']],
    model: Contact,
    fields: FIELDS,

    /** Two rows are the same contact when they have the same Contact ID, else the same name. */
    identityKeys(data) {
        const id = matchKey(data.contactId);
        if (id) return [{ key: `id:${id}`, field: 'contactId', label: 'Contact ID' }];
        const name = matchKey(data.contactName);
        return name ? [{ key: `name:${name}`, field: 'contactName', label: 'contact name' }] : [];
    },

    async loadContext() {
        // Scoped to the company and to the branch open on the screen by tenantPlugin, like the
        // original importer: contacts belong to a branch.
        const contacts = await Contact.find({}).select('contactName contactId company').lean();
        const byId = new Map();
        const byName = new Map();
        const add = (map, key, contact) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(contact);
        };
        contacts.forEach((contact) => {
            add(byId, matchKey(contact.contactId), contact);
            add(byName, matchKey(contact.contactName), contact);
        });
        return { byId, byName };
    },

    validate(data, { context }) {
        const issues = [];
        if (data.email && /[\s,;]/.test(data.email)) {
            issues.push({
                field: 'email',
                code: 'INVALID_EMAIL',
                message: 'Email must be one address.',
                hint: `"${data.email}" has more than one. Keep one address here.`
            });
        }
        if (data.phone && !PHONE_PATTERN.test(data.phone)) {
            issues.push({
                field: 'phone',
                code: 'INVALID_PHONE',
                message: 'Phone is not a valid phone number.',
                hint: `"${data.phone}" should have 7 to 20 digits. Spaces, dashes, brackets and a leading + are allowed.`
            });
        }
        const found = findContact(data, context);
        if (found.issue) issues.push(found.issue);
        return issues;
    },

    match(data, context) {
        const found = findContact(data, context);
        return found.record ? { record: found.record, by: found.by, field: found.field } : null;
    },

    describe(record) {
        return [record.contactId, record.contactName, record.company].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        const doc = {};
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) doc[field] = data[field];
        });
        doc.branchId = activeBranch();
        return doc;
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        const set = {};
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        return set;
    }
};
