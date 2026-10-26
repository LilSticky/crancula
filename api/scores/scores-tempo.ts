import type {Organ} from '../organ/organ';
import type {Tape} from '../tape/tape';

/** One quarter note is 8 Columns, one Column a 1/32 note (DICTIONARY, research R6). */
const COLUMNS_PER_QUARTER = 8;

/**
 * Quarter notes per minute of the Tape: the Crank turns per minute, each turn running the Organ's Tape per
 * Crank turn past the Tape Bed, divided by the length of a quarter note in millimetres (FR-013, Story 1.5).
 * Undefined when the Organ has no Tape per Crank turn.
 */
export function scoresTempo(tape: Tape, organ: Organ): number | undefined {
  if (organ.tapePerCrankTurn === undefined) return undefined;
  const millimetresPerMinute = tape.crankSpeed * organ.tapePerCrankTurn;
  return Math.max(1, Math.round(millimetresPerMinute / (COLUMNS_PER_QUARTER * tape.columnLength)));
}
