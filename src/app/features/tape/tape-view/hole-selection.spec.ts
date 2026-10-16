import {nextHole, type SelectableHole} from './hole-selection';

/** A Hole by its row (counted from 1) and the Column it starts at. */
function hole(row: number, start: number): SelectableHole {
  return {row, start};
}

describe('nextHole', () => {
  const a = hole(2, 10);
  const b = hole(2, 20);
  const c = hole(2, 40);
  const above = hole(1, 12);
  const belowNear = hole(4, 22);
  const belowFar = hole(4, 90);
  const holes = [c, belowFar, a, belowNear, above, b];

  it('moves left and right to the previous and next Hole by start in the same row', () => {
    expect(nextHole(holes, b, 'right')).toBe(c);
    expect(nextHole(holes, b, 'left')).toBe(a);
  });

  it('finds no Hole beyond the first or last Hole of the row', () => {
    expect(nextHole(holes, a, 'left')).toBeUndefined();
    expect(nextHole(holes, c, 'right')).toBeUndefined();
  });

  it('moves up to the Hole of the nearest row above with the nearest start', () => {
    expect(nextHole(holes, a, 'up')).toBe(above);
    expect(nextHole(holes, above, 'up')).toBeUndefined();
  });

  it('skips rows without Holes when moving down, and picks the nearest start', () => {
    expect(nextHole(holes, b, 'down')).toBe(belowNear);
    expect(nextHole(holes, belowNear, 'down')).toBeUndefined();
  });

  it('breaks a tie of the start distance towards the earlier start', () => {
    const current = hole(3, 20);
    const earlier = hole(4, 15);
    const later = hole(4, 25);

    expect(nextHole([later, current, earlier], current, 'down')).toBe(earlier);
  });

  it('picks the first Hole of the topmost row with Holes for any arrow when nothing is selected', () => {
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      expect(nextHole(holes, undefined, direction)).toBe(above);
    }
    expect(nextHole([c, a, b], undefined, 'right')).toBe(a);
  });

  it('finds no Hole on a Tape without Holes', () => {
    expect(nextHole([], undefined, 'down')).toBeUndefined();
  });
});
