# ClinicOS — Architecture

## Overview

```
                    ┌─────────────────────────┐
                    │   apps/web (React)      │
                    │   staff app + display   │
                    │   (Capacitor-wrappable) │
                    └───────────┬─────────────┘
                       REST /api/v1  +  Socket.IO
                                │
                    ┌───────────▼─────────────┐
                    │   apps/api (Express)    │
                    │   modules/<domain>/     │
                    └──┬───────────┬──────────┘
                       │           │
              ┌────────▼───┐   ┌───▼──────────┐
              │  MongoDB   │   │ Redis (opt.) │
              │  Atlas     │   │  BullMQ      │
              └────────────┘   └───┬──────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  apps/worker       │
                          │  (background jobs) │
                          └────────────────────┘

              Cloudinary (documents, authenticated delivery)
```

`packages/types` and `packages/validation` are the contract layer — both apps import
them as TypeScript source (no build step, ADR-1), so a field rename or new enum value
is a single edit that both frontend and backend pick up immediately, with `tsc`
catching anything left inconsistent.

## Backend: domain-oriented modules

`apps/api/src/modules/<domain>/` — one folder per business domain (patients,
appointments, queues, emergencies, nurse-assessments, vitals, consultations,
prescriptions, billing, documents, notifications, dashboards, analytics, audit-logs,
settings, plus identity/tenancy: users, auth, organizations, clinics, branches, staff,
roles, memberships, schedules). Each domain owns:

- `*.model.ts` — the only place that touches its Mongoose schema directly
- `*.service.ts` — business rules (state machine checks, calculations, audit calls)
- `*.controller.ts` — thin HTTP glue: parse → call service → respond
- `*.routes.ts` — wires `authenticate` → `tenantContext` → `authorize()` →
  `validate()` → controller
- `*.test.ts` — Vitest + Supertest against an in-memory MongoDB

`apps/api/src/modules/index.ts` is the single route registry — every domain's router
is mounted there and nowhere else, so the full API surface is visible in one file.

Cross-module references go through Mongoose `ObjectId` refs only (e.g. an
`AppointmentDto` holds a `patientId`, not an embedded patient) — this keeps domains
independently buildable and testable, at the cost of the dashboard/analytics modules
needing to import other domains' `Model` classes for aggregation (the one
intentional exception, since aggregating "today's revenue" genuinely needs to read
the billing collection).

## Frontend: feature-oriented modules

`apps/web/src/features/<domain>/` mirrors the backend split:

- `api.ts` — TanStack Query hooks wrapping the shared `apiClient` (Axios, with an
  automatic refresh-token retry interceptor — `lib/api-client.ts`)
- `pages/<Name>Page.tsx` — routed pages (lazy-loaded; `router.tsx` is the single
  route registry, mirroring `modules/index.ts` on the backend)
- `components/*.tsx` — feature-private components

Server state lives exclusively in TanStack Query; Zustand
(`stores/auth-store.ts`, `stores/ui-store.ts`) holds only client/session state
(tokens, active branch, sidebar collapse). Real-time updates
(`lib/realtime.ts`) invalidate the relevant queries rather than maintaining a
parallel client-side cache.

## Multi-tenancy

`Organization → Clinic → Branch → Staff/Patients → operational records.` Every
tenant-owned Mongoose schema uses the `tenantBase` plugin
(`apps/api/src/database/plugins.ts`), which adds `organizationId`/`clinicId`/
`branchId?` + soft-delete + timestamps. `tenantContext` middleware resolves this
scope from the authenticated user's `Membership` — client-supplied tenant ids are
never trusted (ADR-5). See `docs/DATABASE_DESIGN.md` for indexes.

## Real-time

Socket.IO rooms: `clinic:<id>`, `branch:<id>` (authenticated staff), `branch:<id>:display`
(public waiting-room screens — privacy-safe payloads only), `user:<id>` (personal
notifications/alerts). Event names are a closed enum in
`packages/types/src/realtime.ts` (`SOCKET_EVENTS`) — nothing emits an ad-hoc string.

## Background jobs

Strictly optional (ADR-10). `apps/api` never enqueues directly — it calls a facade
(`shared/jobs.ts`) that no-ops with a logged warning if Redis is unreachable. Only
reminders, PDF pre-rendering, and analytics rollups depend on this; check-in, queue,
consultation, and billing do not.

## Why this shape

The spec's central constraint — a clinic must be fully operable without any patient
ever touching the app — falls directly out of this architecture: every patient-facing
concept (queue position, prescription, appointment) is first and foremost a record
created and driven by staff through `apps/web`; the future patient portal (Phase 2)
is an additional read/write channel onto the same API, not a prerequisite for it.
