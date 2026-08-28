import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MATERIALS_MOCK = [
  {
    id: 'mat-1', code: 'MTC1', name: 'Cathode Material C1',
    suffix: null, type: 'Cathode Electrode',
    min_storage_threshold: 100, shelf_life_days: 365, first_process_id: 'proc-1',
  },
  {
    id: 'mat-2', code: 'MTDW', name: 'DI Water',
    suffix: null, type: 'Electrolyte',
    min_storage_threshold: 50, shelf_life_days: null, first_process_id: null,
  },
  {
    id: 'mat-3', code: 'MTB9', name: 'Material B9',
    suffix: 'B9', type: 'Cathode Electrode',
    min_storage_threshold: null, shelf_life_days: null, first_process_id: null,
  },
]

const STOCK_MOCK = [
  { material_id: 'mat-1', total_stock: 250 },
  { material_id: 'mat-2', total_stock: 30 },
]

const PROCESSES_MOCK = [
  { id: 'proc-1', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1 },
]

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/materials*`, async route => {
    const method = route.request().method()
    if (method === 'POST') return route.fulfill({ status: 201, body: '' })
    if (method === 'PATCH') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MATERIALS_MOCK),
    })
  })

  await page.route(`**${SB}/rest/v1/material_stock_totals*`, async route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(STOCK_MOCK),
    })
  )

  await page.route(`**${SB}/rest/v1/processes*`, async route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(PROCESSES_MOCK),
    })
  )

  // Catch-all — runs first (registered last = highest priority in Playwright).
  // fallback() for already-mocked tables so they fall through to specific handlers.
  // continue() for /users so auth still resolves. Everything else → empty array.
  await page.route(`**${SB}/rest/v1/**`, async route => {
    const url = route.request().url()
    if (url.includes('/rest/v1/users')) return route.continue()
    if (url.includes('/rest/v1/materials')) return route.fallback()
    if (url.includes('/rest/v1/material_stock_totals')) return route.fallback()
    if (url.includes('/rest/v1/processes')) return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test.describe('Materials page — /materials', () => {
  test('renders KPI cards with correct counts', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('materials-kpi-total')).toContainText('3')
    // MTDW has stock 30 < threshold 50 → 1 low stock
    await expect(page.getByTestId('materials-kpi-low-stock')).toContainText('1')
  })

  test('renders all material rows in the grid', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByText('MTC1')).toBeVisible()
    await expect(page.getByText('MTDW')).toBeVisible()
    await expect(page.getByText('MTB9')).toBeVisible()
  })

  test('low-stock row shows Low badge', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('stock-badge-mat-2')).toContainText('Low')
  })

  test('ok-stock row shows OK badge', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('stock-badge-mat-1')).toContainText('OK')
  })

  test('Register button opens modal for Engineer', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('register-material-btn').click()
    await expect(page.getByTestId('material-modal')).toBeVisible()
    await expect(page.getByLabel('Code')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
  })

  test('Register modal happy path sends POST with correct body', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('register-material-btn').click()

    await page.getByLabel('Code').fill('MTB9')
    await page.getByLabel('Name').fill('Material B9')
    await page.getByLabel('Suffix').fill('B9')

    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/materials') && req.method() === 'POST'
    )
    await page.getByRole('button', { name: 'Save material' }).click()
    const postReq = await postPromise
    const body = JSON.parse(postReq.postData() ?? '{}')
    expect(body.code).toBe('MTB9')
    expect(body.name).toBe('Material B9')
    expect(body.suffix).toBe('B9')
  })

  test('Edit button opens modal pre-filled with material data', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('edit-material-mat-1').click()
    await expect(page.getByTestId('material-modal')).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveValue('Cathode Material C1')
  })
})
