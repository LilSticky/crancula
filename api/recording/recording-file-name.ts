import {safeFileName} from '../app/safe-file-name';

/**
 * The file name a Recording of a Tape gets before the dialog adds its extension: safe like a Plotter file name.
 * Dots are kept, because the main process always appends the extension itself.
 */
export function recordingFileName(tapeName: string): string {
  return safeFileName(tapeName);
}
