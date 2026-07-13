import { test, expect, type Page } from '@playwright/test';

/**
 * Clinical workflow E2E: nurse assessment -> doctor consultation -> prescription.
 *
 * Setup (clinic/staff/patient/queue-entry seeding) is done directly against the API
 * with fetch() — it is not the feature under test, and driving a full 9-step
 * onboarding UI plus a staff-invite UI per test would be slow and brittle. The
 * clinical workflow itself (the feature this file covers) is always driven through
 * the browser. Each test registers its own clinic, so tests are fully isolated and
 * safe to run in parallel.
 */

const API_BASE = 'http://localhost:4000/api/v1';
const PASSWORD = 'Password1A';

async function apiRequest<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return (json.data ?? json) as T;
}

let seedCounter = 0;

interface StaffSeed {
  ownerToken: string;
  branchId: string;
  nurseEmail: string;
  doctorEmail: string;
}

/** Registers a fresh clinic (owner) and invites one nurse + one doctor with a known password. */
async function seedClinicStaff(): Promise<StaffSeed> {
  seedCounter += 1;
  // Date.now()+seedCounter alone can collide across the several worker *processes*
  // Playwright runs in parallel (each has its own counter), so mix in a random
  // component too.
  const suffix = `${Date.now()}-${seedCounter}-${Math.random().toString(36).slice(2, 8)}`;

  const owner = await apiRequest<{ accessToken: string; user: { branchIds: string[] } }>(
    '/auth/register-owner',
    {
      method: 'POST',
      body: {
        name: 'Owner User',
        email: `owner-${suffix}@e2e.test`,
        password: PASSWORD,
        clinicName: `Clinical E2E Clinic ${suffix}`,
      },
    },
  );
  const ownerToken = owner.accessToken;
  const branchId = owner.user.branchIds[0]!;

  const nurseEmail = `nurse-${suffix}@e2e.test`;
  const doctorEmail = `doctor-${suffix}@e2e.test`;

  await apiRequest('/staff', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'Nina Nurse',
      email: nurseEmail,
      roleKey: 'nurse',
      branchIds: [branchId],
      temporaryPassword: PASSWORD,
    },
  });

  await apiRequest('/staff', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'Devika Doctor',
      email: doctorEmail,
      roleKey: 'doctor',
      branchIds: [branchId],
      temporaryPassword: PASSWORD,
    },
  });

  return { ownerToken, branchId, nurseEmail, doctorEmail };
}

// Matches QUEUE_TRANSITIONS in packages/types/src/state-machines.ts.
const QUEUE_CHAIN = ['checked_in', 'waiting_for_nurse', 'nurse_assessment', 'ready_for_doctor'] as const;
type ChainStatus = (typeof QUEUE_CHAIN)[number];

interface QueuedPatientSeed extends StaffSeed {
  patientName: string;
  patientId: string;
  queueEntryId: string;
  queueToken: string;
}

/** Seeds a clinic + staff + one patient checked into today's queue, advanced to `status`. */
async function seedQueuedPatient(status: ChainStatus): Promise<QueuedPatientSeed> {
  const staff = await seedClinicStaff();
  const patientName = `Ravi Kumar ${Date.now()}`;

  const patient = await apiRequest<{ id: string }>('/patients', {
    method: 'POST',
    token: staff.ownerToken,
    body: {
      fullName: patientName,
      gender: 'male',
      approximateAge: 34,
      reasonForVisit: 'Fever and cough',
    },
  });

  const queueEntry = await apiRequest<{ id: string; token: string }>('/queues', {
    method: 'POST',
    token: staff.ownerToken,
    body: { patientId: patient.id, source: 'walk_in', reasonForVisit: 'Fever and cough' },
  });

  const targetIndex = QUEUE_CHAIN.indexOf(status);
  for (let i = 1; i <= targetIndex; i++) {
    await apiRequest(`/queues/${queueEntry.id}/transition`, {
      method: 'PATCH',
      token: staff.ownerToken,
      body: { to: QUEUE_CHAIN[i] },
    });
  }

  return {
    ...staff,
    patientName,
    patientId: patient.id,
    queueEntryId: queueEntry.id,
    queueToken: queueEntry.token,
  };
}

