import {TestBed} from '@angular/core/testing';
import {type ImportSummary, midiNoteNumber, type MidiNoteNumber} from '@api/index';
import {column, columnCount, transposition} from '../../../../../api/tape/tape';
import {partIndex} from '../../../../../api/song/song';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {ImportSummaryComponent} from './import-summary.component';

function note(value: number): MidiNoteNumber {
  const result = midiNoteNumber(value);
  if (result === undefined) throw new Error(`invalid test note ${value}`);
  return result;
}

function part(value: number) {
  const result = partIndex(value, 4);
  if (result === undefined) throw new Error(`invalid test Part ${value}`);
  return result;
}

function col(value: number) {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid test Column ${value}`);
  return result;
}

function count(value: number) {
  const result = columnCount(value);
  if (result === undefined) throw new Error(`invalid test Column count ${value}`);
  return result;
}

function shift(value: number) {
  const result = transposition(value);
  if (result === undefined) throw new Error(`invalid test Transposition ${value}`);
  return result;
}

const SUMMARY: ImportSummary = {
  transposition: shift(12),
  notesOnTape: 17,
  movedByOctaves: [{part: part(1), noteNumber: note(48), pipe: note(72), octaves: 2, column: col(0)}],
  unplayableNotes: [{part: part(2), noteNumber: note(30), column: col(4)}],
  holesFixed: [
    {kind: 'overlap-merged', pipe: note(60), column: col(1)},
    {kind: 'lengthened', pipe: note(62), column: col(2), from: count(1), to: count(3)},
    {kind: 'shortened', pipe: note(64), column: col(3), from: count(4), to: count(2)},
    {kind: 'repetition-merged', pipe: note(65), column: col(5), lostColumn: col(6)},
  ],
};

async function render(summary: ImportSummary) {
  TestBed.configureTestingModule({providers: [provideTestTranslations()]});
  const fixture = TestBed.createComponent(ImportSummaryComponent);
  fixture.componentRef.setInput('importSummary', summary);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const all = (testId: string) => [...element.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
  return {fixture, element, all, one: (testId: string) => all(testId)[0]};
}

describe('ImportSummaryComponent', () => {
  it('lists exactly Transposition, Notes moved by octaves, Unplayable Notes and Holes fixed', async () => {
    const {element} = await render(SUMMARY);

    expect([...element.querySelectorAll('dt')].map((term) => term.textContent?.trim())).toEqual([
      'Transposition',
      'Notes moved by octaves',
      'Unplayable Notes',
      'Holes fixed',
    ]);
  });

  it('shows the Transposition with its sign and no count of Notes on the Tape', async () => {
    const {one} = await render(SUMMARY);

    expect(one('transposition')?.dataset['value']).toBe('12');
    expect(one('transposition')?.textContent).toContain('+12');
    expect(one('notes-on-tape')).toBeUndefined();
  });

  it('is titled Import Summary with a close button named Dismiss that emits dismissed', async () => {
    const {element, fixture} = await render(SUMMARY);
    let dismissed = 0;
    fixture.componentInstance.dismissed.subscribe(() => dismissed++);

    expect(element.querySelector('h2, h3')?.textContent?.trim()).toBe('Import Summary');
    const close = element.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    close?.click();
    expect(close).not.toBeNull();
    expect(dismissed).toBe(1);
  });

  it('shows every Note moved by octaves with note name, octaves, Part, Pipe and Column plus one', async () => {
    const {all} = await render(SUMMARY);

    expect(all('moved-note').map(({dataset}) => ({...dataset}))).toEqual([
      expect.objectContaining({noteName: 'C3', octaves: '2', part: '1', pipeName: 'C5', column: '1'}),
    ]);
  });

  it('shows every Unplayable Note with note name, Part and Column plus one', async () => {
    const {all} = await render(SUMMARY);

    expect(all('unplayable-note').map(({dataset}) => ({...dataset}))).toEqual([
      expect.objectContaining({noteName: 'F#1', part: '2', column: '5'}),
    ]);
  });

  it('shows every fixed Hole by kind with its Pipe note name and Column plus one', async () => {
    const {all} = await render(SUMMARY);
    const fixes = all('hole-fixed').map(({dataset}) => ({
      kind: dataset['kind'],
      pipeName: dataset['pipeName'],
      column: dataset['column'],
    }));

    expect(fixes).toEqual([
      {kind: 'overlap-merged', pipeName: 'C4', column: '2'},
      {kind: 'lengthened', pipeName: 'D4', column: '3'},
      {kind: 'shortened', pipeName: 'E4', column: '4'},
      {kind: 'repetition-merged', pipeName: 'F4', column: '6'},
    ]);
  });

  it('shows no list entries for an import that changed nothing', async () => {
    const {all} = await render({...SUMMARY, movedByOctaves: [], unplayableNotes: [], holesFixed: []});

    expect(all('moved-note')).toEqual([]);
    expect(all('unplayable-note')).toEqual([]);
    expect(all('hole-fixed')).toEqual([]);
  });
});
