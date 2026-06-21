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

const addTenantFilter = (query, companyId) => {
    const currentQuery = query.getQuery();
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

    schema.pre('insertMany', function (docs, insertOptions = {}) {
        if (hasBypass(insertOptions)) {
            return;
        }

        const companyId = getTenantId();
        if (!companyId && required) {
            throw new Error(`companyId is required for ${this.modelName} and no tenant context found`);
        }

        if (companyId) {
            docs.forEach((doc) => {
                if (!doc.companyId) {
                    doc.companyId = companyId;
                }
            });
        }

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
