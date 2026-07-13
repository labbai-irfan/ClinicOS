# ClinicOS — Go-To-Market & Client Acquisition Playbook

_How we grab clients, keep them, and grow them. Companion to `BUSINESS_PLAN.md` and
`RISKS_AND_OBSTACLES.md`._

---

## 1. Ideal Customer Profiles (ICP)

| ICP | Profile | Pain we lead with | Qualifying questions |
|-----|---------|-------------------|----------------------|
| **P0: Solo GP** | 1 doctor, 1 receptionist, 40–80 patients/day, paper register | Chaotic queue, angry waiting patients | "How do patients know their turn today?" · "How many no-shows last week?" |
| **P0: Polyclinic** | 2–5 doctors, nurse, evening+morning shifts | No visibility across doctors; billing leakage | "Who tallies cash at closing?" · "Can you see yesterday's revenue per doctor right now?" |
| **P1: Specialty clinic** (derma/dental/pedia/ortho) | Higher fees, repeat treatments | Records + prescriptions look unprofessional; follow-ups missed | "How do you track treatment sessions?" · "How do you remind for follow-ups?" |
| **P1: Small chain** (2–5 branches) | Owner not on-site daily | Zero cross-branch visibility | "How do you know branch 2's collections today?" |
| ❌ Disqualify | Hospital >10 doctors, govt. facility, doctor about to retire, no smartphone at desk | — | Politely exit, note for later |

## 2. Channel Playbook (ranked by expected CAC)

| # | Channel | Motion | Why it works | CAC est. |
|---|---------|--------|--------------|----------|
| 1 | **Doctor referrals** | Ask every happy clinic for 2 intros; 1-month-free per converted referral | Doctors trust doctors; near-zero cost | ₹1–2k |
| 2 | **Door-to-door cluster sales** | Pick one 2-km medical hub; visit every clinic 3× (intro → demo → close) | Density = shared waiting-room displays become visible ads; service response in minutes | ₹6–10k |
| 3 | **Medical-rep / distributor channel** | Consumables & pharma stockists already visit every clinic weekly; commission per activated clinic | They have the relationship; we ride existing routes | ₹3–5k commission |
| 4 | **Chemist/lab cross-referral** | Nearby pharmacy/lab recommends us; reciprocity when partner network (Wave 6) opens | Aligned incentives, future network seed | ₹2–4k |
| 5 | **WhatsApp demo video** | 3-min video: token board + prescription print + reminder SMS; forwardable | Owners decide on WhatsApp, not email | ~₹0 marginal |
| 6 | **IMA branch / clinic associations** | Sponsor a CME session; 15-min product slot; member discount | Batch credibility | event cost /signups |
| 7 | **Google Business + local SEO** | "clinic software + <city>" landing pages (needs P1 public site) | Inbound compounding | low, slow |
| 8 | **Waiting-room display as billboard** | "Powered by ClinicOS + QR" footer on the public display & printed slips | Every patient is a potential referrer to their own doctor | ₹0 |

## 3. Field Sales Script

### 3.1 The 30-second opener (at reception, ask for the owner-doctor between patients)
> "Doctor, one question — right now, do your patients outside know when their number will
> come? … We put a live token screen in your waiting area, send automatic WhatsApp
> reminders so patients actually show up, and print professional prescriptions with your
> letterhead — all from one simple screen your receptionist already knows how to use.
> Five minutes after your last patient, I'll show you on this tablet. If it doesn't feel
> 10× better than the register, I'll leave."

### 3.2 The 5-minute live demo path (rehearse until < 5 min)
1. **Queue**: add a walk-in in 20 seconds → token appears on display screen (bring one).
2. **Vitals→consult**: show nurse entry, then doctor screen with patient history in one view.
3. **Prescription**: pick medicines fast → print preview with THEIR clinic name on it. _(Pause here — this is the emotional moment.)_
4. **Reminder**: book tomorrow's appointment → show the actual SMS arriving on your phone.
5. **Owner view**: today's revenue + patients on the dashboard. "This is your clinic at a glance, from home."

### 3.3 Objection handling

