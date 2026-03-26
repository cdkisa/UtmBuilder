import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('Link + Template Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('main h1');
  });

  test('creates link using a template', async ({ page }) => {
    // Create a template first
    await page.locator('nav a:has-text("Templates")').click();
    await page.waitForSelector('main h1');
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();

    await page.locator(`${modal} input`).first().fill('Email Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('email-blast');
    await page.locator(`${modal} input[placeholder*="banner ad"]`).fill('email');
    await page.locator(`${modal} input[placeholder*="adwords"]`).fill('mailchimp');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template created')).toBeVisible();

    // Go to Links and create a link with that template
    await page.locator('nav a:has-text("Links")').first().click();
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://template-link.com');

    // Select the template
    await page.locator(`${modal} select`).first().selectOption({ label: 'Email Template' });
    await page.waitForTimeout(500);

    // Fields should be auto-populated
    const campaignInput = page.locator(`${modal} input[placeholder*="holiday special"]`);
    await expect(campaignInput).toHaveValue('email-blast');

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('utm_campaign=email-blast');
    await expect(preview).toContainText('utm_medium=email');
    await expect(preview).toContainText('utm_source=mailchimp');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('td:has-text("email-blast")').first()).toBeVisible();
  });

  test('clears template selection', async ({ page }) => {
    // Create a template first
    await page.locator('nav a:has-text("Templates")').click();
    await page.waitForSelector('main h1');
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Clearable Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('clear-test');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template created')).toBeVisible();

    // Go to links
    await page.locator('nav a:has-text("Links")').first().click();
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://clear-test.com');

    // Select template
    await page.locator(`${modal} select`).first().selectOption({ label: 'Clearable Template' });
    await page.waitForTimeout(500);

    // Clear button should appear and work
    await expect(page.locator(`${modal} button:has-text("CLEAR")`)).toBeVisible();
    await page.locator(`${modal} button:has-text("CLEAR")`).click();

    const templateSelect = page.locator(`${modal} select`).first();
    await expect(templateSelect).toHaveValue('');
  });

  test('URL preview updates in real-time', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://preview.com');
    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('https://preview.com');

    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('live-update');
    await expect(preview).toContainText('utm_campaign=live-update');

    await page.locator(`${modal} input[placeholder*="adwords"]`).fill('google');
    await expect(preview).toContainText('utm_source=google');
  });

  test('auto-prefixes https:// to URLs', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('mysite.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('prefix-test');

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('https://mysite.com');
  });
});
