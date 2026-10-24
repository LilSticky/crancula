import {addHole, noteName, tapeGeometry, type Hole, type Organ, type Tape, type TapeGeometry} from '@api/index';
import {formatNumber} from '../../shared/format-number';
import {gripBars, gripRects, type Rect} from './hole-drag';
import {pixelsPerMillimetre} from './pixels-per-millimetre';
import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';
import type {HoleSelection, SelectableHole} from './hole-selection';
import type {Spot} from './spot';
import type {ColumnRange} from './visible-columns';
import type {TapeSectionView} from './tape-section/tape-section.component';

/** Space above the Tape for the ruler, in px. */
export const RULER_HEIGHT = 24;
/** Space below the Tape for the Column numbers, in px. */
const NUMBERS_HEIGHT = 20;
/** A ruler number closer than this to the Tape's end is right-aligned. */
const RULER_END_EDGE_PX = 12;
/** Least distance from the right-aligned last ruler number to the one before it, in px. */
const RULER_END_GAP_PX = 50;
/** Row labels stay at least this far apart, in px; crowded rows are labelled every k-th. */
const MINIMUM_LABEL_PITCH_PX = 12;

/** Largest font size of the glyph in a Cutting Problem ring, in px. */
const MAX_GLYPH_PX = 12;

/** What the Tape section of the side panel tells. */
export function sectionView(
  tape: Tape,
  organ: Organ,
  geometry: TapeGeometry,
  language: string,
  partNames: TapeSectionView['partNames'],
): TapeSectionView {
  const number = (value: number): string => formatNumber(value, language);
  return {
    organId: tape.organId,
    organName: organ.name,
    lengthText: number(tape.length),
    columnLengthText: number(tape.columnLength),
    lengthMmText: number(tape.length * tape.columnLength),
    leadInMm: geometry.leadIn,
    leadInText: number(geometry.leadIn),
    holesText: number(tape.holes.length),
    partNames,
  };
}

/** The text for the accessible name of the drawing. */
export function drawingParams(tape: Tape, organ: Organ, language: string) {
  const number = (value: number): string => formatNumber(value, language);
  return {
    name: tape.name,
    rows: number(organ.pipes.length),
    columns: number(tape.length),
    holes: number(tape.holes.length),
  };
}

/** The row labels left of the Tape and the guide line of every row, in px. Crowded rows get a label only at every k-th row from row 1. */
export function rowLabels(organ: Organ, geometry: TapeGeometry, scale: number) {
  const names = organ.pipes.map(({note}) => noteName(note));
  const [first, second] = geometry.rowCentres;
  // Rounded so a pitch of exactly 12 px is not pushed to the next stride by float noise.
  const pitch = first === undefined || second === undefined ? 0 : Math.round((second - first) * scale * 1e6) / 1e6;
  const every = pitch <= 0 ? 1 : Math.ceil(MINIMUM_LABEL_PITCH_PX / pitch);
  return {
    labels: names.flatMap((name, index) =>
      index % every === 0
        ? [{name, sharp: name.includes('#'), y: (geometry.rowCentres[index] ?? 0) * scale + RULER_HEIGHT}]
        : [],
    ),
    rows: names.map((name, index) => ({
      row: index + 1,
      y: (geometry.rowCentres[index] ?? 0) * scale,
      natural: !name.includes('#'),
    })),
  };
}

/** One selected Hole or several; `undefined` selects nothing. */
type Selected = SelectableHole | HoleSelection | undefined;

function selectedList(selected: Selected): HoleSelection {
  if (selected === undefined) return [];
  return 'row' in selected ? [selected] : selected;
}

/**
 * The Holes to draw for `range`, in px; every selected one is flagged.
 * Rows count from 0 here, from 1 in `selected`.
 */
export function holeRects(tape: Tape, geometry: TapeGeometry, scale: number, range: ColumnRange, selected: Selected) {
  const selection = selectedList(selected);
  return geometry.slots
    .filter(
      (slot) =>
        (slot.start >= range.first && slot.start <= range.last) ||
        (slot.start < range.first && slot.start + slot.width / tape.columnLength > range.first),
    )
    .map((slot) => {
      return {
        row: slot.row - 1,
        selected: selection.some((hole) => hole.row === slot.row && hole.start === slot.start),
        start: slot.start,
        x: slot.x * scale,
        y: slot.y * scale,
        width: slot.width * scale,
        height: slot.height * scale,
        radius: slot.radius * scale,
      };
    });
}

/** The rectangle, in px, of a Hole that a refused drag would have placed; `undefined` if the Organ has no row for it. */
export function ghostRect(tape: Tape, organ: Organ, attempted: Hole, scale: number) {
  const slot = tapeGeometry({...tape, holes: [attempted]}, organ).slots[0];
  if (slot === undefined) return undefined;
  return {
    row: slot.row - 1,
    start: slot.start,
    x: slot.x * scale,
    y: slot.y * scale,
    width: slot.width * scale,
    height: slot.height * scale,
    radius: slot.radius * scale,
  };
}

