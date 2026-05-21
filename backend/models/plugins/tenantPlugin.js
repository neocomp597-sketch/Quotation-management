const { getTenantId } = require('../../middlewares/tenantContext');
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

const hasBypass = (options = {}) => Boolean(options.bypassTenant);

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
                required,
                index: true,
            },
        });
    }

    schema.pre('validate', function () {
        if (!this.companyId) {
            const companyId = getTenantId();
            if (companyId) {
                this.companyId = companyId;
            } else if (!this.$locals.bypassTenant) {
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
                    update.$setOnInsert = {
                        ...(update.$setOnInsert || {}),
                        companyId,
                    };
                    this.setUpdate(update);
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
