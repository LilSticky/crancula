const LINE_EVERY = 8;
const STRONG_EVERY = 32;
const MINIMUM_NUMBER_SPACING_PX = 40;
const RULER_EVERY_MM = 10;

export interface ColumnLine {
  /** The Column the line is at the start of. */
  readonly column: number;
  readonly strong: boolean;
}

export interface ColumnNumber {
  readonly column: number;
  /** The 1-based Column number. */
  readonly number: number;
}

/** A line at every 8th Column, strong at every 32nd, none at or past the end. */
export function columnLines(length: number): readonly ColumnLine[] {
  const lines: ColumnLine[] = [];
  for (let column = 0; column < length; column += LINE_EVERY) {
    lines.push({column, strong: column % STRONG_EVERY === 0});
  }
  return lines;
}

/** Numbers under the 8-Column lines, or only the 32-Column lines when 8 Columns are narrower than 40 px. */
export function columnNumbers(length: number, columnWidthPx: number): readonly ColumnNumber[] {
  const crowded = LINE_EVERY * columnWidthPx < MINIMUM_NUMBER_SPACING_PX;
  return columnLines(length)
    .filter((line) => !crowded || line.strong)
    .map((line) => ({column: line.column, number: line.column + 1}));
}

/** 0, 10, 20, … up to the length in mm. */
export function rulerNumbers(lengthMm: number): readonly number[] {
  const numbers: number[] = [];
  for (let mm = 0; mm <= lengthMm; mm += RULER_EVERY_MM) numbers.push(mm);
  return numbers;
}
