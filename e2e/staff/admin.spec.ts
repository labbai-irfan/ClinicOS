import { test, expect, type Page } from '@playwright/test';

/**
 * Covers the Phase 2 M1 admin module: staff invitations, branches, doctor
 * schedules, and role permission management.
 *
 * Source of truth read before writing selectors:
 *  - apps/web/src/features/admin/pages/{StaffPage,RolesPage,SchedulesPage,ClinicSettingsPage}.tsx
 *  - apps/web/src/features/admin/components/{InviteStaffDialog,BranchEditDialog,WeeklyScheduleEditor,AddLeaveDialog}.tsx
 *  - apps/web/src/features/admin/labels.ts (ROLE_LABELS, WEEKDAY_LABELS)
 *  - apps/web/src/components/ui/{Field,Dialog,Select,Card,Button,Toast,EmptyState}.tsx
 *  - apps/web/src/components/shell/AppShell.tsx (the routed page renders inside a
 *    <main> landmark; the Toaster is a sibling of the router, portalled outside it)
 *  - apps/web/src/components/QueryBoundary.tsx (empty-state title/description wiring)
 *  - packages/types/src/permissions.ts (DEFAULT_ROLE_PERMISSIONS — clinic_owner
 *    holds ALL_PERMISSIONS; receptionist does NOT hold billing.refund)
 *  - packages/types/src/enums.ts (WEEKDAYS — monday is first, used to target the
 *    Monday "Add session" button deterministically)
 *  - packages/validation/src/{tenancy,staff,clinic,auth}.ts (schema error copy,
 *    registerOwnerSchema/onboardingStepSchema for the API seeding fixture below)
 *  - apps/api/src/modules/branches/branch.service.ts (the 409 "Cannot deactivate
 *    the last active branch" guard — NOTE: neither ClinicSettingsPage nor
 *    BranchEditDialog wires up any control that calls DELETE /branches/:id, so
 *    that edge case has no reachable UI path and is intentionally not covered
 *    here; see the task notes for detail)
 *  - apps/api/src/modules/staff/staff.service.ts (listStaff search/filter
 *    semantics, and that a temporary password is always generated server-side
 *    when the invite form omits one, which InviteStaffDialog.tsx always does)
 *  - e2e/staff/auth-onboarding.spec.ts (existing seeding/login conventions —
 *    that file already covers the 9-step onboarding wizard end-to-end, so admin
 *    tests seed an already-activated clinic via the API instead of re-driving it)
 *
 * There are no data-testid attributes anywhere in this codebase, so every locator
 * below is a role/label/text locator that matches real rendered markup.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

interface SeededClinic {
  email: string;
  password: string;
  accessToken: string;
  branchId: string;
}

/**
 * Registers a clinic owner and pushes the clinic straight to "activated" via the
 * same two API calls the onboarding wizard's final step performs (advance to
 * step 9, then activate) — see clinic.service.ts advanceOnboardingStep/
 * activateClinic. The 9-step wizard itself is already exercised end-to-end by
 * e2e/staff/auth-onboarding.spec.ts; re-driving all 9 UI steps in every admin
 * test here would only slow the suite down without adding admin-module coverage.
 */
async function seedActivatedClinic(prefix: string): Promise<SeededClinic> {
  const email = `${unique(prefix)}@example.com`;
  const password = 'Passw0rd1';

  const registerRes = await fetch(`${API_URL}/api/v1/auth/register-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Owner User', email, password, clinicName: unique('Clinic') }),
  });
  if (!registerRes.ok) {
    throw new Error(`register-owner failed: ${registerRes.status} ${await registerRes.text()}`);
  }
  const registerBody = await registerRes.json();
  const accessToken: string = registerBody.data.accessToken;
  const branchId: string = registerBody.data.user.branchIds[0];

  const stepRes = await fetch(`${API_URL}/api/v1/clinics/me/onboarding-step`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ step: 9 }),
  });
  if (!stepRes.ok) {
    throw new Error(`onboarding-step failed: ${stepRes.status} ${await stepRes.text()}`);
  }

  const activateRes = await fetch(`${API_URL}/api/v1/clinics/me/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!activateRes.ok) {
    throw new Error(`activate failed: ${activateRes.status} ${await activateRes.text()}`);
  }

  return { email, password, accessToken, branchId };
}

/** Seeds one staff member directly via the API — used only for list setup, never
 *  for the flow actually under test (invitation is always exercised through the UI). */
