# ClinicOS — Business Plan & Pitch Deck

_Companion docs: `GO_TO_MARKET.md` (client acquisition playbook) · `RISKS_AND_OBSTACLES.md`
(every issue we face) · `../FUTURE_SCOPE.md` (product vision) · `../PENDING_FEATURES.md` (build gaps)._

---

# PART 1 — THE PITCH DECK (slide by slide)

## Slide 1 — Title
**ClinicOS** — The Operating System for Local Clinics.
_One login for the queue, the records, the prescriptions, the billing, and the patient._

## Slide 2 — The Problem
- India has **~350,000+ small clinics** (1–5 doctors); the vast majority still run on
  paper registers, WhatsApp, and memory.
- Patients wait 1–3 hours with **no idea when their turn comes**.
- Records are lost between visits; prescriptions are illegible slips.
- Owners have **zero visibility**: daily revenue counted by hand, no-shows unmeasured.
- Existing software is either hospital-grade (too heavy, too costly) or a booking-only app
  (solves 10% of the day).

## Slide 3 — The Solution
A single, affordable web platform that runs the clinic's **entire day**:
- Live token queue (kanban) + public waiting-room display
- Nurse vitals → doctor consultation → **printed e-prescription** in one flow
- Billing with receipts, refunds, daily closing
- Automatic SMS/WhatsApp appointment reminders
- A patient portal: self-booking, prescriptions, records
_All of this is BUILT and working today — not a mockup._

## Slide 4 — Product Status (traction of the build)
- 27 backend modules · 206 automated tests passing · 38 end-to-end tests
- Staff app (24 pages), patient portal (8 pages), background worker (Twilio SMS/WhatsApp)
- Multi-tenant, role-based (40+ permissions), audit-logged, real-time (websockets)
- Deployable today on commodity cloud (Vercel + Railway + Atlas)

## Slide 5 — Market Size
- TAM: ~350k private clinics + ~90k labs/pharmacies adjacent (India)
- SAM: ~120k digitizable urban/semi-urban clinics with smartphone-first staff
- SOM (3 yr): 5,000 clinics ≈ ₹18–30 Cr ARR at ₹3–5k/month blended
- Expansion multiplier: partner network (labs/pharmacies) + patient-side services

## Slide 6 — Business Model
| Stream | What | When |
|---|---|---|
| Core SaaS | ₹1,999–₹4,999/mo per clinic (tiered by doctors/branches) | Now |
| Messaging margin | SMS/WhatsApp bundles above free tier | Now |
| Partner SaaS | Lab/pharmacy dashboards ₹999–1,999/mo | Wave 6 |
| Network fees | % on lab orders / rx fulfilment routed through platform | Wave 6 |
| Payments | MDR share on online collections | Wave 2 |
| Premium AI | Scribe/suggestions add-on per doctor | Wave 4 |

## Slide 7 — Why Now
- UPI + WhatsApp made every clinic owner digitally fluent.
- ABDM (Ayushman Bharat Digital Mission) is pushing digitization with government tailwind.
- COVID normalized patient expectations: online booking, digital records.
- Cloud costs make ₹2k/month price points profitable.

## Slide 8 — Competition & Moat
| Competitor type | Weakness we exploit |
|---|---|
| Practo/booking apps | Own the patient, not the clinic's operations; clinics resent lead fees |
| Hospital HIS (KareXpert etc.) | Overkill, ₹lakhs, months to deploy |
| Local desktop billing software | No queue, no patient app, no reminders, dies with the PC |
| Paper | Our real competitor — we must be easier than a register |
**Moat**: (1) full-day workflow depth, (2) the partner network (§16 future scope) creating
local network effects, (3) per-clinic prescription templates = high switching cost.

## Slide 9 — Go-to-Market (summary; full playbook in GO_TO_MARKET.md)
- Beachhead: one city cluster at a time, door-to-door + doctor referrals
- Land with the **queue + reminders** (visible pain), expand to billing/records
- Free-forever single-doctor tier → paid on 2nd doctor/branch/features
- Partner channel: distributors of medical consumables already visit every clinic weekly

## Slide 10 — Expansion Roadmap
1. **City density** → 2. **Adjacent partners** (labs/pharmacies per Future Scope §16) →
3. **Patient network** (nearby discovery) → 4. **Chains/franchises** → 5. **ABDM rails &
API platform** → 6. Tier-2/3 + regional languages → 7. SEA/MEA markets with similar
clinic structure.

