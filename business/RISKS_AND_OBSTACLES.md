# ClinicOS — Risks, Issues & Obstacles

_Every obstacle we face or will face, by category, with likelihood (P), impact (I) and
mitigation. Companion to `BUSINESS_PLAN.md` and `GO_TO_MARKET.md`.
Scale: P/I = Low / Med / High._

---

## 1. Adoption & Behavioral Obstacles (the real competition is paper)

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **Paper habit**: 20 years of registers; software feels like extra work | H | H | Demo must be FASTER than paper (4-field walk-in add); run pilot in parallel with the register so nobody feels forced |
| **Receptionist resistance**: fears being replaced or blamed for mistakes | H | H | Train her first, praise her publicly, make her the "system expert"; never pitch as staff-reduction |
| **Doctor time-poverty**: won't sit through demos or training | H | M | 5-min demo between patients; doctor's own flow must be ≤ the time of writing on paper (templates, Wave 1, are key) |
| **Owner ≠ user**: owner buys, staff sabotage by not using | M | H | Health-score monitoring + day 1/3/7/14/30 visits; usage report sent to owner weekly |
| **Half-adoption**: queue used, billing ignored → value invisible → churn | H | M | Onboarding go-live criteria includes first invoice; monthly value one-pager |
| **Seasonality**: festival/harvest lulls reduce OPD and willingness to pay | M | L | Annual plans discount; pause-not-cancel option |

**Checklist**: ⬜ parallel-run pilot SOP · ⬜ receptionist-first training deck · ⬜ weekly owner usage email · **Owner**: sales pod · **Trigger metric**: tokens/day per clinic

## 2. Market & Competitive Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
| Price sensitivity; "free" competitors = WhatsApp + Excel + register | H | H | Free tier as wedge; ROI framing (no-show recovery ≥ subscription) |
| Practo-type players adding clinic tools; deep pockets | M | H | Own the OPERATIONS layer they don't; clinic's patients stay clinic's (their model conflicts) |
| Local copycats cloning UI at lower price | M | M | Moat = templates lock-in, records history, partner network, service density — not UI |
| Hospital-HIS vendors moving downmarket | L | M | They can't hit ₹2k price points with their cost structure; stay lean |
| Long sales cycles for chains distract from P0 | M | L | Chains only via inbound until 300+ clinics |

**Checklist**: ⬜ competitor watch (quarterly) · ⬜ win/loss notes in CRM sheet · **Owner**: founder · **Trigger**: lost-deal reasons trending to one competitor

## 3. Technical Risks (from the actual codebase state)

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **Clinic internet outages** — no offline mode today | H | H | Hotspot fallback in training; roadmap offline-first (FUTURE_SCOPE §14); don't overpromise in sales |
| **No CI pipeline** — regressions can ship silently (PENDING_FEATURES I9) | H | M | Add GitHub Actions: typecheck + 206 tests + E2E on PR — cheap, do now |
| **No error monitoring/boundary** (I3) — prod crashes invisible | H | M | Sentry (free tier) + global React error boundary |
| **Backups/restore untested** — Atlas backups exist but never restored | M | H | Quarterly restore drill; document RPO/RTO; show buyers (sales asset) |
| **Single-region DB/API** — regional outage = all clinics down | L | H | Accept for now; document status page (S6) + incident comms template |
| **Vendor dependence**: Twilio (msgs), Cloudinary (docs), Atlas | M | M | Adapter pattern already in worker; keep second SMS provider evaluated; export tooling |
| **Socket.IO scaling** beyond ~1k concurrent clinics | L | M | Redis adapter for Socket.IO when needed; already have Redis in stack |
| **Secrets hygiene**: real credentials currently in local `.env` (Mongo, Cloudinary, Twilio) | M | H | Never commit `.env` (verify .gitignore); rotate before any repo share; secrets manager at deploy |
| **Mongo Atlas cost curve** as data grows (documents, audit logs) | M | L | TTL/archival policy for audit + message logs; tiered storage |
| **E2E flakiness / 3 known false-positive tests** (I2) | M | L | Fix in Sprint 1–2; keep suite green-only policy |

**Checklist**: ⬜ CI live · ⬜ Sentry live · ⬜ restore drill done · ⬜ .env rotation · **Owner**: eng · **Trigger**: first paying clinic = all four must be done

## 4. Product Gaps as Business Risk (cross-ref PENDING_FEATURES.md)

| Gap | Business consequence | Fix |
|-----|----------------------|-----|
| 🔴 No Privacy/Terms/consent (L1–L7) | Cannot legally onboard patient data; deal-breaker in due diligence | Sprint 1 |
| 🔴 Patient change-password is FAKE (A1) | Trust-destroying if discovered; security theater | Sprint 1 |
| 🔴 No patient password recovery (A4) | Portal support burden lands on clinics | Sprint 1–2 |
| No bulk patient import (PT4) | Migration friction = the #1 onboarding objection | Before scale push |
| No branches admin page (E1) | Multi-branch clinics (best LTV) hit a wall post-onboarding | Sprint 2 (backend done) |
| No data export (E8) | "It's your data" sales claim isn't backed | Sprint 2–3 |
| English-only UI (I6) | Caps tier-2/3 expansion | Before city #3 |