async function seedStaff(
  clinic: SeededClinic,
  input: { name: string; email: string; roleKey: string },
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinic.accessToken}` },
    body: JSON.stringify({ ...input, branchIds: [clinic.branchId] }),
  });
  if (!res.ok) {
    throw new Error(`seed staff failed: ${res.status} ${await res.text()}`);
  }
}

async function loginUI(page: Page, clinic: SeededClinic): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(clinic.email);
  await page.getByLabel('Password').fill(clinic.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * Locates toast text robustly. Radix Toast (components/ui/Toast.tsx) renders
 * each toast as an <li> inside a role="region" viewport, wrapping a title <div>
 * and (optionally) a description <div> — when there's no description the <li>'s
 * own text is identical to the title's, so a plain page-wide `getByText` can
 * resolve to more than one element. Radix also renders a second, visually-hidden
 * copy of the same text (a screen-reader announcer) in a separate portal outside
 * the region for about a second. Scoping to the region excludes that hidden
 * announcer, and `.first()` collapses the <li>/title duplicate to one element.
 */
function toast(page: Page, text: string | RegExp) {
  return page.getByRole('region').getByText(text).first();
}

test.describe('admin: staff, branches, schedules, roles', () => {
  test('golden path: invite a doctor, add a branch, set a weekly schedule, edit a role permission', async ({
    page,
  }) => {
    const clinic = await seedActivatedClinic('admin-golden');
    await loginUI(page, clinic);

    // ---- Invite staff (StaffPage + InviteStaffDialog) ----
    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { level: 1, name: 'Staff' })).toBeVisible();

    await page.getByRole('button', { name: 'Invite Staff' }).click();
    const inviteDialog = page.getByRole('dialog');
    await expect(inviteDialog).toBeVisible();
    await expect(inviteDialog.getByText('Invite staff', { exact: true })).toBeVisible();

    const doctorName = 'Dr. Asha Mehta';
    const doctorEmail = `${unique('asha')}@example.com`;
    // Scoped to the dialog: StaffPage's own search box is labelled "Search staff
    // by name or email", whose accessible name also contains the substring
    // "email" and would otherwise ambiguously match a page-wide getByLabel('Email').
    await inviteDialog.getByLabel('Full name').fill(doctorName);
    await inviteDialog.getByLabel('Email').fill(doctorEmail);
    await page.locator('#invite-role').click();
    await page.getByRole('option', { name: 'Doctor' }).click();
    await inviteDialog.getByLabel('Main Branch').check();
    await inviteDialog.getByLabel('Specialization').fill('Cardiology');
    await inviteDialog.getByLabel('Consultation fee (₹)').fill('500');
    await page.getByRole('button', { name: 'Send invitation' }).click();

    // Recent fix: the server always generates a one-time password when the
    // invite form doesn't send one (InviteStaffDialog omits `temporaryPassword`
    // from its schema), and the dialog surfaces it in the success toast.
    await expect(toast(page, 'Invitation created')).toBeVisible();
    await expect(toast(page, /temporary password is:/)).toBeVisible();

    const staffRow = page.locator('tr', { hasText: doctorName });
    await expect(staffRow).toBeVisible();
    await expect(staffRow).toContainText('Doctor');
    await expect(staffRow).toContainText('Main Branch');
    await expect(staffRow).toContainText('Active');
    await expect(staffRow).toContainText('Consult ₹500.00');

    // ---- Create a branch (ClinicSettingsPage + BranchEditDialog) ----
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Clinic Settings' })).toBeVisible();

    const branchName = unique('Downtown Branch');
    await page.getByRole('button', { name: 'Add branch' }).click();
    const branchDialog = page.getByRole('dialog');
    await expect(branchDialog).toBeVisible();
    await expect(branchDialog.getByText('Add branch', { exact: true })).toBeVisible();
    await branchDialog.getByLabel('Branch name').fill(branchName);
    // Scoped to the dialog — "City" is also a substring of the Appointment &
    // queue rules section's "Walk-in capacity per day" label further down this
    // same settings page, which would otherwise ambiguously match.
    await branchDialog.getByLabel('City').fill('Pune');
    await page.getByRole('button', { name: 'Create branch' }).click();

    await expect(toast(page, 'Branch created')).toBeVisible();
    // Scoped to <main> (the routed page content) so the still-visible toast,
    // which repeats the branch name in its description, isn't also matched.
    await expect(page.locator('main').getByText(branchName, { exact: true })).toBeVisible();

    // ---- Set a weekly schedule for the doctor just invited (SchedulesPage) ----
    await page.goto('/admin/schedules');
    await expect(page.getByRole('heading', { level: 1, name: 'Doctor Schedules' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekly sessions' })).toBeVisible();

    // WEEKDAYS = [monday, tuesday, ...] (packages/types/src/enums.ts) and
    // WeeklyScheduleEditor renders one "Add session" button per day in that
    // order, so the first button in the DOM belongs to Monday.
    await page.getByRole('button', { name: 'Add session' }).first().click();
    await expect(page.getByLabel('Monday session 1 start')).toHaveValue('09:00');
    await expect(page.getByLabel('Monday session 1 end')).toHaveValue('13:00');

    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(toast(page, 'Schedule saved')).toBeVisible();

    // ---- Edit a role permission and save with a reason (RolesPage) ----
    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles & Permissions' })).toBeVisible();

    const billingRefundForReceptionist = page.getByRole('checkbox', {
      name: 'billing.refund for Receptionist',
    });
    await expect(billingRefundForReceptionist).not.toBeChecked();
    await billingRefundForReceptionist.check();

    await page.getByLabel('Reason for this change').fill('Approved by clinic owner to allow billing refunds');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(toast(page, 'Permissions updated')).toBeVisible();
    await expect(toast(page, 'Receptionist permissions saved.')).toBeVisible();
    await expect(billingRefundForReceptionist).toBeChecked();
    // The per-role save bar disappears once the draft matches what was persisted.
    await expect(page.getByText('All roles match their saved permissions.')).toBeVisible();
  });

  test('clinic owner permission checkboxes that are already granted cannot be unchecked', async ({
    page,
  }) => {
    const clinic = await seedActivatedClinic('admin-owner-lock');
    await loginUI(page, clinic);

    await page.goto('/admin/roles');
    await expect(page.getByRole('heading', { level: 1, name: 'Roles & Permissions' })).toBeVisible();

    // Clinic owner holds ALL_PERMISSIONS by default (packages/types/src/permissions.ts).
    // RolesPage.tsx locks every box that is currently checked for the clinic_owner
    // column specifically so that role's permission set can never drop below full —
    // matching the 409 the backend would otherwise return.
    const ownerStaffManage = page.getByRole('checkbox', { name: 'staff.manage for Clinic owner' });
    await expect(ownerStaffManage).toBeChecked();
    await expect(ownerStaffManage).toBeDisabled();

    // The same permission on a non-owner role stays fully interactive — the lock
    // is specific to the clinic_owner column, not the permission row.
    const receptionistStaffManage = page.getByRole('checkbox', { name: 'staff.manage for Receptionist' });
    await expect(receptionistStaffManage).not.toBeChecked();
    await expect(receptionistStaffManage).toBeEnabled();
  });

  test('staff list search and role filter narrow the list, and clearing them restores it', async ({
    page,
  }) => {
    const clinic = await seedActivatedClinic('admin-search');
    await seedStaff(clinic, { name: 'Zoya Kader', email: `${unique('zoya')}@example.com`, roleKey: 'nurse' });
    await seedStaff(clinic, {
      name: 'Milan Fernandes',
      email: `${unique('milan')}@example.com`,
      roleKey: 'receptionist',
    });
    await loginUI(page, clinic);

    await page.goto('/admin/staff');
    await expect(page.locator('tr', { hasText: 'Zoya Kader' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Milan Fernandes' })).toBeVisible();

    // Search narrows to a case-insensitive name/email substring match
    // (staff.service.ts listStaff).
    await page.getByLabel('Search staff by name or email').fill('Zoya');
    await expect(page.locator('tr', { hasText: 'Zoya Kader' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Milan Fernandes' })).toHaveCount(0);

    // Clearing filters restores the full list.
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByLabel('Search staff by name or email')).toHaveValue('');
    await expect(page.locator('tr', { hasText: 'Milan Fernandes' })).toBeVisible();

    // The role filter narrows independently of search.
    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'Receptionist' }).click();
    await expect(page.locator('tr', { hasText: 'Milan Fernandes' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Zoya Kader' })).toHaveCount(0);

    // A filter combination with no matches shows the named empty state, not a
    // blank table (QueryBoundary emptyTitle/emptyDescription in StaffPage.tsx).
    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'All roles' }).click();
    await page.getByLabel('Search staff by name or email').fill('no-such-staff-member-xyz');
    await expect(page.getByText('No staff match your filters')).toBeVisible();
    await expect(page.getByText('Try a different name, role, branch, or status.')).toBeVisible();
  });

  test('inviting staff without selecting a branch shows a validation error and does not submit', async ({
    page,
  }) => {
    const clinic = await seedActivatedClinic('admin-invite-invalid');
    await loginUI(page, clinic);

    await page.goto('/admin/staff');
    await page.getByRole('button', { name: 'Invite Staff' }).click();
    const inviteDialog = page.getByRole('dialog');
    await expect(inviteDialog).toBeVisible();

    // Scoped to the dialog — see the golden-path test for why a page-wide
    // getByLabel('Email') is ambiguous with StaffPage's own search box.
    await inviteDialog.getByLabel('Full name').fill('No Branch Person');
    await inviteDialog.getByLabel('Email').fill(`${unique('nobranch')}@example.com`);
    // Role is left at its default (Receptionist); no branch checkbox is checked,
    // which fails inviteStaffSchema's `branchIds: z.array(objectId).min(1, ...)`.
    await page.getByRole('button', { name: 'Send invitation' }).click();

    await expect(page.getByRole('alert')).toHaveText('Assign at least one branch');
    // Client-side validation blocked the submit entirely: the dialog is still
    // open, no invite toast appeared, and the staff table never gained a row.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Invitation created')).toHaveCount(0);
    await expect(page.getByText('No Branch Person')).toHaveCount(0);
  });
});
