import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Home page', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await launched.app.context().tracing.start({screenshots: true, snapshots: true});
  });

  test.afterAll(async () => {
    await launched.app.context().tracing.stop({path: 'e2e/tracing/trace.zip'});
    await launched.app.close();
  });

  test('launches the Electron app', async () => {
    const windowState = await launched.app.evaluate(async ({BrowserWindow}) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const getState = () => ({
        isVisible: mainWindow.isVisible(),
        isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        isCrashed: mainWindow.webContents.isCrashed(),
      });
      return new Promise<ReturnType<typeof getState>>((resolve) => {
        if (mainWindow.isVisible()) {
          resolve(getState());
        } else {
          mainWindow.once('ready-to-show', () => setTimeout(() => resolve(getState()), 0));
        }
      });
    });

    expect(windowState.isVisible).toBeTruthy();
    expect(windowState.isDevToolsOpened).toBeFalsy();
    expect(windowState.isCrashed).toBeFalsy();
  });

  test('shows the home page title', async () => {
    await expect(launched.window.locator('cranc-home-page h1')).toHaveText('Overview');
  });
});
