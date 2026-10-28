import {type Organ, rowCentres} from '@api/index';

export interface TapeBedMiniature {
  /** Height of the Tape body in px. */
  readonly bodyHeight: number;
  /** The y of each row centre in px, row 1 on top. */
  readonly rowCentres: readonly number[];
}

/** Draws the Tape Bed of `organ` to the scale at which the widest Tape fills `heightPx`. */
export function tapeBedMiniature(organ: Organ, widestTapeWidth: number, heightPx: number): TapeBedMiniature {
  const scale = heightPx / widestTapeWidth;
  return {
    bodyHeight: organ.tapeBed.tapeWidth * scale,
    rowCentres: rowCentres(organ.tapeBed, organ.pipes.length).map((centre) => centre * scale),
  };
}
