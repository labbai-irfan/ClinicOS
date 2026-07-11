# ClinicOS — RBAC Matrix

Source of truth: `packages/types/src/permissions.ts` (`PERMISSIONS`,
`DEFAULT_ROLE_PERMISSIONS`). This file documents that data for humans — if it ever
disagrees with the source file, the source file wins; update this doc to match.

Roles are **per-clinic documents** (`apps/api/src/modules/roles/role.model.ts`),
seeded from `DEFAULT_ROLE_PERMISSIONS` when a clinic is created
(`auth.service.ts#registerOwner`). Clinic owners/admins can customize a role's
permission set via `PATCH /roles/:id` (`ROLE_MANAGE`, always audited with a reason —
spec §6, §37).

## Roles

| Role key | Scope |
| --- | --- |
| `super_admin` | Platform operator — no clinical/permission access by default (spec §6) |
| `clinic_owner` | Full access to everything (`ALL_PERMISSIONS`) |
| `clinic_admin` | Operations, staff, scheduling, reports, settings — no direct clinical documentation permissions |
| `doctor` | Clinical read/write, prescriptions, own queue |
| `nurse` | Pre-assessment, vitals, emergency triage |
| `receptionist` | Registration, appointments, queue, billing (no clinical notes) |
| `patient` | Reserved for the Phase 2 patient portal — no staff permissions |

## Permission → default role grants

| Permission | Owner | Admin | Doctor | Nurse | Receptionist |
| --- | :-: | :-: | :-: | :-: | :-: |
| `patient.create` | ✅ | ✅ | | | ✅ |
| `patient.read.basic` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `patient.read.clinical` | ✅ | | ✅ | ✅ | |
| `patient.update` | ✅ | ✅ | | | ✅ |
| `patient.merge` | ✅ | ✅ | | | |
| `patient.export` | ✅ | ✅ | | | |
| `appointment.create` | ✅ | ✅ | | | ✅ |
| `appointment.read` | ✅ | ✅ | ✅ | | ✅ |
| `appointment.reschedule` | ✅ | ✅ | | | ✅ |
| `appointment.cancel` | ✅ | ✅ | | | ✅ |
| `appointment.override` | ✅ | ✅ | | | |
| `queue.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `queue.manage` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `queue.override` | ✅ | ✅ | | | |
| `vitals.create` | ✅ | | ✅ | ✅ | |
| `vitals.read` | ✅ | | ✅ | ✅ | |
| `assessment.create` | ✅ | | | ✅ | |
| `assessment.read` | ✅ | | ✅ | ✅ | |
| `consultation.create` | ✅ | | ✅ | | |
| `consultation.read` | ✅ | | ✅ | | |
| `consultation.amend` | ✅ | | ✅ | | |
| `prescription.create` | ✅ | | ✅ | | |
| `prescription.sign` | ✅ | | ✅ | | |
| `prescription.read` | ✅ | | ✅ | | |
| `emergency.create` | ✅ | ✅ | | ✅ | ✅ |
| `emergency.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `emergency.triage` | ✅ | | | ✅ | |
| `emergency.assign` | ✅ | | | | |
| `emergency.manage` | ✅ | | ✅ | | |
| `billing.create` | ✅ | ✅ | | | ✅ |
| `billing.read` | ✅ | ✅ | | | ✅ |
| `billing.discount` | ✅ | ✅ | | | |
| `billing.refund` | ✅ | ✅ | | | |
| `document.upload` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `document.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `document.manage` | ✅ | ✅ | | | |
| `staff.manage` | ✅ | ✅ | | | |
| `schedule.manage` | ✅ | ✅ | | | |
| `role.manage` | ✅ | | | | |
| `reports.view` | ✅ | ✅ | | | |
| `settings.manage` | ✅ | ✅ | | | |
| `audit.view` | ✅ | | | | |
| `onboarding.manage` | ✅ | ✅ | | | |
| `notification.read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | ✅ |

## Enforcement

- **Backend (source of truth):** `authorize(...)` middleware
  (`apps/api/src/middleware/authorize.ts`) checks `req.tenant.permissions`, resolved
  server-side from the user's active `Membership` → `Role` — never from client input.
  Some rules are conditional rather than absolute (e.g. appointment double-booking
  override, billing discount) and are checked explicitly inside the relevant
  service, not just at the route.
- **Frontend (UX only):** `usePermission()` (`apps/web/src/hooks/use-permission.ts`)
  hides/disables actions and gates routes via `PermissionGate` — this is navigation
  convenience, not a security boundary (ADR/engineering guide).
- **Cross-tenant access** is a 404, not a 403, to avoid leaking existence of another
  clinic's records (ADR-5).
