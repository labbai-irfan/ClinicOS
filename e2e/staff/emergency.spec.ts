import { test, expect, type Page } from '@playwright/test';

/**
 * Covers the emergency workflow: apps/web/src/features/emergency/pages/{
 *   EmergencyBoardPage, EmergencyQuickRegistrationPage, EmergencyCasePage
 * }.tsx and components/{TriagePanel, AssignPanel, ReferralDialog, ObservationPanel,
 * StatusTransitionBar, TimelineList}.tsx, backed by
 * apps/api/src/modules/emergencies/emergency.service.ts and
 * packages/types/src/state-machines.ts (EMERGENCY_TRANSITIONS).
 *
 * There are no data-testid attributes anywhere in this codebase, so every locator
 * below is a role/label/text locator matched against the real rendered markup (Field
 * renders a <label htmlFor>, Radix Select renders a combobox/option pair, Radix
 * Dialog exposes its Title as the dialog's accessible name).
 *
 * A brand-new clinic (unique email/clinic name) is registered per test via the real
 * API, then onboarding is fast-forwarded through the two onboarding endpoints
 * (PATCH .../onboarding-step, POST .../activate) instead of the 9-step wizard UI —
 * onboarding itself is covered by e2e/staff/auth-onboarding.spec.ts, not this file.
 * Login always happens through the real browser form so the app's actual session
 * bootstrap runs. The golden path drives every emergency action through the UI; the
 * edge-case tests seed the emergency case itself via the API to stay fast, then
 * verify behavior in the browser.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const OWNER_PASSWORD = 'Passw0rd1';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

interface SeededClinic {
  email: string;
  accessToken: string;
  branchId: string;
}

async function apiPost(path: string, body: unknown, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPatch(path: string, body: unknown, accessToken: string) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed with ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Registers a clinic owner and fast-forwards onboarding so /emergency is reachable. */
async function registerActivatedClinic(clinicName: string): Promise<SeededClinic> {
  const email = `${unique('emergency-owner')}@example.com`;
  const registerJson = await apiPost('/auth/register-owner', {
    name: 'Reception Owner',
    email,
    password: OWNER_PASSWORD,
    clinicName,
  });
  const accessToken = registerJson.data.accessToken as string;
  const branchId = registerJson.data.user.activeBranchId as string;

  // ONBOARDING_TOTAL_STEPS is 9; step:9 caps at 9 and satisfies activateClinic's check.
  await apiPatch('/clinics/me/onboarding-step', { step: 9 }, accessToken);
  await apiPost('/clinics/me/activate', {}, accessToken);

  return { email, accessToken, branchId };
}

/** Invites an active doctor so the emergency Assign panel has someone to pick. */
async function inviteDoctor(clinic: SeededClinic, name: string): Promise<void> {
  await apiPost(
    '/staff',
    {
      name,
      email: `${unique('doctor')}@example.com`,
      roleKey: 'doctor',
      branchIds: [clinic.branchId],
    },
    clinic.accessToken,
  );
}

/** Seeds an emergency case directly, for edge-case tests that don't exercise creation. */
async function seedEmergencyCase(
  clinic: SeededClinic,
  mainConcern: string,
): Promise<{ id: string; caseCode: string }> {
  const json = await apiPost('/emergencies', { mainConcern }, clinic.accessToken);
  return { id: json.data.id, caseCode: json.data.caseCode };
}

async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * StatusPill (apps/web/src/components/ui/StatusPill.tsx) is the only component in
 * this app styled with `rounded-full`, so scoping to it disambiguates a priority/
 * status label from a Select trigger that happens to be showing the same word as
 * its currently-chosen value (e.g. the Priority combobox displaying "Critical"
 * right next to the "Critical" status pill).
 */
function pill(page: Page, label: string) {
  return page.locator('span.rounded-full', { hasText: label });
}

