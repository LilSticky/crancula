import {DEFAULT_CRANK_SPEED_RANGE} from './crank-speed-range';
import {describe, expect, it} from 'vitest';
import {
  asValidOrgan,
  borders,
  millimetres,
  minimumHoleLength,
  newOrganId,
  organId,
  rowCentres,
  rowSpan,
  tapeBedFit,
  tapeBedFits,
  type TapeBed,
} from './organ';
import {midiNoteNumber, type MidiNoteNumber} from './midi-note-number';

function mm(value: number) {
  const result = millimetres(value);
  if (result === undefined) throw new Error(`invalid test value ${value}`);
  return result;
}

const tapeBed: TapeBed = {tapeWidth: mm(120), holeDiameter: mm(2.5), rowSpacing: mm(3.5)};

/** The 20er reference: 110 mm tape, 3 mm holes, 3.85 mm rows, 20 Pipes. */
const twentyBed: TapeBed = {tapeWidth: mm(110), holeDiameter: mm(3), rowSpacing: mm(3.85)};

/** The 31er reference: 140 mm tape, 2.5 mm holes, 3.86 mm rows, 31 Pipes. */
const thirtyOneBed: TapeBed = {tapeWidth: mm(140), holeDiameter: mm(2.5), rowSpacing: mm(3.86)};

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

describe('borders', () => {
  function organWith(bed: TapeBed, pipeCount: number) {
    return asValidOrgan({
      id: newOrganId(),
      name: 'Test organ',
      tapeBed: bed,
      minimumGap: mm(1.5),
      leadIn: mm(20),
      crankSpeedRange: DEFAULT_CRANK_SPEED_RANGE,
      pipes: Array.from({length: pipeCount}, (_, row) => ({note: midiNoteNumber(53 + row) as MidiNoteNumber})),
    });
  }

  it('is 6.25 mm on each side for the street organ (120 / 2.5 / 3.5, 31 Pipes)', () => {
    const {guide, far} = borders(organWith(tapeBed, 31));

    expect(guide).toBeCloseTo(6.25);
    expect(far).toBeCloseTo(6.25);
  });

  it('is 0 on each side when the rows exactly fill the tape width', () => {
    const fullBed: TapeBed = {tapeWidth: mm(107.5), holeDiameter: mm(2.5), rowSpacing: mm(3.5)};
    const {guide, far} = borders(organWith(fullBed, 31));

    expect(guide).toBe(0);
    expect(far).toBe(0);
  });

  it('centres the 20er rows at 16.925 mm on each side without a Guide margin', () => {
    const {guide, far} = borders(organWith(twentyBed, 20));

    expect(guide).toBeCloseTo(16.925);
    expect(far).toBeCloseTo(16.925);
  });

  it('puts the guide side at 8.5 mm and the far side at 25.35 mm for the 20er with a Guide margin of 10 mm', () => {
    const {guide, far} = borders(organWith({...twentyBed, guideMargin: mm(10)}, 20));

    expect(guide).toBeCloseTo(8.5);
    expect(far).toBeCloseTo(25.35);
  });

  it('puts the guide side at 9.75 mm and the far side at 11.95 mm for the 31er with a Guide margin of 11 mm', () => {
    const {guide, far} = borders(organWith({...thirtyOneBed, guideMargin: mm(11)}, 31));

    expect(guide).toBeCloseTo(9.75);
    expect(far).toBeCloseTo(11.95);
  });
});

