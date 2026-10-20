const LINE_EVERY = 8;
const STRONG_EVERY = 32;
const MINIMUM_NUMBER_SPACING_PX = 40;
const RULER_STEP_FACTORS = [1, 2, 5];

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

/** The smallest step of 1, 2 or 5 times 10^n mm, from 10 mm up, that is at least 40 px apart. */
function rulerStep(pixelsPerMm: number): number {
  for (let decade = 10; ; decade *= 10) {
    for (const factor of RULER_STEP_FACTORS) {
      if (factor * decade * pixelsPerMm >= MINIMUM_NUMBER_SPACING_PX) return factor * decade;
    }
  }
}

/** Multiples of the ruler step (10, 20, 50, 100, … mm; see `rulerStep`) from 0 up to the length in mm. */
export function rulerNumbers(lengthMm: number, pixelsPerMm: number): readonly number[] {
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return [0];
  const step = rulerStep(pixelsPerMm);
  const numbers: number[] = [];
  for (let mm = 0; mm <= lengthMm; mm += step) numbers.push(mm);
  return numbers;
}

/** Least size of a pointer target, in px. */
export const MINIMUM_HIT_PX = 24;

/** A span of `size` grown to at least `MINIMUM_HIT_PX`, around its centre. */
export function hitSpan(start: number, size: number): {readonly start: number; readonly size: number} {
  if (size >= MINIMUM_HIT_PX) return {start, size};
  return {start: start + size / 2 - MINIMUM_HIT_PX / 2, size: MINIMUM_HIT_PX};
}
