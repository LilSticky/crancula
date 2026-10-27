import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {vi} from 'vitest';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {type ProblemText} from '../cutting-problem-text';
import {CuttingProblemsDialogComponent} from './cutting-problems-dialog.component';

const NO_PIPE: ProblemText = {key: 'TAPE.CUTTING_PROBLEM.NO_PIPE', params: {note: 'A#4', column: '5'}};
const TOO_SHORT: ProblemText = {
  key: 'TAPE.CUTTING_PROBLEM.TOO_SHORT',
  params: {note: 'C4', column: '11', length: '2.5', minimum: '3.3'},
};
const TOO_CLOSE: ProblemText = {
  key: 'TAPE.CUTTING_PROBLEM.TOO_CLOSE',
  params: {note: 'D4', column: '21', next: '25', gap: '1.2', minimum: '1.7'},
};
const TOO_WIDE: ProblemText = {key: 'TAPE.EXPORT.TOO_WIDE', params: {}};

async function render(problems: readonly ProblemText[], language: 'en' | 'de' = 'en') {
  const close = vi.fn<(result?: undefined) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations(language),
      {provide: MatDialogRef, useValue: {close}},
      {provide: MAT_DIALOG_DATA, useValue: problems},
    ],
  });
  const fixture = TestBed.createComponent(CuttingProblemsDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const entries = () =>
    [...element.querySelectorAll('[data-testid="export-problem"]')].map((item) =>
      (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  return {element, entries, close};
}

describe('CuttingProblemsDialogComponent', () => {
  it("titles the dialog \"This Tape can't be cut yet\"", async () => {
    const {element} = await render([TOO_SHORT]);

    expect(element.querySelector('[mat-dialog-title], .mat-mdc-dialog-title')?.textContent?.trim()).toBe(
      "This Tape can't be cut yet",
    );
  });

  it('lists one entry per problem text, in the given order, every one of them', async () => {
    const {entries} = await render([TOO_WIDE, TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    expect(entries()).toHaveLength(4);
    expect(entries()[0]).toBe('This Tape is too wide for the Plotter\'s working width');
  });

  it('translates each entry with the parameters it was given', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    expect(entries()[0]).toBe('C4 at Column 11: the Hole is 2.5 mm long, the Minimum Hole Length is 3.3 mm.');
    expect(entries()[1]).toBe(
      'D4 at Column 21: the gap to the next Hole at Column 25 is 1.2 mm, the Minimum Gap is 1.7 mm.',
    );
    expect(entries()[2]).toBe('A#4 at Column 5: the Organ has no Pipe for this note.');
  });

  it('shows the German text of each key with the parameters as given', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE], 'de');

    expect(entries()[0]).toBe('C4 in Spalte 11: Das Loch ist 2.5 mm lang, die Mindestlochlänge beträgt 3.3 mm.');
    expect(entries()[1]).toContain('Abstand zum nächsten Loch in Spalte 25');
  });

  it('shows no raw translation key in any entry or in the dialog', async () => {
    const {element, entries} = await render([TOO_WIDE, TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    for (const entry of entries()) {
      expect(entry).not.toMatch(/TAPE\.(EXPORT|CUTTING_PROBLEM)/);
    }
    expect(element.textContent).not.toMatch(/TAPE\.(EXPORT|CUTTING_PROBLEM)/);
  });

  it('words each of the three reasons differently', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    expect(new Set(entries().map((entry) => entry.replace(/[\d.,]+/g, '#'))).size).toBe(3);
  });

  it('shows the list inside the scrolling dialog content', async () => {
    const {element} = await render([TOO_SHORT, TOO_CLOSE]);

    const content = element.querySelector('mat-dialog-content');
    expect(content).not.toBeNull();
    expect(content?.querySelectorAll('[data-testid="export-problem"]')).toHaveLength(2);
  });

  it('has one close button that closes the dialog', async () => {
    const {element, close} = await render([TOO_SHORT]);

    const buttons = element.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent?.trim()).toBe('Close');

    buttons[0]?.click();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
