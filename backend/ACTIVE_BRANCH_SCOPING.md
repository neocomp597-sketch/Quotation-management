# Active branch scoping

Every user works in exactly one **active branch** at a time. The branch shown in the
header (`BRANCH: NASHIK`) is the branch the backend scopes every branch-dependent
query to. This applies to every role, super admin included.

## Flow

1. Login returns `user.assignedBranches` (the branches the user may work in: every
   company branch for admins / super admins, whatever branch their own record
   carries, since that is only their home branch; the assignment for everyone else),
   `user.activeBranchId` and `user.activeBranch`.
2. Login goes straight into the app, in the branch the user last worked in, else their
   home branch, else the first of their branches (`AuthContext`). There is no selection
   screen: the user switches from the header when they need to. A session that is
   already open re-reads `GET /api/auth/branches` at startup, so branches added later
   (or a changed role) show up in the header switcher without logging in again.
3. `PUT /api/auth/active-branch { branchId }` validates the branch against the user's
   selectable branches and persists it on the user (`User.activeBranchId`).
4. The frontend sends `x-active-branch: <branchId>` on every request. Switching the
   branch in the header persists it again, clears the client cache and remounts the
   page so every screen reloads in the new context.

## Server-side enforcement (`middlewares/authMiddleware.js`)

- The header branch is validated on every request. An unusable branch gets
  `403 { code: "ACTIVE_BRANCH_INVALID" }`; the frontend then clears its branch, re-reads
  the user's branches and moves the session to one they can use.
- Without a header the branch persisted on the user is used (exports opened in a new
  tab, API tools). `?activeBranchId=` is accepted as well.
- The resolved branch is put in the request context (`AsyncLocalStorage`) and
  `models/plugins/tenantPlugin.js` adds the branch filter to every `find`, `count`,
  `update`, `delete` **and `aggregate`** on models that carry `branchId` /
  `assignedBranches`. Controllers do not need to filter by branch themselves, and a
  caller cannot widen the scope by passing their own `branchId`.
- Staff with **no branch assigned** cannot log in: login, session refresh and every API call
  answer 403 `NO_BRANCH_ASSIGNED`, and the login page shows the message. Admins, super admins
  and vendor logins are exempt. An admin assigns branches in Authorization > Team Users >
  Individual Permissions > Branch Access, or in Employee Master (each updates the other).
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

Customer Service is branch-wise: tickets, visits, RCA reports, warranties, AMCs, attendance and
the CSM Detail Dashboard show only the branch selected in the header. The one exception is
Customer Service Analytics: its Branch filter can show all of the user's branches or another of
them, and the Tickets Register opened from its cards lists the same tickets
(`middlewares/branchView.js`, `?branchView=all|<id>`, never beyond the user's branches). A ticket
itself still opens only in its own branch, so the register switches branch to open one.
Every new ticket gets one branch. Checks that must see the whole company pass `bypassBranch`:
one active ticket per serial, ticket numbers on import, masters in use.
The engineer list follows the branches of the engineer's employee record, because those are
the only branches whose tickets they can see (Territory Master asks for all of them).
Older tickets with no branch stay visible from every branch until they are given one, by
editing the ticket or with `scripts/backfillBranchIds.js` (their customer's branch).

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

## Serial branch transfers

Serial No Transfer > Branch Transfer moves Invoice Bulk Upload serials (Asset) to another
branch: the Asset, its customer history (SerialTransfer) and its Invoice Bulk Upload
history (AssetHistory) take the destination branch in one transaction, and a
SerialBranchTransfer record per serial keeps both branches. Status, customer and invoice
data are not changed. The routes under `/api/serial-transfers/branch-transfers` run
without the active-branch filter (`acrossBranches`); `utils/serialBranchAccess.js` holds
the rules, switched by `SERIAL_BRANCH_TRANSFER_ACCESS`:

- unset / `all` (current, for testing): serials can be moved out of any branch of the
  company, and every transfer is listed in every branch.
- `branch`: serials can be moved only out of the active branch (or, without one, the
  user's selectable branches), and only transfers out of or into those branches are
  listed.

The Serial No List, Invoice Bulk Upload and the other Serial No Transfer tabs keep the
normal active-branch scoping above, so a moved serial shows under its new branch.
