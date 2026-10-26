import type {TapeGeometry} from './tape-geometry';

/** What the Plotter cuts: the size of a Tape, its Slots and its Outline, in mm. */
export type CutGeometry = Pick<TapeGeometry, 'totalLength' | 'width' | 'slots' | 'outline'>;
