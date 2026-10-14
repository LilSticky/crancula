/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  timeout: 45000,
  outputDir: './screenshots',
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    // Slowed down locally so that a run can be watched; full speed in CI.
    launchOptions: {
      slowMo: process.env['CI'] ? 0 : 1000,
    },
    trace: process.env['CI'] ? 'retain-on-failure' : 'on',
  },
  expect: {
    toMatchSnapshot: { threshold: 0.2 },
  },
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
module.exports = config;
