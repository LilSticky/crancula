// HEADED=1 shows the window, slowed down and fully traced; otherwise runs are hidden and at full speed.
const headed = process.env['HEADED'] === '1';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  testIgnore: 'support/**',
  timeout: 45000,
  outputDir: './screenshots',
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      slowMo: headed ? 1000 : 0,
    },
    trace: headed ? 'on' : 'retain-on-failure',
  },
  expect: {
    toMatchSnapshot: { threshold: 0.2 },
  },
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
module.exports = config;
