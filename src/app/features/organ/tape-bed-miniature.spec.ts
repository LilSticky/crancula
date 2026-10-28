import {describe, expect, it} from 'vitest';
import {borders, emptyOrganDraft, type Organ, type OrganDraft, rowSpan, validateOrgan} from '@api/index';
import {tapeBedMiniature} from './tape-bed-miniature';

function organ(tapeWidth: number, pipeCount: number, guideMargin: number | null = null): Organ {
  const draft: OrganDraft = {
    ...emptyOrganDraft(),
    name: 'Test organ',
    tapeBed: {tapeWidth, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin},
    minimumGap: 1.5,
    leadIn: 20,
    pipes: Array.from({length: pipeCount}, (_, row) => ({note: 53 + row})),
  };
  const result = validateOrgan(draft);
  if (!result.ok) throw new Error('The test Organ is not valid.');
  return result.value;
}

describe('tapeBedMiniature', () => {
  it('fills the height with the widest Tape and puts row 1 at the Border plus half a Hole', () => {
    const streetOrgan = organ(120, 31);

    const miniature = tapeBedMiniature(streetOrgan, 120, 56);

    expect(miniature.bodyHeight).toBe(56);
    expect(miniature.rowCentres).toHaveLength(31);
    expect(miniature.rowCentres[0]).toBeCloseTo(((borders(streetOrgan).guide + 1.25) * 56) / 120, 10);
    expect(miniature.rowCentres[0]).toBeCloseTo(3.5, 10);
  });

  it('centres the rows: the last row mirrors the first', () => {
    const streetOrgan = organ(120, 31);

    const {bodyHeight, rowCentres} = tapeBedMiniature(streetOrgan, 120, 56);

    expect(rowCentres[30]).toBeCloseTo(bodyHeight - (rowCentres[0] ?? Number.NaN), 10);
    expect(rowSpan(streetOrgan.tapeBed, 31)).toBe(107.5);
  });

  it('puts row 1 at the Guide margin and the rows below it at the row spacing on a guided Tape Bed (Guide margin 10 mm)', () => {
    const guidedOrgan = organ(110, 20, 10);

    const {bodyHeight, rowCentres} = tapeBedMiniature(guidedOrgan, 110, 110);

    expect(bodyHeight).toBe(110);
    expect(rowCentres[0]).toBeCloseTo(10, 10);
    expect(rowCentres[19]).toBeCloseTo(10 + 19 * 3.5, 10);
  });

  it('draws a narrower Tape next to a wider one on a common scale', () => {
    const miniature = tapeBedMiniature(organ(120, 31), 140, 56);

    expect(miniature.bodyHeight).toBeCloseTo(48, 10);
  });
});
