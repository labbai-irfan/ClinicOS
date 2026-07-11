# ClinicOS

A unified digital operating system for local clinics — the complete patient journey
from walk-in or appointment through check-in, live queue, nurse assessment, doctor
consultation, digital prescription, billing, and follow-up, plus a parallel emergency
workflow that never disrupts normal clinic operations.

See `docs/` for the full picture:

- [`docs/PROJECT_ANALYSIS.md`](docs/PROJECT_ANALYSIS.md) — workspace state, environment, architecture
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — milestones and acceptance criteria
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — architectural decisions and why
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — live status: done / in progress / blocked / next
- [`docs/ENGINEERING_GUIDE.md`](docs/ENGINEERING_GUIDE.md) — binding file-layout and coding conventions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) — collections, indexes, tenancy model
- [`docs/RBAC_MATRIX.md`](docs/RBAC_MATRIX.md) — roles and permissions
- [`docs/QUEUE_ENGINE.md`](docs/QUEUE_ENGINE.md) — token/queue state machine and wait estimation
- [`docs/EMERGENCY_WORKFLOW.md`](docs/EMERGENCY_WORKFLOW.md) — emergency case lifecycle
- [`docs/SECURITY.md`](docs/SECURITY.md) — security controls
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how to deploy
- [`docs/TESTING.md`](docs/TESTING.md) — test strategy and how to run tests
- [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) — every `.env` variable

## Stack

React + TypeScript + Vite + Tailwind (web) · Node.js + Express + TypeScript +
MongoDB/Mongoose (api) · Socket.IO (realtime) · BullMQ/Redis (optional background
jobs) · Cloudinary (documents) — see `docs/DECISIONS.md` for the reasoning behind
each choice, including the Capacitor native-app path and simple-managed-hosting
deployment target.

## Monorepo layout

```
apps/
  web/      React app — staff/clinic UI, waiting-room display, Capacitor-ready
  api/      Express API — REST /api/v1 + Socket.IO
  worker/   Optional BullMQ background jobs (Redis)
packages/
  types/       Shared TypeScript domain types, enums, state machines, permissions
  validation/  Shared Zod schemas (single source of truth for API + form validation)
  config/      Shared constants and defaults
docs/          All documentation
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in MongoDB URI at minimum; everything else has a dev default
npm run dev:api        # apps/api on :4000
npm run dev:web         # apps/web on :5173
```

Run tests: `npm test` (all workspaces) or `npm run test --workspace=apps/api`.
Typecheck everything: `npm run typecheck`.
