# Active branch scoping

Every user works in exactly one **active branch** at a time. The branch shown in the
header (`BRANCH: NASHIK`) is the branch the backend scopes every branch-dependent
query to. This applies to every role, super admin included.

## Flow

1. Login returns `user.assignedBranches` (the branches the user may work in: every
   company branch for admins / super admins, whatever branch their own record
   carries, since that is only their home branch; the assignment for everyone else),
   `user.activeBranchId` and `user.activeBranch`.
2. A user with more than one branch to choose from (every admin of a multi-branch
   company) is sent to **Select Active Branch**, preselected to the branch they last
   worked in, else their home branch. A single-branch user gets their branch applied
   automatically. A session that is already open re-reads `GET /api/auth/branches`
   at startup, so branches added later (or a changed role) show up in the header
   switcher without logging in again.
3. `PUT /api/auth/active-branch { branchId }` validates the branch against the user's
   selectable branches and persists it on the user (`User.activeBranchId`).
4. The frontend sends `x-active-branch: <branchId>` on every request. Switching the
   branch in the header persists it again, clears the client cache and remounts the
   page so every screen reloads in the new context.

## Server-side enforcement (`middlewares/authMiddleware.js`)

- The header branch is validated on every request. An unusable branch gets
  `403 { code: "ACTIVE_BRANCH_INVALID" }`; the frontend then clears its branch and
  returns to the selection screen.
- Without a header the branch persisted on the user is used (exports opened in a new
  tab, API tools). `?activeBranchId=` is accepted as well.
- The resolved branch is put in the request context (`AsyncLocalStorage`) and
  `models/plugins/tenantPlugin.js` adds the branch filter to every `find`, `count`,
  `update`, `delete` **and `aggregate`** on models that carry `branchId` /
  `assignedBranches`. Controllers do not need to filter by branch themselves, and a
  caller cannot widen the scope by passing their own `branchId`.
- Records with **no branch** stay visible from every branch: they are not owned by a
  branch. Use `scripts/backfillBranchIds.js` to give legacy records the branch of
  their customer / warehouse.
- New records created in a branch context default `branchId` to the active branch.
- Platform screens under `/api/super-admin/*` are not branch filtered.
- `req.user.activeBranchId` and `req.user.allowedBranchIds` are available to
  controllers; `getActiveBranchId()` / `getScopedBranches()` from
  `middlewares/tenantContext.js` work anywhere in the request.
- Server-side list caches (`utils/apiCache.js`) include the active branch in their key.

## Branch-scoped models

Customer, Enquiry, Quotation, Ticket, EmployeeProfile, User (list endpoint), Contact,
CustomerContact, Planning, Warehouse, StockLedger, StockTransfer, StockAdjustment,
StockCount, StockAlert, ServiceVisit, Warranty, AMC, Asset, AssetHistory,
KnowledgeBase, Notification (all via tenantPlugin), plus CSMRcaReport and
FieldAttendance (explicit filter in their controllers). Service visits and RCA reports
take their ticket's branch and follow the ticket when it is moved; warranties, AMCs
and assets take their customer's branch; asset history takes its asset's branch;
attendance check-ins, knowledge base articles and notifications take the active
branch of the request that created them (notifications raised by background jobs
carry no branch and reach the user in every branch). Product is a company-wide
catalog and is not branch scoped.

## Endpoints

| Method | Path                      | Purpose                                              |
| ------ | ------------------------- | ---------------------------------------------------- |
| GET    | `/api/auth/branches`      | Branches the user may select + current active branch |
| PUT    | `/api/auth/active-branch` | Persist the active branch (`{ branchId }`)           |
| GET    | `/api/auth/me`            | Includes `assignedBranches`, `activeBranchId`, `activeBranch` |
| GET    | `/api/branches`           | Same list, full branch documents                     |

## Escape hatches

- `Model.find(...).setOptions({ bypassBranch: true })` - look across branches for one
  query (an id lookup that must reach any record). `bypassTenant: true` implies it.
- `runWithTenant(companyId, fn, { bypassBranch: true })` - background work that must
  not be branch filtered.
