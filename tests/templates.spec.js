import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Templates Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/templates');
    await page.waitForSelector('h1');
  });

  test('shows empty state when no templates exist', async ({ page }) => {
    await expect(page.locator('text=No templates yet!')).toBeVisible();
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('UTM Templates');
  });

  test('opens create template modal', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('Create Template');
  });

  test('creates a template', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();

    await page.locator(`${modal} input`).first().fill('Summer Sale Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('summer-sale');
    await page.locator(`${modal} input[placeholder*="banner ad"]`).fill('email');
    await page.locator(`${modal} input[placeholder*="adwords"]`).fill('newsletter');

    await page.locator(`${modal} button:has-text("Save Template")`).click();

    await expect(page.locator('text=Template created')).toBeVisible();
    await expect(page.locator('td:has-text("Summer Sale Template")')).toBeVisible();
    await expect(page.locator('td:has-text("summer-sale-template")')).toBeVisible();
  });

  test('requires template name', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template name is required')).toBeVisible();
  });

  test('creates template with common flag', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();

    await page.locator(`${modal} input`).first().fill('Common Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('common-camp');
    await page.locator(`${modal} label:has-text("This is a common template")`).click();

    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template created')).toBeVisible();
    await expect(page.locator('td:has-text("Common Template")')).toBeVisible();
  });

  test('searches templates', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Alpha Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('alpha');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('td:has-text("Alpha Template")')).toBeVisible();

    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Beta Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('beta');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('td:has-text("Beta Template")')).toBeVisible();

    await page.locator('input[placeholder="Search templates..."]').fill('Alpha');
    await expect(page.locator('td:has-text("Alpha Template")')).toBeVisible();
    await expect(page.locator('td:has-text("Beta Template")')).not.toBeVisible();
  });

  test('duplicates a template', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Original Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('original');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('td:has-text("Original Template")')).toBeVisible();

    await page.locator('button[title="Duplicate"]').click();
    await expect(page.locator('text=Template duplicated')).toBeVisible();
    await expect(page.locator('td:has-text("Original Template (copy)")')).toBeVisible();
  });

  test('deletes a template', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Delete Me Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('delete-me');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('td:has-text("Delete Me Template")')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button[title="Delete"]').click();
    await expect(page.locator('text=Template deleted')).toBeVisible();
    await expect(page.locator('text=No templates yet!')).toBeVisible();
  });

  test('edits a template', async ({ page }) => {
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Editable Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('editable');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('td:has-text("Editable Template")')).toBeVisible();

    await page.locator('button[title="Edit"]').click();
    await expect(page.locator(`${modal} h2`)).toContainText('Edit Template');
  });

  test('shows export button', async ({ page }) => {
    await expect(page.locator('button:has-text("Export to CSV")')).toBeVisible();
  });
});
