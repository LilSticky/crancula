// Captures the screens for UX reviews (`ux-review` skill); not part of the e2e suite.
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  testMatch: '*.capture.ts',
  timeout: 120000,
  outputDir: '../screenshots/ux',
  use: {headless: false},
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
module.exports = config;
