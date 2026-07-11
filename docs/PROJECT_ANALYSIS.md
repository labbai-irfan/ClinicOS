# ClinicOS — Project Analysis

_Date: 2026-07-11_

## Workspace state at analysis time

The workspace `CliniOS/` was **completely empty** — no existing frontend, backend, design
system, routes, authentication, database models, APIs, reusable components, conventions, or
technical debt. This is a greenfield build; nothing needed to be preserved or migrated.

## Environment

| Item          | Value                                        |
| ------------- | -------------------------------------------- |
| OS            | Windows 11 Pro                               |
| Node.js       | v24.18.0                                     |
| npm           | 11.16.0                                      |
| Git           | available (repo initialized during scaffold) |
| Package mgr   | npm workspaces (pnpm not installed)          |
| Cloud creds   | MongoDB Atlas / Cloudinary / Redis **not provided** — configured via `.env`, `.env.example` documents every variable |

> Note: the workspace lives inside a OneDrive-synced folder. `node_modules` churn can slow
> OneDrive sync; consider excluding the folder from sync or moving the repo.

## Current architecture (as built)

Modular monorepo using npm workspaces:

```
apps/
  web/      React 18 + Vite + TypeScript + Tailwind (staff & clinic app, waiting-room display)
  api/      Node.js + Express + TypeScript + Mongoose (REST /api/v1 + Socket.IO)
  worker/   BullMQ + Redis background jobs (optional at runtime — API degrades gracefully)
packages/
  types/       Shared TypeScript domain types, enums, state machines, permission catalog
  validation/  Shared Zod schemas (single source of truth for API + form validation)
  config/      Shared constants and defaults
docs/          Architecture, product, and process documentation
```

Shared packages are consumed **as TypeScript source** through workspace symlinks
("internal packages" pattern) — no per-package build step; Vite and `tsx` compile them
in place, `tsc --noEmit` typechecks them as part of each app's program.

## Existing features

None pre-existed. See `docs/PROGRESS.md` for the live feature status and
`docs/IMPLEMENTATION_PLAN.md` for milestones and acceptance criteria.

## Missing features / out of scope for Phase 1

- Patient-facing portal, OTP auth, SMS/WhatsApp channels (Phase 2 — provider abstraction
  built now, channels added later)
- Pharmacy, lab, hospital-referral network integrations, teleconsultation (Phase 3)
- Offline conflict-aware sync (Phase 1 ships network indicator + local drafts only)

## Risks

1. **No live MongoDB/Cloudinary/Redis credentials** — development uses local MongoDB or
   `mongodb-memory-server`; document uploads require Cloudinary keys before that module
   is usable end-to-end.
2. **Real-time scale** — Socket.IO needs a persistent Node host (documented in
   DEPLOYMENT.md); serverless platforms are explicitly unsuitable for `apps/api`.
3. **Queue/token correctness under concurrency** — mitigated with atomic
   `sequenceCounters` (findOneAndUpdate upsert), idempotency keys, and optimistic
   versioning on queue transitions.
4. **Tenant isolation** — every tenant-owned query goes through a scoped repository that
   injects `clinicId`/`branchId` from the authenticated membership, never from the client.
5. **OneDrive file locking** can occasionally interfere with `node_modules` on Windows.

## Reusable modules

Everything under `packages/` is deliberately reusable across web, api, worker, and the
future Phase 2 patient portal (`apps/patient` when it lands).

## Proposed architecture

Adopted as designed — see `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` for rationale.

## Migration requirements

None — greenfield.
