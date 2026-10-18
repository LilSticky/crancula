import {noteName, type Organ, type Tape, type TapeGeometry} from '@api/index';
import {formatNumber} from '../../shared/format-number';
import {pixelsPerMillimetre} from './pixels-per-millimetre';
import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';
import type {ColumnRange} from './visible-columns';
import type {TapeSectionView} from './tape-section/tape-section.component';

/** Space above the Tape for the ruler, in px. */
export const RULER_HEIGHT = 24;
/** Space below the Tape for the Column numbers, in px. */
const NUMBERS_HEIGHT = 20;

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

/** The row labels left of the Tape and the guide line of every row, in px. */
export function rowLabels(organ: Organ, geometry: TapeGeometry, scale: number) {
  const names = organ.pipes.map(({note}) => noteName(note));
  return {
    labels: names.map((name, index) => ({
      name,
      sharp: name.includes('#'),
      y: (geometry.rowCentres[index] ?? 0) * scale + RULER_HEIGHT,
    })),
    rows: names.map((name, index) => ({
      row: index + 1,
      y: (geometry.rowCentres[index] ?? 0) * scale,
      natural: !name.includes('#'),
    })),
  };
}

/** The Holes to draw for `range`, in px; `selected` is flagged. Rows count from 0 here, from 1 in `selected`. */
export function holeRects(
  tape: Tape,
  geometry: TapeGeometry,
  scale: number,
  range: ColumnRange,
  selected: {readonly row: number; readonly start: number} | undefined,
) {
  return geometry.slots
    .filter(
      (slot) =>
        (slot.start >= range.first && slot.start <= range.last) ||
        (slot.start < range.first && slot.start + slot.width / tape.columnLength > range.first),
    )
    .map((slot) => ({
      row: slot.row - 1,
      selected: slot.row === selected?.row && slot.start === selected?.start,
      start: slot.start,
      x: slot.x * scale,
      y: slot.y * scale,
      width: slot.width * scale,
      height: slot.height * scale,
      radius: slot.radius * scale,
    }));
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
    rulerNumbers: rulerNumbers(geometry.length)
      .filter((mm) => mm >= firstMm && mm <= lastMm)
      .map((mm) => ({mm, x: leadIn + mm * scale})),
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
