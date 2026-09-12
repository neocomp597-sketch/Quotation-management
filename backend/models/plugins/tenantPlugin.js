const { getTenantId, isTenantBypassed } = require('../../middlewares/tenantContext');
const mongoose = require('mongoose');

const TENANT_QUERY_HOOKS = [
    'count',
    'countDocuments',
    'deleteMany',
    'deleteOne',
    'find',
    'findOne',
    'findOneAndDelete',
    'findOneAndReplace',
    'findOneAndUpdate',
    'replaceOne',
    'updateMany',
    'updateOne',
];

const hasBypass = (options = {}) => Boolean(options.bypassTenant) || isTenantBypassed();

const toObjectId = (companyId) => (
    companyId instanceof mongoose.Types.ObjectId
        ? companyId
        : new mongoose.Types.ObjectId(companyId)
);

const hasCompanyId = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    if ('companyId' in obj) return true;
    if (Array.isArray(obj)) {
        return obj.some(item => hasCompanyId(item));
    }
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') && typeof obj[key] === 'object') {
            if (hasCompanyId(obj[key])) {
                return true;
            }
        }
    }
    return false;
};

const addTenantFilter = (query, companyId) => {
    const currentQuery = query.getQuery();
    if (hasCompanyId(currentQuery)) {
        return;
    }
    query.setQuery({ $and: [currentQuery, { companyId }] });
};

module.exports = function tenantPlugin(schema, options = {}) {
    const required = options.required !== false;

    if (!schema.path('companyId')) {
        schema.add({
            companyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Company',
                required: function () {
                    const isBypassed = isTenantBypassed() || this?.$locals?.bypassTenant || this?.options?.bypassTenant;
                    if (isBypassed) {
                        return false;
                    }
                    return required;
                },
                index: true,
            },
        });
    }

    schema.pre('validate', function () {
        if (!this.companyId) {
            const companyId = getTenantId();
            if (companyId) {
                this.companyId = companyId;
            } else if (!this.$locals.bypassTenant && !isTenantBypassed()) {
                throw new Error(`companyId is required for ${this.constructor.modelName} and no tenant context found`);
            }
        }
    });

    schema.pre('insertMany', function (next, docs, insertOptions) {
        let actualDocs = docs;
        let actualOptions = insertOptions || {};
        let callback = next;

        if (typeof next !== 'function') {
            actualDocs = next;
            actualOptions = docs || {};
            callback = null;
        }

        if (hasBypass(actualOptions)) {
            if (callback) return callback();
            return;
        }

        const companyId = getTenantId();
        if (!companyId && required) {
            const err = new Error(`companyId is required for ${this.modelName} and no tenant context found`);
            if (callback) return callback(err);
            throw err;
        }

        if (companyId && actualDocs) {
            const docList = Array.isArray(actualDocs) ? actualDocs : [actualDocs];
            docList.forEach((doc) => {
                if (doc && typeof doc === 'object' && !doc.companyId) {
                    doc.companyId = companyId;
                }
            });
        }

        if (callback) callback();
    });

    TENANT_QUERY_HOOKS.forEach(type => {
        schema.pre(type, function () {
            if (hasBypass(this.options)) {
                return;
            }

            const companyId = getTenantId();
            if (companyId) {
                addTenantFilter(this, companyId);

                const update = this.getUpdate?.();
                if (update && this.options.upsert) {
                    const hasAtomic = Object.keys(update).some(key => key.startsWith('$'));
                    let nextUpdate = { ...update };
                    
                    if (!hasAtomic) {
                        // If it's a raw object, wrap it in $set
                        nextUpdate = { $set: update };
                    }
                    
                    nextUpdate.$setOnInsert = {
                        ...(nextUpdate.$setOnInsert || {}),
                        companyId,
                    };
                    
                    this.setUpdate(nextUpdate);
                }
            }

        });
    });

    schema.pre('aggregate', function () {
        if (hasBypass(this.options)) {
            return;
        }

        const companyId = getTenantId();
        if (companyId) {
            const tenantMatch = { $match: { companyId: toObjectId(companyId) } };
            const pipeline = this.pipeline();
            const firstStage = pipeline[0] || {};
            const firstStageKey = Object.keys(firstStage)[0];
            const insertIndex = ['$geoNear', '$search', '$vectorSearch'].includes(firstStageKey) ? 1 : 0;
            pipeline.splice(insertIndex, 0, tenantMatch);
        }

    });
};
