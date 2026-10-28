import {laneGeometry, type Lane, type SideBySideCut} from '@api/index';
import {pixelsPerMillimetre} from '../tape-view/pixels-per-millimetre';

/** The Lane numbers' size in mm: 4 mm, as drawn before the zoom choice. */
const LANE_NUMBER_MM = 4;
/** The smallest size of a Lane number on screen, in px. */
const READABLE_TEXT_PX = 12;
/** The side of one tile of the overflow hatch on screen, in px: the same spacing as the Overlap hatch on Tape pieces. */
const HATCH_PX = 6;
/** The scale at true size, used while the stage has no width yet. */
const TRUE_SIZE_PX_PER_MM = pixelsPerMillimetre('1:1', 0, 0);

/** One Lane as drawn in mm: its Tape Outline and Holes as SVG path data, and whether it passes the working width. */
export interface LaneDrawing {
  readonly number: number;
  /** Height of the Lane's middle, for its number. */
  readonly centre: number;
  readonly outline: string;
  readonly holes: string;
  readonly overflow: boolean;
}

/** A strip across the roll in mm, from the top edge: the free band or the overflow band. */
export interface Band {
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
  /** From the used width to the working width; undefined when the Lanes fill the working width or pass it. */
  readonly freeBand: Band | undefined;
  /** From the working width to the used width; undefined when the Lanes fit. */
  readonly overflowBand: Band | undefined;
  readonly workingWidthY: number;
  /** The size of the Lane numbers in mm: at least 12 px on screen. */
  readonly labelSize: number;
  /** The side of one tile of the overflow hatch in mm: 6 px on screen. */
  readonly hatchSize: number;
}

/** The length in mm that `px` takes on screen at `scale`, in px per mm; `scale` is above 0. */
function mmOfPx(px: number, scale: number): number {
  return px / scale;
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

/**
 * The side-by-side cut as drawing data: Lanes in mm, the free and overflow bands and the working-width line; no text.
 * `scale` is the scale on screen in px per mm, so the Lane numbers and the hatch stay readable when the roll is small.
 * While it is 0, before layout, they are sized at true size.
 */
export function rollDrawing(cut: SideBySideCut, scale: number): RollDrawing {
  const onScreen = scale > 0 ? scale : TRUE_SIZE_PX_PER_MM;
  const {workingWidth} = cut.plotter;
  const height = Math.max(workingWidth, cut.usedWidth);
  return {
    length: cut.length,
    height,
    viewBox: `0 0 ${cut.length} ${height}`,
    lanes: cut.lanes.map(laneDrawing),
    freeBand: cut.usedWidth < workingWidth ? {top: cut.usedWidth, bottom: workingWidth} : undefined,
    overflowBand: cut.usedWidth > workingWidth ? {top: workingWidth, bottom: cut.usedWidth} : undefined,
    workingWidthY: workingWidth,
    labelSize: Math.max(LANE_NUMBER_MM, mmOfPx(READABLE_TEXT_PX, onScreen)),
    hatchSize: mmOfPx(HATCH_PX, onScreen),
  };
}
