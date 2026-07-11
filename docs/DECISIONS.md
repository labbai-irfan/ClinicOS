# ClinicOS — Architectural Decision Records

Format: **ADR-N — Title** / Context / Decision / Consequences.

---

## ADR-1 — npm workspaces monorepo, internal-packages pattern

**Context.** Spec requires a modular monorepo (`apps/*`, `packages/*`). pnpm is not
installed; npm 11 workspaces are mature.

**Decision.** npm workspaces. Shared packages (`@clinicos/types`, `@clinicos/validation`,
`@clinicos/config`) export raw TypeScript (`"main": "./src/index.ts"`); consumers compile
them (Vite for web, `tsx` for api/worker dev, esbuild bundle for api prod).

**Consequences.** No per-package build/watch pipelines; instant cross-package edits;
each app's `tsc --noEmit` typechecks shared source. Packages cannot be published to npm
without adding a build step (acceptable — they are private).

## ADR-2 — Tailwind CSS only; no Bootstrap

**Context.** Spec allows Bootstrap "only when it materially reduces effort and doesn't
conflict with the design system."

**Decision.** Tailwind + Radix UI primitives + CVA exclusively. Bootstrap is omitted.

**Consequences.** One styling system, no global-CSS conflicts, smaller bundle. No
Bootstrap component is needed that Radix + Tailwind doesn't cover.

## ADR-3 — Express 4 + Mongoose 8, domain-oriented modules

**Context.** Express 5 changed routing internals (path-to-regexp v8); middleware
ecosystem compatibility is still uneven.

**Decision.** Express `^4.21` with a `modules/<domain>/` structure:
`*.model.ts`, `*.service.ts`, `*.controller.ts`, `*.routes.ts`, `*.test.ts`.
Controllers stay thin; business rules live in services; models are the only DB surface.

## ADR-4 — Auth: JWT access (15 min) + rotating refresh tokens in HTTP-only cookies

**Decision.** Access token returned in the response body (held in memory on the web app,
never localStorage). Refresh token is an HTTP-only, `SameSite=Lax`, `Secure` cookie,
stored **hashed** in the `sessions` collection, rotated on every refresh; reuse of a
rotated token revokes the whole session family. bcryptjs (cost 12) for passwords —
pure-JS avoids native build issues on Windows dev machines; swappable for Argon2 later.

## ADR-5 — Tenant context is server-resolved, never client-supplied

**Decision.** `authenticate` verifies the JWT → `tenant` middleware loads the user's
active membership → `req.tenant = { organizationId, clinicId, branchId, roleKey,
permissions }`. Request-body/query tenant ids are ignored for scoping; repositories
inject the tenant filter into every query. A cross-tenant access attempt is a 404, not
a 403 (no existence leakage), and is audit-logged.

## ADR-6 — RBAC: permission catalog in `@clinicos/types`, roles as permission sets

**Decision.** Permissions are string constants (`patient.read.clinical`,
`queue.override`, …) in one canonical catalog. Roles are documents holding permission
arrays; system roles are seeded per clinic and cloneable/customizable. Backend enforces
via `authorize(permission)` middleware; frontend mirrors with `usePermission()` for
role-aware navigation only (never as a security boundary).

## ADR-7 — Queue engine: event-sourced transitions + atomic token counters

**Decision.** Token numbers come from `sequenceCounters` via atomic
`findOneAndUpdate({ scopeKey }, { $inc: { value: 1 } }, { upsert: true })` — no
duplicates under concurrency. Queue entries hold current status + `version` (optimistic
concurrency); every transition validates against the state machine in
`@clinicos/types`, appends an immutable `queueEvents` document, and emits a Socket.IO
event. Manual reorder/skip/rejoin require permission + reason, and never delete history.

## ADR-8 — Waiting-time estimates are ranges, never exact times

