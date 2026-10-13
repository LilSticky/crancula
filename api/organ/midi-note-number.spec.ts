import {describe, expect, it} from 'vitest';
import {midiNoteNumber, noteName} from './midi-note-number';

describe('midiNoteNumber', () => {
  it.each([0, 60, 127])('accepts the integer %i', (n) => {
    expect(midiNoteNumber(n)).toBe(n);
  });

  it.each([-1, 128, 60.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (n) => {
    expect(midiNoteNumber(n)).toBeUndefined();
  });
});

describe('noteName', () => {
  it.each([
    [60, 'C4'],
    [61, 'C#4'],
    [69, 'A4'],
    [71, 'B4'],
    [72, 'C5'],
    [0, 'C-1'],
    [127, 'G9'],
  ])('names %i as %s', (n, name) => {
    const note = midiNoteNumber(n);
    expect(note).toBeDefined();
    expect(noteName(note as NonNullable<typeof note>)).toBe(name);
  });
});
