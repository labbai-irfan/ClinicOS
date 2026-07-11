# ClinicOS — Emergency Workflow

Implemented in `apps/api/src/modules/emergencies/` (spec §18-20).

## Design constraint

An emergency patient may arrive with **no identity at all** — unconscious, unknown,
no family member present, no phone. Every field except `mainConcern` is optional on
intake (`createEmergencySchema`, `packages/validation/src/emergency.ts`). This is
intentional: registration must never block treatment.

## Case lifecycle

```
awaiting_triage ──► triage_in_progress ──► doctor_alerted ──► doctor_responding
                                                  │
                                                  ▼
                                          under_assessment
                                            │    │    │
                                            ▼    ▼    ▼
                              treatment_in_progress  under_observation  referral_required
                                            │              │                   │
                                            └──────┬───────┴───────┬───────────┘
                                                    ▼               ▼
                                               discharged    transfer_arranging
                                                    │               │
                                                    ▼               ▼
                                          follow_up_required   transferred
                                                    │               │
                                                    └───────┬───────┘
                                                             ▼
                                                          closed
```

Legal transitions are enforced by `canTransitionEmergency()`
(`packages/types/src/state-machines.ts`) — the same "no silent status change"
guarantee as the queue engine.

## Priority is never computed automatically

`EmergencyPriority` (`critical` / `urgent` / `standard` / `unconfirmed`) defaults to
`unconfirmed` on creation and can **only** be set by an authorized clinician via
`POST /emergencies/:id/triage` (`emergency.triage` permission). No code path derives
priority from symptoms, vitals, or any heuristic — this is a direct implementation of
spec §2.4 and §18: AI/automation may assist with documentation, never with clinical
urgency classification.

## Immutable timeline

Every transition, triage, assignment, referral, and observation note appends an
`EmergencyEvent` (`emergency-event.model.ts`) — actor, timestamp, from/to status,
notes. There is no update or delete route for this collection; it is the audit trail
required by spec §19.

## Doctor alerting

Moving a case to `doctor_alerted` emits `SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT` to the
branch room and, if a doctor is already assigned, to that doctor's personal
`user:<id>` room — a distinct, higher-urgency event from ordinary queue
notifications, so the frontend can render it differently (spec §18's "Doctor
Alerted" status needs to actually alert someone).

## Normal queue isolation

The emergency module never imports `QueueEntryModel` (verified in
`emergency.test.ts`). Handling an emergency can slow down how fast the normal queue
moves in practice, but there is no code path that reorders, renumbers, or deletes any
queue entry as a side effect of emergency handling — satisfying spec §20 by
construction rather than by convention.

## Billing

Emergency invoices support `deferred: true` (spec §24 "Emergency deferred billing")
— an invoice can be created and the case can proceed through treatment before
payment is collected, via the shared billing module (`modules/billing/`), linked by
`emergencyCaseId` rather than `queueEntryId`.
