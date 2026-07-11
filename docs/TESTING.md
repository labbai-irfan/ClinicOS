# ClinicOS — Testing

## Layers

| Layer | Tool | Location | Run |
| --- | --- | --- | --- |
| Backend unit/integration | Vitest + Supertest + `mongodb-memory-server` | `apps/api/src/**/*.test.ts` | `npm run test --workspace=apps/api` |
| Frontend unit | Vitest + React Testing Library | `apps/web/src/**/*.test.tsx` | `npm run test --workspace=apps/web` |
| End-to-end | Playwright | `apps/web/e2e/` (Phase 1 follow-up) | `npm run test:e2e` |

Every backend module ships a `*.test.ts` alongside its service — this is a hard
convention in `docs/ENGINEERING_GUIDE.md`, not optional polish.

## Backend test setup

`apps/api/src/test/setup.ts` boots an in-memory MongoDB (`mongodb-memory-server`)
once per test file and tears it down after — no real database or network dependency
in CI. `apps/api/src/test/helpers.ts#createTestClinic()` seeds a full tenant
(organization, clinic, branch, all system roles, one user per staff role) and
returns ready-to-use Bearer tokens, so any module's tests can immediately exercise
permission boundaries without re-deriving auth from scratch:

```ts
const { app, tokens, branchId } = await createTestClinic();
await authed(app, tokens.receptionist).post('/api/v1/patients').send({...});
```

## What's covered per domain (see each module's `*.test.ts`)

- **State machines**: every domain with a transition table (queue, emergency,
  appointment) has a test asserting an illegal transition is rejected with
  `InvalidTransitionError`, not silently applied.
- **Permission boundaries**: every mutation route has at least one test asserting a
  role without the required permission gets `403`.
- **Tenant isolation**: cross-clinic access returns `404`, proven by seeding two
  separate test clinics and asserting clinic A's token cannot read clinic B's
  record.
- **Idempotency**: billing payment recording is tested with a repeated
  `Idempotency-Key` header, asserting the second request replays the first result
  rather than double-charging.
- **Money correctness**: billing tests assert totals/discounts/refunds in integer
  paise, and that revenue analytics counts payments received, not invoice totals.
- **Audit trail**: sensitive mutations (role permission changes, queue skip/rejoin,
  billing discount/refund, emergency priority) assert an `AuditLog` entry was
  written.

## Frontend

Component tests use React Testing Library with `jsdom`. Priority areas: form
validation error states, permission-gated UI (an element is absent, not merely
disabled, when the permission is missing), and the `QueryBoundary` loading/error/
empty branches.

## Manual/exploratory verification

Before marking a feature complete, exercise it through the actual UI (not just
passing tests) — see the root `/verify` skill for this repo once test scaffolding
stabilizes: start `apps/api` and `apps/web`, walk the golden path (register clinic →
onboard → register patient → queue → nurse → doctor → prescription → billing) and at
least one edge case (skip/rejoin, emergency with unknown identity, double-booking
rejection).

## Coverage philosophy

Per spec §43, the canonical end-to-end flows to prove work together (not just in
isolation) are: normal patient (register → queue → nurse → doctor → prescription →
billing → complete), appointment patient (book → check-in → queue → consultation →
complete), emergency patient (quick registration → triage → doctor alert →
assessment → referral/discharge), walk-in without a phone number, and a returning
patient (search → queue → view history → consultation). These become the first
Playwright specs once the UI is stable enough to script against reliably.