## 5. Regulatory & Legal Risks (India)

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **DPDP Act 2023**: patient data = digital personal data; consent, purpose limitation, breach notification duties | H | H | Consent capture at signup (L6); privacy program doc; appoint data-protection point person; breach-response runbook |
| **Medical record retention** norms (typically 3+ years; state-varying) | M | M | Retention policy + no hard-delete (soft-delete already built); legal review |
| **Telemedicine Practice Guidelines** when Wave 5 ships | M | M | Compliance checklist before launch: doctor RMP verification, prescription restrictions |
| **Drug schedule rules** (H/H1/X) when pharmacy features ship | M | H | Schedule-aware dispensing rules; pharmacist-in-loop; legal opinion first |
| **Liability for clinical errors** blamed on software (template misuse, wrong dose) | L | H | Templates are doctor-authored drafts; prominent review-before-sign; disclaimers in ToS; professional-liability stays with doctor — get ToS lawyer-drafted |
| **Contract enforceability / payment disputes** with clinics | M | L | Simple e-signed subscription agreement; UPI autopay mandates |
| **GST compliance** on SaaS billing | H | L | Accountant from month 1; invoicing built into billing ops |

**Checklist**: ⬜ lawyer-drafted ToS/Privacy · ⬜ DPDP gap assessment · ⬜ breach runbook · **Owner**: founder + counsel · **Trigger**: first paying clinic

## 6. Financial Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
| CAC exceeds plan (door-to-door slower than modeled) | M | H | Referral channel first; kill-criteria per channel after 90 days |
| Month-1 churn cliff (pilot never converts to habit) | H | H | Onboarding go-live criteria + day 1/3/7/14/30 cadence (GTM §6) |
| Messaging costs eaten by heavy users on flat plans | M | M | Metered packs beyond included quota; WhatsApp template pricing watch |
| Free tier cannibalizes paid (solo GPs never upgrade) | M | M | Free tier caps that bite at success (50 patients/mo, branding on prints) |
| Runway vs milestone mismatch (need 300 clinics for seed story) | M | H | Monthly burn review; sales pod expansion only on proven pod economics |
| Annual-prepay refund demands on churn | L | L | Pro-rata policy in ToS |

## 7. Operational Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **Founder bandwidth**: building AND selling AND supporting | H | H | Timebox (build AM / field PM); first hire = onboarding+support, not sales |
| Hiring field reps who can talk to doctors (tier-2 talent) | M | M | Hire ex-medical reps; pay activation commission not just salary |
| Support load explodes per 100 clinics (WhatsApp pings at 9pm) | H | M | Help center (S1) + FAQ deflection; support hours policy; on-call rotation |
| Onboarding bottleneck (1 day/clinic × people available) | M | M | Self-serve wizard already exists; train distributor partners to onboard |
| Key-person risk (single engineer knows deploy) | M | H | Runbooks in docs/; CI/CD automation; weekly knowledge-share |

## 8. Security Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **Shared front-desk credentials** (one login for all staff) | H | M | Per-staff accounts are cheap (invite flow built); audit-log shows per-user actions — enforce in onboarding |
| Patient-data leak (screenshot, export misuse, insider) | M | H | RBAC already strict; add export watermarks + audit review page (E6); DPDP breach runbook |
| Ransomware/malware on clinic PCs | M | L | Web app = nothing local to encrypt; educate: browser-only, no downloads needed |
| Account takeover of owner (weak passwords) | M | H | Lockout exists; add 2FA for owner/admin (§4 auth roadmap); password policy |
| Credential stuffing on patient portal | M | M | Rate limits exist; add captcha on repeated failures |
| API abuse of public endpoints (clinic search) | L | L | Rate limiting exists; monitor |

## 9. Reputation Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
| **One data-loss incident** in a tight-knit medical community | L | H | Backup drills (§3); honest incident comms; insurance |
| Prescription misprint/mix-up blamed publicly on the software | L | H | Review-before-sign UX; version trail (already built); rapid-response SOP |
| Review-bombing by a churned clinic or competitor | M | L | Google Business monitoring; respond factually; happy-clinic review engine (GTM §6) |
| Downtime during evening OPD rush (peak = 6–9pm) | M | H | Deploy freezes 5–10pm; status page; SMS fallback runbook for clinics |

---

## 10. TOP-10 RISK REGISTER (live — review monthly)

| # | Risk | P | I | Score | Mitigation (short) | Status |
|---|------|---|---|-------|--------------------|--------|
| 1 | Paper habit / half-adoption churn | H | H | 9 | Parallel pilot + onboarding criteria + visit cadence | Open |
| 2 | Legal pages/consent missing while handling patient data | H | H | 9 | Sprint 1 build + lawyer review | **Open — blocker** |
| 3 | Founder bandwidth split | H | H | 9 | Timebox + first support hire | Open |
| 4 | Clinic internet unreliability, no offline | H | H | 9 | Hotspot SOP now; offline-first roadmap | Open |
| 5 | Month-1 churn cliff | H | H | 9 | GTM §6 cadence + health score | Open |
| 6 | DPDP non-compliance | H | H | 9 | Gap assessment + consent + runbook | Open |
| 7 | No CI/monitoring → silent prod breakage | H | M | 6 | GitHub Actions + Sentry this sprint | Open |
| 8 | CAC overrun on door-to-door | M | H | 6 | Referral-first; 90-day channel kill-criteria | Open |
| 9 | Owner-account takeover / shared logins | M | H | 6 | Per-staff accounts enforced + 2FA roadmap | Open |
| 10 | Evening-rush downtime | M | H | 6 | Deploy windows + status page + incident SOP | Open |

_Scoring: P×I with L=1, M=2, H=3._