| Objection | Response |
|-----------|----------|
| "Paper works fine." | "Paper works until the register is lost, the compounder quits, or a patient claims you prescribed something you didn't. Also — paper can't send reminders. One saved no-show pays your month." |
| "Too costly." | "₹66/day — less than one patient's consultation fee, and reminders alone recover 2–3 no-shows a week. Start free with one doctor; pay only when it proves itself." |
| "My staff won't learn it." | "If your receptionist can use WhatsApp, she can use this — adding a patient is 4 fields. We train your staff in person, free, and we're 10 minutes away." |
| "What about my data? Where does it go?" | "Your data stays in your account, encrypted, backed up daily — safer than a register anyone can photograph. You can export everything anytime; it's yours, not ours." (Requires L1/L2 pages live + export E8 to fully back this.) |
| "Internet is unreliable here." | "It runs on your phone's hotspot too — it's lighter than YouTube. And your paper register doesn't work in a fire either." (Honest note: true offline mode is future scope — don't overpromise.) |
| "I'll think about it." | "Fair. Let me set up the free version right now — 10 minutes — and run today's OPD on it in parallel with your register. Tonight you compare." |
| "Practo already calls me." | "Practo sells you patients and charges per lead. We run your clinic's whole day and the patients stay YOURS — their numbers, their records, your brand." |

## 4. Pilot → Paid Conversion Motion

- **Design-partner program (first 10 clinics)**: free Clinic Pro for 6 months in exchange
  for weekly feedback call, testimonial rights, and case-study numbers. Handpick friendly,
  busy clinics.
- **Standard free pilot (14 days full-featured)**: we set it up same-day, seed their doctors
  and services, train staff twice. Conversion trigger: they've billed ≥ 30 real patients.
- **Close**: annual (2 months free) vs monthly; collect via UPI autopay mandate.
- **Rule**: never let a pilot run cold — if no logins for 3 days, visit in person same week.

## 5. Onboarding Playbook (goal: live in ONE day)

**Day 0 checklist**
1. Create clinic + owner account; complete 9-step onboarding wizard together.
2. Add doctors, fees, working hours, branches.
3. Print test prescription with their letterhead → get the doctor's sign-off on layout.
4. Put the waiting-room display on their TV (Chromecast/old laptop).
5. Configure reminder timing; send a test SMS to the owner's phone.
6. Migrate top ~200 active patients (bulk import — build PT4; until then, staff add-as-they-come).
7. 30-min role training: receptionist (queue+billing), nurse (vitals), doctor (consult+rx).
8. Run the evening OPD live with our person standing at reception.

**Go-live criteria**: 1 full OPD session run end-to-end; ≥1 invoice printed; owner has
dashboard on their phone.

## 6. Retention & Expansion

- **Health score** (weekly, automated later): tokens/day, invoices/day, reminder sends,
  staff logins. Red = tokens/day drops >50% week-over-week → call within 24h.
- **Churn-risk signals**: only receptionist logs in (doctor disengaged) · no invoices
  (using it only as queue) · support silence after a complaint.
- **Month-1 cadence**: visit day 1, day 3, day 7, day 14, day 30. Churn is decided in the
  first two weeks.
- **Upsell triggers**: 2nd doctor joins → tier up · >500 msgs/mo → message pack ·
  patients asking for reports → portal pitch · 2nd branch → Chain tier.
- **Referral engine**: after month 2 with green health score, ask for 2 introductions;
  reward 1 month free per activated referral (both sides).
- **QBR-lite**: quarterly one-pager to the owner — patients served, no-shows saved,
  revenue tracked — makes the value visible at renewal.

## 7. Sales Ops (keep it lightweight)

**Pipeline stages**: Lead → Visited → Demo done → Pilot live → Paying → (Churn-risk).

**Tracking sheet columns** (Google Sheet until 100 clinics): clinic name · area · doctors# ·
ICP type · stage · last touch · next action + date · objection notes · source channel ·
MRR · health (G/Y/R).

**Weekly cadence (per pod)**: Mon pipeline review (30 min) · Tue–Fri field blocks (10
visits/day target) · Sat onboarding/training slots · targets: 40 doors, 10 demos, 3 pilots,
1–2 closes per week per rep.

**Pod economics target**: 1 rep + shared support closes 6–8 clinics/mo by month 3 →
pod pays for itself at ~35 paying clinics.

## 8. City Expansion Recipe

1. Enter only when city #1 hits 100 paying + churn <2%/mo (proof the motion works).
2. Choose next city by: medical-hub density, founder network, distributor coverage.
3. Seed with 5 design partners via referrals BEFORE hiring the local pod.
4. Localize: language of prints, festival calendar, pricing sensitivity check.
5. Replicate pod playbook; owner-founder spends week 1 on the ground each launch.
