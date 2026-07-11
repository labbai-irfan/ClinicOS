# ClinicOS — Database Design

MongoDB via Mongoose. Every tenant-owned collection uses the shared `tenantBase`
schema plugin (`apps/api/src/database/plugins.ts`): `organizationId`, `clinicId`,
`branchId?`, `deletedAt` (soft delete), `createdAt`/`updatedAt`. No tenant-owned
document is ever hard-deleted (spec §35).

## Collections

| Collection | Owning module | Notes |
| --- | --- | --- |
| `organizations` | organizations | one per clinic-owner signup |
| `clinics` | clinics | onboarding progress, prescription branding |
| `branches` | branches | working hours, address |
| `users` | users | credentials, lockout state |
| `sessions` | auth | hashed refresh tokens, rotation family id |
| `roles` | roles | permission arrays, system + custom |
| `memberships` | memberships | user ↔ clinic ↔ role ↔ branches |
| `staffProfiles` | staff | doctor/nurse/receptionist profile fields |
| `doctorSchedules` / `doctorLeaves` | schedules | weekly sessions, capacity, leave ranges |
| `patients` | patients | clinic-scoped identity (not branch-scoped — a patient may visit any branch) |
| `appointments` | appointments | date + time-window based |
| `queueEntries` | queues | daily, branch-scoped, token + status |
| `queueEvents` | queues | append-only transition history |
| `nurseAssessments` | nurse-assessments | draft/complete, one per queue entry |
| `vitalRecords` | vitals | linked to patient + optionally queue entry / emergency case |
| `consultations` | consultations | draft → completed → amended |
| `consultationAmendments` | consultations | append-only |
| `prescriptions` | prescriptions | versioned, immutable once finalized |
| `emergencyCases` | emergencies | independent of queueEntries by design |
| `emergencyEvents` | emergencies | append-only timeline |
| `invoices` / `payments` | billing | money as integer paise throughout |
| `documents` | documents | Cloudinary metadata only, never a public URL |
| `notifications` | notifications | per-user, not per-clinic |
| `auditLogs` | audit-logs | append-only, no update/delete route exists |
| `clinicSettings` / `tokenSettings` | settings | one clinicSettings doc per clinic, one tokenSettings doc per branch |
| `sequenceCounters` | shared/sequence.ts | atomic counters for tokens, patient codes, invoice/receipt numbers, case codes |

## Indexing strategy

Compound indexes follow the access pattern, not the entity:

- `queueEntries`: `{clinicId, branchId, date, status}` — the live board query.
- `appointments`: `{clinicId, branchId, doctorId, date}` — calendar + capacity checks.
- `auditLogs`: `{clinicId, createdAt: -1}` and `{clinicId, resource, resourceId, createdAt: -1}`.
- `patients`: text-search-friendly indexes on `fullName` and `mobile` for the
  duplicate-detection and directory search flows (spec §12).
- `sessions`: TTL index on `expiresAt` — expired sessions self-clean.
- Uniqueness: `users.email`, `clinics.slug`, `memberships.{userId,clinicId}`,
  `roles.{clinicId,key}`, `sequenceCounters.key`.

## Why no unbounded embedded arrays

Per spec §39, histories that can grow indefinitely are **separate event
collections**, not arrays embedded in the parent document:
`queueEvents`, `emergencyEvents`, `consultationAmendments`, `auditLogs`,
`prescriptions` (versions as separate documents linked by `consultationId`, not an
array on one document). This keeps document size bounded and avoids the 16MB
document limit ever becoming a real concern, and lets each event carry its own
timestamp/actor cleanly for querying.

## Money

Every amount field is an integer count of paise (`amountPaise`, `totalPaise`, etc.)
— never a float, never rupees. Formatting to a display string happens only at the
edge (`formatMoney()` in `@clinicos/config`), so no rounding error can accumulate in
stored data.

## Dates

Stored as UTC `Date`. "Today", working-hour windows, and appointment slots are all
computed relative to `clinic.timezone` (IANA string) via
`apps/api/src/shared/dates.ts`, converted at the boundary — the database itself never
stores a timezone-relative string except the deliberately-local `date` field on
`queueEntries`/`appointments` (used purely as a fast filter key for "today's board",
not as the source of truth for any instant in time).
