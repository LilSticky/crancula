import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {column, columnCount, tapeId, transposition, type Column, type ColumnCount, type Hole, type Tape} from './tape';
import {plotterOf, referenceOrgan, referencePlotter, referenceTape, tapeOf} from './tape-fixture';
import {tapeGeometry, type Slot, type TapeGeometry} from './tape-geometry';
import {tapePieces, type TapePiece, type TapePieces} from './tape-pieces';
import type {Plotter} from '../plotter/plotter';

/** Floating point slack for lengths in mm. */
const EPSILON = 1e-9;

/** Generated Tapes checked by the invariant test. */
const GENERATED_CASES = 300;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const TAPE_ID = defined(tapeId('00000000-0000-4000-8000-0000000000cc'), 'Tape id');
const ROW_1 = defined(midiNoteNumber(60), 'Pipe of row 1');
const ROW_2 = defined(midiNoteNumber(61), 'Pipe of row 2');
const ROW_3 = defined(midiNoteNumber(62), 'Pipe of row 3');
const NO_PIPE = defined(midiNoteNumber(70), 'note without a Pipe on the reference Organ');
const ROWS: readonly MidiNoteNumber[] = [ROW_1, ROW_2, ROW_3];

function col(value: number): Column {
  return defined(column(value), `Column ${value}`);
}

function columns(value: number): ColumnCount {
  return defined(columnCount(value), `Column count ${value}`);
}

/** A Hole starting at Column index `start` (counted from 0, as in Tape.holes) and running `length` Columns. */
function hole(pipe: MidiNoteNumber, start: number, length: number): Hole {
  return {pipe, start: col(start), length: columns(length)};
}

/** The reference Organ of spec 003 with another Minimum Gap; otherwise the same as referenceOrgan(). */
function organWithGap(minimumGap: number): Organ {
  const result = validateOrgan({
    name: 'Reference organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4, guideMargin: null},
    minimumGap,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
  });
  if (!result.ok) throw new Error(`invalid test Organ with Minimum Gap ${minimumGap}`);
  return result.value;
}

/** A Tape on `organ` with Columns of `columnLength` mm, `length` Columns and the given Holes. */
function tapeWith(organ: Organ, columnLength: number, length: number, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    id: TAPE_ID,
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition 0'),
    columnLength: defined(millimetres(columnLength), `Column length ${columnLength}`),
    length: columns(length),
    holes: [...holes],
  });
}

/** The Tape pieces of `tape` on `organ` for `plotter`, from the geometry the Tape view and the SVG share. */
function piecesOf(tape: Tape, organ: Organ, plotter: Plotter): TapePieces {
  return tapePieces(tapeGeometry(tape, organ), plotter);
}

/** Whether a point lies closer than the Minimum Gap to a Slot; touching exactly at the Minimum Gap is not closer. */
function blocksPoint(geometry: TapeGeometry, point: number): boolean {
  const gap = geometry.endGap;
  return geometry.slots.some(
    (slot: Slot) => point > slot.x - gap + EPSILON && point < slot.x + slot.width + gap - EPSILON,
  );
}

/**
 * Brute force for the invariant test: the fewest Tape pieces over every possible Join, or undefined when no cut
 * exists. Written apart from the implementation: every Column boundary is tried, and each piece is checked.
 */
function fewestPieces(geometry: TapeGeometry, columnCountValue: number, workingLength: number, overlap: number): number | undefined {
  // Each node is a place a piece can start (the tip, then each possible Join) with the fewest pieces that lead to it.
  const nodes: {readonly start: number; readonly pieces: number}[] = [{start: 0, pieces: 0}];
  for (let k = 1; k < columnCountValue; k += 1) {
    const at = geometry.leadIn + k * geometry.columnLength;
    const overlapEnd = at + overlap;
    if (blocksPoint(geometry, at) || blocksPoint(geometry, overlapEnd)) continue;
    const reaching = nodes.flatMap((node) => (overlapEnd - node.start <= workingLength + EPSILON ? [node.pieces + 1] : []));
    if (reaching.length > 0) nodes.push({start: at, pieces: Math.min(...reaching)});
  }
  const finishing = nodes.flatMap((node) =>
    geometry.totalLength - node.start <= workingLength + EPSILON ? [node.pieces + 1] : [],
  );
  return finishing.length > 0 ? Math.min(...finishing) : undefined;
}

