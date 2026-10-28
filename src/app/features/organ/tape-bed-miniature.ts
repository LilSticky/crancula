import {borders, type Organ} from '@api/index';

export interface TapeBedMiniature {
  /** Height of the Tape body in px. */
  readonly bodyHeight: number;
  /** The y of each row centre in px, row 1 on top. */
  readonly rowCentres: readonly number[];
}

/** Draws the Tape Bed of `organ` to the scale at which the widest Tape fills `heightPx`. */
export function tapeBedMiniature(organ: Organ, widestTapeWidth: number, heightPx: number): TapeBedMiniature {
  const scale = heightPx / widestTapeWidth;
  const {holeDiameter, rowSpacing, tapeWidth} = organ.tapeBed;
  const first = borders(organ).guide + holeDiameter / 2;
  return {
    bodyHeight: tapeWidth * scale,
    rowCentres: organ.pipes.map((_, row) => (first + row * rowSpacing) * scale),
  };
}
