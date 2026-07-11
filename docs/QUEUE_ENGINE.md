# ClinicOS — Queue Engine

The live token/queue system (spec §14-17) — implemented in
`apps/api/src/modules/queues/` and `packages/types/src/state-machines.ts`.

## Token generation

Tokens are generated atomically via `nextSequence()`
(`apps/api/src/shared/sequence.ts`), which does a single
`findOneAndUpdate({key}, {$inc:{value:1}}, {upsert:true})` — this is the only place
a token number is produced, so concurrent check-ins can never collide or skip a
number. The sequence key combines the branch id and the local calendar date (in the
clinic's timezone), so numbering resets naturally per branch per day. The number is
formatted with `formatToken()` (`packages/config`) — e.g. `A-007`.

## Status state machine

`QUEUE_STATUSES` and `QUEUE_TRANSITIONS` (`packages/types/src/state-machines.ts`)
define every legal transition; `canTransitionQueue(from, to)` is the single gate the
`queue.service.ts` checks before any status change. Illegal transitions are rejected
with `InvalidTransitionError` (409) — there is no code path that sets `status`
directly without going through this check.

```
scheduled ──► arrival_pending ──► checked_in ──► waiting_for_nurse
                                                        │
                                                        ▼
                                              nurse_assessment
                                                        │
                                                        ▼
                                              ready_for_doctor ──► waiting_for_doctor
                                                                          │
                                                                          ▼
                                                                 in_consultation
                                                                          │
                                                                          ▼
                                                          consultation_completed
                                                                          │
                                                                          ▼
                                                                billing_pending ──► completed
```

Side branches from most active states: `temporarily_away` / `skipped` → `rejoined`
→ back into an active state; `no_show`, `cancelled` (terminal).

## Manual actions always audited

Per spec §14/§16, skip, rejoin, reorder, transfer-doctor, and any priority change
**require a `reason`** and always write both a `QueueEvent` (immutable history,
`queue-event.model.ts`) and an `AuditLog` entry — there is no silent queue
manipulation path.

## Rejoin policies

Configurable per clinic (`RejoinPolicy`): `after_next_patient`, `after_two_patients`,
`end_of_priority_group`, or `manual` (requires `queue.override`). The original queue
history is never deleted — a "rejoined" entry keeps its prior `QueueEvent` trail.

## Waiting-time estimation (ADR-8)

Presented as a **range**, never an exact time:

```
activePatientsAhead = count of active-status entries for the same doctor
                       positioned ahead of this entry
avgMinutes          = doctor's rolling average of the last 10 completed
                       consultation durations (fallback: DEFAULTS.AVG_CONSULTATION_MINUTES)
base                = activePatientsAhead × avgMinutes
                      (minus the elapsed portion of any consultation currently in progress)
spread              = base × DEFAULTS.WAIT_ESTIMATE_SPREAD_RATIO
estimate            = [max(0, base − spread), base + spread]
```

## Optimistic concurrency

Each `QueueEntry` carries a `version` counter. A transition request may include
`expectedVersion`; a mismatch (someone else moved this entry first) returns
`409 CONFLICT` rather than silently clobbering the other change — this is the
concrete implementation of spec §35's "queue transition must be safe from duplicate
requests."

## Realtime

Every transition emits `SOCKET_EVENTS.QUEUE_UPDATED` + `QUEUE_ENTRY_CHANGED` to the
`branch:<id>` room (full staff-facing payload, including patient name) **and** a
separate, privacy-safe `DisplayState` update to `branch:<id>:display` — the display
payload is a distinct, deliberately minimal shape
(`packages/types/src/realtime.ts#DisplayState`) that structurally cannot carry a
patient name, so there's no risk of an accidental leak to the public waiting-room
screen.

## Emergencies never touch this collection

The emergency module (`modules/emergencies/`) never imports `QueueEntryModel` — an
emergency case is a fully separate collection and state machine. This is what
guarantees spec §20's requirement that normal queue order and history survive an
emergency untouched; only the *estimate* may reasonably lengthen if staff are pulled
away, which callers see reflected passively (fewer consultations completing per
hour), not through any code path that reaches into the queue and reorders it.
