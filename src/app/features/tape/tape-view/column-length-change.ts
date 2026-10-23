import {changeColumnLength, cuttingProblems, type Organ, type Tape} from '@api/index';
import {parseDecimal} from '../../shared/format-number';

/** What the typed Column length does to the Tape: nothing, something that is not a Column length, or a changed Tape with its Cutting Problems now and after the change. */
export type ColumnLengthChange =
  | {readonly state: 'unchanged'}
  | {readonly state: 'invalid'}
  | {readonly state: 'ready'; readonly tape: Tape; readonly problemsNow: number; readonly problemsThen: number};

/** Works out the change the typed text would make to the Column length of the Tape, and counts the Cutting Problems before and after it. */
export function columnLengthChange(tape: Tape, organ: Organ, typed: string): ColumnLengthChange {
  const columnLength = parseDecimal(typed);
  if (columnLength === null) return {state: 'unchanged'};
  if (columnLength === tape.columnLength) return {state: 'unchanged'};
  if (Number.isNaN(columnLength)) return {state: 'invalid'};

  const changed = changeColumnLength(tape, columnLength);
  if (!changed.ok) return {state: 'invalid'};
  return {
    state: 'ready',
    tape: changed.value,
    problemsNow: cuttingProblems(tape, organ).length,
    problemsThen: cuttingProblems(changed.value, organ).length,
  };
}
