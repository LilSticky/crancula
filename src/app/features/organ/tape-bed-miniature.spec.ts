import {describe, expect, it} from 'vitest';
import {border, emptyOrganDraft, type Organ, type OrganDraft, rowSpan, validateOrgan} from '@api/index';
import {tapeBedMiniature} from './tape-bed-miniature';

function organ(tapeWidth: number, pipeCount: number): Organ {
  const draft: OrganDraft = {
    ...emptyOrganDraft(),
    name: 'Test organ',
    tapeBed: {tapeWidth, holeDiameter: 2.5, rowSpacing: 3.5},
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
    expect(miniature.rowCentres[0]).toBeCloseTo(((border(streetOrgan) + 1.25) * 56) / 120, 10);
    expect(miniature.rowCentres[0]).toBeCloseTo(3.5, 10);
  });

  it('centres the rows: the last row mirrors the first', () => {
    const streetOrgan = organ(120, 31);

    const {bodyHeight, rowCentres} = tapeBedMiniature(streetOrgan, 120, 56);

    expect(rowCentres[30]).toBeCloseTo(bodyHeight - (rowCentres[0] ?? Number.NaN), 10);
    expect(rowSpan(streetOrgan.tapeBed, 31)).toBe(107.5);
  });

  it('draws a narrower Tape next to a wider one on a common scale', () => {
    const miniature = tapeBedMiniature(organ(120, 31), 140, 56);

    expect(miniature.bodyHeight).toBeCloseTo(48, 10);
  });
});
