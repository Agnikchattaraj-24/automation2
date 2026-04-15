const { expect, test } = require('@playwright/test');
const {
  fillEmailLogin,
  getRequiredEnv,
  gotoLogin,
  stayOnHomepage,
} = require('./helpers');

const LOGIN_URL = 'https://dev.aqueralabs.com/home/login';

async function openOperationsCenterApps(page) {
  const operationsCenterNav = page
    .getByRole('link', { name: /operations center/i })
    .or(page.getByRole('button', { name: /operations center/i }))
    .first();

  await expect(operationsCenterNav).toBeVisible({ timeout: 120000 });
  await operationsCenterNav.click();

  const appsView = page
    .getByRole('tab', { name: /^apps$/i })
    .or(page.getByRole('button', { name: /^apps$/i }))
    .or(page.getByRole('link', { name: /^apps$/i }))
    .first();

  await expect(appsView).toBeVisible({ timeout: 120000 });
  await appsView.click();
}

async function selectApplication(page, applicationName) {
  const appLocator = page
    .getByRole('link', { name: new RegExp(`^${applicationName}$`, 'i') })
    .or(page.getByRole('button', { name: new RegExp(`^${applicationName}$`, 'i') }))
    .or(page.getByText(new RegExp(`^${applicationName}$`, 'i')))
    .first();

  await expect(appLocator).toBeVisible({ timeout: 120000 });
  await appLocator.click();
}

test.describe('Aquera login automation', () => {
  test('Saved SSO session lands on Ops Center overview', async ({ page }) => {
    await gotoLogin(page);
    await stayOnHomepage(page);
  });

  test('Saved session can reopen the overview page without reauth', async ({ page }) => {
    await gotoLogin(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await stayOnHomepage(page);
  });

  test('Password login opens the AD-OU Application Connection Report', async ({ page }) => {
    const email = getRequiredEnv('LOGIN_EMAIL');
    const password = getRequiredEnv('LOGIN_PASSWORD');

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await fillEmailLogin(page, email, password);

    await openOperationsCenterApps(page);
    await selectApplication(page, 'AD-OU');

    await expect(
      page.getByRole('heading', { name: /application connection report/i }).first()
        .or(page.getByText(/application connection report/i).first())
    ).toBeVisible({ timeout: 120000 });
    await expect(page.getByText(/^AD-OU$/i).first()).toBeVisible({ timeout: 120000 });
  });
});
