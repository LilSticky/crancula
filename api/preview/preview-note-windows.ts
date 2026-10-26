import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {PreviewNote} from './performance';

/** One PreviewNote placed on the timeline in seconds. */
export interface TimedPreviewNote {
  readonly pipe: MidiNoteNumber;
  readonly startSeconds: number;
  readonly stopSeconds: number;
}

/**
 * The PreviewNotes as timed notes, grouped by the window their start falls into, so a renderer can schedule
 * one window at a time. Empty windows are kept up to the window of the last note.
 * @returns the windows in order; none if there are no notes
 */
export function previewNoteWindows(
  notes: readonly PreviewNote[],
  columnSeconds: number,
  windowSeconds: number,
): readonly (readonly TimedPreviewNote[])[] {
  const windows: TimedPreviewNote[][] = [];
  for (const note of notes) {
    const timed: TimedPreviewNote = {
      pipe: note.pipe,
      startSeconds: note.startColumn * columnSeconds,
      stopSeconds: note.endColumn * columnSeconds,
    };
    const index = Math.floor(timed.startSeconds / windowSeconds);
    while (windows.length <= index) windows.push([]);
    windows[index].push(timed);
  }
  return windows;
}
