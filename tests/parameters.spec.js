import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Parameters Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/parameters');
    await page.waitForSelector('h1');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Parameters');
  });

  test('displays default parameter categories', async ({ page }) => {
    await expect(page.locator('h3:has-text("campaign")')).toBeVisible();
    await expect(page.locator('h3:has-text("medium")')).toBeVisible();
    await expect(page.locator('h3:has-text("source")')).toBeVisible();
    await expect(page.locator('h3:has-text("term")')).toBeVisible();
    await expect(page.locator('h3:has-text("content")')).toBeVisible();
  });

  test('shows seeded medium values', async ({ page }) => {
    await expect(page.locator('span:has-text("social")').first()).toBeVisible();
    await expect(page.locator('span:has-text("cpc")').first()).toBeVisible();
    await expect(page.locator('span:has-text("display")').first()).toBeVisible();
    await expect(page.locator('span:has-text("affiliate")').first()).toBeVisible();
  });

  test('shows seeded source values', async ({ page }) => {
    await expect(page.locator('span:has-text("facebook")').first()).toBeVisible();
    await expect(page.locator('span:has-text("google")').first()).toBeVisible();
    await expect(page.locator('span:has-text("twitter")').first()).toBeVisible();
  });

  test('shows inline input when clicking add another', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await expect(page.locator('input[placeholder="New campaign value"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  });

  test('adds a parameter value via inline input', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await page.locator('input[placeholder="New campaign value"]').fill('new-value');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.locator('text=Added "new-value" to campaign')).toBeVisible();
    await expect(page.locator('span:has-text("new-value")')).toBeVisible();
  });

  test('adds a parameter value by pressing Enter', async ({ page }) => {
    await page.locator('button:has-text("+ Add another medium")').click();
    await page.locator('input[placeholder="New medium value"]').fill('podcast');
    await page.locator('input[placeholder="New medium value"]').press('Enter');

    await expect(page.locator('text=Added "podcast" to medium')).toBeVisible();
    await expect(page.locator('span:has-text("podcast")')).toBeVisible();
  });

  test('cancels adding parameter with close button', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await expect(page.locator('input[placeholder="New campaign value"]')).toBeVisible();

    await page.locator('button:has-text("×")').click();

    // Input should disappear, button should return
    await expect(page.locator('input[placeholder="New campaign value"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("+ Add another campaign")')).toBeVisible();
  });

  test('cancels adding parameter with Escape key', async ({ page }) => {
    await page.locator('button:has-text("+ Add another source")').click();
    await expect(page.locator('input[placeholder="New source value"]')).toBeVisible();

    await page.locator('input[placeholder="New source value"]').press('Escape');

    await expect(page.locator('input[placeholder="New source value"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("+ Add another source")')).toBeVisible();
  });

  test('does not add empty parameter value', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Input should remain open, no toast
    await expect(page.locator('input[placeholder="New campaign value"]')).toBeVisible();
  });

  test('input autofocuses when opened', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await expect(page.locator('input[placeholder="New campaign value"]')).toBeFocused();
  });

  test('clears input after adding value', async ({ page }) => {
    await page.locator('button:has-text("+ Add another campaign")').click();
    await page.locator('input[placeholder="New campaign value"]').fill('first-value');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('span:has-text("first-value")')).toBeVisible();

    // Input should close after adding
    await expect(page.locator('input[placeholder="New campaign value"]')).not.toBeVisible();
  });

  test('deletes a parameter value', async ({ page }) => {
    const paramItem = page.locator('div.group:has(span:has-text("social"))').first();
    await paramItem.hover();
    await paramItem.locator('button:has-text("✕")').click();
    await expect(page.locator('text=Parameter removed')).toBeVisible();
  });

  test('edits a parameter value', async ({ page }) => {
    const paramItem = page.locator('div.group:has(span:has-text("cpc"))').first();
    await paramItem.hover();
    await paramItem.locator('button:has-text("✏️")').click();
    await expect(page.locator(`${modal} h2`)).toBeVisible();
  });

  test('opens add custom parameter modal', async ({ page }) => {
    await page.locator('button:has-text("ADD CUSTOM URL PARAMETER")').click();
    await expect(page.locator(modal)).toContainText('Add new custom parameter');
    await expect(page.locator(modal)).toContainText('Field name');
  });

  test('adds a custom parameter', async ({ page }) => {
    await page.locator('button:has-text("ADD CUSTOM URL PARAMETER")').click();
    await page.locator(`${modal} input`).first().fill('region');
    await page.locator(`${modal} button:has-text("Add parameter")`).click();
    await expect(page.locator('text=Custom parameter added')).toBeVisible();
    await expect(page.locator('h3:has-text("region")')).toBeVisible();
  });

  test('custom parameter type dropdown works', async ({ page }) => {
    await page.locator('button:has-text("ADD CUSTOM URL PARAMETER")').click();

    await page.locator(`${modal} button:has-text("Freeform (Default)")`).click();
    await expect(page.locator(`${modal} .absolute button:has-text("Number")`)).toBeVisible();
    await expect(page.locator(`${modal} .absolute button:has-text("Date")`)).toBeVisible();

    await page.locator(`${modal} .absolute button:has-text("Number")`).click();
  });

  test('requires field name for custom parameter', async ({ page }) => {
    await page.locator('button:has-text("ADD CUSTOM URL PARAMETER")').click();
    await page.locator(`${modal} button:has-text("Add parameter")`).click();
    await expect(page.locator('text=Field name is required')).toBeVisible();
  });

  test('searches parameters', async ({ page }) => {
    await page.locator('input[placeholder="Search parameters..."]').fill('social');
    await expect(page.locator('span:has-text("social")').first()).toBeVisible();
    await expect(page.locator('span:has-text("cpc")')).not.toBeVisible();
  });

  test('shows export button', async ({ page }) => {
    await expect(page.locator('button:has-text("Export to CSV")')).toBeVisible();
  });
});
