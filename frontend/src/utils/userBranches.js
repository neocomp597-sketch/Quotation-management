// Same roles as isBranchAdminRole in backend/utils/branchScope.js: they work without a branch.
export const isBranchUnrestrictedRole = (role) => ['admin', 'company_admin', 'super_admin', 'superadmin'].includes(String(role || '').toLowerCase());

/** Ids of the branches a user from the user list is assigned to. */
export const userBranchIds = (user) => {
    const branches = Array.isArray(user?.assignedBranches) && user.assignedBranches.length > 0
        ? user.assignedBranches
        : (user?.branchId ? [user.branchId] : []);
    return branches.map((branch) => String(branch?._id || branch));
};
