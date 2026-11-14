const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const { canUseBranch } = require('../utils/branchScope');

/*
 * One rule for every change of an employee's branches: Branch Transfer and the Assign Branch
 * switches on Edit Employee, batch branch assignment, Branch Access in Authorization > Team Users,
 * and the employee imports (Location column).
 *
 *   - Every branch the change adds (a new home branch, or a new entry in the employee's branch
 *     list) must belong to the company, be active and be a branch the signed-in user may work in
 *     (utils/branchScope canUseBranch, the rule of the header branch switcher).
 *   - The employee's current home branch must also be one the user may work in: nobody moves an
 *     employee out of a branch they have no access to.
 *   - A branch that is only removed is not checked further.
 *   - Every change is written to the audit log as EMPLOYEE_BRANCH_TRANSFER: old and new home branch
 *     and branch list (ids and names), who, when, and through which screen.
 *
 * Saved records (attendance, payroll, visits, tickets...) are never touched here.
 */

class BranchChangeError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = 'BranchChangeError';
        this.status = status;
        this.code = code;
    }
}

const idOf = (value) => {
    if (!value) return null;
    const id = value._id || value;
    return mongoose.Types.ObjectId.isValid(id) ? String(id) : null;
};

const uniqueIds = (list = []) => [...new Set((Array.isArray(list) ? list : []).map(idOf).filter(Boolean))];

/** { branchId, assignedBranches } of an employee (or of a change), as id strings. */
const branchStateOf = (record = {}) => ({
    branchId: idOf(record.branchId),
    assignedBranches: uniqueIds(record.assignedBranches)
});

const sameBranchState = (a, b) => {
    if (a.branchId !== b.branchId) return false;
    const left = [...a.assignedBranches].sort();
    const right = [...b.assignedBranches].sort();
    return left.length === right.length && left.every((id, index) => id === right[index]);
};

const allIdsOf = (state) => [...new Set([state.branchId, ...state.assignedBranches].filter(Boolean))];

/** The branch list a move gives: the new home branch takes the old home branch's place, others stay. */
const movedAssignedBranches = (current, nextHomeId) => {
    const state = branchStateOf(current);
    return [nextHomeId, ...state.assignedBranches.filter((id) => id !== state.branchId && id !== nextHomeId)];
};

const loadBranches = async (ids, companyId) => {
    if (!ids.length) return new Map();
    const query = { _id: { $in: ids } };
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) query.companyId = companyId;
    const branches = await Branch.find(query)
        .select('name code status')
        .setOptions({ bypassTenant: true, bypassBranch: true })
        .lean();
    return new Map(branches.map((branch) => [String(branch._id), branch]));
};

const describeState = (state, branches) => ({
    branchId: state.branchId,
    branchName: state.branchId ? branches.get(state.branchId)?.name || '' : '',
    assignedBranches: state.assignedBranches,
    assignedBranchNames: state.assignedBranches.map((id) => branches.get(id)?.name || id)
});

/**
 * Checks a change from `current` to `next` (both { branchId, assignedBranches }) for `user`.
 * Returns { changed: false } when nothing changes, else { changed: true, before, after } with
 * branch names for the audit log. Throws BranchChangeError (status, code, message) when refused.
 */
const checkEmployeeBranchChange = async ({ user, companyId, current, next }) => {
    const before = branchStateOf(current);
    const after = branchStateOf(next);
    if (sameBranchState(before, after)) return { changed: false, before, after };

    const companyKey = companyId ? String(companyId) : (user?.companyId ? String(user.companyId) : null);
    const oldIds = new Set(allIdsOf(before));
    const added = allIdsOf(after).filter((id) => !oldIds.has(id));
    const branches = await loadBranches([...new Set([...allIdsOf(before), ...allIdsOf(after)])], companyKey);

    for (const id of added) {
        const branch = branches.get(id);
        if (!branch) {
            throw new BranchChangeError(400, 'BRANCH_INVALID', 'The selected branch does not belong to this company.');
        }
        if (branch.status === 'Inactive') {
            throw new BranchChangeError(400, 'BRANCH_INACTIVE', `Branch ${branch.name} is inactive. Choose an active branch.`);
        }
        if (!(await canUseBranch(user, id, companyKey))) {
            throw new BranchChangeError(403, 'BRANCH_NOT_ALLOWED', `You can only give employees branches you have access to. You do not have access to ${branch.name}.`);
        }
    }
    if (before.branchId && !(await canUseBranch(user, before.branchId, companyKey))) {
        const name = branches.get(before.branchId)?.name || 'their branch';
        throw new BranchChangeError(403, 'BRANCH_NOT_ALLOWED', `You can only change the branches of employees in branches you have access to. You do not have access to ${name}.`);
    }

    return { changed: true, before: describeState(before, branches), after: describeState(after, branches) };
};

/** Writes the audit entry of a change returned by checkEmployeeBranchChange. Throws if it cannot be written. */
const recordEmployeeBranchChange = async ({ user, companyId, employee, change, via, reason }) => AuditLog.create({
    action: 'EMPLOYEE_BRANCH_TRANSFER',
    entityType: 'Employee',
    entityId: employee._id,
    userId: user.id || user._id,
    userName: user.name || user.email || '',
    oldValue: change.before,
    newValue: change.after,
    timestamp: new Date(),
    reason: [via, String(reason || '').trim().slice(0, 500)].filter(Boolean).join(': '),
    ...(companyId ? { companyId } : {})
});

/** Sends a BranchChangeError to the client; returns false for any other error. */
const sendBranchChangeError = (res, error) => {
    if (!(error instanceof BranchChangeError)) return false;
    res.status(error.status).json({ message: error.message, code: error.code });
    return true;
};

module.exports = {
    BranchChangeError,
    branchStateOf,
    sameBranchState,
    movedAssignedBranches,
    checkEmployeeBranchChange,
    recordEmployeeBranchChange,
    sendBranchChangeError
};
