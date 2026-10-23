// API: TransposeDialogComponent (standalone, in ./transpose-dialog.component); MAT_DIALOG_DATA is
// {tape: Tape, organ: Organ, selected: readonly HoleRef[]}; closes with a `Transposed` on Apply, undefined on Cancel.
// Test ids as in specs/005-transpose-holes/contracts/tape-view-ui.md, plus `outcome-nothing-left` (not in the contract yet).
import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {
  column,
  columnCount,
  midiNoteNumber,
  millimetres,
  organId,
  tapeId,
  transposeHoles,
  transposition,
  validateOrgan,
  type Hole,
  type HoleRef,
  type MidiNoteNumber,
  type Organ,
  type Tape,
  type Transposed,
} from '@api/index';
import {vi} from 'vitest';
import {partIndex, songId} from '../../../../../../api/song/song';
import {tapeOf} from '../../../../../../api/tape/tape-fixture';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {TransposeDialogComponent} from './transpose-dialog.component';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), 'pipe');
}

/** A Hole as the Tape view shows it: Columns first..last, counted from 1. */
function hole(pipe: number, first: number, last: number): Hole {
  return {
    pipe: note(pipe),
    start: defined(column(first - 1), 'column'),
    length: defined(columnCount(last - first + 1), 'length'),
  };
}

function ref(pipe: number, first: number): HoleRef {
  return {pipe: note(pipe), start: defined(column(first - 1), 'column')};
}

function organWith(notes: readonly number[]): Organ {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    leadIn: 20,
    tapePerCrankTurn: null,
    pipes: notes.map((each) => ({note: each})),
  });
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
}

function tapeWith(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(2.5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

const semitones = (value: number) => defined(transposition(value), 'transposition');

/** Pipes C4, D4, E4 (range +-4). */
const ORGAN = organWith([60, 62, 64]);

async function render(options: {tape: Tape; organ?: Organ; selected?: readonly HoleRef[]}) {
  const close = vi.fn<(result?: Transposed) => void>();
  const organ = options.organ ?? ORGAN;
  const selected = options.selected ?? [];
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations('en'),
      {provide: MatDialogRef, useValue: {close}},
      {provide: MAT_DIALOG_DATA, useValue: {tape: options.tape, organ, selected}},
    ],
  });
  const fixture = TestBed.createComponent(TransposeDialogComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const byId = (id: string): HTMLElement => {
    const found = element.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!found) throw new Error(`no element ${id}`);
    return found;
  };
  const maybe = (id: string) => element.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const nativeInput = (id: string): HTMLInputElement => {
    const found = byId(id);
    const input = found instanceof HTMLInputElement ? found : found.querySelector('input');
    if (!input) throw new Error(`no input in ${id}`);
    return input;
  };
  const text = (id: string) => (byId(id).textContent ?? '').replace(/\s+/g, ' ').trim();
  const count = (id: string): number => {
    const match = /(\d+)\s*$/.exec(text(id));
    if (!match) throw new Error(`no count in ${id}: ${text(id)}`);
    return Number(match[1]);
  };
  const setSemitones = async (value: number) => {
    const input = nativeInput('transpose-semitones');
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const click = async (id: string) => {
    nativeInput(id).click();
    await fixture.whenStable();
  };
  const button = (id: string) => byId(id) as HTMLButtonElement;
  return {element, close, byId, maybe, nativeInput, text, count, setSemitones, click, button};
}

