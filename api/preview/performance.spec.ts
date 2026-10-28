import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, type Millimetres, type Organ} from '../organ/organ';
import {emptyOrganDraft} from '../organ/organ-draft';
import {validateOrgan} from '../organ/validate-organ';
import {column, columnCount, type Hole, type Tape} from '../tape/tape';
import {tapeOf} from '../tape/tape-fixture';
import {columnDuration, noteFrequency, performance, previewLength} from './performance';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function mm(value: number): Millimetres {
  return defined(millimetres(value), 'millimetres');
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

/**
 * An Organ with the Pipes 60 and 62 (in this row order). Holes are 10 mm, so a one-Column Hole
 * of a 5 mm Tape is too short; the Minimum Gap is 1.5 mm, so a one-Column gap is not too close.
 */
function organOf(tapePerCrankTurn: number | null): Organ {
  const result = validateOrgan({
    ...emptyOrganDraft(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 10, rowSpacing: 11, guideMargin: null},
    minimumGap: 1.5,
    leadIn: 20,
    tapePerCrankTurn,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

const organ = organOf(100);

function hole(pipe: number, start: number, length: number): Hole {
  return {
    pipe: note(pipe),
    start: defined(column(start), `column ${start}`),
    length: defined(columnCount(length), `length ${length}`),
  };
}

/** A 5 mm Tape of 100 Columns at the default Crank speed of 60 turns per minute. */
function tapeWith(holes: readonly Hole[], length = 100): Tape {
  return tapeOf({
    id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: mm(5),
    length: defined(columnCount(length), 'length'),
    holes,
  });
}

describe('performance', () => {
  it('leaves out Holes whose Pipe is not on the Organ', () => {
    const tape = tapeWith([hole(60, 0, 3), hole(64, 5, 3)]);

    expect(performance(tape, organ)).toEqual([{pipe: note(60), startColumn: 0, endColumn: 3}]);
  });

  it('keeps Holes with other Cutting Problems, such as a Hole too short to cut', () => {
    const tape = tapeWith([hole(60, 0, 1)]);

    expect(performance(tape, organ)).toEqual([{pipe: note(60), startColumn: 0, endColumn: 1}]);
  });

  it('joins touching Holes of one row into one note', () => {
    const tape = tapeWith([hole(60, 0, 3), hole(60, 3, 4)]);

    expect(performance(tape, organ)).toEqual([{pipe: note(60), startColumn: 0, endColumn: 7}]);
  });

  it('keeps a one-Column gap between Holes of one row as two notes', () => {
    const tape = tapeWith([hole(60, 0, 3), hole(60, 4, 2)]);

    expect(performance(tape, organ)).toEqual([
      {pipe: note(60), startColumn: 0, endColumn: 3},
      {pipe: note(60), startColumn: 4, endColumn: 6},
    ]);
  });

  it('sorts the notes by startColumn, then by pipe', () => {
    const tape = tapeWith([hole(62, 0, 2), hole(60, 5, 1), hole(60, 0, 2)]);

    expect(performance(tape, organ)).toEqual([
      {pipe: note(60), startColumn: 0, endColumn: 2},
      {pipe: note(62), startColumn: 0, endColumn: 2},
      {pipe: note(60), startColumn: 5, endColumn: 6},
    ]);
  });
});

describe('columnDuration', () => {
  it('is the Column length over the Tape that passes per second at the Crank speed', () => {
    // 5 mm per Column, 100 mm per Crank turn, 60 turns per minute: one turn per second.
    expect(columnDuration(tapeWith([]), organ)).toBeCloseTo(0.05, 10);
  });

  it('is undefined without Tape per Crank turn', () => {
    expect(columnDuration(tapeWith([]), organOf(null))).toBeUndefined();
  });
});

describe('previewLength', () => {
  it('is the Columns of the Tape times the duration of one Column', () => {
    expect(previewLength(tapeWith([], 100), organ)).toBeCloseTo(5, 10);
  });

  it('is undefined without Tape per Crank turn', () => {
    expect(previewLength(tapeWith([]), organOf(null))).toBeUndefined();
  });
});

describe('noteFrequency', () => {
  it('is 440 Hz for A4, the MIDI note 69', () => {
    expect(noteFrequency(note(69))).toBe(440);
  });

  it('is 880 Hz for A5, the MIDI note 81', () => {
    expect(noteFrequency(note(81))).toBe(880);
  });
});
