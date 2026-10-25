import {safeFileName} from '../app/safe-file-name';

/** The file name a Plotter file of a Tape gets: safe on Windows, never a path, always `.svg`. */
export function plotterFileName(tapeName: string): string {
  return `${safeFileName(tapeName)}.svg`;
}
