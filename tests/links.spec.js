import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Links Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1');
  });

  test('shows empty state when no links exist', async ({ page }) => {
    await expect(page.locator('text=No Links created yet!')).toBeVisible();
  });

  test('shows record count', async ({ page }) => {
    await expect(page.locator('text=0 records')).toBeVisible();
  });

  test('opens create link modal', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await expect(page.locator(modal)).toContainText('Create Link');
    await expect(page.locator(modal)).toContainText('Single URL');
    await expect(page.locator(modal)).toContainText('Multiple URLs');
  });

  test('switches to Multiple URLs tab', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    // Default is Single URL (active)
    const singleBtn = page.locator(`${modal} button:has-text("Single URL")`);
    await expect(singleBtn).toHaveClass(/bg-brand-500/);

    // Switch to Multiple URLs
    await page.locator(`${modal} button:has-text("Multiple URLs")`).click();

    const bulkBtn = page.locator(`${modal} button:has-text("Multiple URLs")`);
    await expect(bulkBtn).toHaveClass(/bg-brand-500/);

    // Should show textarea instead of single URL input
    await expect(page.locator(`${modal} textarea`)).toBeVisible();
    await expect(page.locator(`${modal} input[placeholder="https://example.com"]`)).not.toBeVisible();
  });

  test('switches back to Single URL tab', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    // Switch to Multiple then back
    await page.locator(`${modal} button:has-text("Multiple URLs")`).click();
    await expect(page.locator(`${modal} textarea`)).toBeVisible();

    await page.locator(`${modal} button:has-text("Single URL")`).click();
    await expect(page.locator(`${modal} input[placeholder="https://example.com"]`)).toBeVisible();
    await expect(page.locator(`${modal} textarea`)).not.toBeVisible();
  });

  test('creates multiple links in bulk mode', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} button:has-text("Multiple URLs")`).click();

    // Enter multiple URLs
    await page.locator(`${modal} textarea`).fill('https://bulk1.com\nhttps://bulk2.com\nhttps://bulk3.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('bulk-campaign');
    await page.locator(`${modal} input[placeholder*="banner ad"]`).fill('email');

    await page.locator(`${modal} button:has-text("Bulk Create and Save")`).click();
    await expect(page.locator('text=3 links created')).toBeVisible();
    await expect(page.locator('text=3 records')).toBeVisible();
  });

  test('bulk mode requires at least one URL', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} button:has-text("Multiple URLs")`).click();

    await page.locator(`${modal} button:has-text("Bulk Create and Save")`).click();
    await expect(page.locator('text=Enter at least one URL')).toBeVisible();
  });

  test('bulk mode applies same UTM params to all URLs', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} button:has-text("Multiple URLs")`).click();

    await page.locator(`${modal} textarea`).fill('https://multi1.com\nhttps://multi2.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('shared-campaign');
    await page.locator(`${modal} input[placeholder*="banner ad"]`).fill('social');

    await page.locator(`${modal} button:has-text("Bulk Create and Save")`).click();
    await expect(page.locator('text=2 links created')).toBeVisible();

    // Both links should have the same campaign
    const campaignCells = page.getByRole('cell', { name: 'shared-campaign', exact: true });
    await expect(campaignCells).toHaveCount(2);
  });

  test('creates a single UTM link', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://mysite.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('summer-sale');
    await page.locator(`${modal} input[placeholder*="banner ad"]`).fill('email');
    await page.locator(`${modal} input[placeholder*="adwords"]`).fill('newsletter');

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('https://mysite.com?utm_campaign=summer-sale');
    await expect(preview).toContainText('utm_medium=email');
    await expect(preview).toContainText('utm_source=newsletter');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();

    await expect(page.locator('td:has-text("summer-sale")').first()).toBeVisible();
    await expect(page.locator('td:has-text("email")').first()).toBeVisible();
    await expect(page.locator('td:has-text("newsletter")').first()).toBeVisible();
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('requires URL to create link', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=URL is required')).toBeVisible();
  });

  test('creates link with custom parameters', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://mysite.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('test-campaign');

    await page.locator(`${modal} button:has-text("+ Add custom URL parameter")`).click();
    await page.locator(`${modal} input[placeholder="Param name"]`).fill('ref');
    await page.locator(`${modal} input[placeholder="Param value"]`).fill('homepage');

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('ref=homepage');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("test-campaign")').first()).toBeVisible();
  });

  test('creates link with notes', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://mysite.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('noted-campaign');
    await page.locator(`${modal} input[placeholder*="Notes are saved"]`).fill('This is a test note');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("This is a test note")')).toBeVisible();
  });

  test('creates link with shortener', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://mysite.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('short-campaign');
    await page.locator(`${modal} select`).last().selectOption('local');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=short.local')).toBeVisible();
  });

  test('cancels link creation', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://cancel-me.com');
    await page.locator(`${modal} button:has-text("Cancel")`).click();
    await expect(page.locator('text=No Links created yet!')).toBeVisible();
  });

  test('searches links', async ({ page }) => {
    // Create two links
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://searchable.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('findme-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("findme-campaign")').first()).toBeVisible();

    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://other.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('hidden-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("hidden-campaign")').first()).toBeVisible();

    await page.locator('input[placeholder="Search links..."]').fill('findme');
    await expect(page.locator('td:has-text("findme-campaign")').first()).toBeVisible();
    await expect(page.locator('td:has-text("hidden-campaign")').first()).not.toBeVisible();
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('opens advanced filters', async ({ page }) => {
    await page.locator('button:has-text("▼")').click();
    await expect(page.locator('text=Clear filter')).toBeVisible();
    await expect(page.locator('input[placeholder="campaign"]')).toBeVisible();
    await expect(page.locator('input[placeholder="medium"]')).toBeVisible();
  });

  test('groups links by campaign', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://grouped.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('group-test');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("group-test")').first()).toBeVisible();

    await page.locator('select:has(option:has-text("GROUP BY"))').selectOption('campaign');
    await expect(page.locator('td[colspan]:has-text("group-test")')).toBeVisible();
  });

  test('shows delete confirmation modal', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://confirm-delete.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('confirm-del');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("confirm-del")').first()).toBeVisible();

    await page.locator('button[title="Delete"]').click();

    // Confirmation modal should appear
    await expect(page.locator(`${modal} h2`)).toContainText('Delete Link');
    await expect(page.locator(modal)).toContainText('Are you sure you want to delete this link?');
    await expect(page.locator(modal)).toContainText('This action cannot be undone');
    await expect(page.locator(`${modal} button:has-text("Cancel")`)).toBeVisible();
    await expect(page.locator(`${modal} button:has-text("Delete")`)).toBeVisible();
  });

  test('deletes a link after confirmation', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://deleteme.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('delete-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("delete-campaign")').first()).toBeVisible();

    await page.locator('button[title="Delete"]').click();
    await page.locator(`${modal} button:has-text("Delete")`).click();

    await expect(page.locator('text=Link deleted')).toBeVisible();
    await expect(page.locator('text=0 records')).toBeVisible();
  });

  test('cancels link deletion', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://keepme.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('keep-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("keep-campaign")').first()).toBeVisible();

    await page.locator('button[title="Delete"]').click();
    await page.locator(`${modal} button:has-text("Cancel")`).click();

    // Link should still exist
    await expect(page.locator('td:has-text("keep-campaign")').first()).toBeVisible();
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('closes delete modal by clicking backdrop', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://backdrop.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('backdrop-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("backdrop-campaign")').first()).toBeVisible();

    await page.locator('button[title="Delete"]').click();
    await expect(page.locator(`${modal} h2`)).toContainText('Delete Link');

    // Click the backdrop (the modal-backdrop element itself, not the content)
    await page.locator(modal).click({ position: { x: 5, y: 5 } });

    // Link should still exist
    await expect(page.locator('td:has-text("backdrop-campaign")').first()).toBeVisible();
    await expect(page.locator('text=1 records')).toBeVisible();
  });

  test('copies link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://copy.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('copy-campaign');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("copy-campaign")').first()).toBeVisible();

    await page.locator('button[title="Copy"]').click();
    await expect(page.locator('text=Copied!')).toBeVisible();
  });

  test('opens QR code modal from link row', async ({ page }) => {
    // Create a link first
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://qr-from-link.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('qr-test');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("qr-test")').first()).toBeVisible();

    // Click QR button
    await page.locator('button[title="Generate QR Code"]').click();
    await expect(page.locator(`${modal} h2`)).toContainText('QR Code');
    await expect(page.locator(`${modal} .font-mono`)).toContainText('qr-from-link.com');

    // QR image should generate
    await expect(page.locator(`${modal} img[alt="QR Code"]`)).toBeVisible({ timeout: 5000 });
  });

  test('QR modal shows download and save buttons', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://qr-buttons.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('btn-test');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("btn-test")').first()).toBeVisible();

    await page.locator('button[title="Generate QR Code"]').click();
    await expect(page.locator(`${modal} img[alt="QR Code"]`)).toBeVisible({ timeout: 5000 });

    await expect(page.locator(`${modal} button:has-text("Download PNG")`)).toBeVisible();
    await expect(page.locator(`${modal} button:has-text("Save to Link")`)).toBeVisible();
  });

  test('saves QR code to link', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://save-qr.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('save-qr');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("save-qr")').first()).toBeVisible();

    await page.locator('button[title="Generate QR Code"]').click();
    await expect(page.locator(`${modal} img[alt="QR Code"]`)).toBeVisible({ timeout: 5000 });

    await page.locator(`${modal} button:has-text("Save to Link")`).click();
    await expect(page.locator('text=QR code saved to link')).toBeVisible();
  });

  test('QR modal uses short URL when available', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://short-qr.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('short-qr');
    await page.locator(`${modal} select`).last().selectOption('local');
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=short.local')).toBeVisible();

    await page.locator('button[title="Generate QR Code"]').click();
    // Should show the short URL, not the full URL
    await expect(page.locator(`${modal} .font-mono`)).toContainText('short.local');
  });

  test('shows export and import buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Import Links via CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Export to CSV")')).toBeVisible();
  });

  test('opens import links modal', async ({ page }) => {
    await page.locator('button:has-text("Import Links via CSV")').click();
    await expect(page.locator(modal)).toContainText('Import Links');
    await expect(page.locator(modal)).toContainText('Migrate your short URLs');
    await expect(page.locator(modal)).toContainText('Download a template for CSV import file');
  });
});
