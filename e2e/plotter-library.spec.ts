import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineOctaveOrgan, songRepeatingC4, createTapeFromSong} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

const CUTTING_MAT = {
  name: 'Cutting mat',
  workingLength: '300',
  workingWidth: '120',
  /** The default Overlap of a new Plotter. */
  overlap: '20',
} as const;

/** Describes the Cutting mat from the Plotter list, with the default Overlap. */
async function describeCuttingMat(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Plotters'}).click();
  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill(CUTTING_MAT.name);
  await window.getByTestId('plotter-working-length').fill(CUTTING_MAT.workingLength);
  await window.getByTestId('plotter-working-width').fill(CUTTING_MAT.workingWidth);
  await expect(window.getByTestId('plotter-overlap')).toHaveValue(CUTTING_MAT.overlap);
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);
}

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

  test('changes its working length, lists the new length, and keeps it after a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await describeCuttingMat(window);

    await window.getByTestId('plotter-row').click();
    await window.getByTestId('plotter-working-length').fill('400');
    await window.getByTestId('save-plotter').click();

    await expect(window).toHaveURL(/#?\/plotters$/);
    await expect(window.getByTestId('plotter-row')).toContainText(`400 × ${CUTTING_MAT.workingWidth} mm`);
    await first.app.close();

    const {app, window: restarted} = await launchApp(first.userDataDir);
    await restarted.getByRole('link', {name: 'Plotters'}).click();
    await restarted.getByTestId('plotter-row').click();

    await expect(restarted.getByTestId('plotter-working-length')).toHaveValue('400');
    await app.close();
  });

  test('removed from the list, the Tape view shows No Plotter and the Tapes stay as they are', async () => {
    const launched = await launchApp();
    await resizeWindowOrSkip(launched, 1280, 800); // The Plotter picker lives in the side panel, which the compact layout hides.
    const {app, window} = launched;
    await defineOctaveOrgan(window, 'Drehorgel');
    await describeCuttingMat(window);
    await createTapeFromSong(window, 'Tonleiter', songRepeatingC4('c4s.mid', 4));
    await window.getByTestId('plotter-picker').click();
    await window.getByRole('option', {name: CUTTING_MAT.name}).click();
    await expect(window.getByTestId('plotter-picker')).toContainText(CUTTING_MAT.name);
    await window.getByRole('link', {name: 'Tapes', exact: true}).click();
    const lengthBefore = await window.getByTestId('tape-length-columns').textContent();

    await window.getByRole('link', {name: 'Plotters'}).click();
    await window.getByRole('button', {name: `More actions for ${CUTTING_MAT.name}`}).click();
    await window.getByTestId('remove-plotter').click();
    await window.getByRole('button', {name: 'Confirm'}).click();
    await expect(window.getByTestId('plotter-row')).toHaveCount(0);

    await window.getByRole('link', {name: 'Tapes', exact: true}).click();
    await expect(window.getByTestId('tape')).toHaveCount(1);
    await expect(window.getByTestId('tape-name')).toContainText('Tonleiter');
    await expect(window.getByTestId('tape-length-columns')).toHaveText(lengthBefore ?? '');
    await window.getByTestId('open-tape').filter({hasText: 'Tonleiter'}).click();
    await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText('Tonleiter');
    await expect(window.getByTestId('plotter-picker')).toContainText('No Plotter');
    await app.close();
  });

  test('is described from the Tape view with Describe a Plotter, which opens the editor', async () => {
    const launched = await launchApp();
    await resizeWindowOrSkip(launched, 1280, 800);
    const {app, window} = launched;
    await defineOctaveOrgan(window, 'Drehorgel');
    await createTapeFromSong(window, 'Tonleiter', songRepeatingC4('c4s.mid', 4));

    await expect(window.getByTestId('plotter-describe')).toHaveText('Describe a Plotter…');
    await window.getByTestId('plotter-describe').click();

    await expect(window).toHaveURL(/#?\/plotters\/new$/);
    await expect(window.getByTestId('plotter-name')).toBeVisible();
    await expect(window.getByRole('heading', {name: 'New Plotter'})).toBeVisible();
    await app.close();
  });
});
