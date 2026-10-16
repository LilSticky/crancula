import {midiNoteNumber, type Pipe} from '@api/index';
import {gutterLabels} from './gutter-labels';

function pipe(note: number): Pipe {
  const value = midiNoteNumber(note);
  if (value === undefined) throw new Error(`not a note: ${note}`);
  return {note: value};
}

const STREET_ROW_PITCH_PX = (3.5 * 96) / 25.4; // 1:1, about 13,2 px

describe('gutterLabels', () => {
  it('gives one entry per row, in row order, with the note name and whether it is sharp', () => {
    expect(gutterLabels([pipe(53), pipe(55), pipe(61)], 20)).toEqual([
      {row: 1, note: 'F3', sharp: false, labelled: true},
      {row: 2, note: 'G3', sharp: false, labelled: true},
      {row: 3, note: 'C#4', sharp: true, labelled: true},
    ]);
  });

  it('keeps sharps without text below 14 px row pitch, as at 1:1 on the Street organ', () => {
    const [f, fSharp] = gutterLabels([pipe(53), pipe(54)], STREET_ROW_PITCH_PX);

    expect(f).toEqual({row: 1, note: 'F3', sharp: false, labelled: true});
    expect(fSharp).toEqual({row: 2, note: 'F#3', sharp: true, labelled: false});
  });

  it('labels sharps again at 14 px row pitch', () => {
    expect(gutterLabels([pipe(54)], 14)[0]?.labelled).toBe(true);
  });
});
