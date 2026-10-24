import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * What the signed-in user may do on one screen (keys as in constants/menuPermissions.js):
 *
 *   const { canCreate, canModify, canDelete } = usePermission('master_branches');
 *   {canCreate && <button>Add Branch</button>}
 *
 * Hiding a button is for the user's convenience only; the server refuses the same
 * actions on its own.
 */
const usePermission = (permissionKey) => {
    const { can } = useAuth();

    return useMemo(() => ({
        canView: can(permissionKey, 'view'),
        canCreate: can(permissionKey, 'create'),
        canModify: can(permissionKey, 'modify'),
        canDelete: can(permissionKey, 'delete'),
    }), [can, permissionKey]);
};

export default usePermission;
