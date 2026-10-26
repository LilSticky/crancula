import type {Slot, TapeGeometry, TapeOutline} from './tape-geometry';
import type {TapePiece} from './tape-pieces';

/** Floating point slack for lengths in mm. */
const EPSILON = 1e-9;

/** What the Plotter cuts: the size of a Tape, its Slots and its Outline, in mm. */
export type CutGeometry = Pick<TapeGeometry, 'totalLength' | 'width' | 'slots' | 'outline'>;

/**
 * What the Plotter cuts from one Tape piece: its own length, the Slots wholly inside it moved to its tip (in cut
 * order), and its own Outline. A Slot in an Overlap is cut from both pieces at the same place relative to the Join.
 */
export function pieceGeometry(geometry: TapeGeometry, piece: TapePiece): CutGeometry {
  const {start, end} = piece;
  const slots = geometry.slots
    .filter((slot) => slot.x >= start - EPSILON && slot.x + slot.width <= end + EPSILON)
    .map((slot): Slot => ({...slot, x: slot.x - start}));
  return {totalLength: end - start, width: geometry.width, slots, outline: outlineOf(geometry, piece)};
}

/** The Lead-in diagonal stays on the first piece; later pieces are cut square at their tip. */
function outlineOf(geometry: TapeGeometry, piece: TapePiece): TapeOutline {
  const length = piece.end - piece.start;
  return {
    tip: {x: 0, y: 0},
    topEnd: {x: length, y: 0},
    bottomEnd: {x: length, y: geometry.width},
    columnOneBottom: {x: Math.max(0, geometry.leadIn - piece.start), y: geometry.width},
  };
}
