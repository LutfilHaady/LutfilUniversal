import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  // Hard cap per test — prevents any single test from blocking the runner
  // indefinitely (e.g. WASM load stall, camera hang, unmocked fetch).
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Navigation timeout: fail fast if the dev server is unresponsive
    navigationTimeout: 15_000,
    actionTimeout: 8_000,
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
    {
      name: 'sprint5',
      testDir: './tests/sprint5',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint6',
      testDir: './tests/sprint6',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint7',
      testDir: './tests/sprint7',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint8',
      testDir: './tests/sprint8',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint9',
      testDir: './tests/sprint9',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint10',
      testDir: './tests/sprint10',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint11',
      testDir: './tests/sprint11',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint12',
      testDir: './tests/sprint12',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint13',
      testDir: './tests/sprint13',
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
