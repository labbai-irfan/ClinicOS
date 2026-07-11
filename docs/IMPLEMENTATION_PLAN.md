# ClinicOS — Implementation Plan

Phase 1 is the immediate priority and must be independently usable by a real clinic.
Order follows §46 of the product specification. Status is tracked live in
`docs/PROGRESS.md`.

---

## Milestone 0 — Foundation

| # | Feature | Depends on | Acceptance criteria | Tests |
|---|---------|-----------|---------------------|-------|
| 0.1 | Monorepo scaffold (npm workspaces, TS strict, ESLint/Prettier/Husky) | — | `npm run typecheck` & `lint` pass from root | CI-style scripts run clean |
| 0.2 | `@clinicos/types` — enums, state machines, permission catalog, entity types, realtime event names | 0.1 | Both apps import without duplication | transition-map unit tests |
| 0.3 | `@clinicos/validation` — Zod schemas for every Phase 1 domain | 0.2 | API validates requests & web forms resolve from the same schema | schema unit tests |
| 0.4 | API core — env validation, pino logging, request IDs, error envelope, Helmet/CORS/rate limits, Mongo connection, soft-delete & tenant plugins | 0.1 | Boots with `.env`, `/health` returns ok, errors follow the envelope | supertest smoke |
| 0.5 | Auth — login/logout/refresh rotation/lockout/password flows, sessions, login history | 0.4 | All §8 auth criteria; refresh reuse revokes session family | integration tests |
| 0.6 | Multi-tenancy + RBAC — organizations/clinics/branches/memberships/roles, `authorize()` | 0.5 | Cross-tenant reads return 404 and audit; permission denial 403 | tenant-isolation tests |
| 0.7 | Web core — design tokens, Tailwind theme, UI kit, app shell, role-aware nav, auth pages, API client, socket client | 0.1 | Login → shell renders role-scoped nav; responsive 320→1920 | RTL smoke tests |

## Milestone 1 — Core Operations

| # | Feature | Depends on | Acceptance criteria |
|---|---------|-----------|---------------------|
| 1.1 | Clinic onboarding wizard (9 steps, save & resume, completion %) | 0.6, 0.7 | Clinic can self-configure & activate |
| 1.2 | Staff management (doctors/nurses/receptionists, invites) | 0.6 | Staff login per role |
| 1.3 | Doctor schedules, leaves, holidays | 1.2 | Bookable windows derived correctly |
| 1.4 | Patient registration (quick + full), duplicate detection, controlled merge | 0.6 | ≤3 primary actions; no auto-merge |
| 1.5 | Patient directory + profile tabs | 1.4 | Search by name/mobile/code/DOB |
| 1.6 | Appointments (calendar views, windows, statuses, rules, audit timeline) | 1.3, 1.4 | Double-booking blocked without override permission |
| 1.7 | Token engine (atomic counters, prefix rules, daily reset) | 0.6 | No duplicate tokens under concurrent check-in |
| 1.8 | Queue engine (state machine, Kanban board, skip/rejoin policies, estimates) | 1.7 | All §14–16 flows; realtime updates |
| 1.9 | Waiting-room display (privacy-safe, full-screen, realtime) | 1.8 | Tokens only, no PHI |

## Milestone 2 — Clinical

| # | Feature | Acceptance criteria |
|---|---------|---------------------|
| 2.1 | Nurse assessment + vitals (tablet-first, drafts, autosave) | Assessment → "ready for doctor" transition |
| 2.2 | Doctor consultation (3-region layout, drafts, finalize, amendments) | Finalized records immutable; amendments audited |
| 2.3 | Patient medical timeline | Auto-populates from all event sources |
| 2.4 | Prescription builder + PDF | Finalize → versioned; PDF/print clean |

## Milestone 3 — Emergency

| # | Feature | Acceptance criteria |
|---|---------|---------------------|
| 3.1 | Emergency quick entry (unknown/unconscious patient supported) | ER case ID; incomplete identity allowed |
| 3.2 | Emergency board + triage (staff-confirmed priority only) | No automatic urgency classification |
| 3.3 | Emergency timeline (append-only) | Every action timestamped w/ user+role |
| 3.4 | Observation / referral / transfer summary PDF | Normal queue preserved; estimates updated |

## Milestone 4 — Finance

| # | Feature | Acceptance criteria |
|---|---------|---------------------|
| 4.1 | Invoices + items | Draft → finalize flow |
| 4.2 | Payments (cash/UPI/card/bank/mixed, partial), refunds w/ permission+reason | Idempotent payment recording |
| 4.3 | Receipts + PDFs, daily closing summary | Print-clean output |

## Milestone 5 — Intelligence

Dashboard (real data only), queue/patient/revenue/emergency analytics — every metric with
definition + formula (see ANALYTICS section of API docs).

## Milestone 6 — Quality

Notifications center, audit-log viewer, security hardening pass, accessibility review
(WCAG 2.2 AA), responsive review (320→1920), test suites (unit/integration/e2e),
performance pass, documentation set, deployment configs.

---

## Phase 2 / Phase 3

Architecturally prepared (provider abstraction for notifications, patient identity model
supports portal auth, module boundaries for pharmacy/lab/referral) — **not implemented**
until Phase 1 is stable. See §28–29 of the specification.
