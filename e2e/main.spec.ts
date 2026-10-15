import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Start page', () => {
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
    const windowState = await launched.app.evaluate(({BrowserWindow}) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      return {
        isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        isCrashed: mainWindow.webContents.isCrashed(),
      };
    });

    expect(windowState.isDevToolsOpened).toBeFalsy();
    expect(windowState.isCrashed).toBeFalsy();
  });

  test('opens on the Organ list', async () => {
    await expect(launched.window.locator('cranc-organ-list')).toBeVisible();
    await expect(launched.window.getByTestId('new-organ')).toBeVisible();
  });
});
