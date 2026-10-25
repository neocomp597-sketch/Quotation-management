const mongoose = require('mongoose');
const Attribute = require('../../../models/Attribute');
const MGR = require('../../../models/MGR');
const { getTenantId } = require('../../../middlewares/tenantContext');
const { ImportJobError } = require('../errors');

// Attribute Master import (was importController.importAttributeMaster): attribute definitions
// (code + description) of an MGR3 group. The screen sends the MGR3 that is selected there
// (params.mgr3Id); an "MGR3 Code" in a row puts that row under that MGR3 instead.
// An attribute with the same code under the same MGR3 is updated, otherwise one is added.
// Only code + description must be unique, so one code can have several entries under an MGR3;
// a row for such a code updates the entry with its exact description, or asks which one.

const FIELDS = [
    {
        key: 'mgr3Code', label: 'MGR3 Code', aliases: ['MGR3 Code', 'mgr3Code'],
        description: 'Code of an MGR3 group. Empty: the MGR3 chosen on the screen.'
    },
    {
        key: 'code', label: 'Attribute Code', required: true, aliases: ['Attribute Code', 'attributeCode', 'Code'],
        description: 'An attribute with this code under the same MGR3 is updated.'
    },
    { key: 'description', label: 'Description', required: true, aliases: ['Description', 'description'] },
    { key: 'status', label: 'Status', type: 'option', options: ['Active', 'Inactive'], default: 'Active', aliases: ['Status', 'status'] }
];

const upper = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

const recordKey = (mgr3Id, code) => `${mgr3Id}\u0000${String(code ?? '').trim()}`;

const companyOf = (user) => getTenantId() || user?.companyId || null;

const invalidMgr3 = () => new ImportJobError(
    'INVALID_MGR3',
    'The MGR3 selected on the screen was not found.',
    'Choose the MGR3 again, or leave it empty and fill in the MGR3 Code column.',
    400
);

