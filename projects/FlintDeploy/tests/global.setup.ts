import { test as setup } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const authFile = 'tests/.auth/engineer.json'
const adminAuthFile = 'tests/.auth/admin.json'

setup('authenticate as dev engineer', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await page.goto('/login')
  await page.fill('#email', 'dev.engineer@flintlabs.com')
  await page.fill('#password', 'Test1234')
  await page.click('button[type="submit"]')

  // Wait for redirect to the dashboard after successful login
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})

setup('authenticate as dev admin', async ({ page }) => {
  fs.mkdirSync(path.dirname(adminAuthFile), { recursive: true })

  await page.goto('/login')
  await page.fill('#email', 'dev.admin@flintlabs.com')
  await page.fill('#password', 'Test1234')
  await page.click('button[type="submit"]')

  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 15_000 })

  await page.context().storageState({ path: adminAuthFile })
})
