import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test.describe('GAP-04: Alert resolution_source tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all first (Playwright LIFO — lowest priority)
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Alert rules (for scanAlerts — return empty so scan is a no-op)
    await page.route(`**${SB}/rest/v1/alert_rules**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Let /rest/v1/users reach the real DB — auth context must resolve Engineer role
    // so canDismiss is true and the dismiss button is rendered.
    await page.route(`**${SB}/rest/v1/users**`, route => route.continue())
  })

  test('manual dismiss sends resolution_source=manual and resolved_by', async ({ page }) => {
    // Active alerts GET returns one alert; PATCH returns 204
    await page.route(`**${SB}/rest/v1/alerts**`, route => {
      const method = route.request().method()
      if (method === 'PATCH') {
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'alert-uuid-1',
            severity: 'warning',
            message: 'Test batch held',
            batch_id: null,
            created_at: '2026-06-25T10:00:00Z',
          },
        ]),
      })
    })

    await page.goto('/alerts')
    await expect(page.getByText('Test batch held')).toBeVisible()

    // Capture the PATCH request when dismiss is clicked
    const [patchReq] = await Promise.all([
      page.waitForRequest(req =>
        req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH'
      ),
      page.getByRole('button', { name: /dismiss/i }).click(),
    ])

    const body = patchReq.postDataJSON()
    expect(body).toHaveProperty('resolution_source', 'manual')
    expect(body).toHaveProperty('resolved_by')
    expect(body).toHaveProperty('resolved_at')
  })
})
