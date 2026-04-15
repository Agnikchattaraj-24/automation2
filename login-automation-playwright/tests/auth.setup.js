const { test } = require('@playwright/test');
const {
  clickSsoButton,
  ensureAuthStateDir,
  expectSuccessfulLogin,
  getAuthStatePath,
  getRequiredEnv,
  gotoLogin,
  submitEmailStep,
  waitForEmailRouting,
} = require('./helpers');

test.describe('Auth setup flows', () => {
  test('email continue then SSO saves authenticated session', async ({ page, context }) => {
    const email = getRequiredEnv('LOGIN_EMAIL');
    const authStatePath = getAuthStatePath();

    await gotoLogin(page);
    await submitEmailStep(page, email);

    const route = await waitForEmailRouting(page);

    if (route === 'sso_option') {
      await clickSsoButton(page);
    } else if (route !== 'sso_redirect') {
      throw new Error(`Expected SSO after entering email, but got route: ${route}`);
    }

    await expectSuccessfulLogin(page);
    ensureAuthStateDir();
    await context.storageState({ path: authStatePath });
  });
});