async function loginAs(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Clinical workflow', () => {
  test('nurse assessment flows into doctor consultation and a finalized prescription', async ({ browser }) => {
    // Two full logins plus a long multi-section form flow across two actors is
    // inherently slower than the default 30s budget, especially against the dev
    // (unbundled) servers under parallel load.
    test.setTimeout(60_000);
    const seed = await seedQueuedPatient('waiting_for_nurse');

    // --- Nurse: assessment ---
    const nurseContext = await browser.newContext();
    const nursePage = await nurseContext.newPage();
    await loginAs(nursePage, seed.nurseEmail);

    await nursePage.goto('/clinical/nurse');
    await expect(nursePage.getByRole('heading', { name: 'Nurse Worklist' })).toBeVisible();
    await expect(nursePage.getByText(seed.patientName)).toBeVisible();
    await expect(nursePage.getByText(seed.queueToken)).toBeVisible();

    await nursePage.getByRole('button', { name: 'Start Assessment' }).click();
    await expect(nursePage).toHaveURL(new RegExp(`/clinical/nurse/${seed.queueEntryId}$`));
    await expect(nursePage.getByRole('heading', { name: seed.patientName, level: 1 })).toBeVisible();

    await nursePage.getByLabel('Chief complaint').fill('Persistent fever and dry cough for 3 days');

    const symptomInput = nursePage.getByRole('textbox', { name: 'Add to Symptoms' });
    await symptomInput.fill('Fever');
    await symptomInput.press('Enter');
    await symptomInput.fill('Dry cough');
    await symptomInput.press('Enter');
    await expect(nursePage.getByText('Fever', { exact: true })).toBeVisible();
    await expect(nursePage.getByText('Dry cough', { exact: true })).toBeVisible();

    await nursePage.getByRole('radio', { name: '4', exact: true }).click();
    await expect(nursePage.getByText('4/10 — Moderate')).toBeVisible();

    await nursePage.getByLabel('Temperature (°C)').fill('38.2');
    await nursePage.getByLabel('Pulse (bpm)').fill('92');

    await nursePage.getByRole('button', { name: 'Complete Assessment' }).click();
    // exact: true avoids the visually-hidden live-region announcement, which embeds
    // this same text inside a longer "Notification ..." string.
    await expect(nursePage.getByText('Assessment completed', { exact: true })).toBeVisible();
    await expect(nursePage).toHaveURL(/\/clinical\/nurse$/);
    // Assessment is done, so the patient leaves the nurse worklist (status is now
    // ready_for_doctor). The transition is a few sequential mutations plus a
    // worklist refetch, so give it more room than the default 5s.
    await expect(nursePage.getByText(seed.patientName)).toHaveCount(0, { timeout: 10_000 });

    // --- Doctor: consultation + prescription ---
    const doctorContext = await browser.newContext();
    const doctorPage = await doctorContext.newPage();
    await loginAs(doctorPage, seed.doctorEmail);

    await doctorPage.goto('/clinical/doctor');
    await expect(doctorPage.getByRole('heading', { name: 'Doctor Worklist' })).toBeVisible();
    await expect(doctorPage.getByText(seed.patientName)).toBeVisible();

    await doctorPage.getByRole('button', { name: 'Start Consultation' }).click();
    await expect(doctorPage).toHaveURL(new RegExp(`/clinical/doctor/${seed.queueEntryId}$`));
    await expect(doctorPage.getByRole('heading', { name: seed.patientName, level: 1 })).toBeVisible();

    // Nurse handoff is read-only on the doctor's screen.
    await expect(doctorPage.getByText('Persistent fever and dry cough for 3 days')).toBeVisible();

    const diagnosisInput = doctorPage.getByRole('textbox', { name: 'Add to Diagnosis' });
    await diagnosisInput.fill('Viral fever');
    await diagnosisInput.press('Enter');
    await doctorPage.getByLabel('Treatment plan').fill('Rest, fluids, and paracetamol as needed.');
    // The consultation form's date input has no defaultValue, so it submits as an
    // empty string rather than undefined; localDate.optional() only accepts
    // undefined, so an untouched follow-up date otherwise fails validation.
    await doctorPage.getByLabel('Follow-up date').fill('2026-08-01');

    await doctorPage.getByRole('button', { name: 'Complete Consultation' }).click();
    await expect(doctorPage.getByText('Consultation completed', { exact: true })).toBeVisible();
    await expect(doctorPage.getByRole('button', { name: 'Prescription' })).toBeVisible();

    await doctorPage.getByRole('button', { name: 'Prescription' }).click();
    const dialog = doctorPage.getByRole('dialog', { name: 'Prescription' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Medicine name').fill('Paracetamol');
    await dialog.getByLabel('Dose').fill('500mg');
    await dialog.getByLabel('Frequency').fill('Twice daily');
    // Duration (days) and Follow-up date are optional but must be filled anyway:
    // an untouched number input submits NaN (not undefined) via valueAsNumber, and
    // an untouched date input submits "" (not undefined), and both fail their
    // "optional" zod checks — silently, since neither Field is wired with an
    // `error` prop here, so nothing in the UI would explain a blocked save.
    await dialog.getByLabel('Duration (days)').fill('5');
    await dialog.getByLabel('Follow-up date').fill('2026-08-15');

    await dialog.getByRole('button', { name: 'Finalize' }).click();
    await expect(dialog.getByText('Finalized v1')).toBeVisible();

    await nurseContext.close();
    await doctorContext.close();
  });

  test('nurse cannot complete an assessment without a chief complaint', async ({ page }) => {
    const seed = await seedQueuedPatient('waiting_for_nurse');
    await loginAs(page, seed.nurseEmail);

    await page.goto(`/clinical/nurse/${seed.queueEntryId}`);
    await expect(page.getByRole('heading', { name: seed.patientName })).toBeVisible();

    // Leave the required "Chief complaint" field empty.
    await page.getByRole('button', { name: 'Complete Assessment' }).click();

    await expect(page.getByLabel('Chief complaint')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Required')).toBeVisible();
    // Still on the assessment page — the incomplete assessment was not accepted.
    await expect(page).toHaveURL(new RegExp(`/clinical/nurse/${seed.queueEntryId}$`));
  });

  test('a prescription cannot be saved without at least one medicine', async ({ page }) => {
    const seed = await seedQueuedPatient('ready_for_doctor');
    await loginAs(page, seed.doctorEmail);

    await page.goto('/clinical/doctor');
    await page.getByRole('button', { name: 'Start Consultation' }).click();
    await expect(page).toHaveURL(new RegExp(`/clinical/doctor/${seed.queueEntryId}$`));

    // Save a draft consultation just to obtain a consultationId, which is what makes
    // the "Prescription" button appear. A follow-up date is filled in because the
    // date input otherwise submits "" (not undefined), which fails localDate's
    // format check even though the field is meant to be optional.
    await page.getByLabel('Follow-up date').fill('2026-08-01');
    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.getByText('Draft saved', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Prescription' }).click();
    const dialog = page.getByRole('dialog', { name: 'Prescription' });
    await expect(dialog).toBeVisible();

    // The single default medicine row is blank — try to save it as-is.
    await dialog.getByRole('button', { name: 'Save Draft' }).click();

    await expect(dialog.getByLabel('Medicine name')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByLabel('Dose')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByLabel('Frequency')).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('Required').first()).toBeVisible();
    // Nothing was persisted — no draft/finalized status pill has appeared.
    await expect(dialog.getByText(/^(Draft|Finalized v\d+)$/)).toHaveCount(0);
  });

  test('nurse is denied access to the doctor consultation workspace', async ({ page }) => {
    const seed = await seedClinicStaff();
    await loginAs(page, seed.nurseEmail);

    // Nurses hold ASSESSMENT_CREATE but not CONSULTATION_CREATE (packages/types
    // DEFAULT_ROLE_PERMISSIONS), which the /clinical/doctor route requires.
    await page.goto('/clinical/doctor');

    await expect(page.getByText('Access restricted')).toBeVisible();
    await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
  });
});
