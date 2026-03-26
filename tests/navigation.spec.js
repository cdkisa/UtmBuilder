import { test, expect } from '@playwright/test';

test.describe('Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main h1');
  });

  test('displays app logo and title', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('UTM Builder');
  });

  test('navigates to Links page (default route)', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Activity History');
  });

  test('navigates to QR Codes page', async ({ page }) => {
    await page.locator('nav a:has-text("QR Codes")').click();
    await expect(page).toHaveURL('/qr-codes');
    await expect(page.locator('main h1')).toContainText('Custom QR Codes');
  });

  test('navigates to Templates page', async ({ page }) => {
    await page.locator('nav a:has-text("Templates")').click();
    await expect(page).toHaveURL('/templates');
    await expect(page.locator('main h1')).toContainText('UTM Templates');
  });

  test('navigates to Parameters page', async ({ page }) => {
    await page.locator('nav a:has-text("Parameters")').click();
    await expect(page).toHaveURL('/parameters');
    await expect(page.locator('main h1')).toContainText('Parameters');
  });

  test('navigates to Attributes page', async ({ page }) => {
    await page.locator('nav a:has-text("Attributes")').click();
    await expect(page).toHaveURL('/attributes');
    await expect(page.locator('main h1')).toContainText('Attributes');
  });

  test('navigates to Link Shorteners page', async ({ page }) => {
    await page.locator('nav a:has-text("Link Shorteners")').click();
    await expect(page).toHaveURL('/link-shorteners');
    await expect(page.locator('main h1')).toContainText('Link Shorteners');
  });

  test('navigates to Rules page', async ({ page }) => {
    await page.locator('nav a:has-text("Rules")').click();
    await expect(page).toHaveURL('/rules');
    await expect(page.locator('main h1')).toContainText('Workspace Defaults');
  });

  test('navigates to Members page', async ({ page }) => {
    await page.locator('nav a:has-text("Members")').click();
    await expect(page).toHaveURL('/members');
    await expect(page.locator('main h1')).toContainText('Members');
  });

  test('highlights active nav link', async ({ page }) => {
    const linksNav = page.locator('nav a').first();
    await expect(linksNav).toHaveClass(/bg-brand-50/);
  });

  test('collapses and expands sidebar', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/w-56/);

    await sidebar.locator('button:has-text("←")').click();
    await expect(sidebar).toHaveClass(/w-16/);

    await sidebar.locator('button:has-text("→")').click();
    await expect(sidebar).toHaveClass(/w-56/);
  });
});
