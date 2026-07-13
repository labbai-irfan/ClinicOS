# ClinicOS — Complete Pending Pages & Features Roadmap

_Last audited: 2026-07-13 — verified directly against the codebase (routers, services, models), not just docs._

Legend: 🔴 gap confirmed in code · 🟠 page missing entirely · 🟡 planned/deferred · 🟢 enhancement idea
Effort: ⚡ hours · 🔨 1–2 days · 🏗️ multi-day/module

---

# PART 1 — COMPLETE PAGE INVENTORY (basic → advanced)

Every page the product needs, whether built or not. ✅ = exists today.

## 1. Public / Marketing pages (none exist today — app root redirects straight to /login)

| # | Page | Route | Status | Effort | Notes |
|---|------|-------|--------|--------|-------|
| P1 | **Landing / Home page** | `/` (public site) | 🟠 Missing | 🔨 | What ClinicOS is, features, screenshots, pricing teaser, "Register your clinic" + "Patient login" CTAs. Currently `/` just redirects to dashboard/login |
| P2 | **Features page** | `/features` | 🟠 Missing | ⚡ | Queue, EMR, billing, reminders — one section each |
| P3 | **Pricing page** | `/pricing` | 🟠 Missing | ⚡ | Plans/tiers (pairs with SaaS billing, Phase H) |
| P4 | **About Us** | `/about` | 🟠 Missing | ⚡ | Story, mission, team |
| P5 | **Contact Us** | `/contact` | 🟠 Missing | ⚡ | Form (name/email/message) → email or ticket + address/phone/map |
| P6 | **Book a Demo** | `/demo` | 🟠 Missing | ⚡ | Lead capture form for clinic owners |
| P7 | **Blog / Updates** | `/blog` | 🟢 Later | 🏗️ | SEO + product announcements |
| P8 | **Clinic public profile page** | `/c/:clinicSlug` | 🟢 Later | 🔨 | Public mini-site per clinic (address, hours, doctors, "Book appointment" deep-link) — clinic model already has `slug`! |

## 2. Legal / Policy pages (REQUIRED for healthcare data — none exist)

| # | Page | Route | Status | Effort | Notes |
|---|------|-------|--------|--------|-------|
| L1 | **Privacy Policy** | `/privacy` | 🟠 Missing | ⚡ | MANDATORY — you store patient medical data. Must cover what's collected, retention, sharing, patient rights |
| L2 | **Terms of Service** | `/terms` | 🟠 Missing | ⚡ | Clinic-facing terms + patient-facing terms |
| L3 | **Data Processing / HIPAA-style notice** | `/data-protection` | 🟠 Missing | ⚡ | India: DPDP Act 2023 compliance statement; consent language |
| L4 | **Cookie Policy** | `/cookies` | 🟠 Missing | ⚡ | Auth cookies are used (httpOnly refresh token) |
| L5 | **Refund / Cancellation Policy** | `/refund-policy` | 🟠 Missing | ⚡ | Required by Indian payment gateways (Razorpay etc.) before G1 online payments can go live |
| L6 | **Consent checkboxes wired to legal pages** | register forms | 🔴 Gap | ⚡ | Both register pages should link "I agree to Terms & Privacy" — currently no consent capture at signup |
| L7 | **Patient data-deletion request page** | `/account/delete` | 🟡 | 🔨 | DPDP right-to-erasure: request + grace period + audit trail |

## 3. Help / Support pages (none exist)

| # | Page | Route | Status | Effort | Notes |
|---|------|-------|--------|--------|-------|
| S1 | **Help Center / FAQ** | `/help` | 🟠 Missing | 🔨 | Searchable FAQ: staff topics (queue, billing) + patient topics (booking, prescriptions) |
| S2 | **Contact Support** | `/support` | 🟠 Missing | ⚡ | In-app form → email/ticket; include clinic id + user id automatically |
| S3 | **Support ticket list** | `/support/tickets` | 🟢 Later | 🏗️ | Track submitted issues + status (needs small backend module) |
| S4 | **Onboarding guide / tour** | in-app | 🟢 Later | 🔨 | First-login walkthrough of dashboard/queue |
| S5 | **Keyboard-shortcuts / quick-help modal** | `?` key | 🟢 Later | ⚡ | Power-user reference |
| S6 | **System status page** | `/status` (external) | 🟢 Later | ⚡ | Uptime/status of API, reminders, portal |
| S7 | **Changelog / What's new** | `/whats-new` | 🟢 Later | ⚡ | Surface product updates to staff; docs/CHANGELOG.md already exists — render it |

