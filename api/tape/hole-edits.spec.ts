import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {partIndex, songId} from '../song/song';
import {cuttingProblems, holesWithCuttingProblems} from './cutting-problems';
import {addHole, changeHoleLength, firstFreeColumnAfter, moveHole, removeHole, type HoleRef} from './hole-edits';
import {tapeGeometry} from './tape-geometry';
import {tapeOf} from './tape-fixture';
import {column, columnCount, tapeId, transposition, type Column, type Hole, type Tape} from './tape';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function pipeOf(note: number): MidiNoteNumber {
  return defined(midiNoteNumber(note), 'pipe');
}

const c4 = pipeOf(60);
const d4 = pipeOf(62);
const notOnOrgan = pipeOf(65);

const organ: Organ = (() => {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 1,
    leadIn: 20,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
})();

/** Minimum Hole Length 6.5 mm = 2.6 Columns of 2.5 mm, so 3 whole Columns. */
const wideHoleOrgan: Organ = (() => {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 6.5, rowSpacing: 8},
    minimumGap: 1,
    leadIn: 20,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
})();

function col(value: number): Column {
  return defined(column(value), 'column');
}

/** A Hole as the Tape view shows it: Columns first..last, counted from 1. */
function hole(pipe: MidiNoteNumber, first: number, last: number): Hole {
  return {pipe, start: col(first - 1), length: defined(columnCount(last - first + 1), 'length')};
}

function ref(pipe: MidiNoteNumber, first: number): HoleRef {
  return {pipe, start: col(first - 1)};
}

