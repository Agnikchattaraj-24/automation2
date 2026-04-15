require('dotenv').config();

const { chromium } = require('playwright');
const {
  ensurePersistentProfileDir,
  getPersistentProfilePath,
  gotoLogin,
  stayOnHomepage,
} = require('../tests/helpers');

async function main() {
  ensurePersistentProfileDir();

  const profilePath = getPersistentProfilePath();
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1440, height: 960 },
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    await gotoLogin(page);
    await stayOnHomepage(page);

    console.log(`Reused persistent profile at: ${profilePath}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
