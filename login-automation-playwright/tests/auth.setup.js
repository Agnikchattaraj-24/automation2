const { test } = require('@playwright/test');
const {
  clickSsoButton,
  ensureAuthStateDir,
  getAuthStatePath,
  getRequiredEnv,
  gotoLogin,
  stayOnHomepage,
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

    await stayOnHomepage(page);
    ensureAuthStateDir();
    await context.storageState({ path: authStatePath });
  });
});
