import {changeColumnLength, type Tape} from '@api/index';
import {parseDecimal} from '../../shared/format-number';

/** What the typed Column length does to the Tape: nothing, something that is not a Column length, or a changed Tape. */
export type ColumnLengthChange = {readonly state: 'unchanged'} | {readonly state: 'invalid'} | {readonly state: 'ready'; readonly tape: Tape};

/** Works out the change the typed text would make to the Column length of the Tape. */
export function columnLengthChange(tape: Tape, typed: string): ColumnLengthChange {
  return columnLengthChangeTo(tape, parseDecimal(typed));
}

/** The same as `columnLengthChange`, for a Column length that is already a number; `null` is no Column length, `NaN` is not one. */
export function columnLengthChangeTo(tape: Tape, columnLength: number | null): ColumnLengthChange {
  if (columnLength === null) return {state: 'unchanged'};
  if (columnLength === tape.columnLength) return {state: 'unchanged'};

  const changed = changeColumnLength(tape, columnLength);
  if (!changed.ok) return {state: 'invalid'};
  return {state: 'ready', tape: changed.value};
}
