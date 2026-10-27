import {cutWithin, replaceForbiddenCharacters, safeFileName} from '../app/safe-file-name';
import {plotterFileName} from './plotter-file-name';

/** The longest stem of a file name, in UTF-16 code units (as `safeFileName`). */
const MAXIMUM_STEM_LENGTH = 200;

/**
 * The file name a side-by-side cut gets: one Lane is a single Tape file (`plotterFileName`); more are the name of
 * the first Tape and `more(count)` for the Tapes after it, such as "Reference and 1 more.svg". The name is shortened
 * so the suffix stays whole and the stem stays within 200 characters.
 */
export function sideBySideFileName(firstTapeName: string, laneCount: number, more: (count: string) => string): string {
  if (laneCount <= 1) return plotterFileName(firstTapeName);
  const suffix = ` ${replaceForbiddenCharacters(more(String(laneCount - 1)))}`;
  const stem = cutWithin(safeFileName(firstTapeName), MAXIMUM_STEM_LENGTH - suffix.length).replace(/[ .]+$/, '');
  return `${stem}${suffix}.svg`;
}