describe('tapeBedFit', () => {
  it('gives the Row Span and the Borders of a fitting Tape Bed', () => {
    const fit = tapeBedFit(tapeBed, 31);

    expect(fit.rowSpan).toBeCloseTo(107.5);
    expect(fit.borders.guide).toBeCloseTo(6.25);
    expect(fit.borders.far).toBeCloseTo(6.25);
  });

  it('centres the 20er rows: Row Span 76.15 mm, 16.925 mm on each side without a Guide margin', () => {
    const fit = tapeBedFit(twentyBed, 20);

    expect(fit.rowSpan).toBeCloseTo(76.15);
    expect(fit.borders.guide).toBeCloseTo(16.925);
    expect(fit.borders.far).toBeCloseTo(16.925);
  });

  it('puts the guide side at 8.5 mm and the far side at 25.35 mm for the 20er with a Guide margin of 10 mm', () => {
    const fit = tapeBedFit({...twentyBed, guideMargin: mm(10)}, 20);

    expect(fit.rowSpan).toBeCloseTo(76.15);
    expect(fit.borders.guide).toBeCloseTo(8.5);
    expect(fit.borders.far).toBeCloseTo(25.35);
  });

  it('puts the guide side at 9.75 mm and the far side at 11.95 mm for the 31er with a Guide margin of 11 mm', () => {
    const fit = tapeBedFit({...thirtyOneBed, guideMargin: mm(11)}, 31);

    expect(fit.rowSpan).toBeCloseTo(118.3);
    expect(fit.borders.guide).toBeCloseTo(9.75);
    expect(fit.borders.far).toBeCloseTo(11.95);
  });

  it('gives a negative far side when a Guide margin of 30 mm leaves the 20er rows no room', () => {
    const fit = tapeBedFit({tapeWidth: mm(100), holeDiameter: mm(3), rowSpacing: mm(3.85), guideMargin: mm(30)}, 20);

    expect(fit.rowSpan).toBeCloseTo(76.15);
    expect(fit.borders.far).toBeCloseTo(-4.65);
  });

  it('gives negative Borders when the rows do not fit', () => {
    const fit = tapeBedFit({tapeWidth: mm(100), holeDiameter: mm(2.5), rowSpacing: mm(3.5)}, 31);

    expect(fit.rowSpan).toBeCloseTo(107.5);
    expect(fit.borders.guide).toBeCloseTo(-3.75);
    expect(fit.borders.far).toBeCloseTo(-3.75);
  });
});

describe('rowCentres', () => {
  it('puts row 1 at the Guide margin and steps by the row spacing: the guided 20er starts at 10 mm, step 3.85', () => {
    const centres = rowCentres({...twentyBed, guideMargin: mm(10)}, 20);

    expect(centres).toHaveLength(20);
    expect(centres[0]).toBeCloseTo(10);
    expect(centres[1]).toBeCloseTo(13.85);
    expect(centres[19]).toBeCloseTo(83.15);
  });

  it('centres the 20er rows: row 1 starts at 18.425 mm from the top edge without a Guide margin', () => {
    const centres = rowCentres(twentyBed, 20);

    expect(centres).toHaveLength(20);
    expect(centres[0]).toBeCloseTo(18.425);
    expect(centres[1]).toBeCloseTo(18.425 + 3.85);
  });
});

describe('tapeBedFits', () => {
  it('is true for the centred 20er', () => {
    expect(tapeBedFits(tapeBedFit(twentyBed, 20))).toBe(true);
  });

  it('is true for the guided 20er with a Guide margin of 10 mm', () => {
    expect(tapeBedFits(tapeBedFit({...twentyBed, guideMargin: mm(10)}, 20))).toBe(true);
  });

  it('is false when the guide side Border is below 0: a Guide margin of 1 mm with 3 mm holes', () => {
    expect(tapeBedFits(tapeBedFit({...twentyBed, guideMargin: mm(1)}, 20))).toBe(false);
  });

  it('is false when the far side Border is below 0: a Guide margin of 30 mm on a 100 mm Tape', () => {
    const tooFar: TapeBed = {tapeWidth: mm(100), holeDiameter: mm(3), rowSpacing: mm(3.85), guideMargin: mm(30)};

    expect(tapeBedFits(tapeBedFit(tooFar, 20))).toBe(false);
  });

  it('is false when the centred rows are wider than the Tape: 31 rows on 100 mm', () => {
    expect(tapeBedFits(tapeBedFit({tapeWidth: mm(100), holeDiameter: mm(2.5), rowSpacing: mm(3.5)}, 31))).toBe(false);
  });
});

describe('minimumHoleLength', () => {
  it('equals the hole diameter of the Tape Bed', () => {
    expect(minimumHoleLength(tapeBed)).toBe(2.5);
  });
});