## Slide 11 — Team & Ask
_(fill in: founders, advisors)_
Ask: seed for 18 months — 2 sales pods in 2 cities, 2 engineers, compliance/legal setup,
target 300 paying clinics.

## Slide 12 — The Vision
Every neighbourhood clinic runs on ClinicOS; every patient's local health history lives in
one place; labs and pharmacies plug into the same rail. **The healthcare OS for the last mile.**

---

# PART 2 — BUSINESS SCOPE IN DEPTH

## 2.1 Customer segments
| Segment | Size signal | Priority |
|---|---|---|
| Solo GP clinic | 1 doctor, 1 receptionist | P0 — beachhead |
| Multi-doctor polyclinic | 2–5 doctors, nurse, 2 shifts | P0 — best LTV |
| Specialty clinics (derma, dental, pedia, ortho) | template-heavy, high billing | P1 |
| Small chains (2–5 branches) | needs multi-branch (already built) | P1 |
| Labs & pharmacies | partner network | P2 (Wave 6) |

## 2.2 Pricing (proposed)
| Tier | ₹/month | Includes |
|---|---|---|
| Free | 0 | 1 doctor, 1 branch, 50 patients/mo, queue+records, ClinicOS branding on prints |
| Clinic | 1,999 | 2 doctors, unlimited patients, reminders 500/mo, billing, portal |
| Clinic Pro | 3,499 | 5 doctors, multi-branch, templates, reports, 2,000 msgs |
| Chain | 4,999+/branch | org console, central catalog, priority support |
Annual = 2 months free. Messaging overage at cost+margin.

## 2.3 Unit economics (assumptions to validate)
- CAC (field sales, dense cluster): ₹6–10k/clinic → payback < 4 months at Clinic tier
- Gross margin: >80% (infra ~₹80–150/clinic/mo at current stack)
- Churn target: <2%/mo after month 3 (records lock-in + templates raise switching cost)
- NRR levers: msg packs, added doctors, portal upsell, partner fees

## 2.4 Key metrics to run the business
Activation (first real patient billed within 7 days) · Weekly active staff users ·
Tokens/day per clinic · Reminder delivery rate · MRR, NRR, logo churn · CAC by channel ·
Support tickets per 100 clinics.

## 2.5 Legal & compliance scope (must-do, see RISKS doc)
DPDP Act 2023 compliance program · Privacy/Terms/Consent (PENDING_FEATURES L1–L7) ·
Telemedicine guidelines (when Wave 5) · Drug-schedule rules for pharmacy features ·
GST invoicing · Data-localization posture · Cyber-insurance.

## 2.6 Organization plan (first 18 months)
- Founders: product + sales
- 2 field sales + 1 onboarding/support (per city pod)
- 2 engineers (one product, one platform/reliability)
- Part-time: legal/compliance, accountant, designer
- Advisors: 1 practicing GP, 1 healthcare-compliance lawyer

## 2.7 Milestone plan
| Quarter | Milestone |
|---|---|
| Q1 | Sprint-1 gaps closed (legal pages, password fixes), 10 design-partner clinics free, daily usage proven |
| Q2 | Pricing live, 50 paying, onboarding < 1 day, referral program |
| Q3 | 150 paying, city #2, prescription templates (Wave 1) shipped |
| Q4 | 300 paying, payments live (Wave 2), seed metrics ready |
| Y2 | 1,000 clinics, partner network pilot (lab dashboard), ABDM sandbox |

---

# PART 3 — WHAT WE STILL LACK (business-side gap list)

| Gap | Severity | Action |
|---|---|---|
| No legal pages/consent in product | 🔴 blocker to sell | Build PENDING_FEATURES Sprint 1 |
| No pricing/packaging decision validated | 🔴 | 20 problem interviews + 10 design partners |
| No landing page/demo video | 🔴 | P1 pages + 3-min WhatsApp-shareable demo video |
| No onboarding playbook (who migrates old patients?) | 🟠 | Bulk import tool (PT4) + white-glove first 50 |
| No support channel (phone/WhatsApp) & SLA | 🟠 | Dedicated WhatsApp Business + ticketing lite |
| No case study/testimonial | 🟠 | Instrument 3 lighthouse clinics, publish numbers |
| No partner/reseller agreement template | 🟡 | Legal draft before channel push |
| Brand/trademark not filed | 🟡 | File early |
| No backup/DR runbook shown to buyers | 🟡 | Write + test restore quarterly (see RISKS) |
| Founder bandwidth: sales vs build | 🟠 | Timebox: build mornings, field afternoons in pilot phase |
