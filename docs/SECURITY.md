# ClinicOS — Security

This documents what's implemented and why. It is not a compliance certification —
ClinicOS does not claim HIPAA/legal compliance merely because these controls exist
(spec §36); a real deployment handling PHI needs a proper compliance review.

## Authentication

- Passwords hashed with bcryptjs (cost 12) — `apps/api/src/modules/auth/auth.service.ts`.
- Access tokens: short-lived JWT (15 min default), returned in the response body,
  held in memory/persisted store on the client — never in a cookie accessible to
  other origins.
- Refresh tokens: rotated on every use, stored **hashed** (SHA-256) server-side in
  `sessions`, delivered via an `httpOnly`, `SameSite=Lax` cookie on web (ADR-4).
  **Reuse of an already-rotated refresh token revokes the entire session family** —
  a strong signal of token theft (`auth.service.ts#rotateRefreshToken`).
- Native (Capacitor) clients: see ADR-16 — refresh token only ever appears in the
  response body when the request carries `X-Client-Type: native`; web clients never
  see it there, preserving XSS protection.
- Account lockout after `LOCKOUT_MAX_ATTEMPTS` failed logins for
  `LOCKOUT_DURATION_MINUTES` (configurable, `.env`).
- `POST /auth/logout-all` revokes every session for a user (spec §8 "Logout from all
  devices").

## Authorization

- Every protected route: `authenticate` → `tenantContext` → `authorize(permission)`
  → `validate(schema)` → controller (`apps/api/src/middleware/`).
- Tenant context (`organizationId`/`clinicId`/`branchId`) is resolved **only** from
  the authenticated user's `Membership` record — never from request body/query/params
  (ADR-5). A request for another clinic's resource returns `404`, not `403`, so
  existence isn't leaked cross-tenant.
- Permissions are enforced server-side only; the frontend's `usePermission()` is UX
  convenience, never a security boundary.

## Transport & headers

- `helmet()` sets standard security headers.
- CORS is an explicit allow-list from `WEB_ORIGIN` (comma-separated), not `*`.
- Cookies: `Secure` in production (`COOKIE_SECURE=true`), scoped to `/api/v1/auth`.

## Input handling

- Every request body/query is validated with Zod schemas from `@clinicos/validation`
  before it reaches a controller (`validate()` middleware) — unknown/malformed input
  is rejected with a structured `VALIDATION_ERROR`, never silently coerced.
- Mongoose schemas + Zod together prevent NoSQL-injection-style payloads (no raw
  query objects are ever passed through from client input).
- File uploads (documents module): mimetype + size validated before upload; rejected
  types never reach Cloudinary.

## Data protection

- Documents are stored in Cloudinary with `type: authenticated` (spec §26) — never
  publicly reachable by URL guessing. Downloads go through a short-lived
  (5-minute) signed URL issued per-request, and access is audited.
- Clinical records (consultations, prescriptions) are **immutable once finalized** —
  edits after finalization are rejected (`RecordFinalizedError`) and must go through
  an audited amendment/versioning flow (spec §35, §22, §23).
- Soft delete only (`deletedAt`) for tenant-owned records — nothing is hard-deleted
  by the application (`apps/api/src/database/plugins.ts`).
- Audit logs (`AuditLogModel`) are append-only — there is deliberately no
  update/delete route for that collection.

## Rate limiting & abuse

- Global rate limit on all API routes; a stricter limit on auth endpoints
  (`RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX`, `.env`).
- Idempotency-key support (`apps/api/src/middleware/idempotency.ts`) on critical
  mutations (payments, invoice creation) so a retried request can't double-charge.

## Logging

- `pino` structured logging with redaction paths for `authorization`/`cookie`
  headers and any `password`/`accessToken`/`refreshToken` fields — these never reach
  logs, even in debug mode (`apps/api/src/shared/logger.ts`).
- Stack traces are only returned in API error responses outside production
  (`isProd` check in `error-handler.ts`).

## Secrets

- All secrets come from environment variables (`.env`, never committed — see
  `.gitignore`); `.env.example` documents every variable without real values.
- The API refuses to start in production if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
  are left at their development placeholder values.

## Known gaps (tracked, not yet implemented)

- Two-factor authentication: architecture allows for it (spec §8) but is not
  implemented in Phase 1.
- CSRF: the API is a pure JSON API behind CORS with `SameSite=Lax` cookies used only
  for refresh rotation on the auth routes — add explicit CSRF tokens if a
  cookie-authenticated browser flow beyond refresh is added later.
- Full penetration testing / third-party security audit has not been performed.
