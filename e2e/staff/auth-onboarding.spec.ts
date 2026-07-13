import { test, expect } from '@playwright/test';

/**
 * Covers staff registration, the 9-step onboarding wizard, and login.
 *
 * Source of truth read before writing selectors:
 *  - apps/web/src/features/auth/pages/{RegisterPage,LoginPage}.tsx
 *  - apps/web/src/features/onboarding/pages/OnboardingPage.tsx
 *  - apps/web/src/features/onboarding/components/steps/*.tsx
 *  - apps/web/src/features/onboarding/components/StepFooter.tsx
 *  - packages/validation/src/auth.ts (registerOwnerSchema, loginSchema, passwordSchema)
 *  - apps/api/src/modules/auth/auth.service.ts (exact server error copy)
 *
 * There are no data-testid attributes anywhere in this codebase, so every locator
 * below is a role/label locator that matches real rendered markup (Field renders a
 * <label htmlFor>, StepFooter/Button render accessible button names, server errors
 * render as `<p role="alert">`).
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Seeds a clinic-owner account directly against the running API. Used only for the
 * edge-case tests below that need a *pre-existing* account (duplicate email, wrong
 * password) — the golden path test always creates its account through the real
 * browser registration form.
 */
async function seedOwner(email: string, password = 'Passw0rd1'): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/register-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Seeded Owner',
      email,
      password,
      clinicName: unique('Seeded Clinic'),
    }),
  });
  if (!res.ok) {
    throw new Error(`seedOwner failed with ${res.status}: ${await res.text()}`);
  }
}

test.describe('staff registration + onboarding wizard', () => {
  test('golden path: register a clinic, complete all 9 onboarding steps, land on dashboard', async ({
    page,
  }) => {
    const email = `${unique('owner')}@example.com`;
    const clinicName = unique('Sunrise Clinic');
    const ownerName = 'Priya Sharma';

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Register your clinic' })).toBeVisible();
    await page.getByLabel('Your name').fill(ownerName);
    await page.getByLabel('Clinic name').fill(clinicName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Passw0rd1');
    await page.getByRole('button', { name: 'Create clinic account' }).click();

    // Registration redirects straight into onboarding (RequireAuth exempts /onboarding).
    await expect(page).toHaveURL(/\/onboarding$/);

    // Step 1 — Clinic identity: pre-filled from the org just created; just continue.
    await expect(page.getByRole('heading', { level: 3, name: 'Clinic identity' })).toBeVisible();
    await expect(page.getByText('Step 1 of 9')).toBeVisible();
    await expect(page.getByLabel('Clinic name')).toHaveValue(clinicName);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 — Address & contact: branch name is the only required field.
    await expect(page.getByRole('heading', { level: 3, name: 'Address & contact' })).toBeVisible();
    await page.getByLabel('Branch name').fill('Main Branch');
    await page.getByLabel('City').fill('Mumbai');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 — Working hours: defaults (Mon-Sat 09:00-18:00, Sun closed) are valid as-is.
    await expect(page.getByRole('heading', { level: 3, name: 'Working days & hours' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4 — Add doctors: optional, skip without inviting anyone.
    await expect(page.getByRole('heading', { level: 3, name: 'Add doctors' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 5 — Consultation fees: default fee of 500 is pre-filled and valid.
    await expect(page.getByRole('heading', { level: 3, name: 'Consultation fees' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 6 — Appointment & queue rules: defaults are valid.
    await expect(
      page.getByRole('heading', { level: 3, name: 'Appointment & queue rules' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 7 — Prescription branding: optional header/footer, skip.
    await expect(page.getByRole('heading', { level: 3, name: 'Prescription branding' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 8 — Invite staff: optional, skip without inviting anyone.
    await expect(page.getByRole('heading', { level: 3, name: 'Invite staff' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 9 — Review & activate: summary reflects what was entered, then activate.
    await expect(page.getByRole('heading', { level: 3, name: 'Review & activate' })).toBeVisible();
    await expect(page.getByText('Step 9 of 9')).toBeVisible();
    await expect(page.getByText(clinicName, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Activate clinic' }).click();

    // Activation flips onboardingComplete in the session and routes to /dashboard.
    await expect(page).toHaveURL(/\/dashboard$/);
    const firstName = ownerName.split(' ')[0];
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: new RegExp(`^Good (morning|afternoon|evening|night), ${firstName}`),
      }),
    ).toBeVisible();
  });

  test('registering with an email that already exists shows a server error', async ({ page }) => {
    const email = `${unique('dupe')}@example.com`;
    await seedOwner(email);

    await page.goto('/register');
    await page.getByLabel('Your name').fill('Second Owner');
    await page.getByLabel('Clinic name').fill(unique('Another Clinic'));
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Passw0rd1');
    await page.getByRole('button', { name: 'Create clinic account' }).click();

    await expect(page.getByRole('alert')).toHaveText('An account with this email already exists.');
    // Registration must not have succeeded — still on /register, not redirected.
    await expect(page).toHaveURL(/\/register$/);
  });

  test('a password missing an uppercase letter is rejected before the request is sent', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByLabel('Your name').fill('Weak Password Owner');
    await page.getByLabel('Clinic name').fill(unique('Weak Pw Clinic'));
    await page.getByLabel('Email').fill(`${unique('weak')}@example.com`);
    // 8+ chars, has a lowercase letter and a digit, but no uppercase letter.
    await page.getByLabel('Password').fill('weakpw12');
    await page.getByRole('button', { name: 'Create clinic account' }).click();

    await expect(page.getByText('Include an uppercase letter')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('logging in with the wrong password shows an error and does not sign in', async ({ page }) => {
    const email = `${unique('login')}@example.com`;
    await seedOwner(email, 'Passw0rd1');

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });
});
