import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'sprint3',
      testDir: './tests/sprint3',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint4',
      testDir: './tests/sprint4',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
