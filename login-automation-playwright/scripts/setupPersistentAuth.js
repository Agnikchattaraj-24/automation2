require('dotenv').config();

const { chromium } = require('playwright');
const {
  clickSsoButton,
  ensurePersistentProfileDir,
  getPersistentProfilePath,
  getRequiredEnv,
  gotoLogin,
  stayOnHomepage,
  submitEmailStep,
  waitForEmailRouting,
} = require('../tests/helpers');

async function main() {
  ensurePersistentProfileDir();

  const profilePath = getPersistentProfilePath();
  const email = getRequiredEnv('LOGIN_EMAIL');
  const timeoutMs = Number(process.env.LOGIN_TIMEOUT_MS || 45000);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1440, height: 960 },
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    await gotoLogin(page);
    await submitEmailStep(page, email);

    const route = await waitForEmailRouting(page);

    if (route === 'sso_option') {
      await clickSsoButton(page);
    } else if (route !== 'sso_redirect') {
      throw new Error(`Expected SSO after entering email, but got route: ${route}`);
    }

    await stayOnHomepage(page);

    console.log(`Persistent profile saved at: ${profilePath}`);
    console.log('Microsoft session should now be reusable until it expires or is revoked.');
    await page.waitForTimeout(Math.min(timeoutMs, 2000));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