test.describe('emergency workflow', () => {
  test('golden path: quick-register, appear on board, triage, assign, and observe', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Golden ER Clinic'));
    await inviteDoctor(clinic, 'Dr Alicia Fenn');
    await loginViaUi(page, clinic.email);

    // --- Quick registration with no identity info at all ---
    await page.goto('/emergency');
    await expect(page.getByRole('heading', { level: 1, name: 'Emergency' })).toBeVisible();
    await page.getByRole('button', { name: 'Emergency Entry' }).click();

    await expect(page).toHaveURL(/\/emergency\/new$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Emergency Entry' })).toBeVisible();
    const mainConcern = 'Collapsed outside the pharmacy, unresponsive';
    await page.getByLabel('Main concern').fill(mainConcern);
    // Name, age, mobile, address, emergency contact are all deliberately left blank.
    await page.getByRole('button', { name: 'Open emergency case' }).click();

    // Redirects straight into the new case; patientLabel falls back to "Unidentified"
    // (derivePatientLabel in emergency.service.ts) since no name/gender/age was given.
    await expect(page).toHaveURL(/\/emergency\/[a-f0-9]{24}$/);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText(/^ER-\d{4}-\d{4} · Unidentified$/);
    const caseCodeText = await heading.textContent();
    const caseCode = caseCodeText!.split(' · ')[0];
    await expect(page.getByText(mainConcern)).toBeVisible();
    await expect(pill(page, 'Unconfirmed')).toBeVisible();
    await expect(pill(page, 'Awaiting triage')).toBeVisible();

    // --- Appears on the board ---
    await page.getByRole('link', { name: 'Back to board' }).click();
    await expect(page).toHaveURL(/\/emergency$/);
    const boardRow = page.getByRole('link', { name: new RegExp(caseCode) });
    await expect(boardRow).toBeVisible();
    await expect(boardRow).toContainText('Unidentified');
    await expect(boardRow).toContainText('Unconfirmed');
    await expect(boardRow).toContainText('Awaiting triage');
    await boardRow.click();
    await expect(page).toHaveURL(/\/emergency\/[a-f0-9]{24}$/);

    // --- Triage: confirm priority (never computed, always staff-set) ---
    await page.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByRole('option', { name: 'Critical' }).click();
    await page.getByRole('button', { name: 'Save triage' }).click();
    await expect(pill(page, 'Critical')).toBeVisible();
    // Confirming triage from awaiting_triage auto-advances the status.
    await expect(pill(page, 'Triage in progress')).toBeVisible();

    // --- Assign a doctor ---
    await page.getByRole('combobox', { name: 'Doctor' }).click();
    await page.getByRole('option', { name: 'Dr Alicia Fenn' }).click();
    await page.getByRole('button', { name: 'Save assignment' }).click();
    await expect(page.getByText('Doctor: Dr Alicia Fenn')).toBeVisible();
    // Assigning a doctor while triage_in_progress -> doctor_alerted is a valid
    // transition auto-fires it (emergency.service.ts assignEmergency).
    await expect(pill(page, 'Doctor alerted')).toBeVisible();

    // --- Walk the case to under_observation via the status transition bar ---
    await page.getByRole('button', { name: 'Under assessment' }).click();
    await page.getByRole('dialog', { name: 'Move to: Under assessment' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(pill(page, 'Under assessment')).toBeVisible();

    await page.getByRole('button', { name: 'Under observation' }).click();
    await page.getByRole('dialog', { name: 'Move to: Under observation' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(pill(page, 'Under observation')).toBeVisible();

    // --- Add an observation note ---
    await expect(page.getByRole('heading', { name: 'Observation notes' })).toBeVisible();
    const observationNote = 'Vitals stable, patient resting comfortably.';
    await page.getByLabel('Note').fill(observationNote);
    await page.getByRole('button', { name: 'Add note' }).click();

    // --- Timeline reflects the note (most recent entry first) ---
    // Card renders a `shadow-card` class found on no other ancestor in the tree, so
    // this reliably scopes to the "Case timeline" card regardless of its DOM depth.
    const timelineCard = page
      .getByRole('heading', { name: 'Case timeline' })
      .locator('xpath=ancestor::div[contains(@class, "shadow-card")][1]');
    await expect(timelineCard.getByText('Observation note', { exact: true })).toBeVisible();
    await expect(timelineCard.getByText(observationNote)).toBeVisible();
    await expect(timelineCard.getByText('No timeline events yet')).toHaveCount(0);
  });

  test('an emergency case never appears on the normal patient queue board', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Isolated ER Clinic'));
    const { caseCode } = await seedEmergencyCase(clinic, 'Suspected fracture after a fall');
    await loginViaUi(page, clinic.email);

    await page.goto('/emergency');
    await expect(page.getByText(caseCode)).toBeVisible();

    await page.goto('/queue');
    await expect(page.getByRole('heading', { level: 1, name: 'Live Queue' })).toBeVisible();
    await expect(page.getByText(caseCode)).toHaveCount(0);
    // No patient was ever checked into the normal queue for this fresh clinic.
    await expect(page.getByText('No patients in the queue yet')).toBeVisible();
  });

  test('a referral cannot be saved without a reason', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Referral ER Clinic'));
    const { id } = await seedEmergencyCase(clinic, 'Needs specialist evaluation');
    await loginViaUi(page, clinic.email);

    await page.goto(`/emergency/${id}`);
    await page.getByRole('button', { name: 'Referral' }).click();
    const dialog = page.getByRole('dialog', { name: 'Refer this case' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Facility name').fill('City General Hospital');
    // Reason is deliberately left blank.
    await dialog.getByRole('button', { name: 'Save referral' }).click();

    await expect(dialog.getByText('Required')).toBeVisible();
    // Client-side validation blocks the submit — the dialog stays open and the case
    // status is untouched.
    await expect(dialog).toBeVisible();
    await expect(pill(page, 'Awaiting triage')).toBeVisible();
  });

  test('timeline entries are immutable once recorded — no edit control is offered', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Timeline ER Clinic'));
    const { id } = await seedEmergencyCase(clinic, 'Deep laceration to the forearm');
    await loginViaUi(page, clinic.email);

    await page.goto(`/emergency/${id}`);
    // Trigger a second timeline event beyond the initial "arrival" one.
    await page.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByRole('option', { name: 'Urgent' }).click();
    await page.getByRole('button', { name: 'Save triage' }).click();

    await expect(page.getByText('Triage recorded', { exact: true })).toBeVisible();
    // Exact match: the case-detail dl also renders a longer "Arrived Xm ago · ..."
    // sentence containing this word, distinct from the timeline entry's bare label.
    await expect(page.getByText('Arrived', { exact: true })).toBeVisible();

    // TimelineList (apps/web/src/features/emergency/components/TimelineList.tsx) renders
    // each event as a plain <li> with text/time only — no button of any kind — proving no
    // edit or delete control exists on any recorded entry. Scoped to the timeline's own
    // <ol> (identified via its "Arrived" entry) rather than the whole page, since Radix's
    // Toast viewport also renders its items as an implicit <li> with a close button, which
    // would otherwise produce a false positive right after the "Triage recorded" toast fires.
    const timelineList = page.locator('ol').filter({ has: page.getByText('Arrived', { exact: true }) });
    await expect(timelineList.locator('li button')).toHaveCount(0);
    await expect(timelineList.getByRole('button', { name: /edit/i })).toHaveCount(0);
  });
});
