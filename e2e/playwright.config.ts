// HEADED=1 shows the window, slowed down and fully traced; otherwise runs are hidden and at full speed.
const headed = process.env['HEADED'] === '1';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  timeout: 45000,
  outputDir: './screenshots',
  // Under xvfb (Linux CI) a hidden window renders about one frame per second while a second app runs.
  workers: process.platform === 'linux' ? 1 : undefined,
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
