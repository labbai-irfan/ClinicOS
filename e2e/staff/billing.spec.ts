import { test, expect, type Page } from '@playwright/test';

/**
 * Billing E2E coverage.
 *
 * Setup (clinic registration, onboarding fast-forward, patient/invoice/payment
 * seeding) goes straight to the API with `fetch` — it is not the behaviour under
 * test and driving all nine onboarding-wizard steps through the UI for every
 * test would make the suite far too slow. Every test still logs in and performs
 * the behaviour under test (creating invoices, recording payments, refunding,
 * reading the daily closing report) entirely through the browser.
 */

const API_BASE = 'http://localhost:4000/api/v1';

async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.data as T;
}

function uniqueStamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface OwnerSession {
  token: string;
  email: string;
  password: string;
  branchId: string;
}

/** Registers a fresh clinic + owner, then fast-forwards the 9-step onboarding
 *  wizard via the same endpoints it calls, so the owner lands directly on the
 *  dashboard instead of being redirected into the wizard on first login. */
async function registerClinicOwner(label: string): Promise<OwnerSession> {
  const stamp = uniqueStamp();
  const email = `owner-${label}-${stamp}@e2e.clinicos.test`;
  const password = 'Password123';

  const registered = await api<{ user: { branchIds: string[] }; accessToken: string }>(
    'POST',
    '/auth/register-owner',
    { name: 'Billing Owner', email, password, clinicName: `Billing E2E ${stamp}` },
  );
  const token = registered.accessToken;
  const branchId = registered.user.branchIds[0];

  await api('PATCH', '/clinics/me/onboarding-step', { step: 9 }, token);
  await api('POST', '/clinics/me/activate', {}, token);

  return { token, email, password, branchId };
}

async function seedPatient(token: string, label: string): Promise<string> {
  const patient = await api<{ id: string }>(
    'POST',
    '/patients',
    {
      fullName: `E2E Patient ${label}`,
      gender: 'female',
      dateOfBirth: '1990-05-15',
    },
    token,
  );
  return patient.id;
}

/** Invites a receptionist (BILLING_CREATE + BILLING_READ, but no BILLING_DISCOUNT
 *  or BILLING_REFUND — see DEFAULT_ROLE_PERMISSIONS in packages/types) with a
 *  known password so the test can log in as them through the UI. */
async function inviteReceptionist(owner: OwnerSession, label: string): Promise<{ email: string; password: string }> {
  const stamp = uniqueStamp();
  const email = `reception-${label}-${stamp}@e2e.clinicos.test`;
  const password = 'ReceptionPass1';
  await api(
    'POST',
    '/staff',
    {
      name: 'Reception Staff',
      email,
      roleKey: 'receptionist',
      branchIds: [owner.branchId],
      temporaryPassword: password,
    },
    owner.token,
  );
  return { email, password };
}

