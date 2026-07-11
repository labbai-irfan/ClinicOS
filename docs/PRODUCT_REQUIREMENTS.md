# ClinicOS — Product Requirements (condensed)

Full source: the original master specification supplied for this build. This file
is the working condensation used to drive implementation — when in doubt, the
original spec's intent governs; this summarizes it for quick reference.

## Vision

A clinic operating system, not an appointment website. Local clinics run entirely
through reception/nurse/doctor workspaces; the patient-facing app is an *additional*
channel, never a requirement for receiving care (no smartphone, no internet, no
digital literacy, walk-in, phone booking, and unidentified-emergency patients must
all be fully served).

## Phase 1 scope (this build)

The complete patient journey, staff-operated end to end:

registration/quick-registration → appointment or walk-in → check-in → token/queue →
nurse pre-assessment + vitals → doctor consultation → digital prescription → billing
→ patient medical timeline — **plus** a fully parallel emergency workflow (unknown
identity supported, staff-confirmed priority only, immutable timeline) that never
disrupts the normal queue.

Supporting systems: multi-tenant RBAC, real-time queue/waiting-room display, audit
logging on every sensitive action, dashboard + analytics from real data only,
document management (Cloudinary, private delivery), notifications.

## Explicitly out of Phase 1 (prepared for, not built)

- **Phase 2**: patient portal, OTP auth, online booking, SMS/WhatsApp, family
  accounts, advanced analytics/forecasting. Provider-abstraction and patient-identity
  groundwork exists now so Phase 2 doesn't require re-architecture.
- **Phase 3**: pharmacy/lab/hospital integration, teleconsultation, multi-clinic
  organizations, AI-assisted documentation/translation/forecasting (always
  assistive/reviewable, never autonomous).

## Non-negotiable product rules

These constrain every feature decision and are enforced structurally, not just by
convention (see `docs/DECISIONS.md` and `docs/SECURITY.md` for how):

1. Clinical urgency (emergency priority) is **always** staff-assigned, never
   computed.
2. AI/automation may assist documentation and never diagnoses, prescribes, or
   classifies emergencies.
3. Public waiting-room displays show tokens only — never names, phone numbers, or
   any clinical detail.
4. Consultation windows are ranges ("25–35 min", "6:00–6:20 PM"), never promised
   exact times.
5. Finalized clinical records (consultations, prescriptions) are immutable; changes
   are amendments with full audit history, never silent overwrites.
6. Every sensitive action (permission change, billing discount/refund, emergency
   priority, queue skip/rejoin/override, record amendment) requires a reason and is
   audited.
7. Tenant context is always server-resolved from the authenticated session, never
   trusted from client input.
8. Money is always an integer (paise); dashboards and analytics use only real,
   computed data — no fabricated metrics.

## Design language

Calm, trustworthy, modern healthcare SaaS — deep medical blue + calm teal, accessible
semantic status colors, Tailwind design tokens, WCAG 2.2 AA, fully responsive
320px→1920px, optimized for low-digital-literacy and time-pressured staff (large
touch targets, minimal clicks for common actions, progressive disclosure).

## Acceptance

See spec §47 for the full acceptance checklist and `docs/IMPLEMENTATION_PLAN.md` for
how it's broken into milestones; `docs/PROGRESS.md` tracks live status against it.
