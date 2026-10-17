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
    expect(slot?.x).toBeCloseTo(160);
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
});