async function seedInvoice(owner: OwnerSession, patientId: string, unitPricePaise: number): Promise<{ id: string }> {
  return api(
    'POST',
    '/billing/invoices',
    {
      patientId,
      items: [{ description: 'Consultation fee', type: 'consultation', quantity: 1, unitPricePaise }],
      finalize: true,
    },
    owner.token,
  );
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('Billing', () => {
  test('creating a multi-item invoice, recording full payment, and seeing it in daily closing', async ({
    page,
  }) => {
    const owner = await registerClinicOwner('golden');
    const patientId = await seedPatient(owner.token, 'golden');

    await loginViaUi(page, owner.email, owner.password);

    await page.getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL(/\/billing$/);

    await page.getByRole('button', { name: 'New Invoice' }).click();
    const newInvoiceDialog = page.getByRole('dialog');
    await expect(newInvoiceDialog.getByRole('heading', { name: 'New invoice' })).toBeVisible();

    await newInvoiceDialog.getByLabel('Patient ID').fill(patientId);

    // Line item 1: consultation, qty 1 @ ₹700 (defaults: type=consultation, qty=1)
    await newInvoiceDialog.getByLabel('Description').fill('Consultation fee');
    await newInvoiceDialog.getByLabel('Unit price (₹)').fill('700');

    // Line item 2: dressing, qty 1 @ ₹300
    await newInvoiceDialog.getByRole('button', { name: 'Add item' }).click();
    await newInvoiceDialog.getByLabel('Description').last().fill('Dressing charge');
    await newInvoiceDialog.getByLabel('Type').last().click();
    await page.getByRole('option', { name: 'Dressing' }).click();
    await newInvoiceDialog.getByLabel('Unit price (₹)').last().fill('300');

    // Subtotal = 700 + 300 = 1000, no discount -> total ₹1,000.00
    await expect(newInvoiceDialog.getByText('₹1,000.00').first()).toBeVisible();

    await newInvoiceDialog.getByRole('button', { name: 'Create invoice' }).click();

    await expect(page.getByText('Invoice created').first()).toBeVisible();
    await expect(page).toHaveURL(/\/billing\/[a-f0-9]{24}$/);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(/^INV-\d{4}-\d{6}$/);
    const invoiceNumber = (await heading.textContent())!.trim();

    // Both line items are listed with their own amounts.
    await expect(page.getByRole('cell', { name: 'Consultation fee' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Dressing charge' })).toBeVisible();

    const itemsCard = page.getByRole('heading', { name: 'Items', level: 2 }).locator('..');
    await expect(itemsCard.getByText('Unpaid', { exact: true })).toBeVisible();

    const summaryCard = page.getByRole('heading', { name: 'Summary', level: 2 }).locator('..');
    await expect(summaryCard.getByText('Amount due')).toBeVisible();
    await expect(
      summaryCard.getByText('Amount due', { exact: true }).locator('xpath=following-sibling::span[1]'),
    ).toHaveText('₹1,000.00');

    await page.getByRole('button', { name: 'Record payment' }).click();
    const paymentDialog = page.getByRole('dialog');
    await expect(paymentDialog.getByRole('heading', { name: 'Record payment' })).toBeVisible();
    await expect(paymentDialog.getByText('Amount due: ₹1,000.00')).toBeVisible();
    // Pre-filled with the full due amount — submit as-is for a full payment.
    await paymentDialog.getByRole('button', { name: 'Record payment' }).click();

    await expect(page.getByText(`Invoice ${invoiceNumber} is now paid.`).first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(itemsCard.getByText('Paid', { exact: true })).toBeVisible();
    await expect(
      summaryCard.getByText('Amount due', { exact: true }).locator('xpath=following-sibling::span[1]'),
    ).toHaveText('₹0.00');
    await expect(
      summaryCard.getByText('Paid', { exact: true }).locator('xpath=following-sibling::span[1]'),
    ).toHaveText('₹1,000.00');

    const paymentRow = page.getByRole('row', { name: /RCPT-\d{4}-\d{6}/ });
    await expect(paymentRow.getByText('Cash')).toBeVisible();
    await expect(paymentRow.getByText('₹1,000.00')).toBeVisible();

    // Daily closing picks up the payment for today.
    await page.getByRole('link', { name: 'Daily Closing' }).click();
    await expect(page).toHaveURL(/\/billing\/daily-closing$/);

    // Scoped to <main> because the sidebar also has an "Invoices" nav link, and
    // "Payments"/"Invoices" separately repeat as table column headers below.
    const main = page.getByRole('main');
    const totalCollectedValue = main
      .getByText('Total collected', { exact: true })
      .locator('xpath=following-sibling::p[1]');
    await expect(totalCollectedValue).toHaveText('₹1,000.00');
    const paymentsTileValue = main
      .getByText('Payments', { exact: true })
      .first()
      .locator('xpath=following-sibling::p[1]');
    await expect(paymentsTileValue).toHaveText('1');
    const invoicesTileValue = main
      .getByText('Invoices', { exact: true })
      .first()
      .locator('xpath=following-sibling::p[1]');
    await expect(invoicesTileValue).toHaveText('1');

    const closingRow = page.getByRole('row', { name: /Cash/ });
    await expect(closingRow.getByText('₹1,000.00')).toBeVisible();
  });

  test('discount and refund controls are hidden from a receptionist lacking those permissions', async ({
    page,
  }) => {
    const owner = await registerClinicOwner('discount');
    const patientId = await seedPatient(owner.token, 'discount');
    // A fully-paid invoice with a real payment on it — a user with billing.refund
    // would see a "Refund payment" control here. Seeded via the owner so the
    // receptionist-side assertion below proves the control is gated, not just
    // absent because nothing exists to refund.
    const paidInvoice = await seedInvoice(owner, patientId, 60_000);
    await api(
      'POST',
      `/billing/invoices/${paidInvoice.id}/payments`,
      { payments: [{ method: 'cash', amountPaise: 60_000 }] },
      owner.token,
    );
    const reception = await inviteReceptionist(owner, 'discount');

    await loginViaUi(page, reception.email, reception.password);

    await page.goto('/billing');
    await page.getByRole('button', { name: 'New Invoice' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'New invoice' })).toBeVisible();

    // A receptionist has billing.create but not billing.discount — the whole
    // discount section (NewInvoiceDialog's `canDiscount` gate) must not render.
    await expect(dialog.getByLabel('Discount (₹)')).toHaveCount(0);
    await expect(dialog.getByLabel('Discount reason')).toHaveCount(0);
    await expect(dialog.getByText('Discount', { exact: true })).toHaveCount(0);

    // Receptionist can still create the invoice; the total is exactly the line
    // item amount, proving no discount was silently applied either.
    await dialog.getByLabel('Patient ID').fill(patientId);
    await dialog.getByLabel('Description').fill('Consultation fee');
    await dialog.getByLabel('Unit price (₹)').fill('450');
    await expect(dialog.getByText('₹450.00').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Create invoice' }).click();

    await expect(page.getByText('Invoice created').first()).toBeVisible();
    await expect(page).toHaveURL(/\/billing\/[a-f0-9]{24}$/);
    const summaryCard = page.getByRole('heading', { name: 'Summary', level: 2 }).locator('..');
    await expect(summaryCard.getByText('Discount')).toHaveCount(0);

    // A different invoice that already has a payment on it: a user with
    // billing.refund would see "Refund payment" next to that payment row. The
    // receptionist does not, even though the row itself is visible.
    await page.goto(`/billing/${paidInvoice.id}`);
    await expect(page.getByRole('row', { name: /RCPT-\d{4}-\d{6}/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refund payment' })).toHaveCount(0);
  });

  test('recording a payment above the amount due is rejected', async ({ page }) => {
    const owner = await registerClinicOwner('overpay');
    const patientId = await seedPatient(owner.token, 'overpay');
    const invoice = await seedInvoice(owner, patientId, 50_000); // due ₹500.00

    await loginViaUi(page, owner.email, owner.password);
    await page.goto(`/billing/${invoice.id}`);

    // Confirm the starting state before attempting the (doomed) overpayment.
    const itemsCard = page.getByRole('heading', { name: 'Items', level: 2 }).locator('..');
    await expect(itemsCard.getByText('Unpaid', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Record payment' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Amount due: ₹500.00')).toBeVisible();

    await dialog.getByLabel('Amount (₹)').fill('600');
    await expect(dialog.getByText('Exceeds the amount due by ₹100.00.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Record payment' }).click();

    await expect(dialog.getByText('Payment amount exceeds the amount due on this invoice.')).toBeVisible();
    // The dialog stays open — the invoice itself was never touched.
    await expect(dialog).toBeVisible();
  });

  test('refunding a payment requires a reason', async ({ page }) => {
    const owner = await registerClinicOwner('refund');
    const patientId = await seedPatient(owner.token, 'refund');
    const invoice = await seedInvoice(owner, patientId, 80_000); // ₹800.00
    await api('POST', `/billing/invoices/${invoice.id}/payments`, { payments: [{ method: 'cash', amountPaise: 80_000 }] }, owner.token);

    await loginViaUi(page, owner.email, owner.password);
    await page.goto(`/billing/${invoice.id}`);

    await page.getByRole('button', { name: 'Refund payment' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Refund payment' })).toBeVisible();

    // Amount is pre-filled to the full payment amount; leave the reason blank.
    await expect(dialog.getByLabel('Refund amount (₹)')).toHaveValue('800');
    await dialog.getByRole('button', { name: 'Refund payment' }).click();

    await expect(dialog.getByText('A reason is required')).toBeVisible();
    // No request went through: dialog is still open and the payment is unrefunded.
    await expect(dialog).toBeVisible();

    // Filling in a reason clears the error and lets the refund succeed.
    await dialog.getByLabel('Reason').fill('Duplicate charge');
    await dialog.getByRole('button', { name: 'Refund payment' }).click();
    await expect(page.getByText(/refunded from receipt RCPT-\d{4}-\d{6}\./).first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