function aTape(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(2), 'transposition'),
    columnLength: defined(millimetres(2.5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

function unwrap<T, E>(result: {readonly ok: true; readonly value: T} | {readonly ok: false; readonly error: E}): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${JSON.stringify(result.error)}`);
  return result.value;
}

function expectOtherFieldsUnchanged(before: Tape, after: Tape): void {
  expect(after.id).toBe(before.id);
  expect(after.name).toBe(before.name);
  expect(after.organId).toBe(before.organId);
  expect(after.songId).toBe(before.songId);
  expect(after.selectedParts).toEqual(before.selectedParts);
  expect(after.transposition).toBe(before.transposition);
  expect(after.columnLength).toBe(before.columnLength);
}

describe('removeHole', () => {
  it('removes the Hole and keeps the Tape length', () => {
    const tape = aTape([hole(c4, 10, 13), hole(c4, 30, 33), hole(d4, 5, 6)]);

    const result = unwrap(removeHole(tape, ref(c4, 10)));

    expect(result.holes).toEqual([hole(c4, 30, 33), hole(d4, 5, 6)]);
    expect(result.length).toBe(tape.length);
    expectOtherFieldsUnchanged(tape, result);
  });

  it('keeps Holes whose Pipe is not on the Organ', () => {
    const tape = aTape([hole(c4, 10, 13), hole(notOnOrgan, 20, 22)]);

    expect(unwrap(removeHole(tape, ref(c4, 10))).holes).toEqual([hole(notOnOrgan, 20, 22)]);
  });

  it('refuses an unknown Hole', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(removeHole(tape, ref(c4, 11))).toEqual({ok: false, error: {code: 'no-such-hole'}});
    expect(removeHole(tape, ref(d4, 10))).toEqual({ok: false, error: {code: 'no-such-hole'}});
  });

  it('does not change the Tape it is given', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    removeHole(tape, ref(c4, 10));

    expect(tape.holes).toEqual([hole(c4, 10, 13)]);
  });
});

describe('moveHole', () => {
  it('moves the Hole along its row and keeps its length', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(11)}));

    expect(edit.hole).toEqual(hole(c4, 12, 15));
    expect(edit.tape.holes).toEqual([hole(c4, 12, 15)]);
  });

  it('moves the Hole to another Pipe of the Organ', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: d4, start: col(9)}));

    expect(edit.hole).toEqual(hole(d4, 10, 13));
    expect(edit.tape.holes).toEqual([hole(d4, 10, 13)]);
  });

  it('moves along the row and to another Pipe in one call', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: d4, start: col(11)}));

    expect(edit.tape.holes).toEqual([hole(d4, 12, 15)]);
  });

  it('allows moving a Hole by one Column onto its own old Columns', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(10)})).hole).toEqual(hole(c4, 11, 14));
  });

  it('keeps the Holes sorted by Pipe, then start', () => {
    const tape = aTape([hole(c4, 10, 13), hole(c4, 30, 33), hole(d4, 5, 6)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 30), {pipe: c4, start: col(19)}));

    expect(edit.tape.holes).toEqual([hole(c4, 10, 13), hole(c4, 20, 23), hole(d4, 5, 6)]);
  });

  it('refuses to cover a Column of another Hole of the Pipe', () => {
    const tape = aTape([hole(c4, 10, 13), hole(c4, 16, 19)]);

    expect(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(12)})).toEqual({
      ok: false,
      error: {code: 'overlaps', other: hole(c4, 16, 19)},
    });
    expect(tape.holes).toEqual([hole(c4, 10, 13), hole(c4, 16, 19)]);
  });

  it('refuses a target Pipe whose Hole covers the Columns', () => {
    const tape = aTape([hole(c4, 10, 13), hole(d4, 11, 14)]);

    expect(moveHole(tape, organ, ref(c4, 10), {pipe: d4, start: col(9)})).toEqual({
      ok: false,
      error: {code: 'overlaps', other: hole(d4, 11, 14)},
    });
  });

  it('refuses a Pipe that is not on the Organ', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(moveHole(tape, organ, ref(c4, 10), {pipe: notOnOrgan, start: col(9)})).toEqual({
      ok: false,
      error: {code: 'not-on-the-organ', pipe: notOnOrgan},
    });
  });

  it('refuses an unknown Hole', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(moveHole(tape, organ, ref(c4, 11), {pipe: c4, start: col(20)})).toEqual({
      ok: false,
      error: {code: 'no-such-hole'},
    });
  });

  it('does not refuse a Hole that is too close to another (a Cutting Problem)', () => {
    const tape = aTape([hole(c4, 10, 13), hole(c4, 16, 19)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(10)}));

    expect(edit.hole).toEqual(hole(c4, 11, 14));
  });

  it('leaves every other field and Hole unchanged, including Holes off the Organ', () => {
    const tape = aTape([hole(c4, 10, 13), hole(notOnOrgan, 20, 22)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(40)}));

    expect(edit.tape.holes).toEqual([hole(c4, 41, 44), hole(notOnOrgan, 20, 22)]);
    expect(edit.tape.length).toBe(tape.length);
    expectOtherFieldsUnchanged(tape, edit.tape);
  });
});

describe('changeHoleLength', () => {
  const to = (first: number, last: number) => ({
    start: col(first - 1),
    length: defined(columnCount(last - first + 1), 'length'),
  });

  it('moves the end, then the start', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const longer = unwrap(changeHoleLength(tape, ref(c4, 10), to(10, 16)));
    expect(longer.hole).toEqual(hole(c4, 10, 16));
    expect(longer.hole).toEqual({pipe: c4, start: col(9), length: defined(columnCount(7), 'length')});

    const shorter = unwrap(changeHoleLength(longer.tape, ref(c4, 10), to(12, 16)));
    expect(shorter.hole).toEqual({pipe: c4, start: col(11), length: defined(columnCount(5), 'length')});
    expect(shorter.tape.holes).toEqual([hole(c4, 12, 16)]);
  });

  it('allows shortening to one Column', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(unwrap(changeHoleLength(tape, ref(c4, 10), to(10, 10))).hole).toEqual(hole(c4, 10, 10));
  });

  it('refuses to reach into another Hole of the Pipe', () => {
    const tape = aTape([hole(c4, 10, 13), hole(c4, 16, 19)]);
    const refusal = {ok: false, error: {code: 'overlaps', other: hole(c4, 16, 19)}};

    expect(changeHoleLength(tape, ref(c4, 10), to(10, 16))).toEqual(refusal);
    expect(changeHoleLength(tape, ref(c4, 10), to(10, 20))).toEqual(refusal);
    expect(tape.holes).toEqual([hole(c4, 10, 13), hole(c4, 16, 19)]);
  });

  it('refuses an unknown Hole', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    expect(changeHoleLength(tape, ref(c4, 11), to(11, 14))).toEqual({ok: false, error: {code: 'no-such-hole'}});
  });

  it('leaves every other field and Hole unchanged, including Holes off the Organ', () => {
    const tape = aTape([hole(c4, 10, 13), hole(notOnOrgan, 20, 22)]);

    const edit = unwrap(changeHoleLength(tape, ref(c4, 10), to(10, 15)));

    expect(edit.tape.holes).toEqual([hole(c4, 10, 15), hole(notOnOrgan, 20, 22)]);
    expect(edit.tape.length).toBe(tape.length);
    expectOtherFieldsUnchanged(tape, edit.tape);
  });
});

describe('addHole', () => {
  it('adds a Hole of the Minimum Hole Length in whole Columns', () => {
    const tape = aTape([hole(d4, 5, 6)]);

    const edit = unwrap(addHole(tape, wideHoleOrgan, c4, col(19)));

    expect(edit.hole).toEqual(hole(c4, 20, 22));
    expect(edit.hole).toEqual({pipe: c4, start: col(19), length: defined(columnCount(3), 'length')});
    expect(edit.tape.holes).toEqual([hole(c4, 20, 22), hole(d4, 5, 6)]);
    expect(edit.tape.length).toBe(tape.length);
    expectOtherFieldsUnchanged(tape, edit.tape);
  });

  it('adds the first Hole to a Tape without Holes', () => {
    const edit = unwrap(addHole(aTape([]), wideHoleOrgan, c4, col(19)));

    expect(edit.tape.holes).toEqual([hole(c4, 20, 22)]);
  });

  it('stops at the next Hole of the Pipe, touching it, which is a too-close Cutting Problem', () => {
    const tape = aTape([hole(c4, 22, 25)]);

    const edit = unwrap(addHole(tape, wideHoleOrgan, c4, col(19)));

    expect(edit.hole).toEqual(hole(c4, 20, 21));
    expect(edit.tape.holes).toEqual([hole(c4, 20, 21), hole(c4, 22, 25)]);
    expect(cuttingProblems(edit.tape, wideHoleOrgan).map((problem) => problem.code)).toContain('too-close');
  });

  it('ignores Holes of other Pipes and earlier Holes when shortening', () => {
    const tape = aTape([hole(c4, 10, 13), hole(d4, 22, 25)]);

    expect(unwrap(addHole(tape, wideHoleOrgan, c4, col(19))).hole).toEqual(hole(c4, 20, 22));
  });

  it('refuses a Column that a Hole of the Pipe covers', () => {
    const tape = aTape([hole(c4, 18, 22)]);

    expect(addHole(tape, wideHoleOrgan, c4, col(19))).toEqual({
      ok: false,
      error: {code: 'overlaps', other: hole(c4, 18, 22)},
    });
    expect(tape.holes).toEqual([hole(c4, 18, 22)]);
  });

  it('refuses a Pipe that is not on the Organ', () => {
    expect(addHole(aTape([]), wideHoleOrgan, notOnOrgan, col(19))).toEqual({
      ok: false,
      error: {code: 'not-on-the-organ', pipe: notOnOrgan},
    });
  });
});

describe('growth of the Tape (FR-008)', () => {
  it('grows to Column 104 when a Hole end is changed to Column 104', () => {
    const tape = aTape([hole(c4, 90, 95)]);

    const edit = unwrap(changeHoleLength(tape, ref(c4, 90), {start: col(89), length: defined(columnCount(15), 'length')}));

    expect(edit.tape.length).toBe(104);
  });

  it('grows to Column 110 when a Hole is added there', () => {
    const edit = unwrap(addHole(aTape([]), wideHoleOrgan, c4, col(107)));

    expect(edit.tape.length).toBe(110);
  });

  it('grows to Column 110 when a Hole is moved to end there', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(106)}));

    expect(edit.tape.length).toBe(110);
  });

  it('keeps the grown length when the Hole is shortened, moved back or removed', () => {
    const grown = unwrap(changeHoleLength(aTape([hole(c4, 90, 95)]), ref(c4, 90), {start: col(89), length: defined(columnCount(15), 'length')})).tape;

    const shorter = unwrap(changeHoleLength(grown, ref(c4, 90), {start: col(89), length: defined(columnCount(2), 'length')}));
    const moved = unwrap(moveHole(grown, organ, ref(c4, 90), {pipe: c4, start: col(10)}));
    const removed = unwrap(removeHole(grown, ref(c4, 90)));

    expect(shorter.tape.length).toBe(104);
    expect(moved.tape.length).toBe(104);
    expect(removed.length).toBe(104);
  });

  it('keeps the length for an edit inside the Tape', () => {
    const tape = aTape([hole(c4, 10, 13)]);

    const edit = unwrap(moveHole(tape, organ, ref(c4, 10), {pipe: c4, start: col(96)}));

    expect(edit.tape.length).toBe(100);
  });
});

describe('firstFreeColumnAfter', () => {
  it('is Column 0 when no Hole is selected', () => {
    expect(firstFreeColumnAfter(aTape([hole(c4, 1, 4)]), undefined)).toBe(0);
  });

  it('is Column 0 when the Tape has no Holes', () => {
    expect(firstFreeColumnAfter(aTape([]), ref(c4, 3))).toBe(0);
  });

  it('is the Column right after the end of the selected Hole', () => {
    expect(firstFreeColumnAfter(aTape([hole(c4, 3, 4)]), ref(c4, 3))).toBe(col(4));
  });

  it('skips Holes of the same Pipe that follow directly', () => {
    const tape = aTape([hole(c4, 3, 4), hole(c4, 5, 6), hole(c4, 7, 7)]);

    expect(firstFreeColumnAfter(tape, ref(c4, 3))).toBe(col(7));
  });

  it('ignores Holes of other Pipes', () => {
    const tape = aTape([hole(c4, 3, 4), hole(d4, 5, 8)]);

    expect(firstFreeColumnAfter(tape, ref(c4, 3))).toBe(col(4));
  });
});

describe('performance on a 2,000-Column Tape (SC-002, research R10)', () => {
  it('edits, finds Cutting Problems and builds the geometry in a median under 20 ms', () => {
    const notes = Array.from({length: 31}, (_, row) => 40 + row);
    const organResult = validateOrgan({
      name: 'Big organ',
      tapeBed: {tapeWidth: 160, holeDiameter: 3, rowSpacing: 4},
      minimumGap: 1,
      leadIn: 20,
      pipes: notes.map((note) => ({note})),
    });
    if (!organResult.ok) throw new Error('invalid test Organ');
    const bigOrgan = organResult.value;
    const holes: Hole[] = notes
      .flatMap((note) => Array.from({length: 194}, (_, k) => hole(pipeOf(note), k * 10 + 1, k * 10 + 4)))
      .slice(0, 6000);
    const tape = tapeOf({
      id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
      name: 'Big',
      organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
      songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
      selectedParts: [defined(partIndex(1, 3), 'part')],
      transposition: defined(transposition(0), 'transposition'),
      columnLength: defined(millimetres(2.5), 'column length'),
      length: defined(columnCount(2000), 'length'),
      holes,
    });
    const target = defined(holes[0], 'first hole');

    function oneEdit(): void {
      const edit = unwrap(moveHole(tape, bigOrgan, target, {pipe: target.pipe, start: col(5)}));
      holesWithCuttingProblems(cuttingProblems(edit.tape, bigOrgan));
      tapeGeometry(edit.tape, bigOrgan);
    }

    oneEdit();
    const durations: number[] = [];
    for (let run = 0; run < 20; run++) {
      const begin = performance.now();
      oneEdit();
      durations.push(performance.now() - begin);
    }
    durations.sort((a, b) => a - b);
    const median = ((durations[9] ?? Infinity) + (durations[10] ?? Infinity)) / 2;

    expect(median).toBeLessThan(20);
  });
});
