import { test, expect, type Page } from '@playwright/test';

/**
 * Covers patient registration + the live queue entry point:
 * apps/web/src/features/patients/pages/{PatientDirectoryPage, PatientRegistrationPage,
 * PatientProfilePage}.tsx and apps/web/src/features/queue/pages/QueueBoardPage.tsx +
 * components/{AddWalkInDialog, QueueCard, CallPatientDialog, SkipDialog, RejoinDialog}.tsx.
 *
 * There are no data-testid attributes anywhere in this codebase, so every locator below
 * is a role/label/text locator matched against real rendered markup (Field renders a
 * <label htmlFor>, Radix Select renders a combobox/option pair, IconButton always sets
 * aria-label per components/ui/Tooltip.tsx).
 *
 * A brand-new clinic (unique email/clinic name) is registered per test via the real API,
 * then onboarding is fast-forwarded through the two onboarding endpoints
 * (PATCH .../onboarding-step, POST .../activate) instead of the 9-step wizard UI —
 * onboarding itself is covered by e2e/staff/auth-onboarding.spec.ts, not this file.
 * Login always happens through the real browser form so the app's actual session
 * bootstrap runs. The golden path drives registration through the UI; edge-case tests
 * seed a second patient via the API to stay fast, then verify behavior in the browser.
 *
 * FORMERLY A KNOWN APP BUG, now fixed: navigating to /queue used to crash the entire
 * route within ~1s of mount. `useQueueBoardQuery` (apps/web/src/features/queue/api.ts)
 * requests `view: 'board'` by default, but GET /queues?view=board
 * (apps/api/src/modules/queues/queue.controller.ts `list()`) replies with an object
 * keyed by board column (`{ waiting_for_nurse: [...], nurse_assessment: [...], ... }`),
 * never a flat array — that grouped shape is the deliberate, tested contract (see
 * queue.test.ts "groups active entries into board columns"), so the fix was on the
 * frontend: `useQueueBoardQuery` now flattens the grouped object into a plain
 * `QueueEntryDto[]` before handing it to `QueueBoardPage`, which already expected (and
 * still does) a flat array for its `doctorOptions`/`visibleEntries` memos.
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

async function apiGet(path: string, accessToken: string) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Registers a clinic owner and fast-forwards onboarding so the app shell is reachable. */
async function registerActivatedClinic(clinicName: string): Promise<SeededClinic> {
  const email = `${unique('patq-owner')}@example.com`;
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

/** Seeds a patient directly, for edge-case tests that don't exercise registration itself. */
async function seedPatient(
  clinic: SeededClinic,
  body: Record<string, unknown>,
): Promise<{ id: string; code: string; fullName: string }> {
  const json = await apiPost('/patients', body, clinic.accessToken);
  return json.data;
}

async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Fills the Gender combobox on the registration form. */
async function selectGender(page: Page, label: 'Male' | 'Female' | 'Other' | 'Unknown'): Promise<void> {
  await page.getByLabel('Gender').click();
  // Radix Select briefly renders a duplicate (measurement) copy of the popup content,
  // so scope to the first match rather than assume a single "Male"/"Female" node.
  await page.getByRole('option', { name: label, exact: true }).first().click();
}

test.describe('patient registration', () => {
  test('golden path: register a walk-in patient with no age and reach the queue entry point', async ({
    page,
  }) => {
    const clinic = await registerActivatedClinic(unique('Golden Patient Clinic'));
    await loginViaUi(page, clinic.email);

    // --- Register a walk-in with no age at all (front-desk quick registration) ---
    await page.goto('/patients');
    await expect(page.getByRole('heading', { level: 1, name: 'Patients' })).toBeVisible();
    await page.getByRole('button', { name: 'New Registration' }).click();
    await expect(page).toHaveURL(/\/patients\/new$/);
    await expect(page.getByRole('heading', { level: 1, name: 'New Registration' })).toBeVisible();

    await page.getByLabel('Full name').fill('Priya Walk-In');
    await selectGender(page, 'Female');
    // Marking the patient temporary/unidentified removes the DOB/age requirement
    // (quickRegisterPatientSchema's refine: dateOfBirth || approximateAge || isTemporary).
    await page.getByText('Temporary / unidentified patient (no name or age confirmed yet)').click();
    await page.getByRole('button', { name: 'Register patient' }).click();

    // --- Lands on the new patient's profile ---
    await expect(page).toHaveURL(/\/patients\/[a-f0-9]{24}$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Priya Walk-In' })).toBeVisible();
    await expect(page.getByText(/Patient code P-\d+/)).toBeVisible();
    await expect(page.getByText('Age unknown')).toBeVisible();

    // --- New patient also shows up in the directory search ---
    await page.goto('/patients');
    await page.getByLabel('Search patients by name, mobile, or code').fill('Priya');
    await expect(page.getByRole('cell', { name: 'Priya Walk-In' })).toBeVisible();

    // --- Entry point into the live queue: "Add to queue" carries the patient id ---
    await page.getByRole('cell', { name: 'Priya Walk-In' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Priya Walk-In' })).toBeVisible();
    const patientId = page.url().split('/patients/')[1];
    await page.getByRole('button', { name: 'Add to queue' }).click();
    // Confirms the navigation contract (the patient id is carried as a query param)
    // without depending on QueueBoardPage finishing its render — see the file-level
    // comment: that page currently crashes shortly after mount for any /queue visit,
    // independent of this navigation, so assertions here stop at the URL.
    await expect(page).toHaveURL(new RegExp(`/queue\\?patientId=${patientId}$`));
  });

  test('duplicate patient warning banner appears for a matching mobile number', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Duplicate Patient Clinic'));
    await seedPatient(clinic, {
      fullName: 'Existing Mobile Patient',
      gender: 'male',
      approximateAge: 40,
      mobile: '9876500001',
    });
    await loginViaUi(page, clinic.email);

    await page.goto('/patients/new');
    await page.getByLabel('Full name').fill('Totally Different Name');
    await selectGender(page, 'Male');
    await page.getByText('Temporary / unidentified patient (no name or age confirmed yet)').click();
    await page.getByLabel('Mobile').fill('9876500001');

    await expect(
      page.getByText('Possible existing patient — please check before continuing'),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: 'Existing Mobile Patient' })).toBeVisible();

    // Non-blocking: submission is still allowed with the warning showing.
    await page.getByRole('button', { name: 'Register patient' }).click();
    await expect(page).toHaveURL(/\/patients\/[a-f0-9]{24}$/, { timeout: 10_000 });
  });

  test('registration is rejected without gender or a date of birth/age', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Validation Patient Clinic'));
    await loginViaUi(page, clinic.email);

    await page.goto('/patients/new');
    await page.getByLabel('Full name').fill('Missing Fields Patient');
    // Gender and date of birth/age are both left blank; isTemporary is left unchecked.
    await page.getByRole('button', { name: 'Register patient' }).click();

    await expect(page.getByText('Required').first()).toBeVisible();
    // Still on the registration form — nothing was created.
    await expect(page).toHaveURL(/\/patients\/new$/);
  });

  test('directory search filters out non-matching patients and shows an empty state', async ({
    page,
  }) => {
    const clinic = await registerActivatedClinic(unique('Search Patient Clinic'));
    await seedPatient(clinic, { fullName: 'Alpha Searchable', gender: 'male', approximateAge: 30 });
    await seedPatient(clinic, { fullName: 'Beta Other', gender: 'female', approximateAge: 25 });
    await loginViaUi(page, clinic.email);

    await page.goto('/patients');
    await expect(page.getByRole('cell', { name: 'Alpha Searchable' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta Other' })).toBeVisible();

    await page.getByLabel('Search patients by name, mobile, or code').fill('Alpha');
    await expect(page.getByRole('cell', { name: 'Alpha Searchable' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta Other' })).toHaveCount(0);

    await page.getByLabel('Search patients by name, mobile, or code').fill('NoSuchPatientXyz');
    await expect(page.getByText('No patients match your search')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Try a different name, mobile number, or date of birth.')).toBeVisible();
  });
});

test.describe('live queue', () => {
  /**
   * FIXED — GET /queues?view=board returns entries grouped by board column
   * (Record<QueueBoardColumn, QueueEntryDto[]>), by design (queue.service.ts
   * `getBoard`, covered by its own backend test). useQueueBoardQuery
   * (apps/web/src/features/queue/api.ts) now flattens that object into a plain
   * QueueEntryDto[] so QueueBoardPage's memos can iterate it like any other view.
   */
  test('golden path: walk-in reaches the Kanban board and is called in', async ({
    page,
  }) => {
    const clinic = await registerActivatedClinic(unique('Queue Golden Clinic'));
    const patient = await seedPatient(clinic, {
      fullName: 'Kanban Walk-In',
      gender: 'male',
      isTemporary: true,
    });
    await loginViaUi(page, clinic.email);

    await page.goto('/queue');
    await page.getByRole('button', { name: 'Add Walk-In' }).click();
    await page.getByLabel('Patient ID').fill(patient.id);
    await page.getByRole('button', { name: 'Add to Queue' }).click();
    // The visible toast title and a visually-hidden aria-live announcer both render this
    // text (see components/ui/Toast.tsx) — .first() avoids a strict-mode violation, same
    // fix already applied in billing.spec.ts for the identical dual-render pattern.
    await expect(page.getByText(/Added to queue/).first()).toBeVisible();

    // A freshly added walk-in starts life as `checked_in`, which is outside the Kanban
    // board's columns and has no rendered action buttons (QueueCard.tsx's renderActions
    // switch has no case for it) — so there is no UI path to "Call Patient" without a
    // status transition first. `checked_in -> ready_for_doctor` is a valid direct jump
    // per QUEUE_TRANSITIONS (packages/types/src/state-machines.ts), so fast-forward it via
    // the API (mirroring how "skip then rejoin" below fast-forwards to waiting_for_nurse)
    // rather than driving the full nurse-assessment workflow, which clinical.spec.ts
    // already covers end to end.
    const listRes = await apiGet('/queues?view=list', clinic.accessToken);
    const entry = (listRes.data as Array<{ id: string; patientId: string; version: number }>).find(
      (e) => e.patientId === patient.id,
    );
    if (!entry) throw new Error('Seeded walk-in did not appear in the queue list');
    await apiPatch(`/queues/${entry.id}/transition`, { to: 'ready_for_doctor' }, clinic.accessToken);

    // Only one entry exists in this freshly-registered clinic, so the button is unique —
    // no need for a fragile "find the enclosing card" locator.
    await page.reload();
    await page.getByRole('button', { name: 'Call Patient' }).click();
    await page.getByRole('button', { name: 'Call Patient' }).click();
    await expect(page.getByText(/has been called/)).toBeVisible();
  });

  /**
   * FIXED, same as above — the Queue Board renders now that useQueueBoardQuery
   * flattens the grouped board response. SkipDialog (real Field: "Reason", required)
   * and RejoinDialog (real Field: "Rejoin policy" combobox + "Reason") are reachable
   * from QueueCard's "Skip" / "Rejoin" buttons once an entry is on a board column.
   */
  test('skip then rejoin', async ({ page }) => {
    const clinic = await registerActivatedClinic(unique('Queue Skip Rejoin Clinic'));
    const patient = await seedPatient(clinic, {
      fullName: 'Skip Rejoin Patient',
      gender: 'female',
      isTemporary: true,
    });
    const queueEntry = await apiPost(
      '/queues',
      { patientId: patient.id, source: 'walk_in' },
      clinic.accessToken,
    );
    // Move it onto a board column so Skip/Rejoin actions are actually offered.
    await apiPatch(`/queues/${queueEntry.data.id}/transition`, { to: 'waiting_for_nurse' }, clinic.accessToken);
    await loginViaUi(page, clinic.email);

    await page.goto('/queue');
    // Only one entry exists in this freshly-registered clinic, so each action button's
    // accessible name is unique on the page — no need for a fragile "find the enclosing
    // card via token text" locator (a generic `div` + `.last()` filter risks resolving to
    // an inner text-only wrapper instead of the card that actually contains the buttons).
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByLabel('Reason').fill('Stepped out to make a call');
    await page.getByRole('button', { name: 'Skip Patient' }).click();
    // Toast title and its visually-hidden aria-live announcer both render this text —
    // .first() avoids a strict-mode violation (same dual-render pattern already handled
    // elsewhere, e.g. billing.spec.ts and the "Added to queue" toast above).
    await expect(page.getByText(/was skipped/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Rejoin' }).click();
    await page.getByLabel('Reason').fill('Back and ready to be seen');
    await page.getByRole('button', { name: 'Rejoin Patient' }).click();
    await expect(page.getByText(/is back in the queue/).first()).toBeVisible();
  });
});
