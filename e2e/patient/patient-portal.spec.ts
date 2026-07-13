import { test, expect } from '@playwright/test';

/**
 * Patient portal E2E (apps/patient-web, served at baseURL :5174, API at :4000).
 *
 * Backend quirk that shapes this whole file (apps/api/src/modules/auth/patient.service.ts
 * registerPatient): self-service patient sign-up has no clinic-selection step yet, so a
 * newly registered patient is always attached to the single/first *active* clinic in the
 * database (`ClinicModel.findOne({ isActive: true }).sort({ createdAt: 1 })`), never to
 * whichever clinic a test just created. That only lines up with "the clinic we just seeded"
 * when this is the very first clinic ever created against the target database. These tests
 * therefore assume they run against a clean/empty database (as CI normally provides for an
 * E2E job); against a long-lived dev DB with pre-existing clinics, the booking-flow tests
 * will fail because the branch/doctor seeded below won't belong to whatever clinic patients
 * actually resolve to. `describe.serial` + a single `beforeAll` also means every patient
 * registered anywhere in this file lands on the same seeded clinic.
 */

const API = 'http://localhost:4000/api/v1';
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Local (host clock) calendar date N days out — deliberately not UTC, to match date-fns'
 *  local-time `format(new Date(), 'yyyy-MM-dd')` used for the booking form's `min` date. */
function futureLocalDate(daysFromNow: number): { iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return {
    iso: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    label: `${MONTH_NAMES[m - 1]} ${day}, ${y}`,
  };
}

async function apiJson(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`API call failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body.data;
}

interface SeededClinic {
  branchName: string;
  doctorName: string;
}

/** Registers a fresh owner + clinic (register-owner auto-creates one branch), invites a
 * doctor into it, and gives that doctor a wide-open weekly schedule so the booking flow
 * always has slots available regardless of which date/weekday a test picks. */
async function seedClinicWithDoctor(): Promise<SeededClinic> {
  const suffix = uniqueSuffix();

  const ownerData = await apiJson(
    await fetch(`${API}/auth/register-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Owner',
        email: `owner-e2e-${suffix}@clinicos-test.dev`,
        password: 'Password123',
        clinicName: `E2E Clinic ${suffix}`,
      }),
    }),
  );
  const ownerToken: string = ownerData.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };

  const branches = await apiJson(
    await fetch(`${API}/branches`, { headers: authHeaders }),
  );
  const branch = branches[0];
  if (!branch) throw new Error('seed failed: register-owner did not create a branch');

  const doctorName = `Dr. E2E ${suffix}`;
  const staff = await apiJson(
    await fetch(`${API}/staff`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: doctorName,
        email: `doctor-e2e-${suffix}@clinicos-test.dev`,
        roleKey: 'doctor',
        branchIds: [branch.id],
      }),
    }),
  );

  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  await apiJson(
    await fetch(`${API}/schedules`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        doctorId: staff.id,
        branchId: branch.id,
        weekly: weekdays.map((day) => ({ day, sessions: [{ start: '07:00', end: '20:00' }] })),
        slotMinutes: 30,
        bufferMinutes: 5,
        maxPerWindow: 4,
        walkInCapacityPerDay: 50,
      }),
    }),
  );

  return { branchName: branch.name, doctorName };
}

async function registerPatientViaApi(email: string, password: string, name: string) {
  return apiJson(
    await fetch(`${API}/patient/auth/register-patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    }),
  );
}

test.describe.configure({ mode: 'serial' });
// Fix the browser's timezone to the clinic's default (Asia/Kolkata, ClinicModel.timezone)
// so the date/time the test types into the booking form round-trips through the backend's
// localDateTimeToUtc conversion and back into the appointments list without any host-machine
// timezone skew affecting the displayed date/time assertions below.
test.use({ timezoneId: 'Asia/Kolkata' });

let seeded: SeededClinic;

test.beforeAll(async () => {
  seeded = await seedClinicWithDoctor();
});

test.describe('Patient portal', () => {
  test('patient registers, books an appointment, and sees it in their appointments list', async ({ page }) => {
    const suffix = uniqueSuffix();
    const patientName = `Pat Patient ${suffix}`;
    const patientEmail = `patient-e2e-${suffix}@clinicos-test.dev`;

    await page.goto('/register');
    await page.getByLabel('Your name').fill(patientName);
    await page.getByLabel('Email').fill(patientEmail);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Good (morning|afternoon|evening), ${patientName.split(' ')[0]}`) }),
    ).toBeVisible();

    // Navigate to booking via the sidebar (exercises real in-app navigation).
    await page.getByRole('link', { name: 'Book Appointment' }).click();
    await expect(page).toHaveURL(/\/appointments\/new$/);

    await expect(page.getByLabel('Branch')).toBeEnabled();
    await page.getByLabel('Branch').selectOption({ label: seeded.branchName });
    await expect(page.getByLabel('Doctor')).toBeEnabled();
    await page.getByLabel('Doctor').selectOption({ label: seeded.doctorName });

    const { iso: bookingDate, label: bookingDateLabel } = futureLocalDate(3);
    const dateField = page.getByLabel('Preferred Date');
    await expect(dateField).toBeEnabled();
    await dateField.fill(bookingDate);

    await expect(page.getByText('Available Time Slots')).toBeVisible();
    const firstSlot = page.getByRole('button').filter({ hasText: /(AM|PM)/ }).first();
    await expect(firstSlot).toBeVisible();
    const slotTimeText = (await firstSlot.locator('span').first().innerText()).trim();
    await firstSlot.click();

    await page.getByRole('button', { name: 'Book Appointment' }).click();

    await expect(page.getByText('Appointment booked successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/appointments$/);

    // The freshly booked appointment shows up under the default "Upcoming" tab with its
    // real status and the exact date/time slot that was picked (doctorName is never
    // populated by the booking API, so the card falls back to its literal "Appointment"
    // heading — asserted as-is rather than guessed).
    await expect(page.getByRole('heading', { name: 'Appointment', exact: true })).toBeVisible();
    await expect(page.getByText('scheduled', { exact: true })).toBeVisible();
    await expect(page.getByText(bookingDateLabel)).toBeVisible();
    await expect(page.getByText(slotTimeText, { exact: true })).toBeVisible();
  });

  test('duplicate email registration shows an error', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `dup-e2e-${suffix}@clinicos-test.dev`;
    await registerPatientViaApi(email, 'Password123', 'Original Patient');

    await page.goto('/register');
    await page.getByLabel('Your name').fill('Second Patient');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByRole('alert')).toHaveText('An account with this email already exists.');
    // Registration must not have gone through — still on the register form.
    await expect(page).toHaveURL(/\/register$/);
  });

  test('booking is blocked until a doctor is selected', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `nodoctorbooking-e2e-${suffix}@clinicos-test.dev`;
    await registerPatientViaApi(email, 'Password123', 'No Doctor Patient');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/book-appointment');
    await page.getByLabel('Branch').selectOption({ label: seeded.branchName });

    // Doctor deliberately left unselected: the date field stays disabled and the submit
    // button stays disabled, so the form cannot be advanced or submitted without a doctor.
    await expect(page.getByLabel('Doctor')).toHaveValue('');
    await expect(page.getByLabel('Preferred Date')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Book Appointment' })).toBeDisabled();
  });

  test('logout redirects to /login', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `logout-e2e-${suffix}@clinicos-test.dev`;
    await registerPatientViaApi(email, 'Password123', 'Logout Patient');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'My Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByRole('button', { name: 'Sign Out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toBeVisible();
  });

  test('protected routes redirect to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toBeVisible();

    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
  });
});
