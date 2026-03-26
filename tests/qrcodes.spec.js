import { test, expect } from '@playwright/test';

const modal = '.modal-backdrop';

test.describe('QR Codes Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qr-codes');
    await page.waitForSelector('h1');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Custom QR Codes');
  });

  test('shows empty state when no QR codes exist', async ({ page }) => {
    await expect(page.locator('text=No QR Codes created yet!')).toBeVisible();
  });

  test('shows create and design buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("CREATE QR CODE")')).toBeVisible();
    await expect(page.locator('button:has-text("DESIGN QR TEMPLATE")')).toBeVisible();
    await expect(page.locator('button:has-text("EDIT QR TEMPLATE")')).toBeVisible();
  });

  test('opens create QR code modal with tabs', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await expect(page.locator(`${modal} h2`)).toContainText('Create QR Code');
    await expect(page.locator(`${modal} button:has-text("New Link")`)).toBeVisible();
    await expect(page.locator(`${modal} button:has-text("Existing Link")`)).toBeVisible();
  });

  test('creates QR code with UTM parameters', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();

    await page.locator(`${modal} input`).first().fill('https://qr-test.com');
    await page.locator(`${modal} input[placeholder*="holiday special"]`).fill('qr-campaign');
    await page.locator(`${modal} input[placeholder*="social"]`).fill('social');
    await page.locator(`${modal} input[placeholder*="facebook"]`).fill('facebook');

    await expect(page.locator(`${modal} img[alt="QR Preview"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`${modal} .font-mono`).last()).toContainText('qr-test.com');

    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=QR Code created')).toBeVisible();
    await expect(page.locator('td:has-text("qr-campaign")').first()).toBeVisible();
  });

  test('shows QR preview when URL is entered', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();

    await page.locator(`${modal} input`).first().fill('https://preview-test.com');
    await expect(page.locator(`${modal} img[alt="QR Preview"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`${modal}`)).toContainText('Download QR');
  });

  test('opens design QR template modal with all sections', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('Customize QR Code');
    await expect(page.locator(modal)).toContainText('Pattern');
    await expect(page.locator(modal)).toContainText('Corners');
    await expect(page.locator(modal)).toContainText('Code Color');
    await expect(page.locator(modal)).toContainText('Background Color');
    await expect(page.locator(modal)).toContainText('Add Logo');
    await expect(page.locator(modal)).toContainText('Template Name');
  });

  test('shows visual pattern thumbnails', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    // 6 pattern buttons with SVG icons
    const patternBtns = page.locator(`${modal}`).getByText('Pattern').locator('..').locator('button');
    await expect(patternBtns).toHaveCount(6);
    // First one should be selected by default
    await expect(patternBtns.first()).toHaveClass(/border-brand-500/);
  });

  test('selects different pattern', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    const patternBtns = page.locator(`${modal}`).getByText('Pattern').locator('..').locator('button');
    await patternBtns.nth(2).click();
    await expect(patternBtns.nth(2)).toHaveClass(/border-brand-500/);
    await expect(patternBtns.first()).not.toHaveClass(/border-brand-500/);
  });

  test('shows visual corner thumbnails', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    const cornerBtns = page.locator(`${modal}`).getByText('Corners').locator('..').locator('button');
    await expect(cornerBtns).toHaveCount(7);
  });

  test('selects different corner style', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    const cornerBtns = page.locator(`${modal}`).getByText('Corners').locator('..').locator('button');
    await cornerBtns.nth(3).click();
    await expect(cornerBtns.nth(3)).toHaveClass(/border-brand-500/);
  });

  test('switches code color to Linear Gradient', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();

    // Open color type dropdown for Code Color
    await page.locator(`${modal} button:has-text("Single Color")`).first().click();
    await expect(page.locator(`${modal} .absolute button:has-text("Linear Gradient")`)).toBeVisible();
    await expect(page.locator(`${modal} .absolute button:has-text("Radial Gradient")`)).toBeVisible();

    await page.locator(`${modal} .absolute button:has-text("Linear Gradient")`).click();

    // Second color picker should appear
    const colorInputs = page.locator(`${modal}`).getByText('Code Color').locator('..').locator('input[type="color"]');
    await expect(colorInputs).toHaveCount(2);
  });

  test('switches background color to Radial Gradient', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();

    // The second "Single Color" dropdown is for background
    await page.locator(`${modal} button:has-text("Single Color")`).last().click();
    await page.locator(`${modal} .absolute button:has-text("Radial Gradient")`).click();

    const bgColorInputs = page.locator(`${modal}`).getByText('Background Color').locator('..').locator('input[type="color"]');
    await expect(bgColorInputs).toHaveCount(2);
  });

  test('shows logo upload button', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await expect(page.locator(`${modal}`).getByText('Upload')).toBeVisible();
  });

  test('shows live QR preview', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await expect(page.locator(`${modal} [data-testid="qr-preview"] canvas`)).toBeVisible({ timeout: 5000 });
  });

  test('creates a QR design template', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input[placeholder*="Brand QR"]`).fill('My QR Design');
    await page.locator(`${modal} button:has-text("ADD QR CODE DESIGN")`).click();
    await expect(page.locator('text=QR template saved')).toBeVisible();
  });

  test('requires name for QR design template', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await page.locator(`${modal} button:has-text("ADD QR CODE DESIGN")`).click();
    await expect(page.locator('text=Template name is required')).toBeVisible();
  });

  test('opens edit QR template modal', async ({ page }) => {
    await page.getByRole('button', { name: 'EDIT QR TEMPLATE', exact: true }).click();
    await expect(page.locator(`${modal} h2`)).toContainText('QR Code Templates');
    await expect(page.locator(modal)).toContainText('No QR templates yet');
  });

  test('deletes a QR design template', async ({ page }) => {
    await page.getByRole('button', { name: 'DESIGN QR TEMPLATE', exact: true }).click();
    await page.locator(`${modal} input[placeholder*="Brand QR"]`).fill('Deletable QR');
    await page.locator(`${modal} button:has-text("ADD QR CODE DESIGN")`).click();
    await expect(page.locator('text=QR template saved')).toBeVisible();

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'EDIT QR TEMPLATE', exact: true }).click();
    await page.locator(`${modal} button:has-text("Delete")`).click();
    await expect(page.locator('text=QR template deleted')).toBeVisible();
  });

  test('QR code requires URL', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Copy & Save")`).click();
    await expect(page.locator('text=URL is required')).toBeVisible();
  });

  test('has search input', async ({ page }) => {
    await expect(page.locator('input[placeholder="Search..."]')).toBeVisible();
  });

  test('switches to existing link tab', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();
    await expect(page.locator(`${modal}`)).toContainText('Select a Link');
    await expect(page.locator(`${modal}`)).toContainText('No links found');
  });

  test('shows existing links in picker', async ({ page }) => {
    // Create a link first via the Links page
    await page.goto('/');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator('.modal-backdrop input[placeholder="https://example.com"]').fill('https://existing-link.com');
    await page.locator('.modal-backdrop input[placeholder*="holiday special"]').fill('existing-camp');
    await page.locator('.modal-backdrop input[placeholder*="banner ad"]').fill('email');
    await page.locator('.modal-backdrop button:has-text("Copy & Save")').click();
    await expect(page.locator('td:has-text("existing-camp")').first()).toBeVisible();

    // Go to QR Codes page and open create modal
    await page.goto('/qr-codes');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();

    // Link should appear in picker
    await expect(page.locator(`${modal}`)).toContainText('existing-link.com');
    await expect(page.locator(`${modal}`)).toContainText('existing-camp');
  });

  test('selects existing link and shows preview', async ({ page }) => {
    // Create a link
    await page.goto('/');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator('.modal-backdrop input[placeholder="https://example.com"]').fill('https://select-me.com');
    await page.locator('.modal-backdrop input[placeholder*="holiday special"]').fill('select-camp');
    await page.locator('.modal-backdrop button:has-text("Copy & Save")').click();
    await expect(page.locator('td:has-text("select-camp")').first()).toBeVisible();

    // Go to QR Codes, select existing link
    await page.goto('/qr-codes');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();

    // Click the link in the picker
    await page.locator(`${modal} button:has-text("select-me.com")`).click();

    // Should show selected link details and QR preview
    await expect(page.locator(`${modal}`)).toContainText('Selected Link');
    await expect(page.locator(`${modal} img[alt="QR Preview"]`)).toBeVisible({ timeout: 5000 });
  });

  test('generates QR for existing link and saves', async ({ page }) => {
    // Create a link
    await page.goto('/');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator('.modal-backdrop input[placeholder="https://example.com"]').fill('https://qr-existing.com');
    await page.locator('.modal-backdrop input[placeholder*="holiday special"]').fill('qr-existing');
    await page.locator('.modal-backdrop button:has-text("Copy & Save")').click();
    await expect(page.locator('td:has-text("qr-existing")').first()).toBeVisible();

    // Go to QR Codes, select existing link, save
    await page.goto('/qr-codes');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();
    await page.locator(`${modal} button:has-text("qr-existing.com")`).click();
    await expect(page.locator(`${modal} img[alt="QR Preview"]`)).toBeVisible({ timeout: 5000 });

    await page.locator(`${modal} button:has-text("Generate & Save")`).click();
    await expect(page.locator('text=QR Code added to existing link')).toBeVisible();

    // Link should now appear in the QR codes table
    await expect(page.locator('td:has-text("qr-existing")').first()).toBeVisible();
  });

  test('searches existing links in picker', async ({ page }) => {
    // Create two links
    await page.goto('/');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator('.modal-backdrop input[placeholder="https://example.com"]').fill('https://findable.com');
    await page.locator('.modal-backdrop input[placeholder*="holiday special"]').fill('findable');
    await page.locator('.modal-backdrop button:has-text("Copy & Save")').click();
    await expect(page.locator('td:has-text("findable")').first()).toBeVisible();

    await page.locator('button:has-text("CREATE LINK")').click();
    await page.locator('.modal-backdrop input[placeholder="https://example.com"]').fill('https://other-link.com');
    await page.locator('.modal-backdrop input[placeholder*="holiday special"]').fill('other');
    await page.locator('.modal-backdrop button:has-text("Copy & Save")').click();
    await expect(page.locator('td:has-text("other")').first()).toBeVisible();

    // Go to QR Codes, switch to existing, search
    await page.goto('/qr-codes');
    await page.waitForSelector('main h1');
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();

    await page.locator(`${modal} input[placeholder*="Search links"]`).fill('findable');
    await expect(page.locator(`${modal}`)).toContainText('findable.com');
    await expect(page.locator(`${modal}`)).not.toContainText('other-link.com');
  });

  test('requires link selection for existing link mode', async ({ page }) => {
    await page.locator('button:has-text("CREATE QR CODE")').click();
    await page.locator(`${modal} button:has-text("Existing Link")`).click();
    await page.locator(`${modal} button:has-text("Generate & Save")`).click();
    await expect(page.locator('text=Select a link first')).toBeVisible();
  });
});
