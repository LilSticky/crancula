import {laneGeometry, type Lane, type SideBySideCut} from '@api/index';

/** The Lane numbers' size in mm: 4 mm, as drawn before the zoom choice. */
const LANE_NUMBER_MM = 4;
/** The smallest size of a Lane number on screen, in px. */
const READABLE_TEXT_PX = 12;
/** The dash and the gap of the working-width line in mm: 4 mm and 2 mm, as drawn before the zoom choice. */
const DASH_MM = 4;
const GAP_MM = 2;
/** The smallest length of a dash or a gap of the working-width line on screen, in px. */
const READABLE_DASH_PX = 3;
/** The side of one tile of the overflow hatch on screen, in px: the same spacing as the Overlap hatch on Tape pieces. */
const HATCH_PX = 6;

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
  /** The dash and the gap of the working-width line in mm: at least 3 px on screen each. */
  readonly workingWidthDash: {readonly dash: number; readonly gap: number};
  /** The side of one tile of the overflow hatch in mm: 6 px on screen. */
  readonly hatchSize: number;
}

/** The length in mm that `px` takes on screen at `pixelsPerMillimetre`; 0 before layout, when the scale is 0. */
function mmOfPx(px: number, pixelsPerMillimetre: number): number {
  return pixelsPerMillimetre > 0 ? px / pixelsPerMillimetre : 0;
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
 * `pixelsPerMillimetre` is the scale on screen, so the Lane numbers, the dashes and the hatch stay readable when the roll is small.
 */
export function rollDrawing(cut: SideBySideCut, pixelsPerMillimetre: number): RollDrawing {
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
    labelSize: Math.max(LANE_NUMBER_MM, mmOfPx(READABLE_TEXT_PX, pixelsPerMillimetre)),
    workingWidthDash: {
      dash: Math.max(DASH_MM, mmOfPx(READABLE_DASH_PX, pixelsPerMillimetre)),
      gap: Math.max(GAP_MM, mmOfPx(READABLE_DASH_PX, pixelsPerMillimetre)),
    },
    hatchSize: mmOfPx(HATCH_PX, pixelsPerMillimetre),
  };
}
