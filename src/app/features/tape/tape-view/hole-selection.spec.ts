import {
  activeOf,
  allOf,
  extended,
  framed,
  nextHole,
  toggled,
  type SelectableHole,
  type SelectionFrame,
  type SpanningHole,
} from './hole-selection';

/** A Hole by its row (counted from 1) and the Column it starts at. */
function hole(row: number, start: number): SelectableHole {
  return {row, start};
}

/** A Hole by its row, the Column it starts at and its length in Columns. */
function span(row: number, start: number, length: number): SpanningHole {
  return {row, start, length};
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

describe('toggled', () => {
  const a = hole(2, 10);
  const b = hole(3, 20);

  it('adds a Hole that is not selected and makes it the active one', () => {
    const selection = toggled([a], b);

    expect(selection).toEqual([a, b]);
    expect(activeOf(selection)).toBe(b);
  });

  it('takes out a Hole that is selected and keeps the others selected', () => {
    expect(toggled([a, b], a)).toEqual([b]);
  });

  it('recognises a selected Hole by its row and start, not by object identity', () => {
    expect(toggled([a], hole(2, 10))).toEqual([]);
  });
});

describe('framed', () => {
  // Rows 2 to 4 (both inclusive); Columns from 10 up to, not including, 30.
  const frame: SelectionFrame = {firstRow: 2, lastRow: 4, fromColumn: 10, toColumn: 30};

  it('takes the Holes on rows inside the frame that lie at least partly inside its Columns', () => {
    const startsBefore = span(3, 5, 8);
    const inside = span(2, 12, 4);
    const endsAfter = span(4, 28, 6);

    expect(framed([startsBefore, inside, endsAfter], frame)).toEqual([startsBefore, inside, endsAfter]);
  });

  it('leaves out Holes on rows outside the frame', () => {
    expect(framed([span(1, 12, 4), span(5, 12, 4)], frame)).toEqual([]);
  });

  it('leaves out Holes that end where the frame starts or start where it ends', () => {
    expect(framed([span(3, 4, 6), span(3, 30, 4)], frame)).toEqual([]);
  });
});

describe('extended', () => {
  const a = hole(2, 10);
  const b = hole(2, 20);
  const c = hole(2, 40);

  it('adds the next Hole in the direction and makes it the active one', () => {
    const selection = extended([a], [c, a, b], 'right');

    expect(selection).toEqual([a, b]);
    expect(activeOf(selection)).toBe(b);
  });

  it('finds the active Hole by row and start, not by object identity', () => {
    expect(extended([hole(2, 10)], [c, a, b], 'right')).toEqual([hole(2, 10), b]);
  });

  it('keeps the selection when there is no Hole in that direction', () => {
    expect(extended([c], [a, b, c], 'right')).toEqual([c]);
  });

  it('selects the first Hole of the topmost row when nothing is selected', () => {
    expect(extended([], [c, a, b], 'down')).toEqual([a]);
  });
});

describe('allOf', () => {
  it('selects every Hole of the Tape', () => {
    const holes = [hole(1, 5), hole(2, 10), hole(4, 30)];

    expect(allOf(holes)).toEqual(holes);
  });

  it('selects nothing on a Tape without Holes', () => {
    expect(allOf([])).toEqual([]);
  });
});

describe('activeOf', () => {
  it('is the Hole that was added last', () => {
    const a = hole(2, 10);
    const b = hole(3, 20);

    expect(activeOf([a, b])).toBe(b);
  });

  it('is undefined when nothing is selected', () => {
    expect(activeOf([])).toBeUndefined();
  });
});
