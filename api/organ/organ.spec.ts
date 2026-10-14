import {describe, expect, it} from 'vitest';
import {millimetres, minimumHoleLength, newOrganId, organId, requiredTapeWidth, type TapeBed} from './organ';

function mm(value: number) {
  const result = millimetres(value);
  if (result === undefined) throw new Error(`invalid test value ${value}`);
  return result;
}

const tapeBed: TapeBed = {tapeWidth: mm(120), border: mm(5), holeDiameter: mm(2.5), rowSpacing: mm(3.5)};

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

describe('requiredTapeWidth', () => {
  it('is 2 × border + (pipes − 1) × row spacing + hole diameter', () => {
    expect(requiredTapeWidth(tapeBed, 31)).toBeCloseTo(2 * 5 + 30 * 3.5 + 2.5);
  });

  it('is 2 × border + hole diameter for a single Pipe', () => {
    expect(requiredTapeWidth(tapeBed, 1)).toBeCloseTo(12.5);
  });
});

describe('minimumHoleLength', () => {
  it('equals the hole diameter of the Tape Bed', () => {
    expect(minimumHoleLength(tapeBed)).toBe(2.5);
  });
});
