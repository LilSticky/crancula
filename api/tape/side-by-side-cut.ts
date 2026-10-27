import type {Millimetres, Organ} from '../organ/organ';
import type {RollPlotter} from '../plotter/plotter';
import type {Tape} from './tape';
import {tapeGeometry, type Point, type TapeGeometry, type TapeOutline} from './tape-geometry';
import type {CutGeometry} from './tape-piece-geometry';

/** Floating point slack for lengths in mm. */
const EPSILON = 1e-9;

/** A Tape as it goes into a Lane: the Tape and the Organ it is punched for. */
export interface LaneTape {
  readonly tape: Tape;
  readonly organ: Organ;
}

/** A Tape placed in a Lane of a side-by-side cut: its own geometry, moved down by `top` when cut. */
export interface Lane {
  /** From 1, Lane 1 at the top edge of the file. */
  readonly number: number;
  readonly tape: Tape;
  readonly organ: Organ;
  /** The Tape's own geometry (spec 003), unmoved. */
  readonly geometry: TapeGeometry;
  /** Distance of the Lane's top edge from the file's top edge, in mm. */
  readonly top: Millimetres;
  /** False when the Lane's far edge passes the working width. */
  readonly fits: boolean;
}

/** Several Tapes on one roll Plotter, one per Lane, Tape spacing apart. */
export interface SideBySideCut {
  readonly plotter: RollPlotter;
  readonly lanes: readonly Lane[];
  /** Far edge of the last Lane; 0 without Lanes. */
  readonly usedWidth: Millimetres;
  /** workingWidth − usedWidth; negative when Lanes don't fit. */
  readonly freeWidth: number;
  /** The longest Lane's totalLength; 0 without Lanes. */
  readonly length: Millimetres;
}

/** Whether one more Tape of a given width fits after the last Lane. */
export interface LaneRoom {
  readonly fits: boolean;
  /** The Tape's width, plus the Tape spacing before it when there are Lanes. */
  readonly needed: Millimetres;
  /** The width left after the last Lane. */
  readonly free: number;
}

/**
 * Places the Tapes in Lanes from the top edge of a roll Plotter: Lane 1 at 0, each next Lane one Tape spacing
 * below the far edge of the one before it. A Lane that passes the working width does not fit.
 */
export function sideBySideCut(tapes: readonly LaneTape[], plotter: RollPlotter): SideBySideCut {
  const lanes = tapes.reduce<Lane[]>((placed, {tape, organ}) => {
    const geometry = tapeGeometry(tape, organ);
    const previous = placed.at(-1);
    const top = previous === undefined ? 0 : previous.top + previous.geometry.width + plotter.tapeSpacing;
    const far = top + geometry.width;
    return [
      ...placed,
      {
        number: placed.length + 1,
        tape,
        organ,
        geometry,
        // A sum of lengths in mm is a length in mm.
        top: top as Millimetres,
        fits: far <= plotter.workingWidth + EPSILON,
      },
    ];
  }, []);
  const last = lanes.at(-1);
  const usedWidth = last === undefined ? 0 : last.top + last.geometry.width;
  const length = lanes.reduce((longest, lane) => Math.max(longest, lane.geometry.totalLength), 0);
  return {
    plotter,
    lanes,
    usedWidth: usedWidth as Millimetres,
    freeWidth: plotter.workingWidth - usedWidth,
    length: length as Millimetres,
  };
}

/** Whether one more Tape of `tapeWidth` fits after the last Lane of `cut`. */
export function laneRoom(cut: SideBySideCut, tapeWidth: Millimetres): LaneRoom {
  const spacing = cut.lanes.length > 0 ? cut.plotter.tapeSpacing : 0;
  const needed = tapeWidth + spacing;
  return {fits: needed <= cut.freeWidth + EPSILON, needed: needed as Millimetres, free: cut.freeWidth};
}

function movedDown(point: Point, top: number): Point {
  return {x: point.x, y: point.y + top};
}

function outlineMovedDown(outline: TapeOutline, top: number): TapeOutline {
  return {
    tip: movedDown(outline.tip, top),
    topEnd: movedDown(outline.topEnd, top),
    bottomEnd: movedDown(outline.bottomEnd, top),
    columnOneBottom: movedDown(outline.columnOneBottom, top),
  };
}

/** The Lane's Tape as it is cut: its CutGeometry with every Slot and Outline corner moved down by the Lane's top. */
export function laneGeometry(lane: Lane): CutGeometry {
  const {geometry, top} = lane;
  return {
    totalLength: geometry.totalLength,
    width: geometry.width,
    slots: geometry.slots.map((slot) => ({...slot, y: slot.y + top})),
    outline: outlineMovedDown(geometry.outline, top),
  };
}
