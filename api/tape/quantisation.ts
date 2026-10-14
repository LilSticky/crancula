import type {Note, Tick, TicksPerQuarter} from '../song/song';
import {column, columnCount, type Column, type ColumnCount} from './tape';

/** Where a Note lies on the Column grid. */
export interface QuantisedNote {
  readonly start: Column;
  readonly length: ColumnCount;
}

/** One Column is a 1/32 note, so a quarter note is 8 Columns. */
const COLUMNS_PER_QUARTER = 8;

function validColumn(value: number): Column {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid Column ${value}`);
  return result;
}

function validColumnCount(value: number): ColumnCount {
  const result = columnCount(value);
  if (result === undefined) throw new Error(`invalid Column count ${value}`);
  return result;
}

/** Rounds to the nearest Column boundary, a tie going to the later Column (exact integer maths). */
export function columnOfTick(at: Tick, perQuarter: TicksPerQuarter): Column {
  const doubled = 2 * perQuarter;
  return validColumn(Math.floor((2 * COLUMNS_PER_QUARTER * at + perQuarter) / doubled));
}

/** Rounds start and end separately; the result is at least one Column long. */
export function quantiseNote(note: Note, perQuarter: TicksPerQuarter): QuantisedNote {
  const start = columnOfTick(note.start, perQuarter);
  const end = columnOfTick((note.start + note.duration) as Tick, perQuarter);
  return {start, length: validColumnCount(Math.max(end - start, 1))};
}