## 4. Auth & account pages

| # | Page | App | Status | Notes |
|---|------|-----|--------|-------|
| ✅ | Login | web | Built | eye-toggle just added |
| ✅ | Register clinic | web | Built | add consent links (L6) |
| ✅ | Forgot / Reset password | web | Built | |
| ✅ | Login / Register | patient-web | Built | add consent links (L6) |
| A1 | 🔴 **Change Password (patient)** — FAKE today: shows success toast, calls no API (`ProfilePage.tsx:100` TODO) | patient-web | Broken | ⚡ fix: add `POST /patient/me/change-password` + wire form |
| A2 | 🔴 **Change Password (staff)** — backend `changePassword()` exists (`auth.service.ts:176`), zero UI | web | Missing | ⚡ |
| A4 | 🔴 **Forgot/Reset password (patient portal)** — no recovery path at all; patient who forgets password is locked out forever | patient-web | Missing | 🔨 token flow exists staff-side; needs email/SMS delivery |
| C1 | 🟠 **My Account / My Profile** (`/account`) — staff can't view/edit own name/phone or see role/clinic/branches; Header only has Logout | web | Missing | ⚡ |
| C3 | 🟠 **Active Sessions** (`/account/sessions`) — backend `listActiveSessions()` + `logoutAll()` fully built (`auth.service.ts:168,287`), no UI. "Sign out other devices" security page | web + patient-web | Missing | ⚡ |
| A3 | 🔴 **404 Not Found page** — both routers silently redirect `*` → `/dashboard` (`router.tsx:175`, `router-patient.tsx:59`) | both | Missing | ⚡ |
| — | 🟢 Email verification at signup | both | Later | 🔨 |
| — | 🟢 Two-factor authentication (TOTP/SMS) | web | Later | 🏗️ sensible for owner/admin accounts |
| — | 🟢 Account-locked page with countdown (lockout exists backend-side; UI just shows generic error) | both | Later | ⚡ |

## 5. Staff app — core pages

| # | Page | Status | Notes |
|---|------|--------|-------|
| ✅ | Dashboard (KPIs + quick actions) | Built | |
| ✅ | Queue board (kanban/list/doctor views) | Built | |
| ✅ | Patient directory + quick registration | Built | |
| ✅ | Patient profile — **Overview tab only** | Partial | see §6 |
| ✅ | Appointments calendar (FullCalendar, reschedule, availability) | Built | |
| ✅ | Emergency board / quick-reg / case detail | Built | |
| ✅ | Nurse worklist + assessment (autosave) | Built | |
| ✅ | Doctor worklist + consultation + prescription builder | Built | |
| ✅ | Billing: invoices list/detail, payments, refunds, daily closing | Built | |
| ✅ | Reports (patient/queue/revenue/emergency, ECharts) | Built | |
| ✅ | Notifications + preferences | Built | |
| ✅ | Documents (upload/download/replace/archive) | Built | |
| ✅ | Public waiting-room display `/display/:branchId` | Built | |
| ✅ | 9-step onboarding wizard | Built | |

## 6. Staff app — Patient 360° profile tabs (all 8 are "coming soon" stubs today)

`PatientProfilePage.tsx:226-281`. Data already exists in backend for 6 of 8 — this is mostly wiring.

| # | Tab | Backend | Work |
|---|-----|---------|------|
| B1 | Medical Timeline | per-module data exists | 🔨 aggregate `GET /patients/:id/timeline` + UI |
| B2 | Visits | queue+appointments exist | ⚡ list UI |
| B3 | Vitals | ✅ indexed by patient | ⚡ table + trend sparklines |
| B4 | Prescriptions | ✅ indexed by patient | ⚡ version list + PDF links |
| B5 | Appointments | ✅ `listPatientAppointments()` exists | ⚡ tab only |
| B6 | Documents | ✅ `listByPatient()` exists | ⚡ reuse components |
| B7 | Billing | ✅ indexed by patient | ⚡ invoice list + balance |
| B8 | Follow-Ups | ❌ no follow-up entity | 🏗️ new module + tab (see F1) |

## 7. Staff app — Admin pages

