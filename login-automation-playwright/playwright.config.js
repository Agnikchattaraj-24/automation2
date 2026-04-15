require('dotenv').config();

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const timeoutMs = Number(process.env.LOGIN_TIMEOUT_MS || 45000);
const authStatePath = process.env.AUTH_STATE_PATH || path.join(__dirname, 'playwright/.auth/user.json');

module.exports = defineConfig({
  testDir: './tests',
  timeout: timeoutMs,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
      },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePath,
      },
    },
  ],
});
