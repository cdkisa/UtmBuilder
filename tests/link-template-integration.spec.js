import { test, expect } from './fixtures.js';

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

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://template-link.test');

    // Select the template
    await page.locator(`${modal} select`).first().selectOption({ label: 'Email Template' });
    await page.waitForTimeout(500);

    // The Template's values show as placeholders; nothing is copied into the field
    const campaignInput = page.locator(`${modal} input[list="list-campaign"]`);
    await expect(campaignInput).toHaveValue('');
    await expect(campaignInput).toHaveAttribute('placeholder', 'email-blast');

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
    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://clear-test.test');

    // Select template
    await page.locator(`${modal} select`).first().selectOption({ label: 'Clearable Template' });
    await page.waitForTimeout(500);

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('utm_campaign=clear-test');

    // Clear button should appear and work
    await expect(page.locator(`${modal} button:has-text("CLEAR")`)).toBeVisible();
    await page.locator(`${modal} button:has-text("CLEAR")`).click();

    const templateSelect = page.locator(`${modal} select`).first();
    await expect(templateSelect).toHaveValue('');

    // Clearing the Template takes its values with it
    await expect(preview).not.toContainText('utm_campaign=clear-test');
  });

  test('URL preview updates in real-time', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('https://preview.test');
    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('https://preview.test');

    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('live-update');
    await expect(preview).toContainText('utm_campaign=live-update');

    await page.locator(`${modal} input[placeholder*="adwords"]`).fill('google');
    await expect(preview).toContainText('utm_source=google');
  });

  test('auto-prefixes https:// to URLs', async ({ page }) => {
    await page.locator('button:has-text("CREATE LINK")').click();

    await page.locator(`${modal} input[placeholder="https://example.com"]`).fill('mysite.test');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('prefix-test');

    const preview = page.locator(`${modal} .font-mono`);
    await expect(preview).toContainText('https://mysite.test');
  });

  test('HTML email mode refuses a Template deleted after it was chosen', async ({ page }) => {
    await page.locator('nav a:has-text("Templates")').click();
    await page.waitForSelector('main h1');
    await page.getByRole('button', { name: 'CREATE TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input`).first().fill('Vanishing Template');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('vanish');
    await page.locator(`${modal} button:has-text("Save Template")`).click();
    await expect(page.locator('text=Template created')).toBeVisible();

    await page.locator('nav a:has-text("Links")').first().click();
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator(`${modal} select`).first().selectOption({ label: 'Vanishing Template' });
    await page.locator(`${modal} button:has-text("HTML Email")`).click();
    await page.locator(`${modal} textarea`).fill('<a href="https://email-target.test">x</a>');

    // Delete the Template from another tab while this one still has it chosen
    const other = await page.context().newPage();
    await other.goto('/templates');
    await other.waitForSelector('main h1');
    other.on('dialog', dialog => dialog.accept());
    await other.locator('button[title="Delete"]').click();
    await expect(other.locator('text=Template deleted')).toBeVisible();
    await other.close();

    await page.locator(`${modal} button:has-text("Process & Copy HTML")`).click();
    await expect(page.locator('text=The chosen Template no longer exists.')).toBeVisible();
    await expect(page.locator('text=UTM parameters injected')).not.toBeVisible();
  });
});
