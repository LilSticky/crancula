import {describe, expect, it} from 'vitest';
import {
  asValidOrgan,
  border,
  millimetres,
  minimumHoleLength,
  newOrganId,
  organId,
  rowSpan,
  tapeBedFit,
  type TapeBed,
} from './organ';
import {midiNoteNumber, type MidiNoteNumber} from './midi-note-number';

function mm(value: number) {
  const result = millimetres(value);
  if (result === undefined) throw new Error(`invalid test value ${value}`);
  return result;
}

const tapeBed: TapeBed = {tapeWidth: mm(120), holeDiameter: mm(2.5), rowSpacing: mm(3.5)};

describe('millimetres', () => {
  it.each([0, 0.5, 120])('accepts %d', (value) => {
    expect(millimetres(value)).toBe(value);
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(millimetres(value)).toBeUndefined();
  });
});

describe('organId', () => {
  it('accepts a UUID', () => {
    expect(organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f')).toBe('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f');
  });

  it.each(['', 'organ-1'])('rejects "%s"', (value) => {
    expect(organId(value)).toBeUndefined();
  });

  it('creates new unique ids', () => {
    const first = newOrganId();
    expect(organId(first)).toBe(first);
    expect(newOrganId()).not.toBe(first);
  });
});

describe('rowSpan', () => {
  it('is (pipes − 1) × row spacing + hole diameter', () => {
    expect(rowSpan(tapeBed, 31)).toBeCloseTo(30 * 3.5 + 2.5);
  });

  it('is the hole diameter for a single Pipe', () => {
    expect(rowSpan(tapeBed, 1)).toBeCloseTo(2.5);
  });
});

describe('border', () => {
  function organWith(bed: TapeBed, pipeCount: number) {
    return asValidOrgan({
      id: newOrganId(),
      name: 'Test organ',
      tapeBed: bed,
      minimumGap: mm(1.5),
      leadIn: mm(20),
      pipes: Array.from({length: pipeCount}, (_, row) => ({note: midiNoteNumber(53 + row) as MidiNoteNumber})),
    });
  }

  it('is 6.25 mm for the street organ (120 / 2.5 / 3.5, 31 Pipes)', () => {
    expect(border(organWith(tapeBed, 31))).toBeCloseTo(6.25);
  });

  it('is 0 when the rows exactly fill the tape width', () => {
    const fullBed: TapeBed = {tapeWidth: mm(107.5), holeDiameter: mm(2.5), rowSpacing: mm(3.5)};
    expect(border(organWith(fullBed, 31))).toBe(0);
  });
});

describe('tapeBedFit', () => {
  it('gives the Row Span and the Border of a fitting Tape Bed', () => {
    const fit = tapeBedFit(tapeBed, 31);
    expect(fit.rowSpan).toBeCloseTo(107.5);
    expect(fit.border).toBeCloseTo(6.25);
  });

  it('gives a negative Border when the rows do not fit', () => {
    const fit = tapeBedFit({tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5}, 31);
    expect(fit.rowSpan).toBeCloseTo(107.5);
    expect(fit.border).toBeCloseTo(-3.75);
  });
});

describe('minimumHoleLength', () => {
  it('equals the hole diameter of the Tape Bed', () => {
    expect(minimumHoleLength(tapeBed)).toBe(2.5);
  });
});
