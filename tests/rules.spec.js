import { test, expect } from '@playwright/test';

test.describe('Rules Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rules');
    await page.waitForSelector('h1');
  });

  test('shows workspace defaults section', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Workspace Defaults');
  });

  test('shows space character selector with default hyphen', async ({ page }) => {
    await expect(page.locator('text=Space Character')).toBeVisible();
    const spaceSelect = page.locator('select').first();
    await expect(spaceSelect).toHaveValue('hyphen');
  });

  test('changes space character to underscore', async ({ page }) => {
    await page.locator('select').first().selectOption('underscore');
    await page.locator('button:has-text("Save Workspace Settings")').click();
    await expect(page.locator('text=Workspace settings saved')).toBeVisible();
  });

  test('changes space character to plus', async ({ page }) => {
    await page.locator('select').first().selectOption('plus');
    await page.locator('button:has-text("Save Workspace Settings")').click();
    await expect(page.locator('text=Workspace settings saved')).toBeVisible();
  });

  test('shows prohibited characters input', async ({ page }) => {
    await expect(page.locator('text=Prohibited Characters')).toBeVisible();
    await expect(page.locator('text=Characters which are not allowed to use in the builder').first()).toBeVisible();
  });

  test('shows force lowercase checkbox', async ({ page }) => {
    await expect(page.locator('text=Force all campaigns parameters to lowercase')).toBeVisible();
  });

  test('toggles force lowercase', async ({ page }) => {
    await page.locator('label:has-text("Force all campaigns parameters to lowercase")').click();
    await page.locator('button:has-text("Save Workspace Settings")').click();
    await expect(page.locator('text=Workspace settings saved')).toBeVisible();
  });

  test('shows template requirement options', async ({ page }) => {
    await expect(page.locator('text=Require template selection in link builder')).toBeVisible();
    await expect(page.locator('text=Do not allow members to select different templates')).toBeVisible();
  });

  test('shows QR customization option', async ({ page }) => {
    await expect(page.locator('text=Allow the members to customize the QR code designs')).toBeVisible();
  });

  test('shows rules section with empty state', async ({ page }) => {
    await expect(page.locator('text=Workspace Rules')).toBeVisible();
    await expect(page.locator('text=No rules created yet.')).toBeVisible();
  });

  test('creates a rule', async ({ page }) => {
    await page.locator('button:has-text("+ Create Rule")').first().click();

    await expect(page.locator('text=Rule created')).toBeVisible();
    await expect(page.locator('h3:has-text("Rule 1")')).toBeVisible();
  });

  test('rule shows parameter columns', async ({ page }) => {
    await page.locator('button:has-text("+ Create Rule")').first().click();
    await expect(page.locator('h3:has-text("Rule 1")')).toBeVisible();

    await expect(page.locator('td:has-text("campaign")').first()).toBeVisible();
    await expect(page.locator('td:has-text("medium")').first()).toBeVisible();
    await expect(page.locator('td:has-text("source")').first()).toBeVisible();
    await expect(page.locator('td:has-text("term")').first()).toBeVisible();
    await expect(page.locator('td:has-text("content")').first()).toBeVisible();

    await expect(page.locator('th:has-text("Required")')).toBeVisible();
    await expect(page.locator('th:has-text("Blocked")')).toBeVisible();
    await expect(page.locator('th:has-text("Force Lowercase")')).toBeVisible();
  });

  test('toggles rule checkboxes', async ({ page }) => {
    await page.locator('button:has-text("+ Create Rule")').first().click();
    await expect(page.locator('h3:has-text("Rule 1")')).toBeVisible();

    const campaignRow = page.locator('tr:has(td:has-text("campaign"))').first();
    const requiredCheckbox = campaignRow.locator('input[type="checkbox"]').first();

    await requiredCheckbox.click();
    await expect(requiredCheckbox).toBeChecked();
  });

  test('deletes a rule', async ({ page }) => {
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.locator('button:has-text("+ Create Rule")').first().click();
    await expect(page.locator('h3:has-text("Rule 1")')).toBeVisible();

    await page.locator('h3:has-text("Rule 1")').locator('..').locator('button:has-text("🗑️")').click();
    await expect(page.locator('text=Rule deleted')).toBeVisible();
  });

  test('saves workspace settings', async ({ page }) => {
    await page.locator('button:has-text("Save Workspace Settings")').click();
    await expect(page.locator('text=Workspace settings saved')).toBeVisible();
  });
});
