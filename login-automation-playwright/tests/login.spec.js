const { test } = require('@playwright/test');
const {
  expectSuccessfulLogin,
  gotoLogin,
} = require('./helpers');

test.describe('Aquera login automation', () => {
  test('Saved SSO session lands on Ops Center overview', async ({ page }) => {
    await gotoLogin(page);
    await expectSuccessfulLogin(page);
  });

  test('Saved session can reopen the overview page without reauth', async ({ page }) => {
    await gotoLogin(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectSuccessfulLogin(page);
  });
});
