import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Fonts ship with the app', () => {
  let launched: LaunchedApp;
  const requestedUrls: string[] = [];

  test.beforeAll(async () => {
    launched = await launchApp();
    launched.window.on('request', (request) => requestedUrls.push(request.url()));
    // Reload so that every request of the start page is recorded.
    await launched.window.reload();
    await launched.window.waitForLoadState('domcontentloaded');
    // The Organ editor renders mat-icons, which use the Material Icons font.
    await launched.window.getByRole('link', {name: 'Organs'}).click();
    await launched.window.getByTestId('new-organ').click();
    await expect(launched.window.locator('mat-icon').first()).toBeVisible();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('requests no font from an external origin', async () => {
    const {window} = launched;
    await window.evaluate(() => document.fonts.ready.then(() => undefined));

    const external = requestedUrls.filter((url) => /^https?:/.test(url));
    expect(external).toEqual([]);
  });

  test('loads Roboto and Material Icons from the app', async () => {
    const {window} = launched;

    const fonts = await window.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([document.fonts.load('16px Roboto'), document.fonts.load('24px "Material Icons"')]);
      const loaded = (family: string): boolean =>
        [...document.fonts].some((face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded');
      return {
        robotoUsable: document.fonts.check('16px Roboto'),
        iconsUsable: document.fonts.check('24px "Material Icons"'),
        robotoLoaded: loaded('Roboto'),
        iconsLoaded: loaded('Material Icons'),
      };
    });

    expect(fonts).toEqual({robotoUsable: true, iconsUsable: true, robotoLoaded: true, iconsLoaded: true});

    // The font files themselves must come from the app, not from the network.
    const appFontFiles = requestedUrls.filter((url) => /\.woff2(\?|$)/.test(url) && !/^https?:/.test(url));
    expect(appFontFiles.filter((url) => /roboto/i.test(url))).not.toEqual([]);
    expect(appFontFiles.filter((url) => /material-?icons/i.test(url))).not.toEqual([]);
  });
});