/** The Spot as drawn: the rectangle, in px, of the Hole that a tap there would add; `undefined` if that Hole cannot be added. */
export function spotRect(tape: Tape, organ: Organ, spot: Spot, scale: number) {
  const pipe = organ.pipes[spot.row - 1]?.note;
  if (pipe === undefined) return undefined;
  const added = addHole(tape, organ, pipe, spot.start);
  return added.ok ? ghostRect(tape, organ, added.value.hole, scale) : undefined;
}

/** The grips of the one selected Hole in view, in px: visible bars and hit areas; `undefined` unless exactly one is selected. */
export function gripsOf(holes: readonly (SelectableHole & Rect & {readonly selected: boolean})[]) {
  const selected = holes.filter((hole) => hole.selected);
  const only = selected.length === 1 ? selected[0] : undefined;
  if (only === undefined) return undefined;
  // The drawing is in px already, so one unit is one screen px.
  return {hole: {row: only.row, start: only.start}, bars: gripBars(only), hits: gripRects(only, 1)};
}

/** Space between a Hole and its Cutting Problem ring, in px. */
const RING_GAP_PX = 2;

/** The rings around Holes with a Cutting Problem inside `range`, in px. `problems` holds "pipe:start" keys. */
export function holeMarks(
  tape: Tape,
  organ: Organ,
  geometry: TapeGeometry,
  scale: number,
  range: ColumnRange,
  problems: ReadonlySet<string>,
  selected?: Selected,
) {
  return holeRects(tape, geometry, scale, range, selected)
    .filter((rect) => {
      const pipe = organ.pipes[rect.row]?.note;
      return pipe !== undefined && problems.has(`${pipe}:${rect.start}`);
    })
    .map((rect) => ({
      row: rect.row,
      start: rect.start,
      selected: rect.selected,
      glyph: {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: Math.min(MAX_GLYPH_PX, rect.height)},
      x: rect.x - RING_GAP_PX,
      y: rect.y - RING_GAP_PX,
      width: rect.width + 2 * RING_GAP_PX,
      height: rect.height + 2 * RING_GAP_PX,
      radius: rect.radius + RING_GAP_PX,
    }));
}

/**
 * The last ruler number sits right-aligned at the Tape's end (see the template), so it reaches further left
 * than a centred one. The number before it is dropped when they would touch.
 */
function withoutCrowdedBeforeEnd<T extends {readonly x: number}>(numbers: readonly T[], width: number): readonly T[] {
  const last = numbers[numbers.length - 1];
  if (last === undefined || last.x <= width - RULER_END_EDGE_PX) return numbers;
  return numbers.filter((entry, index) => index !== numbers.length - 2 || last.x - entry.x >= RULER_END_GAP_PX);
}

/** The Column marks, Column numbers and ruler numbers inside `range`, in px. */
export function columnMarks(tape: Tape, geometry: TapeGeometry, scale: number, range: ColumnRange) {
  const columnPx = tape.columnLength * scale;
  const leadIn = geometry.leadIn * scale;
  const inRange = (column: number): boolean => column >= range.first && column <= range.last;
  const firstMm = range.first * tape.columnLength;
  const lastMm = (range.last + 1) * tape.columnLength;
  return {
    marks: columnLines(tape.length)
      .filter((line) => inRange(line.column))
      .map((line) => ({...line, x: leadIn + line.column * columnPx})),
    numbers: columnNumbers(tape.length, columnPx)
      .filter((entry) => inRange(entry.column))
      .map((entry) => ({...entry, x: leadIn + entry.column * columnPx})),
    rulerNumbers: withoutCrowdedBeforeEnd(
      rulerNumbers(geometry.length, scale).map((mm) => ({mm, x: leadIn + mm * scale})),
      geometry.totalLength * scale,
    ).filter(({mm}) => mm >= firstMm && mm <= lastMm),
  };
}

/** The shape of the Tape in px: Lead-in, body, borders and the total height with ruler and Column numbers. */
export function outline(geometry: TapeGeometry, scale: number) {
  const leadIn = geometry.leadIn * scale;
  const height = geometry.width * scale;
  const {outline: corners} = geometry;
  return {
    leadIn,
    leadInPath: `M${corners.tip.x * scale},${corners.tip.y * scale} H${leadIn} V${corners.columnOneBottom.y * scale} Z`,
    bodyWidth: (geometry.totalLength - geometry.leadIn) * scale,
    borders: [geometry.border * scale, (geometry.width - geometry.border) * scale],
    width: geometry.totalLength * scale,
    height,
    totalHeight: RULER_HEIGHT + height + NUMBERS_HEIGHT,
    numbersY: height + NUMBERS_HEIGHT - 6,
  };
}

/** The whole Tape at `stageWidth`, for the overview strip. */
export function overviewOf(geometry: TapeGeometry, stageWidth: number) {
  const scale = pixelsPerMillimetre('whole', stageWidth, geometry.totalLength);
  const shape = outline(geometry, scale);
  return {
    width: stageWidth,
    height: shape.height,
    leadIn: shape.leadIn,
    leadInPath: shape.leadInPath,
    bodyWidth: shape.bodyWidth,
    holesPath: geometry.slots
      .map((slot) => {
        const x = slot.x * scale;
        return `M${x},${slot.y * scale}h${slot.width * scale}v${slot.height * scale}h${-slot.width * scale}z`;
      })
      .join(''),
  };
}
