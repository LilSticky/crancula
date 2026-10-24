import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {PreviewNote} from './performance';
import {previewNoteWindows} from './preview-note-windows';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

function previewNote(pipe: number, startColumn: number, endColumn: number): PreviewNote {
  return {pipe: note(pipe), startColumn, endColumn};
}

describe('previewNoteWindows', () => {
  it('has no windows when there are no notes', () => {
    expect(previewNoteWindows([], 1, 10)).toEqual([]);
  });

  it('turns a note into a timed note with start and stop in seconds', () => {
    const windows = previewNoteWindows([previewNote(60, 3, 5)], 1, 10);

    expect(windows).toEqual([[{pipe: note(60), startSeconds: 3, stopSeconds: 5}]]);
  });

  it('scales the Columns by the column duration', () => {
    const windows = previewNoteWindows([previewNote(60, 21, 30)], 0.5, 10);

    expect(windows).toEqual([[], [{pipe: note(60), startSeconds: 10.5, stopSeconds: 15}]]);
  });

  it('keeps a stop beyond the end of its window', () => {
    const windows = previewNoteWindows([previewNote(60, 9, 15)], 1, 10);

    expect(windows).toEqual([[{pipe: note(60), startSeconds: 9, stopSeconds: 15}]]);
  });

  it('puts a note that starts exactly on a window boundary in the later window', () => {
    const windows = previewNoteWindows([previewNote(60, 10, 12)], 1, 10);

    expect(windows).toEqual([[], [{pipe: note(60), startSeconds: 10, stopSeconds: 12}]]);
  });

  it('groups notes by the window their start falls into, in order', () => {
    const windows = previewNoteWindows(
      [previewNote(60, 0, 2), previewNote(62, 1, 4), previewNote(64, 12, 14)],
      1,
      10,
    );

    expect(windows).toEqual([
      [
        {pipe: note(60), startSeconds: 0, stopSeconds: 2},
        {pipe: note(62), startSeconds: 1, stopSeconds: 4},
      ],
      [{pipe: note(64), startSeconds: 12, stopSeconds: 14}],
    ]);
  });

  it('keeps empty windows up to the window of the last note', () => {
    const windows = previewNoteWindows([previewNote(60, 0, 1), previewNote(62, 25, 26)], 1, 10);

    expect(windows).toEqual([
      [{pipe: note(60), startSeconds: 0, stopSeconds: 1}],
      [],
      [{pipe: note(62), startSeconds: 25, stopSeconds: 26}],
    ]);
  });
});
