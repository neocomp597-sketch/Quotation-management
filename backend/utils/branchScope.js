/**
 * Active branch rules shared by the auth middleware, the auth controller and the
 * branch list endpoint.
 *
 * Vocabulary:
 *  - assigned branches: Branch ids on the user (assignedBranches, else branchId)
 *  - selectable branches: what the user may pick as active branch. Users with an
 *    assignment pick from it; admins / super admins / users without any assignment
 *    pick from every branch of the company.
 *  - active branch: the single branch the user is working in right now. It is sent
 *    by the UI on every request (x-active-branch) and persisted on the user so API
 *    clients without the header, exports and background work share the context.
 */
const mongoose = require('mongoose');
const Branch = require('../models/Branch');

const BRANCH_ADMIN_ROLES = ['admin', 'company_admin', 'super_admin', 'superadmin'];

const BRANCH_SUMMARY_FIELDS = '_id name code branchPrefix address city state status';

const isBranchAdminRole = (role) => BRANCH_ADMIN_ROLES.includes(String(role || '').toLowerCase());

const idOf = (value) => {
    if (value === undefined || value === null) return null;
    const raw = (typeof value === 'object' && (value._id || value.id)) ? (value._id || value.id) : value;
    return raw && raw.toString ? raw.toString() : String(raw);
};

const isObjectIdString = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

/**
 * Normalizes a branch id from a header / query / body. Returns null for every
 * "no branch" spelling the UI has used over time ('', 'all', 'null', 'undefined').
 */
const normalizeBranchId = (raw) => {
    if (raw === undefined || raw === null) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const str = idOf(value);
    if (!str) return null;
    const trimmed = str.trim();
    if (!trimmed || ['all', 'null', 'undefined', 'none'].includes(trimmed.toLowerCase())) return null;
    return trimmed;
};

/** Branch ids assigned to a user (multi-branch list first, else the primary branch). */
const getAssignedBranchIds = (user) => {
    if (!user) return [];
    if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
        return user.assignedBranches.map(idOf).filter(Boolean);
    }
    const primary = idOf(user.branchId);
    return primary ? [primary] : [];
};

/** Branch ids the user may select; null means every branch of the company. */
const getSelectableBranchIds = (user) => {
    const assigned = getAssignedBranchIds(user);
    return assigned.length > 0 ? assigned : null;
};

// Existence checks run on every request for admins without an assignment, so
// keep a short-lived in-process answer per company/branch pair.
const BRANCH_LOOKUP_TTL_MS = Number(process.env.BRANCH_LOOKUP_TTL_MS || 60 * 1000);
const branchLookupCache = new Map();

const branchExistsInCompany = async (branchId, companyId) => {
    if (!isObjectIdString(branchId)) return false;
    const key = `${companyId || 'any'}:${branchId}`;
    const hit = branchLookupCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const query = { _id: branchId };
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) query.companyId = companyId;
    const exists = Boolean(await Branch.exists(query).setOptions({ bypassTenant: true }));

    if (branchLookupCache.size > 500) branchLookupCache.clear();
    branchLookupCache.set(key, { value: exists, expiresAt: Date.now() + BRANCH_LOOKUP_TTL_MS });
    return exists;
};

const forgetBranchLookups = () => branchLookupCache.clear();

/**
 * Whether `branchId` may be the active branch of `user`.
 * Users with assigned branches must stay inside them; everyone else may use any
 * branch of the company they are working in.
 */
const canUseBranch = async (user, branchId, companyId) => {
    const normalized = normalizeBranchId(branchId);
    if (!normalized || !isObjectIdString(normalized)) return false;

    const assigned = getAssignedBranchIds(user);
    if (assigned.length > 0) {
        return assigned.includes(normalized);
    }
    return branchExistsInCompany(normalized, companyId || idOf(user?.companyId));
};

/** Full branch documents the user may select from, sorted by name. */
const listSelectableBranches = async (user, companyId) => {
    const ids = getSelectableBranchIds(user);
    const query = {};
    const resolvedCompanyId = companyId || idOf(user?.companyId);
    if (resolvedCompanyId && mongoose.Types.ObjectId.isValid(resolvedCompanyId)) query.companyId = resolvedCompanyId;
    if (ids) {
        query._id = { $in: ids };
    } else {
        query.status = { $ne: 'Inactive' };
    }
    return Branch.find(query)
        .select(BRANCH_SUMMARY_FIELDS)
        .sort({ name: 1 })
        .setOptions({ bypassTenant: true })
        .lean();
};

module.exports = {
    BRANCH_SUMMARY_FIELDS,
    isBranchAdminRole,
    idOf,
    isObjectIdString,
    normalizeBranchId,
    getAssignedBranchIds,
    getSelectableBranchIds,
    branchExistsInCompany,
    forgetBranchLookups,
    canUseBranch,
    listSelectableBranches,
};
