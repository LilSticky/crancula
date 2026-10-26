import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';

const CUTTING_MAT = {
  name: 'Cutting mat',
  workingLength: '300',
  workingWidth: '120',
  /** The default Overlap of a new Plotter. */
  overlap: '20',
} as const;

test.describe('Cutting mat', () => {
  test('is described with the default Overlap, listed, and still there after a restart', async () => {
    const first = await launchApp();
    const {window} = first;

    await window.getByRole('link', {name: 'Plotters'}).click();
    await window.getByTestId('new-plotter').click();
    await window.getByTestId('plotter-name').fill(CUTTING_MAT.name);
    await window.getByTestId('plotter-working-length').fill(CUTTING_MAT.workingLength);
    await window.getByTestId('plotter-working-width').fill(CUTTING_MAT.workingWidth);
    await expect(window.getByTestId('plotter-overlap')).toHaveValue(CUTTING_MAT.overlap);
    await window.getByTestId('save-plotter').click();

    await expect(window).toHaveURL(/#?\/plotters$/);
    const row = window.getByTestId('plotter-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CUTTING_MAT.name);
    await expect(row).toContainText(`${CUTTING_MAT.workingLength} × ${CUTTING_MAT.workingWidth} mm`);
    await expect(row).toContainText(`${CUTTING_MAT.overlap} mm`);
    await first.app.close();

    const {app, window: restarted} = await launchApp(first.userDataDir);
    await restarted.getByRole('link', {name: 'Plotters'}).click();
    await restarted.getByTestId('plotter-row').click();

    await expect(restarted.getByTestId('plotter-name')).toHaveValue(CUTTING_MAT.name);
    await expect(restarted.getByTestId('plotter-working-length')).toHaveValue(CUTTING_MAT.workingLength);
    await expect(restarted.getByTestId('plotter-working-width')).toHaveValue(CUTTING_MAT.workingWidth);
    await expect(restarted.getByTestId('plotter-overlap')).toHaveValue(CUTTING_MAT.overlap);
    await app.close();
  });
});
