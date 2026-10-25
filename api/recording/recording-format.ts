export const RECORDING_SAMPLE_RATE = 44100;
export const RECORDING_CHANNELS = 1;
/** The MP3 bit rate in kbit/s. */
export const MP3_BIT_RATE = 128;

export type RecordingFormat = 'wav' | 'mp3';

/**
 * The format a file name asks for by its extension, in any case.
 * @returns `undefined` for any other extension or none; the save dialog then appends `.wav`
 */
export function recordingFormatOf(fileName: string): RecordingFormat | undefined {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return undefined;
  const extension = fileName.slice(dot + 1).toLowerCase();
  if (extension === 'wav' || extension === 'mp3') return extension;
  return undefined;
}
