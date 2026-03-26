import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Attributes Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/attributes');
    await page.waitForSelector('h1');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Attributes');
  });

  test('shows empty state when no attributes exist', async ({ page }) => {
    await expect(page.locator('text=No attributes created yet!')).toBeVisible();
  });

  test('opens add attribute modal', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('Add new attribute');
  });

  test('creates an attribute', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Department');
    await page.locator(`${modal} button:has-text("Add attribute")`).click();

    await expect(page.locator('text=Attribute added')).toBeVisible();
    await expect(page.locator('span:has-text("Department")')).toBeVisible();
    await expect(page.locator('input[placeholder="Value 1"]')).toBeVisible();
  });

  test('prevents duplicates in freeform values', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Skills');
    await page.locator(`${modal} button:has-text("Add attribute")`).click();

    const card = page.locator('div.rounded-xl', { has: page.locator('span:has-text("Skills")') });
    await card.locator('input[placeholder="Value 1"]').fill('React');
    await card.locator('input[placeholder="Value 1"]').blur();
    
    await card.getByRole('button', { name: '+ Add another Skills' }).click();
    await card.locator('input[placeholder="Value 2"]').fill('React');
    await card.locator('input[placeholder="Value 2"]').blur();

    await expect(page.locator('text=Duplicate values removed')).toBeVisible();

    // Verify it drops the duplicate, so there should not be a Value 2 input
    // The placeholder sequence drops empty inputs unless it's the last one
    // So if the duplicate was removed, 'Value 2' input might disappear.
    // Let's actually check how many inputs are rendered inside the card.
    await expect(card.locator('input')).toHaveCount(1);
  });

  test('creates attribute with Number type', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Priority');

    await page.locator(`${modal} button:has-text("Freeform (Default)")`).click();
    await page.locator(`${modal} .absolute button:has-text("Number")`).click();

    await page.locator(`${modal} button:has-text("Add attribute")`).click();

    await expect(page.locator('span:has-text("Priority")')).toBeVisible();
    await expect(page.locator('text=Number Field')).toBeVisible();
  });

  test('creates attribute with Date type', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Launch Date');

    await page.locator(`${modal} button:has-text("Freeform (Default)")`).click();
    await page.locator(`${modal} .absolute button:has-text("Date")`).click();

    await page.locator(`${modal} button:has-text("Add attribute")`).click();

    await expect(page.locator('span:has-text("Launch Date")')).toBeVisible();
    await expect(page.locator('text=Date Picker')).toBeVisible();
  });

  test('creates common attribute', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Team');
    await page.locator(`${modal} label:has-text("This is a common attribute")`).click();

    await page.locator(`${modal} button:has-text("Add attribute")`).click();

    await expect(page.locator('span:has-text("Team")')).toBeVisible();
  });

  test('requires field name for attribute', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} button:has-text("Add attribute")`).click();
    await expect(page.locator('text=Field name is required')).toBeVisible();
  });

  test('deletes an attribute', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Temp Attr');
    await page.locator(`${modal} button:has-text("Add attribute")`).click();
    await expect(page.locator('span:has-text("Temp Attr")')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    const card = page.locator('div.rounded-xl', { has: page.locator('span:has-text("Temp Attr")') });
    await card.getByRole('button', { name: 'Options' }).click();
    await card.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('text=Attribute deleted')).toBeVisible();
    await expect(page.locator('text=No attributes created yet!')).toBeVisible();
  });

  test('searches attributes', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Searchable');
    await page.locator(`${modal} button:has-text("Add attribute")`).click();
    await expect(page.locator('span:has-text("Searchable")')).toBeVisible();

    await page.getByRole('button', { name: 'ADD ATTRIBUTE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Hidden');
    await page.locator(`${modal} button:has-text("Add attribute")`).click();
    await expect(page.locator('span:has-text("Hidden")')).toBeVisible();

    await page.locator('input[placeholder="Search attributes..."]').fill('Search');
    await expect(page.locator('span:has-text("Searchable")')).toBeVisible();
    await expect(page.locator('span:has-text("Hidden")')).not.toBeVisible();
  });

});
