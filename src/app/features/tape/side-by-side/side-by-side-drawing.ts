import {laneGeometry, type Lane, type SideBySideCut} from '@api/index';

/** One Lane as drawn in mm: its Tape Outline and Holes as SVG path data, and whether it passes the working width. */
export interface LaneDrawing {
  readonly number: number;
  /** Height of the Lane's middle, for its number. */
  readonly centre: number;
  readonly outline: string;
  readonly holes: string;
  readonly overflow: boolean;
}

/** The strip from the used width to the working width, in mm from the top edge of the roll. */
export interface FreeBand {
  readonly top: number;
  readonly bottom: number;
}

/** The to-scale drawing of a side-by-side cut: the roll is drawn 1 mm per unit, so the scale is exact. */
export interface RollDrawing {
  /** Length of the Tape along the roll, in mm. */
  readonly length: number;
  /** The working width, or the used width when the Lanes pass it, in mm. */
  readonly height: number;
  readonly viewBox: string;
  readonly lanes: readonly LaneDrawing[];
  /** Undefined when the Lanes fill the working width or pass it. */
  readonly freeBand: FreeBand | undefined;
  readonly workingWidthY: number;
}

/** The Lane's Tape Outline as a closed path through its four corners, the way the Tape is cut. */
function outlinePath(lane: Lane): string {
  const {tip, topEnd, bottomEnd, columnOneBottom} = laneGeometry(lane).outline;
  return `M${tip.x},${tip.y}L${topEnd.x},${topEnd.y}L${bottomEnd.x},${bottomEnd.y}L${columnOneBottom.x},${columnOneBottom.y}Z`;
}

/** The Lane's Holes as one path of rectangles, moved down to the Lane. */
function holesPath(lane: Lane): string {
  return laneGeometry(lane)
    .slots.map((slot) => `M${slot.x},${slot.y}h${slot.width}v${slot.height}h${-slot.width}z`)
    .join('');
}

function laneDrawing(lane: Lane): LaneDrawing {
  return {
    number: lane.number,
    centre: lane.top + lane.geometry.width / 2,
    outline: outlinePath(lane),
    holes: holesPath(lane),
    overflow: !lane.fits,
  };
}

/** The side-by-side cut as drawing data: Lanes in mm, the free band and the working-width line; no text. */
export function rollDrawing(cut: SideBySideCut): RollDrawing {
  const {workingWidth} = cut.plotter;
  const height = Math.max(workingWidth, cut.usedWidth);
  return {
    length: cut.length,
    height,
    viewBox: `0 0 ${cut.length} ${height}`,
    lanes: cut.lanes.map(laneDrawing),
    freeBand: cut.usedWidth < workingWidth ? {top: cut.usedWidth, bottom: workingWidth} : undefined,
    workingWidthY: workingWidth,
  };
}
