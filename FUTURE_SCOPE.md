# ClinicOS — Future Scope & Vision

_Companion to `PENDING_FEATURES.md` (which tracks current gaps). This file is the long-horizon
product vision: features that make ClinicOS the operating system for every local clinic._

Priority: ⭐⭐⭐ high-demand differentiator · ⭐⭐ strong value · ⭐ nice-to-have

---

## 1. 🖋️ Template-Based Prescription System (per clinic, per doctor) ⭐⭐⭐

The flagship future feature. Today the prescription builder is free-form; the future system
makes prescriptions template-driven at three levels:

### 1.1 Template levels
| Level | Owner | Example |
|-------|-------|---------|
| **Clinic templates** | Admin/owner | Standard layout, header/footer, logo, watermark, footer disclaimers, Rx symbol style |
| **Doctor templates** | Each doctor | "Viral fever kit", "Hypertension monthly", "Pediatric URI" — pre-filled diagnosis + medicine set + advice |
| **Condition templates** | System + clinic library | Curated starting points per common diagnosis, copy-and-customize |

### 1.2 Template contents
- Pre-filled **medicine sets** (drug, strength, dose, frequency shorthand `1-0-1`, duration, food relation, route)
- Default **advice lines** (rest, hydration, diet) with per-language variants
- Default **investigations** to order (CBC, LFT…)
- Default **follow-up interval** (auto-suggests booking follow-up in N days)
- **Variables**: `{{patient.name}}`, `{{patient.age}}`, `{{vitals.bp}}`, `{{date}}` auto-filled at apply time
- Conditional blocks (pediatric dose section only when age < 12)

### 1.3 Layout designer (per clinic)
- Drag-and-drop print layout: logo position, clinic header, doctor block (name, qualification,
  reg no.), Rx body, footer (timings, emergency number), signature area
- Paper presets: A4, A5, half-letter, thermal
- Multiple layouts per clinic (branch letterheads), default per branch
- Language of printout: English / Hindi / regional (advice lines translated per template)
- Preview with live sample data before saving
- Versioned layouts — old prescriptions always re-print with the layout used at signing time

### 1.4 Prescription-writing UX upgrades
- Type-ahead from clinic **drug catalog** (see §3) with last-used dose memory per doctor
- "Apply template" → merge into current rx, then tweak
- One-click "Repeat last prescription" for chronic patients (with date/duration refresh)
- Favourite medicines pinned per doctor
- Dose auto-calc by weight (pediatric mg/kg rules on catalog items)
- Interaction/allergy warning banner (checks patient allergies + catalog interaction pairs)

### 1.5 Data model sketch
```
PrescriptionTemplate {
  organizationId, clinicId, doctorId?,        // doctorId null = clinic-wide
  name, tags[], language,
  diagnosisDefaults[], items[{drugRef|freeText, dose, frequency, duration, instructions}],
  adviceLines[], investigations[], followUpDays?,
  isActive, usageCount, createdBy, version
}
PrintLayout {
  clinicId, branchId?, name, paperSize, margins,
  blocks[{type: header|doctor|patient|rx|advice|footer|signature, position, style, content}],
  isDefault, version
}
```

---

## 2. 🤖 AI-Assisted Clinical Suite ⭐⭐⭐

- **AI scribe**: doctor speaks during consult → structured note (complaint, findings, diagnosis,
  plan) — review-and-sign, never auto-final
- **Prescription suggestion**: given diagnosis + age/weight/allergies, suggest from the doctor's
  own historical prescriptions ("you usually prescribe X for this")
