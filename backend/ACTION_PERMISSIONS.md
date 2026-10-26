# Action-level permissions (View / Create / Modify / Delete)

Every screen in Admin → Authorization has four permissions: **View**, **Create**,
**Modify** and **Delete**. They are set per role (Role Matrix tab) and can be changed
for one employee (Team Users tab → Individual Permissions).

## Storage

- A screen's own key is its View permission (`master_branches`). The actions are
  stored next to it as `master_branches:create`, `master_branches:modify` and
  `master_branches:delete`.
- Role permissions: `RolePermission.menuVisibility` (one document per role and
  company, with `createdBy` / `updatedBy` and timestamps). Saving a role stores every
  flag explicitly.
- Employee permissions: `User.customPermissions` holds only what differs from the
  role (`customPermissionsUpdatedBy` / `customPermissionsUpdatedAt` record the last
  change), so later role changes still reach the employee. "Reset to Role Defaults"
  empties it.
- Each save is a single-document update, so it is applied completely or not at all.
  Every change is written to `AuditLog` (`ROLE_PERMISSIONS_UPDATED`,
  `ROLE_PERMISSIONS_RESET`, `USER_PERMISSIONS_UPDATED`, `USER_PERMISSIONS_RESET`)
  with the flags before and after.

## Rules (`config/authorization.js`)

- An action flag that was never saved follows the screen's View value. Roles and
  employees saved before action-level permissions therefore keep exactly the access
  they had.
- No action is granted on a screen that cannot be viewed (`hasPermission`).
- Screens that only show information have View alone; some have no Delete
  (`MODULE_ACTIONS`). An action a screen does not have is decided by its Modify.
- Employees always see the screens in `ROLE_LOCKED_VIEW_KEYS` (the client has the
  same rule).
- The module switch: off removes all access to the module; on gives View on every
  submodule. Create, Modify and Delete are always given separately.
- Nobody can change their own individual permissions (platform super admins excepted).

## Enforcement

- **Server** (`middlewares/permissionMiddleware.js`): `protect` ends with
  `enforceApiPermission`, which checks every protected request against the rule table
  in `config/apiPermissions.js` (URL prefix → screen; GET = View, POST = Create,
  PUT/PATCH = Modify, DELETE = Delete, with per-route exceptions). A refusal is
  `403 { code: "PERMISSION_DENIED", message, permission: { key, action } }`.
  Role permissions are cached for 60 s and dropped when a role is saved; a user's
  overrides are part of `protect`'s user cache, which is dropped when they change.
- **Master lists stay readable** (`openRead`): customers, products, branches,
  states, cities and the other masters are also the dropdown lists of other screens,
  so reading them is not checked; their screens are hidden and their changes are
  checked. Transaction screens (quotations, tenders, tickets…) check View on reads.
- **Client**: `usePermission(key)` / `useAuth().can(key, action)` hide the Add, Edit
  and Delete buttons; `PermissionRoute action="create" | "modify"` guards the new
  and edit URLs. Open sessions reload their permissions when an administrator saves
  (socket message `PERMISSIONS:UPDATE`), when a request is refused, and when the tab
  regains focus after a minute.
- Platform super admins are not checked. Admins are checked like everyone else; the
  Authorization and user-management APIs are admin-only and are not in the rule
  table, so an admin can always correct permissions.

## Adding a screen

1. Add the screen to `MENU_GROUPS` here and to `MENU_PERMISSION_GROUPS` in
   `frontend/src/constants/menuPermissions.js`.
2. If it does not have all four actions, add it to `MODULE_ACTIONS`.
3. Add its API prefix to `config/apiPermissions.js` (plus exceptions for POST routes
   that are not creates, such as `/:id/approve`).
4. In the page, `const { canCreate, canModify, canDelete } = usePermission('<key>')`
   around its buttons, and `action="create"` / `action="modify"` on its new/edit routes.