module.exports = {
    key: 'attribute-master',
    label: 'Attribute Master',
    recordLabel: 'attribute',
    recordLabelPlural: 'attributes',
    permissionKey: 'master_attributes',
    permissions: [['master_attributes', 'create']],
    model: Attribute,
    fields: FIELDS,

    /** The MGR3 selected on the screen (optional): it must be an MGR3 of this company. */
    async resolveParams(raw, { user }) {
        const id = String(raw?.mgr3Id ?? '').trim();
        if (!id) return {};
        if (!mongoose.isValidObjectId(id)) throw invalidMgr3();
        const companyId = companyOf(user);
        if (!companyId) throw invalidMgr3();
        const mgr = await MGR.findOne({ _id: id, companyId, mgrType: 'MGR3' }).select('_id code').lean();
        if (!mgr) throw invalidMgr3();
        return { mgr3Id: String(mgr._id), mgr3Code: mgr.code };
    },

    describeParams(params) {
        return params?.mgr3Code ? `MGR3: ${params.mgr3Code}` : '';
    },

    /** The MGR3 codes of the file and the attributes of every MGR3 a row can go to. */
    async loadContext({ params, user, rows }) {
        const companyId = companyOf(user);
        if (!companyId) throw new Error('Attribute import needs a company context');

        const codes = [...new Set(rows.map((row) => row.mgr3Code).filter(Boolean))];
        const mgr3ByCode = new Map();
        if (codes.length) {
            const mgrs = await MGR.find({ companyId, mgrType: 'MGR3', code: { $in: codes } })
                .collation({ locale: 'en', strength: 2 })
                .select('_id code')
                .sort({ _id: 1 })
                .lean();
            mgrs.forEach((mgr) => {
                const key = upper(mgr.code);
                if (!mgr3ByCode.has(key)) mgr3ByCode.set(key, []);
                mgr3ByCode.get(key).push(mgr);
            });
        }

        const mgr3Ids = [...new Set([
            ...(params.mgr3Id ? [params.mgr3Id] : []),
            ...[...mgr3ByCode.values()].flat().map((mgr) => String(mgr._id))
        ])];
        const attributesByKey = new Map();
        const byId = new Map();
        if (mgr3Ids.length) {
            const attributes = await Attribute.find({ companyId, mgr3Id: { $in: mgr3Ids } })
                .select('_id mgr3Id code description status')
                .sort({ _id: 1 })
                .lean();
            attributes.forEach((attribute) => {
                const key = recordKey(attribute.mgr3Id, attribute.code);
                if (!attributesByKey.has(key)) attributesByKey.set(key, []);
                attributesByKey.get(key).push(attribute);
                byId.set(String(attribute._id), attribute);
            });
        }
        return { mgr3ByCode, attributesByKey, byId };
    },

    validate(data, { context, params }) {
        if (data.mgr3Code !== undefined) {
            const candidates = context.mgr3ByCode.get(upper(data.mgr3Code)) || [];
            // Codes that differ only in capitals: the one written exactly like the file wins.
            const mgr = candidates.find((candidate) => candidate.code === data.mgr3Code)
                || (candidates.length === 1 ? candidates[0] : null);
            if (!candidates.length) {
                return [{
                    field: 'mgr3Code', code: 'NOT_FOUND',
                    message: `MGR3 code "${data.mgr3Code}" was not found.`,
                    hint: params.mgr3Id
                        ? `Check the code in the MGR Master (type MGR3), or empty the cell to use ${params.mgr3Code}.`
                        : 'Check the code in the MGR Master (type MGR3).'
                }];
            }
            if (!mgr) {
                return [{
                    field: 'mgr3Code', code: 'AMBIGUOUS_CODE',
                    message: `More than one MGR3 has the code "${data.mgr3Code}" in different capitals.`,
                    hint: 'Write the code exactly as the MGR3 has it.'
                }];
            }
            data.mgr3Id = String(mgr._id);
            data.mgr3Code = mgr.code;
        } else if (params.mgr3Id) {
            data.mgr3Id = params.mgr3Id;
            data.mgr3Code = params.mgr3Code;
        } else {
            return [{
                field: 'mgr3Code', code: 'REQUIRED',
                message: 'MGR3 is missing.',
                hint: 'Choose an MGR3 on the screen, or fill in the MGR3 Code column.'
            }];
        }
        if (data.code === undefined) return [];

        // The attribute this row updates. Code + description is what must be unique, so an
        // MGR3 can hold one code several times with other descriptions: then the row must name
        // one of them by its exact description (it can only change its status).
        const candidates = context.attributesByKey.get(recordKey(data.mgr3Id, data.code)) || [];
        let record = candidates.length === 1 ? candidates[0] : null;
        if (candidates.length > 1 && data.description !== undefined) {
            record = candidates.find((candidate) => String(candidate.description ?? '').trim() === data.description) || null;
            if (!record) {
                return [{
                    field: 'description', code: 'AMBIGUOUS_ATTRIBUTE',
                    message: `Attribute ${data.code} of ${data.mgr3Code} has ${candidates.length} entries (${candidates.slice(0, 3).map((candidate) => candidate.description).join(', ')}), so this row cannot tell which one to change.`,
                    hint: 'Use the description of one of them to update its status, or change the descriptions on the Attributes screen.'
                }];
            }
        }
        if (record) data.attributeId = String(record._id);
        return [];
    },

    /** Two rows for the same attribute (or adding the same new code): the first one is imported. */
    identityKeys(data) {
        if (!data.mgr3Id || !data.code) return [];
        const key = data.attributeId ? `id:${data.attributeId}` : `new:${recordKey(data.mgr3Id, data.code)}`;
        return [{ key, field: 'code', label: 'MGR3 and attribute code' }];
    },

    match(data, context) {
        const record = data.attributeId ? context.byId.get(data.attributeId) : null;
        return record ? { record, by: 'MGR3 and attribute code', field: 'code' } : null;
    },

    describe(record) {
        return [record.code, record.description].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        return { mgr3Id: data.mgr3Id, code: data.code, description: data.description, status: data.status };
    },

    /** Only the values the row supplies: an empty Status keeps the current status. */
    toUpdate(data) {
        const set = {};
        ['description', 'status'].forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        return set;
    }
};
