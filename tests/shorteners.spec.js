import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Link Shorteners Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/link-shorteners');
    await page.waitForSelector('h1');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Link Shorteners');
  });

  test('shows empty state when no shorteners exist', async ({ page }) => {
    await expect(page.locator('text=No link shorteners configured yet!')).toBeVisible();
  });

  test('shows record count', async ({ page }) => {
    await expect(page.locator('text=0 records')).toBeVisible();
  });

  test('opens add shortener modal', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('Add New Link Shortener');
    await expect(page.locator(`${modal} button:has-text("Custom Branded Domain")`)).toBeVisible();
    await expect(page.locator(`${modal} button:has-text("Local Shortener")`)).toBeVisible();
  });

  test('adds local shortener', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Local Shortener")`).click();

    await expect(page.locator('text=Local shortener added')).toBeVisible();
    await expect(page.locator('td:has-text("short.local")')).toBeVisible();
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('adds custom branded domain shortener', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Custom Branded Domain")`).click();

    await expect(page.locator(modal)).toContainText('Configure a custom branded domain');

    await page.locator(`${modal} input[placeholder="Enter Branded Domain"]`).fill('go.mycompany.com');
    await page.locator(`${modal} input[placeholder="Default Redirect URL"]`).fill('https://mycompany.com');
    await page.locator(`${modal} button:has-text("Next")`).click();

    await expect(page.locator('text=Custom domain shortener added')).toBeVisible();
    await expect(page.locator('td:has-text("go.mycompany.com")')).toBeVisible();
  });

  test('requires domain for custom shortener', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Custom Branded Domain")`).click();
    await page.locator(`${modal} button:has-text("Next")`).click();
    await expect(page.locator('text=Domain is required')).toBeVisible();
  });

  test('custom shortener has back button', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Custom Branded Domain")`).click();
    await page.locator(`${modal} button:has-text("Back")`).click();
    await expect(page.locator(`${modal} button:has-text("Custom Branded Domain")`)).toBeVisible();
  });

  test('toggles shortener status', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Local Shortener")`).click();
    await expect(page.locator('td:has-text("short.local")')).toBeVisible();

    await page.locator('button:has-text("Disable")').click();
    await expect(page.locator('text=Shortener disabled')).toBeVisible();

    await page.locator('button:has-text("Enable")').click();
    await expect(page.locator('text=Shortener active')).toBeVisible();
  });

  test('deletes a shortener', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Local Shortener")`).click();
    await expect(page.locator('td:has-text("short.local")')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("🗑️")').click();

    await expect(page.locator('text=Shortener removed')).toBeVisible();
    await expect(page.locator('text=0 records')).toBeVisible();
  });

  test('shows table headers when shorteners exist', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD LINK SHORTENER', exact: true }).click();
    await page.locator(`${modal} button:has-text("Local Shortener")`).click();
    await expect(page.locator('td:has-text("short.local")')).toBeVisible();

    await expect(page.locator('th:has-text("Link Shorteners")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Default Redirect")')).toBeVisible();
  });
});
