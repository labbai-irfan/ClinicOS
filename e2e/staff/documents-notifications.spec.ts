import path from 'path';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Documents + Notifications (spec §26/§27).
 *
 * Setup is API-seeded (register-owner -> invite a clinic_admin staff account -> quick-register
 * a patient), all via real HTTP calls against the running API, then the browser logs in as the
 * seeded clinic_admin — never the owner. This sidesteps the 9-step onboarding wizard on purpose:
 * RequireAuth (apps/web/src/components/RequireAuth.tsx) only forces a fresh clinic_owner to
 * /onboarding, so logging in as clinic_admin (who has document.read/upload/manage and
 * notification.read per DEFAULT_ROLE_PERMISSIONS in packages/types/src/permissions.ts) reaches
 * /documents and /notifications directly without onboarding ever being completed.
 *
 * Note on notifications coverage: nothing in the current backend (searched for every call site
 * of notification.service#notify()) actually creates a notification as a side effect of any
 * user-facing flow yet — notify() is only ever invoked from notification.test.ts. There is
 * therefore no black-box (browser/API) way to seed an unread notification for these tests to
 * mark as read. The notifications test below instead verifies the one real, verifiable
 * contract available: a fresh inbox and the header bell agree on "zero unread", and Mark All
 * Read's round trip (button -> POST /notifications/mark-all-read -> toast) works correctly even
 * with nothing to update.
 */

const API_URL = 'http://localhost:4000/api/v1';

interface StaffSession {
  email: string;
  password: string;
  patientId: string;
}

let seedCounter = 0;

async function seedStaffSession(request: APIRequestContext): Promise<StaffSession> {
  seedCounter += 1;
  // A random suffix (not just Date.now()+counter) avoids cross-spec-file email collisions
  // when multiple files' seed helpers happen to fire in the same millisecond under parallel workers.
  const stamp = `${Date.now()}-${seedCounter}-${Math.floor(Math.random() * 1_000_000)}`;
  const password = 'Password1';

  const registerRes = await request.post(`${API_URL}/auth/register-owner`, {
    data: {
      name: 'Owner User',
      email: `owner-${stamp}@e2e.test`,
      password,
      clinicName: `Docs Clinic ${stamp}`,
    },
  });
  expect(registerRes.ok(), await registerRes.text()).toBeTruthy();
  const registerBody = await registerRes.json();
  const ownerToken: string = registerBody.data.accessToken;
  const branchId: string = registerBody.data.user.activeBranchId;

  const email = `admin-${stamp}@e2e.test`;
  const staffRes = await request.post(`${API_URL}/staff`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: {
      name: 'Admin User',
      email,
      roleKey: 'clinic_admin',
      branchIds: [branchId],
      temporaryPassword: password,
    },
  });
  expect(staffRes.ok(), await staffRes.text()).toBeTruthy();

  const patientRes = await request.post(`${API_URL}/patients`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: {
      fullName: `Test Patient ${stamp}`,
      gender: 'female',
      approximateAge: 30,
      isTemporary: false,
    },
  });
  expect(patientRes.ok(), await patientRes.text()).toBeTruthy();
  const patientBody = await patientRes.json();

  return { email, password, patientId: patientBody.data.id };
}

async function loginAsStaff(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Documents', () => {
  test('uploads a document for a patient, it appears in the list, and the download link is wired correctly', async ({
    page,
    request,
  }) => {
    const { email, password, patientId } = await seedStaffSession(request);
    await loginAsStaff(page, email, password);

    await page.goto(`/documents?patientId=${patientId}`);
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(page.getByText('No documents yet')).toBeVisible();

    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Lab Report' }).click();
    await page.getByLabel('Title').fill('CBC Report');
    await page.getByLabel('File').setInputFiles(path.join(__dirname, 'fixtures', 'sample-report.pdf'));

    const [uploadResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/documents') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Upload' }).click(),
    ]);
    // Document storage (Cloudinary) is optional local/dev config (see root .env: "Leave
    // blank for local dev; document uploads return 503 'not configured'") and this exact
    // 503 is itself covered by a dedicated backend test (document.test.ts "rejects upload
    // with 503 when Cloudinary is not configured"). Skip gracefully here rather than fail
    // the whole suite over environment config this test doesn't control.
    if (uploadResponse.status() === 503) {
      test.skip(true, 'Document storage (Cloudinary) is not configured in this environment');
    }
    expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy();
    const uploaded = (await uploadResponse.json()).data;

    await expect(page.getByText('Document uploaded')).toBeVisible();
    await expect(page.getByText('CBC Report')).toBeVisible();
    await expect(page.getByText('Lab Report').first()).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();

    const downloadLink = page.getByRole('link', { name: 'Download' });
    await expect(downloadLink).toHaveAttribute(
      'href',
      `http://localhost:4000/api/v1/documents/${uploaded.id}/download`,
    );
  });

  test('rejects an oversized file client-side without ever calling the upload API', async ({ page, request }) => {
    const { email, password, patientId } = await seedStaffSession(request);
    await loginAsStaff(page, email, password);
    await page.goto(`/documents?patientId=${patientId}`);

    await page.getByLabel('Title').fill('Too Big');
    await page.getByLabel('File').setInputFiles({
      name: 'huge-scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(16 * 1024 * 1024), // DEFAULTS.MAX_UPLOAD_MB is 15
    });
    await expect(page.getByText('File exceeds the 15MB limit.')).toBeVisible();

    let uploadFired = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/documents') && req.method() === 'POST') uploadFired = true;
    });

    // The rejected file is never stored in form state, so submitting still blocks with its own error.
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('A file is required.')).toBeVisible();
    expect(uploadFired).toBe(false);
  });

  test('rejects an unsupported file type client-side with the allowed-types message', async ({
    page,
    request,
  }) => {
    const { email, password, patientId } = await seedStaffSession(request);
    await loginAsStaff(page, email, password);
    await page.goto(`/documents?patientId=${patientId}`);

    await page.getByLabel('File').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('plain text notes'),
    });

    await expect(page.getByText('Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.')).toBeVisible();
  });
});

test.describe('Notifications', () => {
  test('an empty inbox agrees with the header bell (no badge) and Mark All Read is a real no-op', async ({
    page,
    request,
  }) => {
    const { email, password } = await seedStaffSession(request);
    await loginAsStaff(page, email, password);

    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('No notifications yet')).toBeVisible();

    // Header.tsx only renders the red count badge when unreadCount is truthy — with zero
    // notifications its accessible name stays the plain "Notifications" (not "Notifications, N unread").
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();

    const [markAllResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/notifications/mark-all-read')),
      page.getByRole('button', { name: 'Mark All Read' }).click(),
    ]);
    expect(markAllResponse.ok(), await markAllResponse.text()).toBeTruthy();
    expect((await markAllResponse.json()).data.updated).toBe(0);
    // The toast text is rendered twice: once in the visible toast body, and once inside
    // an `aria-live="assertive"` status region that screen readers use (its text is the
    // toast title concatenated with the body with no separator, e.g. "Notification Inbox
    // updated0 notifications..."). Scope to the exact toast body to avoid the strict-mode
    // violation from matching both.
    await expect(page.getByText('0 notifications marked as read.', { exact: true })).toBeVisible();

    // Still agrees with the header after the round trip.
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  });
});