| # | Page | Route | Status | Notes |
|---|------|-------|--------|-------|
| ✅ | Staff directory + invite | `/admin/staff` | Built | |
| ✅ | Roles & permissions | `/admin/roles` | Built | |
| ✅ | Doctor schedules | `/admin/schedules` | Built | verify leave UI (E3) |
| ✅ | Clinic settings | `/admin/settings` | Built | |
| ✅ | Audit logs | `/admin/audit-logs` | Built | add diff viewer (E6) |
| E1 | 🟠 **Branches management** — backend CRUD fully built + tested (M1), **no page exists**; branches only creatable via onboarding | `/admin/branches` | Missing | ⚡ biggest "free" win |
| E2 | 🟠 **Clinic profile editor** — `GET/PATCH /clinics/me` built; identity only editable via onboarding wizard today | `/admin/clinic` | Missing | ⚡ |
| E5 | 🟠 Staff detail page (full page vs dialog) | `/admin/staff/:id` | Missing | 🔨 |
| E7 | 🟠 **Message log viewer** — worker logs every SMS/WhatsApp attempt to `MessageLogModel`; admins can't see delivery status/failures | `/admin/messages` | Missing | ⚡ |
| E4 | 🟠 Token/queue numbering settings UI — `tokenSettings` model exists; queue doesn't read it yet | `/admin/settings` section | Missing | 🔨 UI + wire queue to read it |
| I10 | 🟠 Locked-accounts admin view (see & unlock locked-out staff) | `/admin/staff` addition | Missing | ⚡ |
| E8 | 🟡 Data export (patients/billing CSV) — `patient.export` permission exists, no endpoint | buttons | Missing | 🔨 |
| H5 | 🟡 Patient merge UI — backend `merge()` built | dialog on profile | Missing | 🔨 |
| C4 | 🟡 Branch switcher in header (multi-branch staff) | header | Missing | 🔨 |

## 8. Patient portal — pages

| # | Page | Status | Notes |
|---|------|--------|-------|
| ✅ | Dashboard (upcoming appts + active prescriptions) | Built | |
| ✅ | Appointments list + Book appointment (live slots) | Built | |
| ✅ | Prescriptions list/detail + PDF download | Built | |
| ✅ | Profile (view/edit) | Built | change-password is fake (A1) |
| D3 | 🟠 **My Documents** — view/download own lab reports & files | Missing | 🔨 needs `GET /patient/documents/me` |
| D4 | 🟠 **My Bills** — invoices + payment history | Missing | 🔨 needs `GET /patient/invoices/me` |
| D5 | 🟠 **My Vitals / health record** | Missing | 🔨 needs `GET /patient/vitals/me` |
| D7 | 🟠 **Live queue status** ("token 12, ~25 min") — queue engine + Socket.IO already exist | dashboard card | 🔨 |
| D6 | 🟠 Cancel / reschedule own appointment (with policy window) | Missing | 🔨 |
| D9 | 🟠 Notifications page (confirmations/reminders in-app) | Missing | 🔨 |
| D8 | 🟡 Family / dependent profiles (book for a child) | Missing | 🏗️ |
| — | 🟡 Visit summary page (post-consultation summary shared to patient) | Missing | 🔨 |
| — | 🟢 Feedback / rate-your-visit page | Missing | 🔨 |
| — | 🟢 Find-a-clinic directory (search public clinics — API `GET /patient/auth/clinics` already exists!) | Missing | ⚡ |

## 9. Advanced / platform pages (most advanced tier)

| # | Page/Feature | Status | Effort |
|---|--------------|--------|--------|
| H1 | Organization admin console (multi-clinic under one org — architecture ready, zero UI) | 🟡 | 🏗️ |
| H2 | Clinic switcher for multi-membership users (middleware currently single-membership) | 🟡 | 🏗️ |
| H3 | Super-admin platform console (`super_admin` role reserved, nothing built): tenant list, usage, support tools, feature flags | 🟡 | 🏗️ |
| H4 | SaaS subscription pages: plan picker, payment, invoices-for-the-clinic, usage limits | 🟡 | 🏗️ |
| G6 | Teleconsultation: video visit type, join page (patient), console (doctor) | 🟡 | 🏗️ |
| F2 | Lab orders & results pages (order entry, result upload, doctor review) | 🟡 | 🏗️ |
| F6 | Referral letter composer + printable PDF | 🟡 | 🔨 |
| F7 | Immunization schedule + record pages | 🟡 | 🏗️ |
| — | Inventory/pharmacy stock pages (dispense against prescription) | 🟢 | 🏗️ |
| — | Expense tracking pages (clinic outgoings → true P&L in reports) | 🟢 | 🏗️ |
| — | Doctor mobile-first "my day" view | 🟢 | 🔨 |
| — | AI-assisted documentation surface (scribe/summarize consultation) | 🟢 | 🏗️ |
| — | Advanced analytics: forecasting, benchmarking pages | 🟡 | 🏗️ |

