const {
    getTenantId,
    isTenantBypassed,
    isBranchBypassed,
    getScopedBranches,
    getActiveBranchId,
} = require('../../middlewares/tenantContext');
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

/**
 * Tenant (company) bypass: an explicit per-query option, or the request-level
 * bypass that super admins get so they can work across companies.
 */
const hasTenantBypass = (options = {}) => Boolean(options.bypassTenant) || isTenantBypassed();

/**
 * Branch bypass. Deliberately NOT tied to the request-level tenant bypass: a
 * super admin working in the "NASHIK" branch context still only sees NASHIK
 * data. Only an explicit per-query option (used for id lookups that must be
 * able to reach any record) or a request-level branch bypass (platform level
 * super admin screens, background jobs) turns the branch filter off.
 */
const hasBranchBypass = (options = {}) => (
    Boolean(options.bypassTenant) || Boolean(options.bypassBranch) || isBranchBypassed()
);

const toObjectId = (id) => (
    id instanceof mongoose.Types.ObjectId
        ? id
        : new mongoose.Types.ObjectId(id)
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

const isBranchScopedSchema = (schema) => Boolean(schema.path('branchId') || schema.path('assignedBranches'));

/**
 * The branch condition for the current request: records in one of the scoped
 * branches, plus records that carry no branch at all. Unassigned records are not
 * owned by any branch, so they stay reachable from every branch context instead of
 * disappearing from the application entirely.
 */
const buildBranchCondition = (branchIds, schema) => {
    const ids = branchIds.map(id => toObjectId(id));
    const branchOrConditions = [];
    if (schema.path('branchId')) {
        branchOrConditions.push({ branchId: { $in: ids } });
    }
    if (schema.path('assignedBranches')) {
        branchOrConditions.push({ assignedBranches: { $in: ids } });
    }
    if (schema.path('branchId')) {
        branchOrConditions.push({ branchId: null }, { branchId: { $exists: false } });
    } else {
        branchOrConditions.push({ assignedBranches: { $size: 0 } }, { assignedBranches: { $exists: false } });
    }
    return { $or: branchOrConditions };
};

/**
 * Restricts a query to the branches of the current request.
 *
 * Applied on top of whatever the caller asked for (never instead of it), so a user
 * cannot widen their own access by passing a branchId of their choosing.
 */
const addBranchFilter = (query, branchIds, schema) => {
    const currentQuery = query.getQuery();
    query.setQuery({
        $and: [
            currentQuery,
            buildBranchCondition(branchIds, schema)
        ]
    });
};

const PIPELINE_HEAD_STAGES = ['$geoNear', '$search', '$vectorSearch'];

const pipelineInsertIndex = (pipeline) => {
    const firstStage = pipeline[0] || {};
    const firstStageKey = Object.keys(firstStage)[0];
    return PIPELINE_HEAD_STAGES.includes(firstStageKey) ? 1 : 0;
};

/**
 * Fills in the branch of a new record from the active branch of the request, so
 * everything created while working in "NASHIK" belongs to NASHIK. A branch the
 * caller sets explicitly is always kept.
 */
const applyDefaultBranch = (doc, schema) => {
    if (!doc || typeof doc !== 'object') return;
    if (!schema.path('branchId')) return;
    if (doc.branchId) return;
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId || !mongoose.Types.ObjectId.isValid(activeBranchId)) return;
    doc.branchId = toObjectId(activeBranchId);
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

        if (this.isNew && !this.$locals.bypassBranch && !isBranchBypassed()) {
            applyDefaultBranch(this, schema);
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

        const docList = actualDocs ? (Array.isArray(actualDocs) ? actualDocs : [actualDocs]) : [];

        if (!hasBranchBypass(actualOptions)) {
            docList.forEach((doc) => applyDefaultBranch(doc, schema));
        }

        if (hasTenantBypass(actualOptions)) {
            if (callback) return callback();
            return;
        }

        const companyId = getTenantId();
        if (!companyId && required) {
            const err = new Error(`companyId is required for ${this.modelName} and no tenant context found`);
            if (callback) return callback(err);
            throw err;
        }

        if (companyId) {
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
            // Only models that actually carry a branch can be branch-scoped.
            if (isBranchScopedSchema(schema) && !hasBranchBypass(this.options)) {
                const branchIds = getScopedBranches();
                if (branchIds) {
                    addBranchFilter(this, branchIds, schema);
                }
            }

            if (hasTenantBypass(this.options)) {
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
        const pipeline = this.pipeline();

        // Dashboards and reports aggregate directly, so the branch scope has to be
        // enforced here as well or a super admin would see every branch's numbers.
        if (isBranchScopedSchema(schema) && !hasBranchBypass(this.options)) {
            const branchIds = getScopedBranches();
            if (branchIds) {
                pipeline.splice(pipelineInsertIndex(pipeline), 0, { $match: buildBranchCondition(branchIds, schema) });
            }
        }

        if (hasTenantBypass(this.options)) {
            return;
        }

        const companyId = getTenantId();
        if (companyId) {
            pipeline.splice(pipelineInsertIndex(pipeline), 0, { $match: { companyId: toObjectId(companyId) } });
        }
    });
};
