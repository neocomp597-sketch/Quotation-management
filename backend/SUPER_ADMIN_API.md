# Super Admin API

All routes require a valid JWT for a user with `role: "SUPER_ADMIN"`.

## Routes

- `GET /api/super-admin/company-stats`
  - Returns company and user totals.
- `GET /api/super-admin/companies`
  - Returns companies with backend-aggregated `userCount` and `activeUserCount`.
- `GET /api/super-admin/users?companyId=<id>&limit=100`
  - Returns tenant and platform users for status management.
- `GET /api/super-admin/audit-logs?limit=50`
  - Returns recent platform audit events.
- `PATCH /api/super-admin/users/:id/status`
  - Body: `{ "isActive": false }`
  - Blocks self-deactivation and last active platform-admin deactivation.
  - Increments `tokenVersion` and revokes refresh sessions when disabling.
- `PATCH /api/super-admin/companies/:id/status`
  - Body: `{ "isActive": false, "status": "SUSPENDED" }`
  - Valid statuses: `ACTIVE`, `SUSPENDED`, `DISABLED`.
  - Suspends users, increments `tokenVersion`, and revokes refresh sessions.

## Security Notes

- Super admin access is not email-based.
- Platform admins should not have `companyId`.
- Tenant routes remain tenant scoped; platform operations live under `/api/super-admin`.
- Login, refresh, and protected APIs reject inactive users and suspended companies.
- Status mutations write `PlatformAuditLog` records with actor, target, previous state, next state, IP, user agent, and timestamp.