---

# PART 1B — IN-DEPTH PER-DOMAIN PAGE BREAKDOWN

Every additional page/sub-page each domain needs to be a complete product, beyond the inventory above.

## 10. Appointments — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| AP1 | Appointment detail page `/appointments/:id` | 🟠 | Today appointments are only calendar events + dialogs; no standalone shareable page with full history (created-by, reschedule trail, reminder-sent status from MessageLog) |
| AP2 | Day-sheet / print view `/appointments/day-sheet` | 🟠 | Printable list of today's appointments per doctor — front-desk staple |
| AP3 | No-show management view | 🟠 | Filter no-shows, one-click rebook, no-show rate per patient |
| AP4 | Waitlist page | 🟡 | When a slot is full: waitlist entity + auto-offer when a cancellation frees a slot |
| AP5 | Recurring appointments (weekly physio etc.) | 🟡 | Series creation + edit-one-vs-all semantics |
| AP6 | Multi-doctor day view (columns per doctor) | 🟢 | Reception overview beyond FullCalendar default |
| AP7 | Walk-in vs booked capacity dashboard | 🟢 | Live capacity bar per doctor per session |

## 11. Queue — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| Q1 | Queue history page `/queue/history` | 🟠 | Board only shows today; no way to browse past days' queues, wait-time stats per day |
| Q2 | Queue entry detail `/queue/:entryId` | 🟠 | Full event timeline of one visit (checked-in → vitals → consult → billed) — `queue-event.model.ts` already stores every transition! |
| Q3 | Kiosk self-check-in page `/kiosk/:branchId` | 🟡 | Tablet at reception: patient enters mobile → gets token; pairs with display screen |
| Q4 | QR self-check-in (patient scans poster → checks in from phone) | 🟡 | Ties into patient portal D7 |
| Q5 | Announcement/calling settings (chime, language, repeat) for display screen | 🟢 | Display exists; no config UI |
| Q6 | Doctor "next patient" one-click console (call → start consult → complete, minimal UI) | 🟢 | Speed-optimized alternative to the board |

