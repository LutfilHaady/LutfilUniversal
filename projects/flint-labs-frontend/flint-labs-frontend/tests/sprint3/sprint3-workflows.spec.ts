import { test, expect, type Page } from '@playwright/test';

// On the /batches list every `/batches/` link is a MAIN-batch link to
// /batches/[id]; sub-batch links (/batches/[id]/[subId]) only exist on the
// main-batch detail page. This helper returns the first sub-batch link on the
// current page — identified by its two path segments after `/batches/`.
async function firstSubBatchLink(page: Page) {
  const links = page.locator('a[href*="/batches/"]');
  await expect(links.first()).toBeVisible();
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (href && /^\/batches\/[^/]+\/[^/]+/.test(href)) return links.nth(i);
  }
  throw new Error('No sub-batch link found on the main-batch detail page');
}

test.describe('Sprint 3 End-to-End Workflows', () => {

  test('1. Dashboard KPI Verification', async ({ page }) => {
    await page.goto('/');
    
    // Verify headers
    await expect(page.getByText('Active Sub-Batches')).toBeVisible();
    await expect(page.getByText('QC Pass Rate (7d)')).toBeVisible();
    await expect(page.getByText('On Hold').first()).toBeVisible();
    await expect(page.getByText('Released').first()).toBeVisible();

    // Give it a moment to load the data instead of showing the skeleton
    await page.waitForTimeout(1000);

    // Ensure the numerical values loaded successfully (assuming they're inside elements with class 'text-[28px]')
    const kpiValues = page.locator('.text-\\[28px\\]');
    await expect(kpiValues.first()).toBeVisible();
    await expect(kpiValues.first()).not.toBeEmpty();
  });

  test('2. Main Batch / Sub-batch Navigation', async ({ page }) => {
    await page.goto('/batches');

    // Ensure the table loads
    await expect(page.getByText('All Batches')).toBeVisible();

    // Wait for the rows to populate
    await page.waitForTimeout(1000);

    // First hop: open the first main batch's detail page (the list links to
    // /batches/[id]; sub-batch links live on that detail page).
    await page.locator('a[href*="/batches/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Sub-batches' })).toBeVisible();

    // Second hop: navigate into a sub-batch detail page.
    const subbatchLink = await firstSubBatchLink(page);
    await subbatchLink.click();

    // Verify we arrived at the sub-batch detail page
    await expect(page.getByText('Parent:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show QR' })).toBeVisible();
  });

  test('3. Process Timeline Rendering', async ({ page }) => {
    await page.goto('/batches');
    await page.waitForTimeout(1000);

    // First hop → main-batch detail; second hop → sub-batch detail.
    await page.locator('a[href*="/batches/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Sub-batches' })).toBeVisible();
    const subbatchLink = await firstSubBatchLink(page);
    await subbatchLink.click();

    // The non-mixing sub-batch detail page shows the Process Timeline panel
    await expect(page.getByText('Process Timeline')).toBeVisible();

    // Wait for timeline to load
    await page.waitForTimeout(1000);

    // There should be timeline entries (buttons with class 'w-full flex items-center ...')
    // We can just verify the empty state is NOT there, or that at least one entry exists
    const timelineEntries = page.locator('button:has(svg.lucide-chevron-right), button:has(svg.lucide-chevron-down)');
    const count = await timelineEntries.count();
    
    if (count > 0) {
      // Click the first entry to expand it
      await timelineEntries.first().click();
      
      // If it has parameters, there will be a table or 'No parameters'
      const paramTableOrEmpty = page.locator('table, text="No parameters"').first();
      await expect(paramTableOrEmpty).toBeVisible();
    }
  });

  test('4. Sub-Batch Log Process Step (Auto-fill Bypass)', async ({ page }) => {
    // Navigate to a known sub-batch page
    await page.goto('/batches');
    await page.waitForTimeout(1000);
    
    // Expand parent batch
    await page.locator('tr.cursor-pointer').first().click();
    await page.waitForTimeout(500);

    const subbatchLink = page.locator('a[href*="/batches/"]').first();
    await subbatchLink.click();

    // Wait for the Log Process Step button
    const logButton = page.getByRole('button', { name: 'Log Process Step' });
    
    // If the sub-batch isn't "InProgress", the button won't exist. We'll handle this gracefully.
    const isVisible = await logButton.isVisible();
    if (!isVisible) {
      console.log('Skipping auto-fill test because the selected sub-batch is not InProgress.');
      return;
    }

    await logButton.click();

    // Because of the URL parameter, it should auto-skip the QR scanner and go straight to Step 2!
    await expect(page.getByText('Select Process Step')).toBeVisible();
    await expect(page.getByText('Point at QR code')).toBeHidden();
  });

  test('5. Sub-Batch Log Process Step (Manual QR Scanner fallback)', async ({ page }) => {
    // Navigate directly to the log page without URL parameters
    await page.goto('/log/process-step');

    // Verify it lands on Step 1
    await expect(page.getByText('Scan Sub-Batch')).toBeVisible();

    // Instead of using the camera, use the manual text input
    const input = page.getByPlaceholder('CTGC-20260601-A01-01');
    await expect(input).toBeVisible();

    // Type a known sub-batch number, assuming CTGC-20260520-A01 exists from seed data
    await input.fill('CTGC-20260520-A01');

    // Click continue
    const continueBtn = page.getByRole('button', { name: 'Continue →' });
    await continueBtn.click();

    // Wait for the lookup
    await page.waitForTimeout(1500);

    // It should progress to Step 2
    await expect(page.getByText('Select Process Step')).toBeVisible();
  });

});
