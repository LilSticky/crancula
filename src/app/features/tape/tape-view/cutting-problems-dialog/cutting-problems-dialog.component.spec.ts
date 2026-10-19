import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {column, type CuttingProblem, midiNoteNumber, type MidiNoteNumber, type Millimetres} from '@api/index';
import {vi} from 'vitest';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {CuttingProblemsDialogComponent} from './cutting-problems-dialog.component';

function note(value: number): MidiNoteNumber {
  const result = midiNoteNumber(value);
  if (result === undefined) throw new Error(`invalid test note ${value}`);
  return result;
}

function col(value: number) {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid test Column ${value}`);
  return result;
}

const mm = (value: number): Millimetres => value as Millimetres;

const NO_PIPE: CuttingProblem = {code: 'no-pipe', pipe: note(70), start: col(4)}; // Column 5, A#4
const TOO_SHORT: CuttingProblem = {
  code: 'too-short',
  pipe: note(60), // C4
  start: col(10), // Column 11
  lengthMm: 2.5,
  minimumHoleLengthMm: mm(3.3),
};
const TOO_CLOSE: CuttingProblem = {
  code: 'too-close',
  pipe: note(62), // D4
  start: col(20), // Column 21
  nextStart: col(24), // Column 25
  gapMm: 1.2,
  minimumGapMm: mm(1.7),
};

async function render(problems: readonly CuttingProblem[], language: 'en' | 'de' = 'en') {
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

  it('lists one entry per problem, in the given order, every one of them', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE, { ...TOO_SHORT, start: col(30) }]);

    expect(entries()).toHaveLength(4);
  });

  it('names the note and counts the start Column from 1 for each problem', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    const [tooShort, tooClose, noPipe] = entries();
    expect(tooShort).toContain('C4');
    expect(tooShort).toMatch(/\b11\b/);
    expect(tooClose).toContain('D4');
    expect(tooClose).toMatch(/\b21\b/);
    expect(noPipe).toContain('A#4');
    expect(noPipe).toMatch(/\b5\b/);
  });

  it('gives a too-short Hole its length and the Minimum Hole Length in mm', async () => {
    const {entries} = await render([TOO_SHORT]);

    expect(entries()[0]).toContain('2.5');
    expect(entries()[0]).toContain('3.3');
  });

  it('gives a too-close Hole the gap, the Minimum Gap and the next Hole\'s Column counted from 1', async () => {
    const {entries} = await render([TOO_CLOSE]);

    expect(entries()[0]).toContain('1.2');
    expect(entries()[0]).toContain('1.7');
    expect(entries()[0]).toMatch(/\b25\b/);
  });

  it('writes the mm values with the decimal comma in German', async () => {
    const {entries} = await render([TOO_SHORT, TOO_CLOSE], 'de');

    expect(entries()[0]).toContain('3,3');
    expect(entries()[0]).not.toContain('3.3');
    expect(entries()[1]).toContain('1,2');
  });

  it('words each of the three reasons differently, with every text translated', async () => {
    const {element, entries} = await render([TOO_SHORT, TOO_CLOSE, NO_PIPE]);

    expect(new Set(entries().map((entry) => entry.replace(/[\d.,]+/g, '#'))).size).toBe(3);
    expect(element.textContent).not.toMatch(/TAPE\.(EXPORT|CUTTING_PROBLEM)/);
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
