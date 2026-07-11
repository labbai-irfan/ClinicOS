# Changelog

All notable changes to ClinicOS are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Phase 1 build

### Added

- Monorepo foundation: npm workspaces, strict TypeScript, ESLint/Prettier/Husky.
- `@clinicos/types` — enums, state machines (queue/emergency/appointment), the
  permission catalog, shared DTOs, Socket.IO event names.
- `@clinicos/validation` — Zod schemas for every Phase 1 domain, shared by the API
  and web forms.
- `@clinicos/config` — shared constants (money formatting, token formatting,
  defaults, age computation).
- API foundation: env validation, structured logging with secret redaction, security
  middleware (Helmet, CORS, rate limiting), MongoDB connection + tenant/soft-delete
  plugin, centralized error envelope, idempotency-key support, Socket.IO realtime
  layer with tenant-scoped rooms.
- Authentication: login/logout/logout-all, refresh-token rotation with reuse
  detection, account lockout, password reset, session listing, native-client
  (Capacitor) token flow alongside the web httpOnly-cookie flow.
- Multi-tenancy and RBAC: organizations/clinics/branches/memberships/roles, seeded
  default permission sets per role, tenant context resolved server-side only.
- Web foundation: design tokens (light/dark), Tailwind theme, accessible UI kit
  (Radix-based), responsive app shell with role-aware navigation, TanStack Query +
  Axios client with automatic token refresh, Socket.IO client, auth pages.
- Backend domain modules and frontend feature areas for the full Phase 1 patient
  journey — patients, appointments, the live queue/token engine, the emergency
  workflow, nurse assessment, vitals, doctor consultation, digital prescriptions,
  billing/payments, documents, notifications, the dashboard, and analytics — see
  `docs/PROGRESS.md` for current status.

### Decisions

See `docs/DECISIONS.md` for the full ADR log, including the Capacitor native-app
path and simple-managed-hosting deployment target (ADR-16, ADR-17).
