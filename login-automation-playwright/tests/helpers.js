const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEFAULT_POST_LOGIN_REGEX = /securehome|ops-center|overview/i;
const DEFAULT_SSO_HOST_REGEX = /(microsoftonline|login\.microsoft|okta|google|onelogin|auth0)/i;
const DEFAULT_AUTH_STATE_PATH = path.join(__dirname, '..', 'playwright/.auth/user.json');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalRegex(name, fallback) {
  const value = process.env[name];
  return value ? new RegExp(value, 'i') : fallback;
}

function getAuthStatePath() {
  return process.env.AUTH_STATE_PATH || DEFAULT_AUTH_STATE_PATH;
}

function ensureAuthStateDir() {
  fs.mkdirSync(path.dirname(getAuthStatePath()), { recursive: true });
}

async function gotoLogin(page) {
  await page.goto(getRequiredEnv('BASE_URL'), { waitUntil: 'domcontentloaded' });
}

async function resolvePrimaryEmailInput(page) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidates = [
      page.getByRole('textbox'),
      page.getByLabel(/email/i),
      page.getByPlaceholder(/email/i),
      page.locator('input[type="email"]'),
      page.locator('input:not([type="hidden"])'),
    ];

    for (const candidate of candidates) {
      if (await candidate.first().isVisible().catch(() => false)) {
        return candidate.first();
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Could not find the primary email textbox on the Aquera login page.');
}

async function clickIfVisible(page, selector) {
  if (!selector) {
    return false;
  }

  const locator = page.locator(selector).first();
  if (await locator.count()) {
    await locator.click();
    return true;
  }

  return false;
}

async function openEmailFormIfNeeded(page) {
  if (await clickIfVisible(page, process.env.EMAIL_TRIGGER_SELECTOR)) {
    return;
  }

  const triggerCandidates = [
    page.getByRole('button', { name: /email/i }),
    page.getByRole('link', { name: /email/i }),
    page.getByText(/continue with email/i),
    page.getByText(/sign in with email/i),
    page.getByText(/use email/i),
  ];

  for (const candidate of triggerCandidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      await candidate.first().click();
      return;
    }
  }
}

async function resolveEmailInput(page) {
  if (process.env.EMAIL_INPUT_SELECTOR) {
    return page.locator(process.env.EMAIL_INPUT_SELECTOR).first();
  }

  const candidates = [
    await resolvePrimaryEmailInput(page),
    page.getByLabel(/email/i),
    page.getByPlaceholder(/email/i),
    page.locator('input[type="email"]'),
    page.locator('input[name*="email" i]'),
    page.locator('input[id*="email" i]'),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }

  throw new Error('Could not find an email input. Set EMAIL_INPUT_SELECTOR if the page uses a custom field.');
}

async function resolvePasswordInput(page) {
  if (process.env.PASSWORD_INPUT_SELECTOR) {
    return page.locator(process.env.PASSWORD_INPUT_SELECTOR).first();
  }

  const candidates = [
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.locator('input[type="password"]'),
    page.locator('input[name*="password" i]'),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }

  return null;
}

async function submitEmailStep(page, email) {
  const emailInput = await resolvePrimaryEmailInput(page);
  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);

  const continueButton = page.getByRole('button', { name: /continue/i }).first();
  await expect(continueButton).toBeVisible();
  await continueButton.click();
}

async function waitForEmailRouting(page) {
  const ssoButton = page.getByRole('button', { name: /continue with single sign-on/i }).first();
  const passwordFallback = page.getByRole('button', { name: /use password instead/i }).first();
  const passwordField = page.locator('input[type="password"]').first();
  const ssoRegex = getOptionalRegex('SSO_HOST_REGEX', DEFAULT_SSO_HOST_REGEX);

  await page.waitForTimeout(1500);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const url = page.url();

    if (ssoRegex.test(url)) {
      return 'sso_redirect';
    }

    if (await passwordField.isVisible().catch(() => false)) {
      return 'password_form';
    }

    if (await passwordFallback.isVisible().catch(() => false)) {
      return 'password_option';
    }

    if (await ssoButton.isVisible().catch(() => false)) {
      return 'sso_option';
    }

    await page.waitForTimeout(500);
  }

  return 'unknown';
}

async function resolveEmailSubmit(page) {
  if (process.env.EMAIL_SUBMIT_SELECTOR) {
    return page.locator(process.env.EMAIL_SUBMIT_SELECTOR).first();
  }

  const candidates = [
    page.getByRole('button', { name: /sign in|log in|continue|next|submit/i }),
    page.getByRole('link', { name: /sign in|log in|continue|next/i }),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      return candidate.first();
    }
  }

  throw new Error('Could not find a submit button. Set EMAIL_SUBMIT_SELECTOR if needed.');
}

async function fillEmailLogin(page, email, password) {
  await openEmailFormIfNeeded(page);
  await submitEmailStep(page, email);

  const route = await waitForEmailRouting(page);

  if (route === 'sso_redirect' || route === 'sso_option') {
    throw new Error('This account is configured for SSO after the email step. A password login is not available for the current email.');
  }

  if (route === 'password_option') {
    await page.getByRole('button', { name: /use password instead/i }).first().click();
  }

  const passwordInput = await resolvePasswordInput(page);
  if (!passwordInput) {
    throw new Error('Password input did not appear after choosing the password flow.');
  }

  if (!password) {
    throw new Error('Password login is available, but LOGIN_PASSWORD is empty. Add it to .env before running the email login test.');
  }

  await passwordInput.fill(password);

  const submit = await resolveEmailSubmit(page);
  await submit.click();
}

async function clickSsoButton(page) {
  if (await clickIfVisible(page, process.env.SSO_BUTTON_SELECTOR)) {
    return;
  }

  const candidates = [
    page.getByRole('button', { name: /sso|single sign-on|microsoft|azure|google|okta/i }),
    page.getByRole('link', { name: /sso|single sign-on|microsoft|azure|google|okta/i }),
    page.getByText(/sign in with sso/i),
    page.getByText(/continue with sso/i),
    page.getByText(/microsoft/i),
  ];

  for (const candidate of candidates) {
    if (await candidate.first().isVisible().catch(() => false)) {
      await candidate.first().click();
      return;
    }
  }

  throw new Error('Could not find an SSO button. Set SSO_BUTTON_SELECTOR if the app uses a custom control.');
}

async function expectSuccessfulLogin(page) {
  const postLoginRegex = getOptionalRegex('POST_LOGIN_URL_REGEX', DEFAULT_POST_LOGIN_REGEX);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(postLoginRegex, { timeout: 120000 });
}

async function expectSsoRedirect(page, popupPromise) {
  const ssoHostRegex = getOptionalRegex('SSO_HOST_REGEX', DEFAULT_SSO_HOST_REGEX);

  const popup = await popupPromise.catch(() => null);
  if (popup) {
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(ssoHostRegex);
    return;
  }

  await page.waitForLoadState('domcontentloaded');
  const currentUrl = page.url();
  const appUrl = getRequiredEnv('BASE_URL');
  const leftApp = !currentUrl.startsWith(appUrl);
  expect(leftApp || ssoHostRegex.test(currentUrl)).toBeTruthy();
}

module.exports = {
  clickSsoButton,
  ensureAuthStateDir,
  expectSuccessfulLogin,
  expectSsoRedirect,
  fillEmailLogin,
  getAuthStatePath,
  getRequiredEnv,
  gotoLogin,
  submitEmailStep,
  waitForEmailRouting,
};
