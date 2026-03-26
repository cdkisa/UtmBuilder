import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Members Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members');
    await page.waitForSelector('h1');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Members');
  });

  test('shows seeded admin member', async ({ page }) => {
    await expect(page.locator('td:has-text("admin@local.app")')).toBeVisible();
  });

  test('shows record count', async ({ page }) => {
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('admin member has admin checkbox checked', async ({ page }) => {
    const adminRow = page.locator('tr:has(td:has-text("admin@local.app"))');
    const adminCheckbox = adminRow.locator('input[type="checkbox"]');
    await expect(adminCheckbox).toBeChecked();
  });

  test('cannot remove admin member', async ({ page }) => {
    await page.locator('tr:has(td:has-text("admin@local.app")) button:has-text("Remove from workspace")').click();
    await expect(page.locator("text=Can't remove workspace admin")).toBeVisible();
  });

  test('opens invite member modal', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('Invite Users');
    await expect(page.locator(modal)).toContainText('Email Address');
  });

  test('invites a new member', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('newuser@test.com');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();

    await expect(page.locator('text=1 member(s) invited')).toBeVisible();
    await expect(page.locator('td:has-text("newuser@test.com")')).toBeVisible();
    await expect(page.locator('text=2 records')).toBeVisible();
  });

  test('invites member with Viewer role', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('viewer@test.com');
    await page.locator(`${modal} select`).first().selectOption('Viewer');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();

    await expect(page.locator('td:has-text("viewer@test.com")')).toBeVisible();
  });

  test('adds multiple invite rows', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} button:has-text("+ Add more users")`).click();

    const emailInputs = page.locator(`${modal} input[placeholder="user@example.com"]`);
    await expect(emailInputs).toHaveCount(2);
  });

  test('invites multiple members at once', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).first().fill('user1@test.com');

    await page.locator(`${modal} button:has-text("+ Add more users")`).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).last().fill('user2@test.com');

    await page.locator(`${modal} button:has-text("CONFIRM")`).click();

    await expect(page.locator('text=2 member(s) invited')).toBeVisible();
    await expect(page.locator('text=3 records')).toBeVisible();
  });

  test('requires at least one email to invite', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();
    await expect(page.locator('text=Enter at least one email')).toBeVisible();
  });

  test('removes a non-admin member', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('removable@test.com');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();
    await expect(page.locator('td:has-text("removable@test.com")')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('tr:has(td:has-text("removable@test.com")) button:has-text("Remove from workspace")').click();

    await expect(page.locator('text=Member removed')).toBeVisible();
    await expect(page.locator('td:has-text("removable@test.com")')).not.toBeVisible();
  });

  test('changes member role', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('rolechange@test.com');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();
    await expect(page.locator('td:has-text("rolechange@test.com")')).toBeVisible();

    const memberRow = page.locator('tr:has(td:has-text("rolechange@test.com"))');
    await memberRow.locator('select').selectOption('Viewer');
    await expect(page.locator('text=Role updated')).toBeVisible();
  });

  test('toggles admin status', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('admintest@test.com');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();
    await expect(page.locator('td:has-text("admintest@test.com")')).toBeVisible();

    const memberRow = page.locator('tr:has(td:has-text("admintest@test.com"))');
    await memberRow.locator('input[type="checkbox"]').click();
    await expect(page.locator('text=Admin granted')).toBeVisible();

    await memberRow.locator('input[type="checkbox"]').click();
    await expect(page.locator('text=Admin revoked')).toBeVisible();
  });

  test('searches members', async ({ page }) => {
    await page.getByRole('button', { name: 'INVITE MEMBER', exact: true }).click();
    await page.locator(`${modal} input[placeholder="user@example.com"]`).fill('searchme@test.com');
    await page.locator(`${modal} button:has-text("CONFIRM")`).click();
    await expect(page.locator('td:has-text("searchme@test.com")')).toBeVisible();

    await page.locator('input[placeholder="Search members..."]').fill('searchme');
    await expect(page.locator('td:has-text("searchme@test.com")')).toBeVisible();
    await expect(page.locator('td:has-text("admin@local.app")')).not.toBeVisible();
  });

  test('shows table headers', async ({ page }) => {
    await expect(page.locator('th:has-text("Email")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Rule")')).toBeVisible();
    await expect(page.locator('th:has-text("Workspace Admin")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });
});
