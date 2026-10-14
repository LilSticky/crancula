import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from './midi-note-number';
import {asValidOrgan, millimetres, type Millimetres, newOrganId} from './organ';
import {addPipe, emptyOrganDraft, movePipe, type OrganDraft, removePipe, toDraft} from './organ-draft';

function draftWithNotes(...notes: number[]): OrganDraft {
  return {...emptyOrganDraft(), pipes: notes.map((note) => ({note}))};
}

const notesOf = (draft: OrganDraft) => draft.pipes.map((pipe) => pipe.note);

describe('emptyOrganDraft', () => {
  it('has no id, no name, no measurements and no Pipes', () => {
    expect(emptyOrganDraft()).toEqual({
      name: '',
      tapeBed: {tapeWidth: null, border: null, holeDiameter: null, rowSpacing: null},
      minimumGap: null,
      pipes: [],
    });
  });
});

describe('toDraft', () => {
  it('copies all fields of a valid Organ', () => {
    const mm = (n: number) => millimetres(n) as Millimetres;
    const id = newOrganId();
    const organ = asValidOrgan({
      id,
      name: 'Street organ',
      tapeBed: {tapeWidth: mm(120), border: mm(5), holeDiameter: mm(2.5), rowSpacing: mm(3.5)},
      minimumGap: mm(1.5),
      pipes: [{note: midiNoteNumber(60) as MidiNoteNumber}],
    });

    expect(toDraft(organ)).toEqual({
      id,
      name: 'Street organ',
      tapeBed: {tapeWidth: 120, border: 5, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      pipes: [{note: 60}],
    });
  });
});

describe('addPipe', () => {
  it('appends an empty Pipe as the last row', () => {
    expect(notesOf(addPipe(draftWithNotes(60, 62)))).toEqual([60, 62, null]);
  });

  it('does not change the original draft', () => {
    const draft = draftWithNotes(60);
    addPipe(draft);
    expect(notesOf(draft)).toEqual([60]);
  });
});

describe('removePipe', () => {
  it('removes the row and keeps the others in order', () => {
    expect(notesOf(removePipe(draftWithNotes(60, 62, 64), 1))).toEqual([60, 64]);
  });

  it('throws a RangeError for a row that does not exist', () => {
    expect(() => removePipe(draftWithNotes(60), 1)).toThrow(RangeError);
  });
});

describe('movePipe', () => {
  it('moves the last row to the first and shifts the others down', () => {
    expect(notesOf(movePipe(draftWithNotes(60, 62, 64), 2, 0))).toEqual([64, 60, 62]);
  });

  it('moves a row down by one', () => {
    expect(notesOf(movePipe(draftWithNotes(60, 62, 64), 0, 1))).toEqual([62, 60, 64]);
  });

  it.each([
    [-1, 0],
    [0, 3],
  ])('throws a RangeError when moving from %i to %i', (from, to) => {
    expect(() => movePipe(draftWithNotes(60, 62, 64), from, to)).toThrow(RangeError);
  });
});
