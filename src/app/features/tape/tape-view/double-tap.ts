import type {SelectableHole} from './hole-selection';

/** Two taps on the same Hole this close together, in ms, are a double-tap. */
export const DOUBLE_TAP_MS = 400;

/** A tap on a Hole, or on a Spot that added one: which Hole, when (ms), and whether it added it or had a modifier key. */
export interface Tap {
  readonly hole: SelectableHole;
  readonly at: number;
  readonly added: boolean;
  readonly modifier: boolean;
}

/** The last tap, the only one that a next tap can pair with. */
export type TapMemory = Tap;

/**
 * The memory after `tap`, and whether `tap` is the second of a double-tap on the Hole of the memory. A double clears the
 * memory, so a third tap starts afresh. The first tap must neither have added its Hole nor carry a modifier key, and
 * neither may the second.
 */
export function nextTap(memory: TapMemory | undefined, tap: Tap): {readonly memory: TapMemory | undefined; readonly double: boolean} {
  const double =
    memory !== undefined &&
    memory.hole.row === tap.hole.row &&
    memory.hole.start === tap.hole.start &&
    tap.at - memory.at <= DOUBLE_TAP_MS &&
    !memory.added &&
    !memory.modifier &&
    !tap.modifier;
  return double ? {memory: undefined, double} : {memory: tap, double};
}
