import { test, expect } from '@playwright/test';

/**
 * Public waiting-room display (spec §17): apps/web/src/features/display/pages/WaitingRoomDisplayPage.tsx,
 * mounted at /display/:branchId outside the app shell with no RequireAuth wrapper
 * (apps/web/src/router.tsx). The page is fed exclusively by the privacy-safe
 * `display:state` socket payload built in apps/api/src/modules/queues/queue.service.ts
 * (buildDisplayState), which selects only `token` and `doctorId` — never patient
 * name, mobile, or clinical fields. These tests seed real clinic/patient/queue data
 * through the API (the browser under test never authenticates) and assert both that
 * the screen renders live queue tokens AND that none of the seeded PII ever reaches
 * the DOM.
 */

const API = 'http://localhost:4000/api/v1';

interface RegisteredClinic {
  accessToken: string;
  branchId: string;
}

/** Seeds a brand-new organization/clinic/branch via the real registration endpoint. */
async function registerClinic(clinicName: string): Promise<RegisteredClinic> {
  const email = `display-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const res = await fetch(`${API}/auth/register-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Display Test Owner',
      email,
      password: 'Password1',
      clinicName,
    }),
  });
  if (!res.ok) throw new Error(`register-owner failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    accessToken: json.data.accessToken as string,
    branchId: json.data.user.activeBranchId as string,
  };
}

/**
 * Registers a patient and checks them into today's live queue (source defaults to
 * `walk_in`, which is auto-checked-in — see AUTO_CHECKED_IN_SOURCES in
 * apps/api/src/modules/queues/queue.service.ts), returning the minted token.
 * Adding to the queue also broadcasts the fresh DisplayState to the display socket.
 */
async function checkInPatient(
  accessToken: string,
  patient: { fullName: string; mobile: string; reasonForVisit: string },
): Promise<string> {
  const patientRes = await fetch(`${API}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      fullName: patient.fullName,
      gender: 'female',
      approximateAge: 34,
      mobile: patient.mobile,
      reasonForVisit: patient.reasonForVisit,
      isTemporary: false,
    }),
  });
  if (!patientRes.ok) throw new Error(`patient create failed: ${patientRes.status} ${await patientRes.text()}`);
  const patientJson = await patientRes.json();

  const queueRes = await fetch(`${API}/queues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ patientId: patientJson.data.id, reasonForVisit: patient.reasonForVisit }),
  });
  if (!queueRes.ok) throw new Error(`add to queue failed: ${queueRes.status} ${await queueRes.text()}`);
  const queueJson = await queueRes.json();
  return queueJson.data.token as string;
}

test.describe('waiting-room display', () => {
  test('renders live queue tokens with no login, and never exposes patient PII', async ({ page }) => {
    const { accessToken, branchId } = await registerClinic('Golden Display Clinic');
    const fullName = 'Zephyrine Okonkwo-Iyer';
    const mobile = '+919876543210';
    const reasonForVisit = 'Severe chest pain and shortness of breath';

    await page.goto(`/display/${branchId}`);

    // Public route: no redirect to the staff login screen.
    await expect(page).toHaveURL(new RegExp(`/display/${branchId}$`));
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toHaveCount(0);
    await expect(page.getByText('Waiting Room', { exact: true })).toBeVisible();

    // Display sockets only receive broadcasts made *after* they join the branch's
    // display room (apps/api/src/realtime/socket.ts has no "send current state on
    // join" step), so wait for this socket to finish connecting before seeding the
    // queue entry — otherwise the broadcast would be missed entirely.
    await expect(page.getByText('Reconnecting…')).toHaveCount(0);

    const token = await checkInPatient(accessToken, { fullName, mobile, reasonForVisit });

    await expect(page.getByRole('heading', { name: 'Now Consulting' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Next', exact: true })).toBeVisible();

    // Socket delivers the seeded entry's token into the "Next" list.
    await expect(page.getByText(token, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Nobody has been called into consultation yet, so the placeholder shows —
    // never the patient's name.
    await expect(
      page.getByText('Please wait — your token will appear here when called'),
    ).toBeVisible();

    // Privacy-critical (spec §17): name, mobile and clinical reason must never render.
    await expect(page.getByText(fullName)).toHaveCount(0);
    await expect(page.getByText(mobile)).toHaveCount(0);
    await expect(page.getByText(reasonForVisit)).toHaveCount(0);
  });

  test('shows the connecting placeholder and no data when a branch has no queue activity', async ({ page }) => {
    const { branchId } = await registerClinic('Empty Display Clinic');

    await page.goto(`/display/${branchId}`);

    await expect(page.getByText('Waiting Room', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toHaveCount(0);

    // No queue entry was ever created for this branch, so buildDisplayState is never
    // broadcast and the page is stuck on its pre-data placeholder — not an error page.
    await expect(
      page.getByText('Connecting to the waiting room display…'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Now Consulting' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Next', exact: true })).toHaveCount(0);
  });

  test('degrades gracefully for a malformed branch id without requiring login', async ({ page }) => {
    // Not a 24-char hex id, so the server's display socket handler
    // (Types.ObjectId.isValid check in apps/api/src/realtime/socket.ts) refuses to
    // join it to any display room and disconnects it.
    await page.goto('/display/not-a-real-branch-id');

    await expect(page.getByText('Waiting Room', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to ClinicOS' })).toHaveCount(0);

    // The page never crashes or shows a login/error redirect; it just never
    // receives display state and the reconnecting indicator appears.
    await expect(page.getByText('Reconnecting…')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Connecting to the waiting room display…'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Now Consulting' })).toHaveCount(0);
  });
});
