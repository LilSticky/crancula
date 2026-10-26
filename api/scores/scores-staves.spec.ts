/*
 * Expected API of api/scores/scores-staves.ts (T019, data-model.md "Staves and clefs"):
 *
 *   scoresStaves(splitNotes: readonly MidiNoteNumber[], organ: Organ, notes: readonly ScoresNote[]): readonly Staff[]
 *   staffOf(pitch: MidiNoteNumber, staves: readonly Staff[]): Staff
 *   Staff { number (1 at the top); from: MidiNoteNumber | undefined (lowest pitch, undefined for the bottom staff);
 *           below: MidiNoteNumber | undefined (first pitch above, undefined for the top staff); clef }
 *   Clef = 'treble' | 'treble-8va' | 'bass' | 'bass-8vb'. This file tests the plain clefs only (T037 adds the
 *   octave clefs).
 */
import {describe, expect, it} from 'vitest';
import type {ScoresNote} from './close-gaps';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {column, columnCount} from '../tape/tape';
import {scoresStaves, staffOf, type Staff} from './scores-staves';

const ORGAN_ID = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function midi(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

/** An Organ with one Pipe for each of the notes given, on a 100 mm Tape Bed. */
function organWithPipes(notes: readonly number[]): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Staff organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: notes.map((value) => ({note: value})),
  });
  if (!result.ok) throw new Error(`invalid Organ fixture: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A Hole of the Scores at the given pitch, starting at Column 0 for 8 Columns. */
function scoresNoteAt(pitch: number): ScoresNote {
  return {
    pitch: midi(pitch),
    start: defined(column(0), 'start'),
    length: defined(columnCount(8), 'length'),
  };
}

/** Whether the pitch lies in the range of the staff (FR-005). */
function holds(staff: Staff, pitch: number): boolean {
  return (staff.from === undefined || pitch >= staff.from) && (staff.below === undefined || pitch < staff.below);
}

describe('scoresStaves cuts the pitches at the split notes (FR-005)', () => {
  it('gives one staff without a split note', () => {
    const staves = scoresStaves([], organWithPipes([60, 62]), []);

    expect(staves.map(({number, from, below}) => ({number, from, below}))).toEqual([
      {number: 1, from: undefined, below: undefined},
    ]);
  });

  it('gives a top staff from the split note and a bottom staff below it', () => {
    const staves = scoresStaves([midi(60)], organWithPipes([60, 62]), []);

    expect(staves.map(({number, from, below}) => ({number, from, below}))).toEqual([
      {number: 1, from: 60, below: undefined},
      {number: 2, from: undefined, below: 60},
    ]);
  });

  it('puts every pitch from 0 to 127 on exactly one staff, the one staffOf gives', () => {
    const splitNotes = [48, 60, 72].map(midi);
    const staves = scoresStaves(splitNotes, organWithPipes([60, 62]), []);
    const failures: string[] = [];

    for (let value = 0; value <= 127; value += 1) {
      const holding = staves.filter((staff) => holds(staff, value));
      const [only] = holding;
      if (holding.length !== 1 || staffOf(midi(value), staves) !== only) failures.push(String(value));
    }

    expect(staves).toHaveLength(4);
    expect(failures).toEqual([]);
  });
});

describe('scoresStaves gives each staff a plain clef (FR-006, research R9)', () => {
  it('gives the treble clef to a staff whose Pipes have a middle of 60 or more, else bass', () => {
    const staves = scoresStaves([midi(60)], organWithPipes([48, 50, 52, 60, 62, 64]), []);

    expect(staves.map(({clef}) => clef)).toEqual(['treble', 'bass']);
  });

  it('gives a staff without Pipes the clef of the middle of its notes', () => {
    const staves = scoresStaves([midi(48)], organWithPipes([40, 42]), [scoresNoteAt(70), scoresNoteAt(72)]);

    expect(staves[0]?.clef).toBe('treble');
  });

  it('gives a staff with neither Pipes nor notes the clef of its lower bound', () => {
    const staves = scoresStaves([midi(60)], organWithPipes([48, 50]), []);

    expect(staves[0]?.clef).toBe('treble');
  });
});