/** A small seeded pseudo-random generator (mulberry32), so every run tests the same Tapes. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from `min` to `max`, both included. */
function between(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

interface GeneratedCase {
  readonly organ: Organ;
  readonly tape: Tape;
  readonly workingLength: number;
  readonly overlap: number;
}

/** A small Tape with random Holes in three rows, and a Plotter with a random working length and Overlap. */
function generatedCase(seed: number): GeneratedCase {
  const random = seededRandom(seed);
  const organ = organWithGap(between(random, 1, 6));
  const workingLength = between(random, 60, 300);
  const overlap = between(random, 1, 30);
  const columnLength = between(random, 2, 5);
  const length = between(random, 10, 90);
  const holes: Hole[] = [];
  for (const pipe of ROWS) {
    let start = between(random, 0, 12);
    while (start < length) {
      const holeLength = between(random, 1, Math.min(4, length - start));
      holes.push(hole(pipe, start, holeLength));
      start += holeLength + between(random, 1, 30);
    }
  }
  return {organ, tape: tapeWith(organ, columnLength, length, holes), workingLength, overlap};
}

describe('tapePieces', () => {
  const organ = referenceOrgan();
  const plotter = referencePlotter();

  /** Scenario 1 of Story 2: the reference Tape without Holes, 652 mm, cut by the 300 mm Plotter. */
  const referenceCut = {
    kind: 'pieces',
    pieces: [
      {number: 1, start: 0, end: 298, join: {at: 278, after: 76, overlapEnd: 298}},
      {number: 2, start: 278, end: 577, join: {at: 557, after: 169, overlapEnd: 577}},
      {number: 3, start: 557, end: 652},
    ],
  };

  it('cuts the reference Tape without Holes at the Joins after Columns 76 and 169', () => {
    expect(piecesOf(tapeWith(organ, 3, 200), organ, plotter)).toEqual(referenceCut);
  });

  it('cuts a guided Tape without Holes at the same Joins as the centred one: a Guide margin moves rows, not Joins', () => {
    const guided = validateOrgan({
      name: 'Reference organ, guided',
      tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4, guideMargin: 10},
      minimumGap: 2,
      leadIn: 50,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
    });
    if (!guided.ok) throw new Error('invalid guided reference Organ');

    expect(piecesOf(tapeWith(guided.value, 3, 200), guided.value, plotter)).toEqual(referenceCut);
  });

  it('keeps a Tape that fits the working length in one piece', () => {
    // 50 mm Lead-in, 80 Columns of 3 mm and the 2 mm end gap: 292 mm.
    expect(piecesOf(tapeWith(organ, 3, 80), organ, plotter)).toEqual({
      kind: 'pieces',
      pieces: [{number: 1, start: 0, end: 292}],
    });
  });

  it('keeps a piece exactly as long as the working length in one piece', () => {
    // 50 mm Lead-in, 62 Columns of 4 mm and the 2 mm end gap: exactly 300 mm.
    expect(piecesOf(tapeWith(organ, 4, 62), organ, plotter)).toEqual({
      kind: 'pieces',
      pieces: [{number: 1, start: 0, end: 300}],
    });
  });

  it('leaves the Join possible when a Hole lies in the Overlap after it', () => {
    // A Hole from 284 mm to 290 mm: inside the 20 mm after the Join at 278 mm, clear of the Join and of its Overlap end.
    const tape = tapeWith(organ, 3, 200, [hole(ROW_1, 78, 2)]);
    expect(piecesOf(tape, organ, plotter)).toEqual(referenceCut);
  });

  it('places a Join exactly the Minimum Gap from a Hole, not one closer', () => {
    // Columns of 2 mm. A Hole from 280 mm to 286 mm: the Join at 280 mm lies on its start (closer than the
    // 2 mm Minimum Gap), the Join at 278 mm is exactly 2 mm before it and is allowed.
    const tape = tapeWith(organ, 2, 200, [hole(ROW_1, 115, 3)]);
    expect(piecesOf(tape, organ, plotter)).toEqual({
      kind: 'pieces',
      pieces: [
        {number: 1, start: 0, end: 298, join: {at: 278, after: 114, overlapEnd: 298}},
        {number: 2, start: 278, end: 452},
      ],
    });
  });

  it('keeps the end of an Overlap exactly the Minimum Gap from a Hole, not one closer', () => {
    // Columns of 2 mm. A Hole from 300 mm: the Overlap of the Join at 280 mm ends on its start (closer than the
    // Minimum Gap), so that Join is refused; the Join at 278 mm ends its Overlap 2 mm before the Hole.
    const tape = tapeWith(organ, 2, 200, [hole(ROW_1, 125, 1)]);
    expect(piecesOf(tape, organ, plotter)).toEqual({
      kind: 'pieces',
      pieces: [
        {number: 1, start: 0, end: 298, join: {at: 278, after: 114, overlapEnd: 298}},
        {number: 2, start: 278, end: 452},
      ],
    });
  });

  it('ignores a Hole whose Pipe is not on the Organ', () => {
    // A Hole from 272 mm to 299 mm on a note without a Pipe would cover both the Join and its Overlap end.
    const tape = tapeWith(organ, 3, 200, [hole(NO_PIPE, 74, 9)]);
    expect(piecesOf(tape, organ, plotter)).toEqual(referenceCut);
  });

  it('places Joins only after Column 1 and before the last Column', () => {
    // Minimum Gap 30 mm: the end cut lies 305 mm from the tip. The Join after the last Column (at 275 mm, its
    // Overlap ending at 295 mm) would fit the working length, but it is not a Join: the one after Column 74 is.
    const longEnd = organWithGap(30);
    const tape = tapeWith(longEnd, 3, 75);
    expect(piecesOf(tape, longEnd, plotter)).toEqual({
      kind: 'pieces',
      pieces: [
        {number: 1, start: 0, end: 292, join: {at: 272, after: 74, overlapEnd: 292}},
        {number: 2, start: 272, end: 305},
      ],
    });
  });

  describe('when no cut exists', () => {
    it('lists a 100-Column Hole from Column 1 as one stretch from Column 1 to Column 101', () => {
      // The Hole covers 50–350 mm and blocks up to 352 mm; the first possible Join is after Column 101 at 353 mm.
      const tape = tapeWith(organ, 3, 200, [hole(ROW_1, 0, 100)]);
      const expected: TapePieces = {kind: 'no-join', stretches: [{first: col(0), last: col(100)}]};

      expect(piecesOf(tape, organ, plotter)).toEqual(expected);
    });

    it('finds the reference cut for a 70-Column Hole from Column 1, at the furthest Join that fits', () => {
      // The first possible Join is after Column 71 at 263 mm; the furthest one within 300 mm is after Column 76.
      const tape = tapeWith(organ, 3, 200, [hole(ROW_1, 0, 70)]);

      expect(piecesOf(tape, organ, plotter)).toEqual(referenceCut);
    });

    it('lists two separate long stretches each on its own', () => {
      // Row 1 from Column 1 and row 2 from Column 151, 100 Columns each, 300 Columns in all. Stretch 1 runs from
      // the tip to the Join after Column 101 (353 mm). Stretch 2 runs from the Join after Column 142 (476 mm) to
      // the Join after Column 251 (803 mm), which is past the second Hole (500–800 mm).
      const tape = tapeWith(organ, 3, 300, [hole(ROW_1, 0, 100), hole(ROW_2, 150, 100)]);
      const expected: TapePieces = {
        kind: 'no-join',
        stretches: [
          {first: col(0), last: col(100)},
          {first: col(142), last: col(250)},
        ],
      };

      expect(piecesOf(tape, organ, plotter)).toEqual(expected);
    });

    it('makes the stretch from Column 1 to the first possible Join a problem when Lead-in and Overlap reach the working length', () => {
      // Lead-in 50 mm + Overlap 20 mm = 70 mm, at least the working length of 60 mm: no Join after the tip fits.
      const short = plotterOf({name: 'Short', workingWidth: 120, roll: false, workingLength: 60, overlap: 20, tapeSpacing: 3});
      const expected: TapePieces = {kind: 'no-join', stretches: [{first: col(0), last: col(0)}]};

      expect(piecesOf(tapeWith(organ, 3, 200), organ, short)).toEqual(expected);
    });

    it('makes a Tape without Holes uncuttable when a Column is longer than the working length less the Overlap', () => {
      // Columns of 290 mm: the Join after Column 1 ends its Overlap at 360 mm, beyond the 300 mm working length.
      const expected: TapePieces = {kind: 'no-join', stretches: [{first: col(0), last: col(0)}]};

      expect(piecesOf(tapeWith(organ, 290, 2), organ, plotter)).toEqual(expected);
    });
  });

  describe('when the Plotter is narrower than the tape', () => {
    it('gives too-wide with both widths and nothing else', () => {
      const narrow = plotterOf({name: 'Narrow', workingWidth: 90, roll: false, workingLength: 300, overlap: 20, tapeSpacing: 3});
      const expected: TapePieces = {kind: 'too-wide', tapeWidth: 100, workingWidth: 90};

      expect(piecesOf(tapeWith(organ, 3, 200), organ, narrow)).toEqual(expected);
    });

    it('fits a Tape exactly as wide as the working width (FR-017)', () => {
      const exact = plotterOf({name: 'Exact', workingWidth: 100, roll: false, workingLength: 300, overlap: 20, tapeSpacing: 3});

      expect(piecesOf(tapeWith(organ, 3, 200), organ, exact)).toEqual(referenceCut);
    });
  });

  describe('when the Plotter is a roll Plotter', () => {
    it('gives the reference Tape as one Tape piece of 652 mm, however long it is (FR-011)', () => {
      const roll = plotterOf({name: 'Vinyl cutter', workingWidth: 120, roll: true, workingLength: null, overlap: null, tapeSpacing: 3});

      expect(piecesOf(referenceTape(organ), organ, roll)).toEqual({
        kind: 'pieces',
        pieces: [{number: 1, start: 0, end: 652}],
      });
    });

    it('gives too-wide with both widths when the roll Plotter is narrower than the Tape (scenario 2)', () => {
      const narrowRoll = plotterOf({name: 'Narrow roll', workingWidth: 90, roll: true, workingLength: null, overlap: null, tapeSpacing: 3});
      const expected: TapePieces = {kind: 'too-wide', tapeWidth: 100, workingWidth: 90};

      expect(piecesOf(referenceTape(organ), organ, narrowRoll)).toEqual(expected);
    });
  });

  describe('on generated small Tapes', () => {
    it('cuts into contiguous Tape pieces within the working length, with the fewest pieces (SC-003, SC-004)', () => {
      let multiPiece = 0;
      for (let seed = 1; seed <= GENERATED_CASES; seed += 1) {
        const {organ: generatedOrgan, tape, workingLength, overlap} = generatedCase(seed);
        const geometry = tapeGeometry(tape, generatedOrgan);
        const generatedPlotter = plotterOf({name: 'Generated', workingWidth: 120, roll: false, workingLength, overlap, tapeSpacing: 3});
        const result = tapePieces(geometry, generatedPlotter);
        const expected = fewestPieces(geometry, tape.length, workingLength, overlap);

        if (expected === undefined) {
          expect(result.kind, `seed ${seed}`).toBe('no-join');
          continue;
        }
        const pieces: readonly TapePiece[] = result.kind === 'pieces' ? result.pieces : [];
        expect(result.kind, `seed ${seed}`).toBe('pieces');
        expect(pieces.length, `seed ${seed}: fewest Tape pieces`).toBe(expected);
        if (pieces.length > 1) multiPiece += 1;

        let start = 0;
        pieces.forEach((piece, index) => {
          const message = `seed ${seed}, Tape piece ${piece.number}`;
          expect(piece.number, message).toBe(index + 1);
          expect(piece.start, message).toBe(start);
          expect(piece.end - piece.start, message).toBeLessThanOrEqual(workingLength + EPSILON);

          if (index === pieces.length - 1) {
            expect(piece.join, message).toBeUndefined();
            expect(piece.end, message).toBe(geometry.totalLength);
            return;
          }
          const join = piece.join;
          if (join === undefined) throw new Error(`${message}: only the last Tape piece has no Join`);
          expect(piece.end, message).toBe(join.overlapEnd);
          expect(join.overlapEnd, message).toBeCloseTo(join.at + overlap, 9);
          expect(join.after, message).toBeGreaterThanOrEqual(1);
          expect(join.after, message).toBeLessThanOrEqual(tape.length - 1);
          expect(join.at, message).toBeCloseTo(geometry.leadIn + join.after * geometry.columnLength, 9);
          expect(blocksPoint(geometry, join.at), `${message}: no Slot closer than the Minimum Gap to the Join`).toBe(false);
          expect(blocksPoint(geometry, join.overlapEnd), `${message}: no Slot closer than the Minimum Gap to the Overlap end`).toBe(false);
          start = join.at;
        });
      }
      expect(multiPiece, 'generated Tapes that needed several Tape pieces').toBeGreaterThan(GENERATED_CASES / 4);
    });
  });
});
