import {describe, expect, it} from 'vitest';
import {columnCount, type ColumnCount} from '../tape/tape';
import {noteValues} from './note-values';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function columns(value: number): ColumnCount {
  return defined(columnCount(value), `column count ${value}`);
}

/** The Column counts of the note values of FR-009 (research R7). */
const VALUE_COLUMNS = [48, 32, 24, 16, 12, 8, 6, 4, 3, 2, 1] as const;

/** For specs: brute force, the fewest values from {@link VALUE_COLUMNS} adding up to `total`. */
function minimumCount(total: number): number {
  const best: number[] = [0];
  for (let sum = 1; sum <= total; sum += 1) {
    best[sum] = Math.min(
      ...VALUE_COLUMNS.filter((value) => value <= sum).map((value) => best[sum - value] + 1),
    );
  }
  return best[total];
}

describe('noteValues', () => {
  it('writes 8 Columns as one quarter note', () => {
    expect(noteValues(columns(8))).toEqual([{type: 'quarter', dotted: false, columns: 8}]);
  });

  it('writes 12 Columns as one dotted quarter note', () => {
    expect(noteValues(columns(12))).toEqual([{type: 'quarter', dotted: true, columns: 12}]);
  });

  it('writes 3 Columns as one dotted sixteenth note', () => {
    expect(noteValues(columns(3))).toEqual([{type: '16th', dotted: true, columns: 3}]);
  });

  it('writes 5 Columns as an eighth note tied to a 32nd note, longest first', () => {
    expect(noteValues(columns(5))).toEqual([
      {type: 'eighth', dotted: false, columns: 4},
      {type: '32nd', dotted: false, columns: 1},
    ]);
  });

  it('writes 7 Columns as a dotted eighth note tied to a 32nd note', () => {
    expect(noteValues(columns(7))).toEqual([
      {type: 'eighth', dotted: true, columns: 6},
      {type: '32nd', dotted: false, columns: 1},
    ]);
  });

  it('lists the longest value first', () => {
    for (let total = 1; total <= 200; total += 1) {
      const lengths = noteValues(columns(total)).map((value) => value.columns);
      expect(lengths, `values for ${total}`).toEqual([...lengths].sort((a, b) => b - a));
    }
  });

  it('adds up to n with the fewest values, for every n from 1 to 200', () => {
    for (let total = 1; total <= 200; total += 1) {
      const values = noteValues(columns(total));
      expect(
        values.reduce((sum, value) => sum + value.columns, 0),
        `sum for ${total}`,
      ).toBe(total);
      expect(values.length, `count for ${total}`).toBe(minimumCount(total));
    }
  });
});
