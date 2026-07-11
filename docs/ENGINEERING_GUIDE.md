# ClinicOS — Engineering Guide (binding conventions)

Every module MUST follow these conventions. The central registries (API route registry,
web router, sidebar nav) are written against the file paths and export names below —
deviating breaks the build.

## Imports & TypeScript

- Strict TS everywhere. `verbatimModuleSyntax` is ON → use `import type { X }` for types.
- Shared code comes from `@clinicos/types`, `@clinicos/validation`, `@clinicos/config`.
  Never redefine enums/statuses/permissions locally.
- No `any` (use `unknown` + narrowing). No default exports except React pages/lazy routes.
- Node built-ins imported as `node:crypto`, `node:path`, etc.
- These are ESM packages (`"type": "module"`). Relative imports inside apps use
  extensionless specifiers (bundler resolution) — e.g. `import { x } from '../shared/errors'`.

## API module anatomy (`apps/api/src/modules/<domain>/`)

```
<domain>.model.ts        Mongoose schema+model  (export const <Domain>Model, interface <Domain>Doc)
<domain>.service.ts      Business logic (pure functions taking { tenant, actor } context)
<domain>.controller.ts   Thin: parse → call service → respond with ok()/created()
<domain>.routes.ts       export const <domain>Routes: Router  (auth + authorize + validate wired here)
<domain>.test.ts         Vitest unit/integration tests (mongodb-memory-server)
```

- Every route file starts from `Router()` and is mounted by `modules/index.ts` — do not
  mount inside the module.
- All protected routes: `authenticate` → `tenantContext` → `authorize(PERMISSIONS.x)` →
  `validate(schema)` → controller. These come from `../../middleware`.
- Responses: `ok(res, data, meta?)`, `created(res, data)`, errors via `throw new
  AppError(...)` subclasses from `../../shared/errors` (async errors are caught by
  `asyncHandler` — wrap every controller fn).
- Pagination: `parsePagination(req.query)` from `../../shared/pagination`; return
  `ok(res, items, { page, limit, total })`.
- NEVER read `clinicId`/`branchId`/`organizationId` from body/query for scoping — always
  `req.tenant`. Repos/services must include `clinicId` in every filter.
- Audit: `await audit(req, { action, resource, resourceId, before?, after?, reason? })`
  from `../../shared/audit` for every action listed in spec §37.
- Realtime: `emitToBranch(branchId, event, payload)` / `emitToClinic` / `emitToDisplay`
  from `../../realtime/emit`. Event names ONLY from `SOCKET_EVENTS` in `@clinicos/types`.
- Soft delete via `deletedAt`; base plugin `tenantBase` (adds organizationId/clinicId/
  branchId?, deletedAt, timestamps) from `../../database/plugins`.
- Sequences (tokens, patient codes, invoice numbers, ER ids):
  `nextSequence(scopeKey)` from `../../shared/sequence` — never compute max()+1.

### Canonical models (import across modules ONLY from these paths)

| Model export | File |
| --- | --- |
| `UserModel` | `modules/users/user.model.ts` |
| `SessionModel` | `modules/auth/session.model.ts` |
| `OrganizationModel` | `modules/organizations/organization.model.ts` |
| `ClinicModel` | `modules/clinics/clinic.model.ts` |
| `BranchModel` | `modules/branches/branch.model.ts` |
| `MembershipModel` | `modules/memberships/membership.model.ts` |
| `RoleModel` | `modules/roles/role.model.ts` |
| `StaffProfileModel` | `modules/staff/staff.model.ts` |
| `DoctorScheduleModel` | `modules/schedules/schedule.model.ts` |
| `PatientModel` | `modules/patients/patient.model.ts` |
| `AppointmentModel` | `modules/appointments/appointment.model.ts` |
| `QueueEntryModel` | `modules/queues/queue-entry.model.ts` |
| `QueueEventModel` | `modules/queues/queue-event.model.ts` |
| `NurseAssessmentModel` | `modules/nurse-assessments/nurse-assessment.model.ts` |
| `VitalRecordModel` | `modules/vitals/vital.model.ts` |
| `ConsultationModel` | `modules/consultations/consultation.model.ts` |
| `PrescriptionModel` | `modules/prescriptions/prescription.model.ts` |
| `EmergencyCaseModel` | `modules/emergencies/emergency.model.ts` |
| `EmergencyEventModel` | `modules/emergencies/emergency-event.model.ts` |
| `InvoiceModel` | `modules/billing/invoice.model.ts` |
| `PaymentModel` | `modules/billing/payment.model.ts` |
| `DocumentModel` | `modules/documents/document.model.ts` |
| `NotificationModel` | `modules/notifications/notification.model.ts` |
| `AuditLogModel` | `modules/audit-logs/audit-log.model.ts` |
| `ClinicSettingsModel` | `modules/settings/settings.model.ts` |
| `SequenceCounterModel` | `shared/sequence.ts` |

## Web feature anatomy (`apps/web/src/features/<domain>/`)

```
pages/<Name>Page.tsx     default-export page components (lazy-loaded by router)
components/…             feature-private components
api.ts                   TanStack Query hooks (useXxxQuery/useXxxMutation) built on lib/api
```

- Router (`src/router.tsx`) lazy-imports pages by exact path — check it before creating
  pages; create exactly the files it references.
- Server state: TanStack Query only. Query keys: `[domain, ...scope]` (e.g.
  `['queue', branchId, date]`). Socket events invalidate queries via
  `lib/realtime.ts` subscriptions.
- Forms: React Hook Form + `zodResolver(schema)` with schemas from
  `@clinicos/validation`. Always: labels, required indicators, inline errors, submit
  loading state, disabled duplicate submission.
- UI: components from `src/components/ui` (Button, Input, Select, Dialog, Card, Badge,
  Table, EmptyState, Skeleton, PageHeader, StatusPill, Toast…). Never raw hex colors —
  Tailwind semantic tokens only (`bg-surface`, `text-text-primary`, `border-border`,
  `bg-primary`, `text-danger`, …).
- Every page: loading (skeleton), empty, error, and permission-denied states —
  `<QueryBoundary>` helper covers loading/error; `usePermission()` gates actions.
- Icons: lucide-react, always with visible label or `aria-label` + tooltip.
- Dates: `date-fns`; display clinic-local, transmit ISO strings.
- Accessibility: WCAG 2.2 AA — focus visible, 44px touch targets, no color-only status
  (StatusPill renders icon + text), dialogs from Radix.

## Testing

- API: Vitest + Supertest + mongodb-memory-server. Helper `apps/api/src/test/setup.ts`
  boots an in-memory Mongo and provides `createTestClinic()` returning seeded
  tenant/users/tokens for each role.
- Web: Vitest + RTL, `jsdom`.
- Money: integers in **paise** (`amountPaise`) everywhere; format with `formatMoney` from
  `@clinicos/config`.

## Error codes

Use `ERROR_CODES` from `@clinicos/types`. Envelope is produced centrally — controllers
never build `{ success: false }` bodies by hand.
