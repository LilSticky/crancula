import type {ColumnCount} from '../tape/tape';

/** The note types of the Scores; one Column is a 1/32 note (DICTIONARY). */
export type NoteType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

/** One written note value: its type, whether it is dotted, and its length in Columns. */
export interface NoteValue {
  readonly type: NoteType;
  readonly dotted: boolean;
  readonly columns: 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 | 32 | 48;
}

/** The values of FR-009, longest first (research R7). */
const NOTE_VALUES: readonly NoteValue[] = [
  {type: 'whole', dotted: true, columns: 48},
  {type: 'whole', dotted: false, columns: 32},
  {type: 'half', dotted: true, columns: 24},
  {type: 'half', dotted: false, columns: 16},
  {type: 'quarter', dotted: true, columns: 12},
  {type: 'quarter', dotted: false, columns: 8},
  {type: 'eighth', dotted: true, columns: 6},
  {type: 'eighth', dotted: false, columns: 4},
  {type: '16th', dotted: true, columns: 3},
  {type: '16th', dotted: false, columns: 2},
  {type: '32nd', dotted: false, columns: 1},
];

/**
 * The fewest values adding up to `columns`, longest first (FR-009, research R7). A dynamic programme gives the
 * fewest count for every total up to `columns`; then the longest value that keeps the count minimal is taken
 * first, and the rest is written the same way.
 */
export function noteValues(columns: ColumnCount): readonly NoteValue[] {
  const fewest: number[] = [0];
  for (let total = 1; total <= columns; total += 1) {
    fewest[total] = Math.min(
      ...NOTE_VALUES.filter((value) => value.columns <= total).map((value) => fewest[total - value.columns] + 1),
    );
  }

  const values: NoteValue[] = [];
  let rest: number = columns;
  while (rest > 0) {
    const remaining = rest;
    const next = NOTE_VALUES.find(
      (value) => value.columns <= remaining && fewest[remaining - value.columns] === fewest[remaining] - 1,
    );
    if (next === undefined) throw new Error(`no note value fits ${remaining} Columns`);
    values.push(next);
    rest -= next.columns;
  }
  return values;
}
