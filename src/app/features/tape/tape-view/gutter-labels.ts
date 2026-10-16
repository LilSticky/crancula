import {noteName, type Pipe} from '@api/index';

export interface GutterLabel {
  /** The row, counted from 1. */
  readonly row: number;
  readonly note: string;
  readonly sharp: boolean;
  /** Whether the note name is written; sharps lose it when rows are close together. */
  readonly labelled: boolean;
}

const MINIMUM_SHARP_ROW_PITCH_PX = 14;

export function gutterLabels(pipes: readonly Pipe[], rowPitchPx: number): readonly GutterLabel[] {
  return pipes.map((pipe, index) => {
    const note = noteName(pipe.note);
    const sharp = note.includes('#');
    return {row: index + 1, note, sharp, labelled: !sharp || rowPitchPx >= MINIMUM_SHARP_ROW_PITCH_PX};
  });
}