describe('TransposeDialogComponent', () => {
  describe('scope', () => {
    it('preselects the selected Holes and counts them in the label when some are selected', async () => {
      const {nativeInput, text} = await render({
        tape: tapeWith([hole(60, 3, 4), hole(62, 5, 8)]),
        selected: [ref(60, 3), ref(62, 5)],
      });

      expect(nativeInput('transpose-scope-selected').checked).toBe(true);
      expect(nativeInput('transpose-scope-all').checked).toBe(false);
      expect(text('transpose-scope-selected')).toContain('Selected Holes (2)');
    });

    it('disables the selected scope and chooses all Holes when nothing is selected', async () => {
      const {nativeInput, text} = await render({tape: tapeWith([hole(60, 3, 4)])});

      expect(nativeInput('transpose-scope-selected').disabled).toBe(true);
      expect(nativeInput('transpose-scope-all').checked).toBe(true);
      expect(text('transpose-scope-selected')).toContain('(0)');
      expect(text('transpose-scope-all')).toContain('All Holes');
    });
  });

  describe('semitones field', () => {
    it('starts at 0 and spans the range of the Organ, here -4 to 4', async () => {
      const {nativeInput} = await render({tape: tapeWith([hole(60, 3, 4)])});

      const input = nativeInput('transpose-semitones');
      expect(input.value).toBe('0');
      expect(input.min).toBe('-4');
      expect(input.max).toBe('4');
    });
  });

  describe('Apply', () => {
    it('is disabled at 0 semitones and enabled otherwise', async () => {
      const {button, setSemitones} = await render({tape: tapeWith([hole(60, 3, 4)])});

      expect(button('transpose-apply').disabled).toBe(true);

      await setSemitones(2);
      expect(button('transpose-apply').disabled).toBe(false);

      await setSemitones(0);
      expect(button('transpose-apply').disabled).toBe(true);
    });

    it('closes with the Transposed of the selected Holes', async () => {
      const tape = tapeWith([hole(60, 3, 4), hole(62, 5, 8)]);
      const selected = [ref(60, 3)];
      const {close, button, setSemitones} = await render({tape, selected});

      await setSemitones(2);
      button('transpose-apply').click();

      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith(transposeHoles(tape, ORGAN, {kind: 'these', holes: selected}, semitones(2)));
    });

    it('prevents the default of the Enter key that applies, so focus returning to the Transpose button cannot click it', async () => {
      const tape = tapeWith([hole(60, 3, 4), hole(62, 5, 8)]);
      const {close, nativeInput, setSemitones} = await render({tape, selected: [ref(60, 3)]});

      await setSemitones(2);
      const enter = new KeyboardEvent('keydown', {key: 'Enter', cancelable: true, bubbles: true});
      nativeInput('transpose-semitones').dispatchEvent(enter);

      expect(enter.defaultPrevented).toBe(true);
      expect(close).toHaveBeenCalledWith(transposeHoles(tape, ORGAN, {kind: 'these', holes: [ref(60, 3)]}, semitones(2)));
    });

    it('closes with the Transposed of all Holes when that scope is chosen', async () => {
      const tape = tapeWith([hole(60, 3, 4), hole(62, 5, 8)]);
      const {close, button, setSemitones, click} = await render({tape, selected: [ref(60, 3)]});

      await click('transpose-scope-all');
      await setSemitones(-2);
      button('transpose-apply').click();

      expect(close).toHaveBeenCalledWith(transposeHoles(tape, ORGAN, {kind: 'all'}, semitones(-2)));
    });
  });

  describe('Cancel', () => {
    it('closes without a result', async () => {
      const {close, button, setSemitones} = await render({tape: tapeWith([hole(60, 3, 4)])});

      await setSemitones(2);
      button('transpose-cancel').click();

      expect(close).toHaveBeenCalledTimes(1);
      expect(close.mock.calls[0]?.[0]).toBeUndefined();
    });
  });

  describe('outcome', () => {
    it('counts moved Holes and follows the semitones', async () => {
      const {count, setSemitones} = await render({tape: tapeWith([hole(60, 3, 4), hole(62, 5, 8)])});

      await setSemitones(2);
      expect(count('outcome-moved')).toBe(2); // C4 -> D4, D4 -> E4
      await setSemitones(-2);
      expect(count('outcome-moved')).toBe(1); // D4 -> C4; C4 -> A#3 has no Pipe
      expect(count('outcome-removed')).toBe(1);
    });

    it('counts Holes moved by whole octaves to a Pipe of the same pitch class', async () => {
      // Pipes C4, D4, E5: D4 + 2 = E4 has no Pipe, E5 does.
      const {count, setSemitones} = await render({
        tape: tapeWith([hole(62, 3, 4)]),
        organ: organWith([60, 62, 76]),
      });

      await setSemitones(2);

      expect(count('outcome-moved-by-octaves')).toBe(1);
      expect(count('outcome-moved')).toBe(0);
    });

    it('counts Holes that merge with overlapping Holes on the same Pipe', async () => {
      // Only C4 (Columns 3-6) moves onto D4 (Columns 5-8): one merged Hole.
      const {count, setSemitones} = await render({
        tape: tapeWith([hole(60, 3, 6), hole(62, 5, 8)]),
        selected: [ref(60, 3)],
      });

      await setSemitones(2);

      expect(count('outcome-merged')).toBe(1);
    });

    it('counts and lists removed Holes as "note · Column" counted from 1', async () => {
      // E4 + 2 = F#4: no Pipe, and no Pipe of that pitch class.
      const {count, text, setSemitones} = await render({tape: tapeWith([hole(62, 3, 4), hole(64, 12, 14)])});

      await setSemitones(2);

      expect(count('outcome-removed')).toBe(1);
      expect(text('outcome-removed-holes')).toContain('E4 · Column 12');
    });

    it('shows the left-out Holes without a Pipe when there are some', async () => {
      // C#4 has no Pipe on the Organ; it is only counted for the scope "all".
      const {text, setSemitones} = await render({tape: tapeWith([hole(60, 3, 4), hole(61, 5, 6)])});

      await setSemitones(2);

      expect(text('outcome-left-out')).toContain('1');
    });

    it('hides the left-out line when every Hole has a Pipe', async () => {
      const {maybe, setSemitones} = await render({tape: tapeWith([hole(60, 3, 4)])});

      await setSemitones(2);

      expect(maybe('outcome-left-out')).toBeNull();
    });

    it('notes that nothing is left when every chosen Hole would be removed', async () => {
      const {maybe, setSemitones} = await render({tape: tapeWith([hole(64, 3, 4)])});

      await setSemitones(2);
      expect(maybe('outcome-nothing-left')).not.toBeNull();

      await setSemitones(-2);
      expect(maybe('outcome-nothing-left')).toBeNull();
    });
  });
});
