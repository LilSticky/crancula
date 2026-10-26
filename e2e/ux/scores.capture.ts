import {expect, test, type Page} from '@playwright/test';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scoreXml, type MeasureEntry, type NoteSpec, type PitchSpec, type ScoreSpec} from '../../api/song/musicxml/score-test-helper';
import {launchApp} from '../support/launch-app';
import {defineOctaveOrgan} from '../support/tape-creation';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

function quarter(step: PitchSpec['step'], octave: number, staff: number, voice: number): NoteSpec {
  return {kind: 'note', pitch: {step, octave}, duration: 1, staff, voice};
}

/** A piano with two staves (two Parts) in 3/4, G major, with an upbeat of one quarter. */
const WALTZ: ScoreSpec = {
  workTitle: 'Waltz with upbeat',
  parts: [
    {
      name: 'Piano',
      staves: 2,
      measures: [
        {
          number: 1,
          implicit: true,
          entries: [
            {kind: 'attributes', divisions: 1, time: {beats: 3, beatType: 4}, key: {fifths: 1, mode: 'major'}, clef: {sign: 'G', line: 2, staff: 1}},
            quarter('G', 4, 1, 1),
            {kind: 'backup', duration: 1},
            quarter('G', 4, 2, 2),
          ] satisfies MeasureEntry[],
        },
        {
          number: 2,
          entries: [
            quarter('G', 4, 1, 1),
            quarter('A', 4, 1, 1),
            quarter('B', 4, 1, 1),
            {kind: 'backup', duration: 3},
            quarter('C', 4, 2, 2),
            quarter('D', 4, 2, 2),
            quarter('E', 4, 2, 2),
          ] satisfies MeasureEntry[],
        },
      ],
    },
  ],
};

async function capture(window: Page, name: string): Promise<void> {
  await expect(window.locator('.mat-mdc-snack-bar-container')).toHaveCount(0);
  await window.waitForLoadState('networkidle');
  // Settle fades and scales (dialog, backdrop); endless animations never finish, so they are ignored.
  await window.waitForFunction(() => {
    const panel = document.querySelector('.mat-mdc-dialog-surface');
    const panelSettled = panel === null || getComputedStyle(panel).opacity === '1';
    return panelSettled && document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity);
  });
  await window.mouse.move(640, 400);
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

test('captures the screens of Bring Scores onto a tape', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'crancula-ux-score-'));
  const scorePath = join(folder, 'waltz.musicxml');
  const pdfPath = join(folder, 'score.pdf');
  await writeFile(scorePath, scoreXml(WALTZ));
  await writeFile(pdfPath, '%PDF-1.7\n');

  const {app, window} = await launchApp();
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  await defineOctaveOrgan(window, 'Octave organ');

  for (const language of ['en', 'de'] as const) {
    const suffix = language === 'en' ? '' : '-german';
    await window.getByTestId('language-switch').locator(`[data-language="${language}"]`).click();
    const tapes = window.getByTestId('rail-nav').getByRole('link').nth(1);
    await tapes.click();
    await window.getByTestId('new-tape').click();

    await window.getByTestId('song-file').setInputFiles(scorePath);
    await expect(window.getByTestId('part')).toHaveCount(2);
    await expect(window.getByTestId('song-metre')).toBeVisible();
    await capture(window, `20-tape-import-score${suffix}`);

    await window.getByTestId('name').fill('Waltz');
    await window.getByTestId('create-tape').click();
    await expect(window).toHaveURL(/\/tapes\/[0-9a-f-]{36}$/);
    await expect(window.getByTestId('side-panel').getByTestId('song-metre')).toBeVisible();
    await capture(window, `21-tape-view-metre${suffix}`);

    await tapes.click();
    await window.getByTestId('new-tape').click();
    await window.getByTestId('song-file').setInputFiles(pdfPath);
    await expect(window.getByTestId('song-rejection')).toHaveAttribute('data-code', 'pdf');
    await capture(window, `22-tape-import-pdf-rejected${suffix}`);

    await window.getByTestId('song-rejection').getByTestId('score-how-to-open').click();
    await expect(window.getByRole('dialog')).toBeVisible();
    await capture(window, `23-score-how-to-dialog${suffix}`);
    await window.getByRole('dialog').getByTestId('score-how-to-close').click();
    await expect(window.getByRole('dialog')).toHaveCount(0);
  }
  await app.close();
});
