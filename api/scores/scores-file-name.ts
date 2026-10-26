import {safeFileName} from '../app/safe-file-name';

/** The file name of a Scores export: the Tape's name made safe, with the MusicXML extension (FR-015). */
export function scoresFileName(tapeName: string): string {
  return `${safeFileName(tapeName)}.musicxml`;
}
