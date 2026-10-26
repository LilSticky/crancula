import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {column, columnCount, tapeId, transposition, type Hole, type Tape} from './tape';
import {referenceOrgan, referencePlotter, tapeOf} from './tape-fixture';
import {tapeGeometry, type Point, type TapeGeometry} from './tape-geometry';
import {pieceGeometry, type CutGeometry} from './tape-piece-geometry';
import {tapePieces, type TapePiece} from './tape-pieces';

/** Lengths of the expected Tape pieces are exact to 0.01 mm (SC-002). */
const DIGITS = 2;

const TAPE_ID = tapeId('00000000-0000-4000-8000-0000000000dd');

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function nth<T>(items: readonly T[], index: number): T {
  return defined(items[index], `item ${index}`);
}

function hole(pipe: MidiNoteNumber, start: number, length: number): Hole {
  return {pipe, start: defined(column(start), `Column ${start}`), length: defined(columnCount(length), `length ${length}`)};
}

function note(row: number): MidiNoteNumber {
  return defined(midiNoteNumber(60 + row), `Pipe of row ${row + 1}`);
}

/** The reference Tape of spec 011 without Holes: Column length 3 mm, 200 Columns, on the reference Organ. */
function tapeWith(organ: Organ, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    id: defined(TAPE_ID, 'Tape id'),
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition 0'),
    columnLength: defined(millimetres(3), 'Column length 3 mm'),
    length: defined(columnCount(200), 'Column count 200'),
    holes: [...holes],
  });
}

/** The Tape pieces of `tape` for the reference Plotter (300 mm, Overlap 20 mm), with the Tape geometry they cut. */
function cutOf(tape: Tape, organ: Organ): {readonly geometry: TapeGeometry; readonly pieces: readonly TapePiece[]} {
  const geometry = tapeGeometry(tape, organ);
  const cut = tapePieces(geometry, referencePlotter());
  if (cut.kind !== 'pieces') throw new Error(`expected Tape pieces, got ${cut.kind}`);
  return {geometry, pieces: cut.pieces};
}

function xsOf(cut: CutGeometry): readonly number[] {
  return cut.slots.map((slot) => slot.x);
}

function expectPoint(actual: Point, x: number, y: number): void {
  expect(actual.x).toBeCloseTo(x, DIGITS);
  expect(actual.y).toBeCloseTo(y, DIGITS);
}

/** Holes that exercise the scenario-1 pieces: one in piece 1, one in the Overlap after the first Join, one in piece 2 and one in piece 3. */
const SCENARIO_HOLES: readonly Hole[] = [
  hole(note(1), 10, 2), // row 2 at x 80: piece 1 only
  hole(note(0), 80, 2), // row 1 at x 290: in the Overlap after the first Join at 278, so in piece 1 and piece 2
  hole(note(2), 150, 2), // row 3 at x 500: piece 2 only
  hole(note(0), 190, 2), // row 1 at x 620: piece 3 only
];

describe('pieceGeometry', () => {
  it('gives the scenario-1 pieces the lengths 298, 299 and 95 mm, all 100 mm wide', () => {
    const organ = referenceOrgan();
    const {geometry, pieces} = cutOf(tapeWith(organ), organ);
    const cuts = pieces.map((piece) => pieceGeometry(geometry, piece));

    expect(cuts).toHaveLength(3);
    expect(nth(cuts, 0).totalLength).toBeCloseTo(298, DIGITS);
    expect(nth(cuts, 1).totalLength).toBeCloseTo(299, DIGITS);
    expect(nth(cuts, 2).totalLength).toBeCloseTo(95, DIGITS);
    for (const cut of cuts) expect(cut.width).toBeCloseTo(100, DIGITS);
  });

  it('shifts each Slot wholly inside a piece by the piece start, in cut order', () => {
    const organ = referenceOrgan();
    const {geometry, pieces} = cutOf(tapeWith(organ, SCENARIO_HOLES), organ);
    const cuts = pieces.map((piece) => pieceGeometry(geometry, piece));

    expect(cuts).toHaveLength(3);
    const [first, second, third] = [nth(cuts, 0), nth(cuts, 1), nth(cuts, 2)];
    expect(xsOf(first)).toHaveLength(2);
    expect(xsOf(first)[0]).toBeCloseTo(80, DIGITS);
    expect(xsOf(first)[1]).toBeCloseTo(290, DIGITS);
    expect(xsOf(second)).toHaveLength(2);
    expect(xsOf(second)[0]).toBeCloseTo(12, DIGITS);
    expect(xsOf(second)[1]).toBeCloseTo(222, DIGITS);
    expect(xsOf(third)).toHaveLength(1);
    expect(xsOf(third)[0]).toBeCloseTo(63, DIGITS);
  });

  it('keeps a Slot in an Overlap at the same place relative to its Join in both pieces', () => {
    const organ = referenceOrgan();
    const {geometry, pieces} = cutOf(tapeWith(organ, SCENARIO_HOLES), organ);
    const [first, second] = [nth(pieces, 0), nth(pieces, 1)];
    const join = defined(first.join, 'Join after piece 1');

    const inFirst = nth(xsOf(pieceGeometry(geometry, first)), 1);
    const inSecond = nth(xsOf(pieceGeometry(geometry, second)), 0);
    expect(inFirst - join.at).toBeCloseTo(inSecond, DIGITS);
  });

  it('keeps the Lead-in diagonal on the first piece and ends it at the piece length', () => {
    const organ = referenceOrgan();
    const {geometry, pieces} = cutOf(tapeWith(organ), organ);
    const {outline} = pieceGeometry(geometry, nth(pieces, 0));

    expectPoint(outline.tip, 0, 0);
    expectPoint(outline.topEnd, 298, 0);
    expectPoint(outline.bottomEnd, 298, 100);
    expectPoint(outline.columnOneBottom, 50, 100);
  });

  it('cuts the later pieces square at x = 0 and ends them at the piece length', () => {
    const organ = referenceOrgan();
    const {geometry, pieces} = cutOf(tapeWith(organ), organ);
    const [, second, third] = [nth(pieces, 0), nth(pieces, 1), nth(pieces, 2)];

    const middle = pieceGeometry(geometry, second).outline;
    expectPoint(middle.tip, 0, 0);
    expectPoint(middle.topEnd, 299, 0);
    expectPoint(middle.bottomEnd, 299, 100);
    expectPoint(middle.columnOneBottom, 0, 100);

    const last = pieceGeometry(geometry, third).outline;
    expectPoint(last.tip, 0, 0);
    expectPoint(last.topEnd, 95, 0);
    expectPoint(last.bottomEnd, 95, 100);
    expectPoint(last.columnOneBottom, 0, 100);
  });

  it('cuts the first piece square too for a Lead-in of 0', () => {
    const result = validateOrgan({
      name: 'Square organ',
      tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
      minimumGap: 2,
      leadIn: 0,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
    });
    if (!result.ok) throw new Error('invalid test Organ with Lead-in 0');
    const {geometry, pieces} = cutOf(tapeWith(result.value), result.value);

    const outline = pieceGeometry(geometry, nth(pieces, 0)).outline;
    expectPoint(outline.tip, 0, 0);
    expectPoint(outline.columnOneBottom, 0, 100);
  });
});
