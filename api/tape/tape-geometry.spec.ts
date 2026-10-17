import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {asValidTape, type Column, type ColumnCount, type Hole, type Tape} from './tape';
import {tapeGeometry} from './tape-geometry';

/** A valid Organ: 120 mm wide, 3.5 mm rows, 2.5 mm holes, notes 60, 62, … */
function testOrgan(name: string, pipeCount: number, leadIn: number): Organ {
  const result = validateOrgan({
    name,
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    leadIn,
    pipes: Array.from({length: pipeCount}, (_, row) => ({note: 60 + 2 * row})),
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

// Street organ: 120 mm wide, 31 rows at 3,5 mm, hole 2,5 mm, Column 2,5 mm. The Pipe of row r (from 1) is note 58 + 2r.
const streetOrgan = testOrgan('Street organ', 31, 20);

function hole(pipe: number, start: number, length: number): Hole {
  const note = midiNoteNumber(pipe);
  if (note === undefined) throw new Error(`not a note: ${pipe}`);
  return {pipe: note, start: start as Column, length: length as ColumnCount};
}

function tapeWith(organ: Organ, holes: readonly Hole[]): Tape {
  return asValidTape({
    id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: 2.5 as Millimetres,
    length: 100 as ColumnCount,
    holes,
  });
}

describe('tapeGeometry', () => {
  it('measures the Lead-in, the Tape from Column 1 and the Border in mm', () => {
    const geometry = tapeGeometry(tapeWith(streetOrgan, []), streetOrgan);

    expect(geometry.leadIn).toBe(20);
    expect(geometry.length).toBe(250);
    expect(geometry.width).toBe(120);
    expect(geometry.border).toBeCloseTo(6.25);
  });

  it('has a Lead-in of 0 for an Organ without one', () => {
    const organ = testOrgan('Plain', 31, 0);

    expect(tapeGeometry(tapeWith(organ, []), organ).leadIn).toBe(0);
  });

  it('centres the rows, row 1 nearest the top edge, leaving the Border on both sides', () => {
    const {rowCentres, border, width} = tapeGeometry(tapeWith(streetOrgan, []), streetOrgan);

    expect(rowCentres).toHaveLength(31);
    expect(rowCentres[0]).toBeCloseTo(7.5);
    expect(rowCentres[30]).toBeCloseTo(112.5);
    expect(width - (rowCentres[30] ?? 0)).toBeCloseTo(7.5);
    expect(border).toBeCloseTo(6.25);
  });

  it('draws a Hole as the slot from its first Column start to its last Column end', () => {
    // Row 25 is note 108.
    const {slots} = tapeGeometry(tapeWith(streetOrgan, [hole(108, 64, 15)]), streetOrgan);

    expect(slots).toHaveLength(1);
    const [slot] = slots;
    expect(slot?.row).toBe(25);
    expect(slot?.start).toBe(64);
    expect(slot?.x).toBeCloseTo(180);
    expect(slot?.width).toBeCloseTo(37.5);
    expect(slot?.y).toBeCloseTo(90.25);
    expect(slot?.height).toBeCloseTo(2.5);
    expect(slot?.radius).toBeCloseTo(1.25);
  });

  it('leaves out the Holes of a Pipe no longer on the Organ', () => {
    // Note 60 is on the Organ (row 1), note 59 is not.
    const {slots} = tapeGeometry(tapeWith(streetOrgan, [hole(60, 0, 2), hole(59, 4, 2)]), streetOrgan);

    expect(slots.map((slot) => slot.start)).toEqual([0]);
  });

  it('moves a Hole with its Pipe when the Organ is reordered', () => {
    const reordered = validateOrgan({
      name: 'Reordered',
      tapeBed: streetOrgan.tapeBed,
      minimumGap: streetOrgan.minimumGap,
      leadIn: streetOrgan.leadIn,
      pipes: [...streetOrgan.pipes].reverse().map((pipe) => ({note: pipe.note})),
    });
    if (!reordered.ok) throw new Error('invalid test Organ');

    const {slots} = tapeGeometry(tapeWith(reordered.value, [hole(60, 0, 2)]), reordered.value);

    expect(slots[0]?.row).toBe(31);
    expect(slots[0]?.y).toBeCloseTo(111.25);
  });

  describe('cut order of the Slots (FR-012)', () => {
    it('sorts the Slots by start although the Holes are stored by Pipe, then start', () => {
      // Rows 1, 2, 3 are notes 60, 62, 64; stored by Pipe: row 1, row 2, row 3.
      const holes = [hole(60, 8, 2), hole(62, 2, 2), hole(64, 5, 2)];

      const {slots} = tapeGeometry(tapeWith(streetOrgan, holes), streetOrgan);

      expect(slots.map((slot) => slot.start)).toEqual([2, 5, 8]);
      expect(slots.map((slot) => slot.row)).toEqual([2, 3, 1]);
    });

    it('cuts row 1 first when two Holes start in the same Column', () => {
      const reordered = validateOrgan({
        name: 'Reordered',
        tapeBed: streetOrgan.tapeBed,
        minimumGap: streetOrgan.minimumGap,
        leadIn: streetOrgan.leadIn,
        pipes: [...streetOrgan.pipes].reverse().map((pipe) => ({note: pipe.note})),
      });
      if (!reordered.ok) throw new Error('invalid test Organ');
      // Note 60 is row 31 and note 62 is row 30, so the stored order is the reverse of the row order.
      const holes = [hole(60, 4, 2), hole(62, 4, 2)];

      const {slots} = tapeGeometry(tapeWith(reordered.value, holes), reordered.value);

      expect(slots.map((slot) => slot.row)).toEqual([30, 31]);
    });
  });

  describe('on the reference Organ (Lead-in 50, Minimum Gap 2, 100 mm wide, hole 3, 4 rows at 12 mm)', () => {
    function reference(leadIn: number, minimumGap: number, border0 = false): Organ {
      const result = validateOrgan({
        name: 'Reference',
        tapeBed: border0
          ? {tapeWidth: 100, holeDiameter: 3, rowSpacing: 97 / 3}
          : {tapeWidth: 100, holeDiameter: 3, rowSpacing: 12},
        minimumGap,
        leadIn,
        pipes: Array.from({length: 4}, (_, row) => ({note: 60 + 2 * row})),
      });
      if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
      return result.value;
    }

    function tape(organ: Organ, holes: readonly Hole[], length: number): Tape {
      return {...tapeWith(organ, holes), columnLength: 3 as Millimetres, length: length as ColumnCount};
    }

    it('puts the first Hole of row 1 at the Lead-in, measured from the tip', () => {
      const organ = reference(50, 2);
      const [slot] = tapeGeometry(tape(organ, [hole(60, 0, 4)], 200), organ).slots;

      expect(slot?.x).toBeCloseTo(50);
      expect(slot?.width).toBeCloseTo(12);
      expect(slot?.y).toBeCloseTo(30.5);
      expect((slot?.y ?? 0) + (slot?.radius ?? 0)).toBeCloseTo(32);
    });

    it('measures the document: Lead-in, Columns and one Minimum Gap', () => {
      const organ = reference(50, 2);
      const geometry = tapeGeometry(tape(organ, [], 200), organ);

      expect(geometry.length).toBe(600);
      expect(geometry.endGap).toBe(2);
      expect(geometry.totalLength).toBe(652);
      expect(geometry.width).toBe(100);
    });

    it('starts Column 1 at x = 0 without a Lead-in', () => {
      const organ = reference(0, 2);
      const [slot] = tapeGeometry(tape(organ, [hole(60, 5, 4)], 200), organ).slots;

      expect(slot?.x).toBeCloseTo(15);
    });

    it('lets empty Columns at the end count in the length', () => {
      const organ = reference(50, 2);

      expect(tapeGeometry(tape(organ, [hole(60, 0, 4)], 200), organ).length).toBe(600);
    });

    it('puts Slots on the long edges when the Border is 0', () => {
      const organ = reference(50, 2, true);
      const geometry = tapeGeometry(tape(organ, [hole(60, 0, 4), hole(66, 0, 4)], 200), organ);

      expect(geometry.border).toBeCloseTo(0);
      expect(geometry.slots[0]?.y).toBeCloseTo(0);
    });

    describe('outline', () => {
      it('cuts from the tip on the top edge, to the end cut, and back along the Lead-in diagonal', () => {
        const organ = reference(50, 2);
        const {outline} = tapeGeometry(tape(organ, [], 200), organ);

        expect(outline.tip).toEqual({x: 0, y: 0});
        expect(outline.topEnd).toEqual({x: 652, y: 0});
        expect(outline.bottomEnd).toEqual({x: 652, y: 100});
        expect(outline.columnOneBottom).toEqual({x: 50, y: 100});
      });

      it('cuts square at Column 1 without a Lead-in', () => {
        const organ = reference(0, 2);
        const {outline} = tapeGeometry(tape(organ, [], 200), organ);

        expect(outline.columnOneBottom).toEqual({x: 0, y: 100});
      });

      it('is the same for a Tape with and without Holes', () => {
        const organ = reference(50, 2);

        expect(tapeGeometry(tape(organ, [hole(60, 0, 4)], 200), organ).outline).toEqual(
          tapeGeometry(tape(organ, [], 200), organ).outline,
        );
      });
    });
  });
});
