/*
 * Expected API of api/scores/close-gaps.ts (T034, data-model.md "Gap closing", research R6):
 *
 *   minimumGapColumns(organ: Organ, columnLength: Millimetres): number
 *     ceil(organ.minimumGap ÷ columnLength − 1e-9), in whole Columns.
 *   closeGaps(holes: readonly Hole[], minimumGapColumns: number): readonly ScoresNote[]
 *     Works per Pipe (the Holes sorted by Pipe, then start). A Hole is lengthened to the start of the next Hole of
 *     its Pipe when 0 < gap ≤ minimumGapColumns; the last Hole of a Pipe keeps its length. The input is not changed.
 *
 * A Minimum Gap of 0 mm cannot be given to validateOrgan (the value must be positive), so 0 → 0 is not written here.
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Millimetres, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {column, columnCount, type Hole} from '../tape/tape';
import {closeGaps, minimumGapColumns} from './close-gaps';

const ORGAN_ID = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function midi(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

function hole(pipe: number, start: number, length: number): Hole {
  return {
    pipe: midi(pipe),
    start: defined(column(start), `start ${start}`),
    length: defined(columnCount(length), `length ${length}`),
  };
}

function mm(value: number): Millimetres {
  return defined(millimetres(value), `millimetres ${value}`);
}

/** For specs: an Organ with Pipes 60 to 69 and the given Minimum Gap in millimetres. */
function organWithMinimumGap(minimumGap: number): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Gap organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4, guideMargin: null},
    minimumGap,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
  });
  if (!result.ok) throw new Error('invalid Organ fixture');
  return result.value;
}

describe('minimumGapColumns', () => {
  it('is a Minimum Gap of 2 mm over Columns of 3 mm rounded up to one Column (FR-008)', () => {
    expect(minimumGapColumns(organWithMinimumGap(2), mm(3))).toBe(1);
  });

  it('is a Minimum Gap of 6 mm over Columns of 3 mm exactly two Columns, without rounding up (FR-008)', () => {
    expect(minimumGapColumns(organWithMinimumGap(6), mm(3))).toBe(2);
  });
});

describe('closeGaps', () => {
  it('lengthens a 7-Column Hole to the start of the next Hole of its Pipe when the gap is 1 Column (Story 2.1)', () => {
    const notes = closeGaps([hole(60, 0, 7), hole(60, 8, 8)], 1);

    expect(notes).toEqual([
      {pitch: midi(60), start: column(0), length: columnCount(8)},
      {pitch: midi(60), start: column(8), length: columnCount(8)},
    ]);
  });

  it('keeps the length of a Hole when the gap to the next Hole of its Pipe is 2 Columns, above the Minimum Gap (Story 2.2)', () => {
    const notes = closeGaps([hole(60, 0, 7), hole(60, 9, 8)], 1);

    expect(notes.map((note) => note.length)).toEqual([7, 8]);
  });

  it('keeps touching Holes of one Pipe as two notes, each with its length (research R6)', () => {
    const notes = closeGaps([hole(60, 0, 7), hole(60, 7, 8)], 1);

    expect(notes).toEqual([
      {pitch: midi(60), start: column(0), length: columnCount(7)},
      {pitch: midi(60), start: column(7), length: columnCount(8)},
    ]);
  });

  it('keeps the length of the last Hole of a Pipe, however small the gap closing would be (FR-008)', () => {
    const notes = closeGaps([hole(60, 0, 7)], 5);

    expect(notes).toEqual([{pitch: midi(60), start: column(0), length: columnCount(7)}]);
  });

  it('never lengthens a Hole past the last Column of the Tape: a closed gap ends at the next Hole, the last Hole keeps its end (FR-008)', () => {
    // A 40-Column Tape whose last Hole of Pipe 60 ends on its last Column; the Hole before it closes its gap.
    const notes = closeGaps([hole(60, 0, 7), hole(60, 8, 32)], 1);

    expect(notes.map((each) => each.start + each.length)).toEqual([8, 40]);
  });

  it('closes the gaps of each Pipe on its own: a Hole of another Pipe does not close a gap (research R6)', () => {
    const notes = closeGaps([hole(60, 0, 7), hole(62, 8, 4)], 1);

    expect(notes).toEqual([
      {pitch: midi(60), start: column(0), length: columnCount(7)},
      {pitch: midi(62), start: column(8), length: columnCount(4)},
    ]);
  });

  it('leaves the Holes it was given unchanged (FR-008, Story 2.8)', () => {
    const holes = [hole(60, 0, 7), hole(60, 8, 8)];
    const before = structuredClone(holes);

    closeGaps(holes, 1);

    expect(holes).toEqual(before);
  });
});