**Decision.** Estimate = active patients ahead × doctor's rolling average consultation
duration (last 10 completed, clinic-configurable fallback), adjusted for the elapsed time
of the in-progress consultation, doctor pauses and emergency interruptions. Presented as
a range (e.g. "25–35 min") with the inputs stored on the entry for later calibration.

## ADR-9 — Real-time via Socket.IO rooms scoped by tenant

**Decision.** Rooms: `clinic:<id>`, `branch:<id>`, `branch:<id>:display` (privacy-safe
waiting-room payloads only — tokens, never names), `user:<id>`. Socket handshake
authenticates with the access token; display screens use a scoped display token.

## ADR-10 — Redis/BullMQ strictly optional at runtime

**Decision.** The API never enqueues directly — it calls a `jobs` facade that no-ops
(with a structured warning log) when Redis is unreachable. Reminders, PDF pre-rendering
and analytics rollups degrade; check-in, queue, consultation, billing do not.

## ADR-11 — PDFs server-side with pdfkit

**Decision.** `pdfkit` (pure JS, no headless browser) renders prescriptions, invoices,
receipts, and transfer summaries from dedicated layout functions. Print flows in the web
app use dedicated print stylesheets (`@media print`) on print-specific routes.

## ADR-12 — Soft delete + immutable clinical records

**Decision.** Tenant documents get `deletedAt` (soft delete) via a shared schema plugin.
Finalized consultations/prescriptions are immutable: changes create amendment/version
documents with full audit trail. Audit logs and queue/emergency event streams are
append-only collections with no update/delete API paths.

## ADR-13 — Dates stored UTC, rendered in clinic-local timezone

**Decision.** All timestamps persist as UTC `Date`. Each clinic stores an IANA
`timezone` setting; "today" boundaries for queues/analytics are computed from it.
`date-fns` on both tiers.

## ADR-14 — Charts: Apache ECharts via a thin in-house React wrapper

**Decision.** A small `<Chart>` component (init/resize/dispose/theme/accessible summary)
wraps `echarts` directly instead of depending on stale wrapper libraries.

## ADR-16 — Native app path: Capacitor wrapping the web app (user decision, 2026-07-11)

**Context.** The user wants ClinicOS eventually installable as a native iOS/Android
app and wants deployment to stay simple while learning the stack.

**Decision.** `apps/web` is built mobile-ready from the start (fully responsive,
44px touch targets, no browser-only APIs that break inside a WebView) so it can be
wrapped with **Capacitor** later — one React codebase producing both the browser app
and installable native apps. React Native (a second, separate UI codebase) was
explicitly declined in favor of this lower-maintenance path.

**Consequence — auth.** A native WebView cannot always reliably persist cross-origin
httpOnly cookies, so `POST /auth/login|register-owner|refresh` return `refreshToken`
in the JSON body **only** when the request carries `X-Client-Type: native` (see
`auth.controller.ts`). Web clients never receive it in the body — only via the
httpOnly cookie — preserving XSS protection (ADR-4). No backend rework will be
needed when the Capacitor wrap happens; only the native client shell needs to store
that token in secure device storage and send it back via the same header/body.

## ADR-17 — Deployment target: simple managed hosting (user decision, 2026-07-11)

**Decision.** Target Vercel (apps/web static build) + Railway or Render (apps/api,
persistent Node process for Socket.IO) + MongoDB Atlas free/shared tier + Cloudinary
free tier, with Redis/BullMQ added only when needed (ADR-10 already makes this
optional). AWS (ADR/spec's alternative) is deferred until scale requires it — the
API has no code-level dependency on any specific host, so migrating later is a
config change, not a rewrite.

## ADR-15 — React 18 + Vite 5 + TanStack Query 5 + Zustand 5

**Decision.** Server state lives exclusively in TanStack Query (with Socket.IO-driven
invalidation); Zustand holds only UI/session state (auth tokens, sidebar, active branch).
React Router 6 with role-aware route guards and route-level code splitting.