- **Auto-coding**: free-text diagnosis → ICD-10 suggestion
- **Referral-letter drafting**: one click from consultation context
- **Smart patient summary**: 30-second pre-consult brief ("3rd visit for headache this year;
  BP trending up; allergic to penicillin")
- **Report reader**: uploaded lab PDF → extracted values into structured vitals/results
- **Chat with the record** (staff-side, permission-scoped): "when did we last change his BP meds?"
- Guardrails: every AI output is draft-only, logged in audit trail, clearly labeled

## 3. 💊 Drug Catalog & Formulary ⭐⭐⭐

- Clinic-level medicine master (brand, generic, strength, form, default dose patterns)
- Import from standard Indian drug databases; sync updates
- Generic-substitution hints, price display at prescription time
- Per-doctor usage stats feed the AI suggestions (§2)
- Foundation for inventory dispensing (§7) and interaction checks (§1.4)

## 4. 🧪 Diagnostics & Lab Ecosystem ⭐⭐

- In-house lab: test catalog, sample collection worklist, result entry with reference ranges,
  abnormal flagging, cumulative result trends per patient
- External lab integration: order → webhook results (Thyrocare/Dr Lal-style APIs)
- Imaging orders with attached reports (reuse documents)
- Panels/profiles with one-click ordering from templates (§1.2 investigations)
- Patient portal: results visible after doctor releases them

## 5. 📅 Advanced Scheduling ⭐⭐

- Waitlist with auto-offer on cancellation (SMS "a 5pm slot opened, reply YES")
- Recurring appointment series (physio, dressing, dialysis)
- Resource scheduling beyond doctors: rooms, machines (X-ray, dental chair)
- Group sessions (vaccination camps, antenatal classes)
- Smart overbooking based on the clinic's historical no-show rate
- Multi-branch doctor itineraries (Dr sits at Branch A Mon/Wed, Branch B Tue/Thu — single view)

## 6. 💰 Revenue Suite ⭐⭐⭐

- **Online payments** (UPI/cards) at booking + on outstanding invoices; auto-reconciled
- **Advance/deposit collection** at booking with auto-adjust on final invoice
- **Memberships/health plans**: annual plan → discounted consults, plan usage tracking
- **Packages**: N-session bundles with per-visit redemption
- **Insurance/TPA workflow**: eligibility note, claim tracking, document bundle export
- **EMI/partial-payment plans** for larger treatments
- Doctor revenue-share statements with configurable rules
- Accounting export (Tally/Zoho Books CSV)

## 7. 🏪 Pharmacy & Inventory ⭐⭐

- Stock with batch + expiry; FEFO dispensing against prescriptions
- Purchase orders + supplier ledger; GST-ready purchase records
- Barcode scanning (receive + dispense)
- Auto low-stock/expiry alerts → notification system
- Retail counter mode (walk-in OTC sale without prescription, still invoiced)

## 8. 📣 Patient Engagement Platform ⭐⭐⭐

- Segmented broadcast campaigns (all diabetics due for HbA1c) with opt-out compliance
- **Two-way WhatsApp**: confirm/cancel/reschedule by replying; questions land in a staff inbox
- Automated care journeys: post-op day-1/3/7 check-in messages; chronic-care monthly nudges
- Recall system: "patients not seen in 6 months" worklist + gentle reminder
- Google Review nudge after positive feedback rating
- Referral rewards tracking (patient-refers-patient)
- Birthday/festival greetings with clinic branding

## 9. 🩺 Telemedicine ⭐⭐

- Video visit type end-to-end: pay → join link → consult → e-prescription delivered in portal
- Doctor console with the same 3-region layout + camera pane
- Async consults ("send a photo of the rash + questions") at lower price point
- E-prescription compliance (signature, telemedicine guidelines disclaimers)

## 10. 👨‍👩‍👧 Family & Care Networks ⭐⭐

- Family accounts: one login manages spouse/children/parents records + bookings
- Caregiver access grants (adult child manages elderly parent, with patient consent flag)
- Shared family billing wallet

## 11. 🏥 Multi-Clinic / Chain Operations ⭐⭐

- Org console: clinics list, consolidated KPIs, roll-up reports
- Central patient index across the chain (visit any branch/clinic, one record) with consent
- Central drug catalog + template library pushed to all clinics (§1 + §3 at org level)
- Franchise mode: standard templates locked, local overrides where permitted
- Cross-clinic doctor credentials + schedules

## 12. 🧾 Compliance & Records ⭐⭐

- **ABDM/ABHA integration** (India digital health mission): ABHA-linked patient IDs, share
  care-context, FHIR-shaped record export
- Consent artefact management (what was consented, when, evidence)
- Data-retention policies with automated archival
- Legal-hold + export bundle for medico-legal requests
- e-Sign for consent forms on a tablet at reception

## 13. 📊 Intelligence & Forecasting ⭐

- Demand forecasting: expected footfall per day/hour → staffing hints
- No-show prediction per appointment with suggested overbooking
- Revenue forecasting + seasonality view
- Epidemiology pulse: symptom trends across the clinic's own patients ("fever cases doubled this week")
- Benchmarking vs anonymized peer clinics (opt-in)

## 14. 🖥️ Platform & Developer ⭐

- Public REST API + API keys per clinic; webhooks (appointment.created, invoice.paid…)
- Zapier/Make connectors
- Plugin/marketplace architecture for third-party modules (labs, payments, accounting)
- White-label deployments for hospital chains
- Offline-first mode with sync for unreliable connectivity (critical for tier-2/3 towns)
- Native mobile apps (staff + patient) once PWA ceiling is hit

## 15. 🌐 Localization ⭐⭐

- Full UI i18n: Hindi + major regional languages (staff app + patient portal)
- Prescriptions/advice printed in patient's preferred language (ties into §1.3)
- Voice input in regional languages for the AI scribe (§2)
- Regional date/number formats, festival-aware holiday presets (§ST4)

## 16. 🔬 Pathology & Medical-Store Partner Network ⭐⭐⭐

Turn ClinicOS from a clinic tool into a **local healthcare network**: pathology labs and
medical stores (pharmacies) get their own partner apps/dashboards and connect with nearby
clinics and the public.

### 16.1 New partner account types
| Partner | App | Who uses it |
|---------|-----|-------------|
| **Pathology lab** | `apps/partner-lab` (or partner portal) | Lab owner, technicians, sample collectors |
| **Medical store / pharmacy** | `apps/partner-pharmacy` | Store owner, counter staff, delivery boys |

Both are first-class tenants like clinics: own onboarding, staff, roles, branding.

### 16.2 Pathology lab dashboard
- **Orders inbox**: test orders flowing in from connected clinics in real time (doctor orders
  CBC → appears on the lab's board instantly)
- Order lifecycle board: received → sample collected → processing → **result uploaded** →
  delivered (mirrors the queue-kanban pattern already built)
- Home sample-collection worklist with patient address + phone + assigned collector + route view
- Result entry with reference ranges / PDF upload → result flows back automatically into the
  ordering clinic's patient record AND the patient's portal
- Test catalog + price list management (visible to connected clinics at ordering time)
- Revenue dashboard: orders/day, revenue by clinic source, TAT (turnaround time) metrics
- Settlement view: commission/referral reconciliation with each connected clinic
- Ratings from clinics/patients

### 16.3 Medical store / pharmacy dashboard
- **Prescription inbox**: patient (or clinic) forwards an e-prescription → store sees structured
  medicine list, confirms availability + price → patient picks up or gets delivery
- Fulfilment board: new → confirmed → ready/out-for-delivery → completed
- Inventory sync so availability answers are real (pairs with §7)
- Substitution requests routed BACK to the prescribing doctor for approval (never silent generic
  swap) — full audit trail
- Revenue + top-medicines analytics; expiry-risk view
- Settlement view with clinics/network

### 16.4 Nearby-public discovery (the network effect)
- **Patient portal & public site**: "Labs near me" / "Pharmacies near me" — geolocation search of
  onboarded partners with services, prices, ratings, home-collection/delivery badges
- Patient self-orders a test (walk-in or home collection) even WITHOUT a clinic visit; results
  land in their ClinicOS health record
- Patient sends any prescription (ClinicOS ones auto-structured) to a nearby pharmacy for
  fulfilment/delivery quotes
- Public clinic mini-sites (P8) extended: each clinic shows its trusted partner labs/pharmacies
- Partners get a public profile page with map pin, timings, services, reviews

### 16.5 Clinic-side integration surface
- Doctor consultation screen: "Order test" → pick connected lab (price/TAT shown inline)
- Prescription finalize: "Send to pharmacy" option with patient's preferred/nearest store
- Clinic admin page: manage partner connections (invite lab/store, accept requests, set
  preferred partners, commission terms)
- Results auto-file into patient timeline (§B1) + abnormal-value notification to the doctor

### 16.6 Trust, consent & data rules
- Patient consent required per share (order → lab, prescription → pharmacy) — consent artefacts
  logged (§12)
- Partners see ONLY the order/prescription payload, never the full medical record
- Data-sharing agreements at partner onboarding; every cross-tenant access audit-logged
- Verified-partner badge (license upload + review) before appearing in public discovery

### 16.7 Monetization angles
- Per-transaction network fee on fulfilled orders
- Partner SaaS subscription (dashboard + inbox)
- Featured placement in nearby-public discovery
- Settlement/reconciliation as a premium feature

### 16.8 Data model sketch
```
Partner { type: 'lab'|'pharmacy', name, geo, services[], licenseDocs[], verified, isActive }
PartnerConnection { clinicId, partnerId, status: invited|active|paused, commissionTerms }
LabOrder { clinicId?, patientId, partnerId, tests[], status, sampleMode: walkin|home,
           resultDocs[], resultValues[], consentRef, timeline[] }
RxFulfilment { prescriptionId, patientId, partnerId, items[], substitutions[],
               status, deliveryMode, quote, consentRef, timeline[] }
```
Reuses existing building blocks: tenancy plugin, kanban board pattern, Socket.IO realtime,
documents (Cloudinary), notifications, audit logs, BullMQ jobs.

---

## Suggested future-scope sequencing

| Wave | Features | Rationale |
|------|----------|-----------|
| **Wave 1** | §1 Prescription templates + §3 drug catalog | Daily-use doctor delight; foundation for AI + inventory |
| **Wave 2** | §6 online payments/advances + §8 two-way WhatsApp | Direct revenue + engagement lift on existing Twilio infra |
| **Wave 3** | §5 waitlist/recurring + §4 in-house lab | Operational completeness |
| **Wave 4** | §2 AI scribe/suggestions | Needs §1+§3 data to be great |
| **Wave 5** | §9 telemedicine + §10 family accounts | Portal maturity |
| **Wave 6** | §16 partner network (lab dashboard first, then pharmacy, then public discovery) | The moat — network effects make ClinicOS the local healthcare hub |
| **Wave 7** | §11 multi-clinic + §12 ABDM + §14 API | Scale & platform |
| **Continuous** | §15 localization, §13 analytics | Alongside each wave |
