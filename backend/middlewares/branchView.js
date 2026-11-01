const { tenantStorage } = require('./tenantContext');
const { canUseBranch, getSelectableBranchIds } = require('../utils/branchScope');

/**
 * Customer Service Analytics counts tickets by its own Branch filter, and the register its cards
 * open lists the same tickets: ?branchView=all is every branch the user was given, ?branchView=<id>
 * one of them; any other branch is refused. Without the parameter a request stays on the branch
 * selected in the header, as everywhere else. Goes after protect, on read routes only.
 */
const withBranchView = async (req, res, next) => {
    try {
        const view = String(req.query.branchView || '').trim();
        if (!view) return next();

        const store = tenantStorage.getStore();
        if (view.toLowerCase() === 'all') {
            const branchIds = getSelectableBranchIds(req.user); // null: every branch of the company
            return tenantStorage.run({ ...store, branchScoped: Boolean(branchIds), branchIds: branchIds || [] }, next);
        }
        if (!(await canUseBranch(req.user, view, req.user.companyId))) {
            return res.status(403).json({ message: 'You do not have access to the selected branch.' });
        }
        return tenantStorage.run({ ...store, branchScoped: true, branchIds: [view] }, next);
    } catch (error) {
        return next(error);
    }
};

module.exports = { withBranchView };