## 12. Billing — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| BL1 | Price list / service catalog `/admin/services` | 🟠 | Invoice items are free-text today; needs service master (name, default price, tax code) + autocomplete on invoice create |
| BL2 | Estimates / quotations page | 🟡 | Pre-treatment estimate → convert to invoice |
| BL3 | Packages page (e.g. 10-session physio) | 🟡 | Package purchase, per-visit redemption tracking |
| BL4 | Outstanding/dues report page `/billing/outstanding` | 🟠 | All unpaid/partial invoices, aging buckets, per-patient dues, "send reminder" action |
| BL5 | Payments ledger `/billing/payments` | 🟠 | Flat list of every payment/refund across invoices (reconciliation view; receipt reprint) |
| BL6 | Tax/GST summary page | 🟡 | Monthly GST breakup export for the accountant |
| BL7 | Insurance/TPA claim pages | 🟡 | Claim entity: submitted → approved/rejected; attach documents |
| BL8 | Doctor payout/commission page | 🟡 | If clinic pays doctors per-consult share: computed payouts per period |
| BL9 | Receipt/invoice print-template settings | 🟢 | Header/footer/logo per clinic (prescription branding exists; invoices don't) |

## 13. Clinical — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| CL1 | Consultation read-only view `/consultations/:id` | 🟠 | Finalized consultations are only reachable inside the doctor flow; need a standalone viewable/printable page (for records, audits, patient requests) |
| CL2 | Prescription print/preview page (staff side) | 🟠 | PDF exists; an in-app preview + reprint page per version |
| CL3 | Amendment history viewer | 🟠 | `consultation-amendment.model.ts` exists; no UI lists amendments side-by-side with original |
| CL4 | Growth charts (pediatric height/weight percentiles) | 🟡 | Vitals data exists; plot against WHO curves |
| CL5 | Allergy & alerts banner management | 🟠 | Allergies stored on patient; no prominent red banner across clinical pages + edit UI |
| CL6 | Chronic-care flowsheet (diabetes/HTN: key values over visits in one grid) | 🟡 | Differentiator for GP clinics |
| CL7 | Procedure notes page (minor procedures with consent + photos) | 🟡 | Consent capture + document links |
| CL8 | Sick-leave / fitness certificate generator | 🟡 | Templated printable certificates — very common clinic ask |
| CL9 | Case-sheet full print (entire visit bundle) | 🟢 | Assessment + vitals + consult + rx in one printout |

## 14. Patients — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| PT1 | Advanced search / filters page | 🟠 | Directory has text search only; needs filters (age band, gender, condition, last-visit range, city) + saved filters |
| PT2 | Duplicate-review worklist `/patients/duplicates` | 🟠 | `checkDuplicates()` warns at creation but there's no queue to review & merge existing dupes (pairs with H5 merge UI) |
| PT3 | Tag/segment manager (e.g. "diabetic", "senior") | 🟡 | Conditions array exists; formal tags + filterable segments |
| PT4 | Bulk import page (CSV of legacy patients) | 🟡 | Every clinic migrating from paper/Excel needs this on day 1 |
| PT5 | Patient card / ID print view (code + QR) | 🟢 | QR pairs with kiosk check-in Q3 |
| PT6 | Deceased/inactive marking flow | 🟢 | Status beyond soft-delete, excluded from reminders |

## 15. Reports — deeper pages

| # | Page/View | Status | Notes |
|---|-----------|--------|-------|
| R1 | Doctor performance report | 🟠 | Consults/day, avg duration, revenue per doctor, no-show rate |
| R2 | Appointment funnel report | 🟡 | Booked → arrived → completed → billed conversion |
| R3 | New vs returning patients report | 🟡 | Growth/retention curve |
| R4 | Reminder effectiveness report | 🟡 | Sent vs no-show correlation (MessageLog + appointments join) |
| R5 | Custom report builder | 🟢 | Pick dimensions/metrics/date-range, save + schedule email |
| R6 | Scheduled email reports (daily summary to owner) | 🟡 | Worker infra exists; needs email channel (G3) |
| R7 | Branch comparison report (multi-branch clinics) | 🟡 | Same KPIs side-by-side per branch |

## 16. Settings — missing sub-pages (today: one ClinicSettingsPage)

| # | Settings page | Status | Notes |
|---|--------------|--------|-------|
| ST1 | `/admin/settings/notifications` — reminder hours, channel (SMS/WhatsApp), templates per event | 🟠 | Values live only in `.env` today (`APPOINTMENT_REMINDER_HOURS_BEFORE`, `APPOINTMENT_REMINDER_CHANNEL`) — should be per-clinic DB settings |
| ST2 | `/admin/settings/templates` — SMS/WhatsApp message template editor with variables | 🟡 | Message text is hardcoded in worker handler |
| ST3 | `/admin/settings/billing` — invoice prefix/numbering, tax rates, currency, receipt footer | 🟠 | Invoice numbering exists backend-side; not configurable |
| ST4 | `/admin/settings/working-hours` — clinic-level holiday calendar (beyond per-doctor leave) | 🟡 | Public holidays block slots for everyone |
| ST5 | `/admin/settings/integrations` — Twilio/Cloudinary/payment keys status + test buttons | 🟢 | "Is my SMS configured?" self-service check |
| ST6 | `/admin/settings/security` — password policy, session TTLs, 2FA enforcement | 🟢 | |
| ST7 | `/admin/settings/branding` — logo upload, colors for portal/receipts/display | 🟡 | Prescription branding exists in onboarding only |

## 17. HR & staff operations (new domain)

| # | Page | Status | Notes |
|---|------|--------|-------|
| HR1 | Staff attendance page (in/out, per-day register) | 🟡 | Small clinics run attendance on paper today |
| HR2 | Staff leave requests + approval flow | 🟡 | Doctor leave exists (schedules); non-doctor staff leave doesn't |
| HR3 | Shift roster page (receptionist/nurse shifts per branch) | 🟡 | |
| HR4 | Internal announcements/noticeboard | 🟢 | Owner → all staff broadcast (notification infra exists) |
| HR5 | Task assignments ("call patient X back") | 🟢 | Lightweight per-user todo with due dates |

## 18. Inventory & pharmacy (new domain, pairs with F3/G4)

| # | Page | Status | Notes |
|---|------|--------|-------|
| IN1 | Stock items list + stock levels | 🟢 | Medicines/consumables master |
| IN2 | Purchase entry (supplier, batch, expiry) | 🟢 | |
| IN3 | Dispense against prescription | 🟢 | Decrement stock when rx items handed over; charge to invoice |
| IN4 | Expiry & low-stock alerts page | 🟢 | Notification triggers |
| IN5 | Supplier directory | 🟢 | |
| IN6 | Stock audit/adjustment page | 🟢 | Physical count reconciliation |

## 19. Patient engagement & communication (new domain)

| # | Page | Status | Notes |
|---|------|--------|-------|
| EN1 | Broadcast/campaign page ("clinic closed Friday", health-camp announcement to a segment) | 🟡 | Twilio infra exists; needs consent/opt-out handling (pairs with L-pages) |
| EN2 | Two-way message inbox (patient replies to SMS/WhatsApp land somewhere) | 🟡 | Today replies vanish; Twilio webhooks → inbox page |
| EN3 | Review/feedback collection + dashboard (post-visit rating link) | 🟢 | Pairs with portal feedback page |
| EN4 | Health-tips / education library shared to patients | 🟢 | |
| EN5 | Birthday/anniversary greetings automation settings | 🟢 | DOB already stored |

## 20. Print & document views (cross-cutting, all 🟠 unless noted)

- Invoice/receipt print CSS view (PDF exists; browser-print variant)
- Prescription reprint per version (CL2)
- Appointment slip print (token + arrival window, handed at desk)
- Queue token slip print (thermal-printer friendly, 80mm)
- Patient registration form print (blank + filled)
- Certificates (CL8) 🟡
- Day-sheet (AP2)
- Case-sheet bundle (CL9) 🟢

## 21. Mobile & device-specific surfaces

| # | Surface | Status | Notes |
|---|---------|--------|-------|
| M1 | PWA install (manifest + service worker) for patient portal | 🟡 | Cheapest "app" — patients keep it on the home screen |
| M2 | Doctor mobile "my day" (today's list, one-tap start consult) | 🟢 | Responsive-first page, not a new app |
| M3 | Owner mobile dashboard (today's revenue/queue at a glance) | 🟢 | |
| M4 | Kiosk mode (Q3) — fullscreen, auto-reset, no navigation | 🟡 | |
| M5 | Second display screen variant: doctor-room door display (current token per room) | 🟢 | Display infra exists |

---

# PART 2 — BACKEND WORK REQUIRED (grouped)

## Already built, needs only frontend (zero/near-zero backend)
- Branches CRUD (E1) · Clinic profile (E2) · Active sessions + logoutAll (C3) · Staff changePassword (A2, verify route) · Patient-scoped appointment list (B5) · Documents listByPatient (B6) · Vitals/prescriptions/billing by patient (B3/B4/B7 — verify query params) · Patient merge (H5) · Public clinic search (find-a-clinic)

## New endpoints (small ⚡–🔨)
- `POST /patient/me/change-password` (A1)
- Patient forgot/reset password + delivery channel (A4, needs G3 email or SMS)
- `GET /patients/:id/timeline` aggregate (B1)
- `GET /patient/documents/me`, `/patient/invoices/me`, `/patient/vitals/me`, `/patient/queue/me` (D3–D7)
- Patient cancel/reschedule with policy window (D6)
- CSV export endpoints (E8)
- Contact/support form intake (S2) — or wire to external (email/Slack)
- Admin unlock-account endpoint (I10)

## New modules (🏗️)
- Follow-ups (B8/F1): entity, CRUD, reminders trigger
- Support tickets (S3)
- Lab orders (F2) · Referrals (F6) · Immunizations (F7)
- Drug catalog (F3) + consultation templates (F5)
- Online payments/webhooks (G1) — needs L5 refund policy live first
- Notification triggers expansion (G2): queue "you're next", prescription-ready, payment receipt — infra (BullMQ+Twilio) already built, incremental
- Email channel adapter in worker (G3) — unblocks A4 and receipts
- Family profiles linkage (D8)
- Org/multi-clinic membership resolution (H1/H2) · Super-admin (H3) · SaaS billing (H4)
- Teleconsultation (G6) · Pharmacy/lab integrations (G4/G5)
- Service catalog (BL1) · Estimates/packages (BL2/BL3) · Insurance claims (BL7)
- Waitlist (AP4) · Recurring appointments (AP5) · Kiosk/QR check-in (Q3/Q4)
- Certificates (CL8) · Procedure notes (CL7) · Bulk patient import (PT4)
- Per-clinic notification settings + templates (ST1/ST2) — move from `.env` to DB
- Clinic holiday calendar (ST4) · Attendance/leave/roster (HR1–HR3)
- Inventory suite (IN1–IN6) · Campaigns + two-way inbox (EN1/EN2)

---

# PART 3 — QUALITY / NON-PAGE WORK

| # | Item | Status |
|---|------|--------|
| I1 | Frontend unit tests — **0 test files** in both apps (backend: 206 ✅, E2E: 38 ✅) | 🔴 |
| I2 | 3 false-positive emergency isolation tests (8/11 since Phase 1) | 🟡 |
| I3 | Global React error boundary + crash reporting (Sentry) — none found | 🟠 |
| I4 | Loading/empty-state audit across all lists | 🟢 |
| I5 | Accessibility pass (focus traps, aria on dialogs/kanban) | 🟢 |
| I6 | i18n — `preferredLanguage` stored on patients; UI is English-only | 🟡 |
| I7 | PWA/offline for waiting-room display | 🟢 |
| I8 | Backup/restore & data-retention: docs → actual tooling | 🟡 |
| I9 | CI pipeline (typecheck+tests+E2E on PR) — no CI config in repo | 🟠 |
| — | SEO/meta/OG tags for public pages (once P1+ exist) | 🟢 |
| — | Uptime monitoring + alerting for API/worker | 🟢 |

---

# SUGGESTED BUILD ORDER

| Sprint | Contents | Why |
|--------|----------|-----|
| **1. Trust & legal basics** | A1 fake password fix · A2 staff change-password · A3 404s · L1 Privacy · L2 Terms · L6 consent links · S2 contact-support form | A1 lies to users; L1/L2 are mandatory for medical data; all are ⚡ |
| **2. Free wins (backend done)** | E1 Branches page · E2 Clinic profile · C1 My Account · C3 Sessions · E7 Message log · find-a-clinic | Backend 100% ready — pure frontend |
| **3. Patient 360°** | B2–B7 tabs, then B1 timeline | Highest staff daily-use value |
| **4. Patient portal v2** | A4 password recovery · D3 documents · D4 bills · D7 live queue · D6 cancel | Makes the portal genuinely useful |
| **5. Ops depth** | E4 token settings · E8 export · H5 merge UI · I10 unlock · E6 audit diff | Operational maturity |
| **6. Follow-ups + notifications** | B8/F1 module · G2 triggers · G3 email | Retention loop; infra exists |
| **7. Public site** | P1 landing · P5 contact · P2/P3/P4 · P8 clinic mini-sites | Growth |
| **8+. Advanced** | G1 payments · F2 labs · G6 tele · H1–H4 platform · F3–F7 clinical depth | Roadmap by business need |
| **Continuous** | I1 tests · I3 error boundary · I9 CI · I5 a11y | Alongside everything |

---

# ALREADY FULLY BUILT (do NOT rebuild)

**Staff app (24 routed pages)**: login/register/forgot/reset · 9-step onboarding · dashboard ·
queue kanban(+list/doctor) · patient directory/registration/profile(overview) · appointments
calendar · emergency board/quick-reg/case detail · nurse worklist+assessment · doctor
worklist+consultation+prescription builder · billing list/detail/daily-closing · reports ×4 ·
admin staff/roles/schedules/settings/audit-logs · notifications · documents · public display.

**Patient portal (8 routed pages)**: login · register (clinic picker) · dashboard · appointments ·
book (live slots) · prescriptions list/detail (PDF) · profile.

**Backend**: 27 modules · 206 passing tests · Socket.IO realtime · BullMQ worker + Twilio
SMS/WhatsApp appointment reminders · audit logging · RBAC (40+ permissions) · idempotency ·
soft-delete tenancy.
