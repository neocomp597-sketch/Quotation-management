const Branch = require('../models/Branch');
const { canUseBranch } = require('./branchScope');

const MAX_VIEW_BRANCHES = 100;
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

/**
 * ?branchIds (repeated, `branchIds[]` or comma-separated): the branches a list screen asks to show
 * together (the branch buttons), each one checked against the branches the user may use, as the
 * branch switcher does (utils/branchScope canUseBranch). Null when the request names none, so the
 * active branch applies as before; else the branch documents. One branch outside the user's access
 * refuses the request (403) rather than being left out silently.
 */
const requestedViewBranches = async (req) => {
    const raw = req.query?.branchIds !== undefined ? req.query.branchIds : req.query?.['branchIds[]'];
    if (raw === undefined) return null;
    const ids = [...new Set((Array.isArray(raw) ? raw : [raw])
        .flatMap((value) => String(value ?? '').split(','))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean))];
    if (!ids.length) throw httpError(400, 'Select at least one branch.');
    if (ids.some((id) => !/^[a-f\d]{24}$/.test(id))) throw httpError(400, 'Invalid branch.');
    if (ids.length > MAX_VIEW_BRANCHES) throw httpError(400, `Select at most ${MAX_VIEW_BRANCHES} branches.`);
    const companyId = req.user?.companyId;
    const branches = await Branch.find({ _id: { $in: ids }, companyId }).select('name code').setOptions({ bypassTenant: true }).lean();
    const allowed = await Promise.all(ids.map((id) => canUseBranch(req.user, id, companyId)));
    const refused = ids.filter((id, index) => !allowed[index] || !branches.some((branch) => String(branch._id) === id));
    if (refused.length) {
        const names = refused.map((id) => branches.find((branch) => String(branch._id) === id)?.name || id);
        throw httpError(403, `You do not have access to ${refused.length === 1 ? 'branch' : 'branches'} ${names.join(', ')}. Nothing was shown.`, { code: 'BRANCH_NOT_ALLOWED' });
    }
    return ids.map((id) => branches.find((branch) => String(branch._id) === id));
};

module.exports = { requestedViewBranches };
