import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {column, columnCount} from '../tape/tape';
import type {ScoresNote} from './close-gaps';
import {assignVoices, type VoiceNumber} from './voices';
import type {Staff} from './scores-staves';

const VOICES: readonly VoiceNumber[] = [1, 2, 3, 4];

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function pitchOf(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `pitch ${value}`);
}

/** A Hole's note as the Scores see it: pitch, start Column and length in Columns. */
function note(pitch: number, start: number, length: number): ScoresNote {
  return {
    pitch: pitchOf(pitch),
    start: defined(column(start), `start ${start}`),
    length: defined(columnCount(length), `length ${length}`),
  };
}

/** A staff with no Pipes, for the voices alone. */
const STAFF: Staff = {number: 1, from: undefined, below: undefined, clef: 'treble'};

/** A deterministic pseudo-random sequence (Park–Miller), so the property test is reproducible. */
function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('assignVoices', () => {
  it('puts notes that start and end together into one chord, pitches ascending', () => {
    const voices = assignVoices(STAFF, [note(67, 0, 8), note(60, 0, 8), note(64, 0, 8)]).voices;

    expect(voices.get(1)).toEqual([{start: 0, length: 8, pitches: [60, 64, 67]}]);
    expect(voices.get(2) ?? []).toEqual([]);
  });

  it('puts the higher moving chords in voice 1 and a held low note in voice 2', () => {
    const voices = assignVoices(STAFF, [note(48, 0, 32), note(60, 0, 8), note(62, 8, 8), note(64, 16, 8)]).voices;

    expect(voices.get(1)).toEqual([
      {start: 0, length: 8, pitches: [60]},
      {start: 8, length: 8, pitches: [62]},
      {start: 16, length: 8, pitches: [64]},
    ]);
    expect(voices.get(2)).toEqual([{start: 0, length: 32, pitches: [48]}]);
  });

  it('keeps the chords of every voice from overlapping, and every note length once', () => {
    const random = pseudoRandom(20261026);
    const notes: ScoresNote[] = [];
    for (let i = 0; i < 60; i += 1) {
      notes.push(note(48 + Math.floor(random() * 25), Math.floor(random() * 40), 1 + Math.floor(random() * 16)));
    }
    const staffVoices = assignVoices(STAFF, notes).voices;

    let coverage = 0;
    for (const voice of VOICES) {
      const chords = staffVoices.get(voice) ?? [];
      for (let i = 1; i < chords.length; i += 1) {
        const before = chords[i - 1];
        const after = chords[i];
        expect(before.start + before.length, `voice ${voice} overlaps`).toBeLessThanOrEqual(after.start);
      }
      for (const chord of chords) coverage += chord.length * chord.pitches.length;
    }
    const expected = notes.reduce((sum, value) => sum + value.length, 0);
    expect(coverage).toBe(expected);
  });

  it('puts a fifth layer of overlapping notes in voice 4, cut into tied pieces where its notes start or end', () => {
    // Five notes start together: the highest chords take voices 1 to 3, then 4; the lowest overflows into voice 4.
    const voices = assignVoices(STAFF, [
      note(60, 0, 32),
      note(62, 0, 24),
      note(64, 0, 16),
      note(65, 0, 8),
      note(67, 0, 4),
    ]).voices;

    expect(voices.get(1)).toEqual([{start: 0, length: 4, pitches: [67]}]);
    expect(voices.get(2)).toEqual([{start: 0, length: 8, pitches: [65]}]);
    expect(voices.get(3)).toEqual([{start: 0, length: 16, pitches: [64]}]);
    expect(voices.get(4)).toEqual([
      {start: 0, length: 24, pitches: [60, 62]},
      {start: 24, length: 8, pitches: [60]},
    ]);
  });
});
