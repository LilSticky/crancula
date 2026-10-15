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

  test('loads Noto Sans, Libertinus Serif and Material Icons from the app, and no Roboto', async () => {
    const {window} = launched;

    const fonts = await window.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('16px "Noto Sans"'),
        document.fonts.load('600 16px "Libertinus Serif"'),
        document.fonts.load('24px "Material Icons"'),
      ]);
      const loaded = (family: string): boolean =>
        [...document.fonts].some((face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded');
      return {
        notoSansUsable: document.fonts.check('16px "Noto Sans"'),
        libertinusUsable: document.fonts.check('600 16px "Libertinus Serif"'),
        iconsUsable: document.fonts.check('24px "Material Icons"'),
        notoSansLoaded: loaded('Noto Sans'),
        libertinusLoaded: loaded('Libertinus Serif'),
        iconsLoaded: loaded('Material Icons'),
        robotoDeclared: [...document.fonts].some((face) => face.family.replace(/["']/g, '') === 'Roboto'),
      };
    });

    expect(fonts).toEqual({
      notoSansUsable: true,
      libertinusUsable: true,
      iconsUsable: true,
      notoSansLoaded: true,
      libertinusLoaded: true,
      iconsLoaded: true,
      robotoDeclared: false,
    });

    // The font files themselves must come from the app, not from the network.
    const appFontFiles = requestedUrls.filter((url) => /\.woff2(\?|$)/.test(url) && !/^https?:/.test(url));
    expect(appFontFiles.filter((url) => /noto-?sans/i.test(url))).not.toEqual([]);
    expect(appFontFiles.filter((url) => /libertinus/i.test(url))).not.toEqual([]);
    expect(appFontFiles.filter((url) => /material-?icons/i.test(url))).not.toEqual([]);
    expect(appFontFiles.filter((url) => /roboto/i.test(url))).toEqual([]);
  });
});
