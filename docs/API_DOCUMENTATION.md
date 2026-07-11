# ClinicOS — API Documentation

Base URL: `{API_BASE_URL}/api/v1`. All routes except `/auth/login`,
`/auth/register-owner`, `/auth/refresh`, `/auth/forgot-password`,
`/auth/reset-password`, and the Socket.IO waiting-room display handshake require a
`Authorization: Bearer <accessToken>` header. Every route also runs through
`tenantContext` (resolves clinic/branch from the authenticated session) except the
auth routes themselves — see `docs/ARCHITECTURE.md`.

> A generated OpenAPI/Swagger document is the intended long-term source of truth
> (spec §3 "Swagger/OpenAPI documentation") — add `swagger-jsdoc`/`zod-to-openapi`
> once the route surface stabilizes. Until then, this file plus
> `apps/api/src/modules/index.ts` (the route registry) are authoritative.

## Response envelope

Success:

```json
{ "success": true, "data": { }, "meta": { "requestId": "..." } }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Error codes: see `ERROR_CODES` in `packages/types/src/api.ts` — `VALIDATION_ERROR`,
`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE`,
`INVALID_TRANSITION`, `ACCOUNT_LOCKED`, `TOKEN_EXPIRED`, `TOKEN_REUSED`,
`TENANT_MISMATCH`, `DOUBLE_BOOKING`, `RECORD_FINALIZED`, `PAYMENT_EXCEEDS_DUE`,
`SERVICE_UNAVAILABLE`, `RATE_LIMITED`, `INTERNAL`.

## Pagination

List endpoints accept `?page=&limit=&sort=&order=&search=` (parsed by
`shared/pagination.ts`) and return `meta: { page, limit, total }`.

## Route groups

| Mount | Domain | Key permissions |
| --- | --- | --- |
| `/auth` | login, refresh, logout, password reset, sessions | — |
| `/clinics` | current clinic identity + onboarding progress | `settings.manage`, `onboarding.manage` |
| `/branches` | branch CRUD, working hours | `settings.manage` |
| `/staff` | staff invite/list/update | `staff.manage` |
| `/roles` | role list + permission-matrix update | `role.manage` |
| `/schedules` | doctor weekly schedule, leaves, available slots | `schedule.manage` |
| `/patients` | registration, search, merge, duplicate check | `patient.*` |
| `/appointments` | booking, reschedule, status | `appointment.*` |
| `/queues` | add/transition/skip/rejoin/transfer/call, board | `queue.*` |
| `/emergencies` | quick entry, triage, transitions, assign, referral | `emergency.*` |
| `/nurse-assessments` | draft/complete assessment | `assessment.*` |
| `/vitals` | record + list vitals | `vitals.*` |
| `/consultations` | draft/complete/amend | `consultation.*` |
| `/prescriptions` | draft/finalize/versions/PDF | `prescription.*` |
| `/billing` | invoices, payments, refunds, daily closing, PDFs | `billing.*` |
| `/documents` | upload/download/replace/archive | `document.*` |
| `/notifications` | list/read/preferences | — (per-user) |
| `/dashboard` | summary KPIs | `dashboard.view` |
| `/analytics` | patient/queue/revenue/emergency reports | `reports.view` |
| `/audit-logs` | read-only log viewer | `audit.view` |
| `/settings` | clinic + token settings | `settings.manage` |

Full request/response DTO shapes: `packages/types/src/entities.ts`. Full request
validation schemas (the exact accepted body shape for every mutation): each
`packages/validation/src/*.ts` file, one per domain, matching the route groups above.

## Realtime (Socket.IO)

Handshake: `{ auth: { token } }` for staff clients (joins `clinic:<id>`,
`branch:<id>` for each assigned branch, `user:<id>`), or `{ auth: { displayBranchId }
}` for an unauthenticated waiting-room display client (joins only
`branch:<id>:display`). Event names: `packages/types/src/realtime.ts#SOCKET_EVENTS`.
