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
import {scoresStaves, staffOf, staffPipes, staffRange, type Staff} from './scores-staves';

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

describe('staffRange gives the notes a staff holds, open at the ends of the keyboard (FR-005)', () => {
  it('gives the whole keyboard, 0 to 127, for the only staff', () => {
    const staves = scoresStaves([], organWithPipes([60, 62]), []);

    expect(staves.map((staff) => staffRange(staff))).toEqual([{lowest: 0, highest: 127}]);
  });

  it('gives the top staff from its split note up to 127 and the bottom staff from 0 up to the split note less one', () => {
    const staves = scoresStaves([midi(60)], organWithPipes([60, 62]), []);

    expect(staves.map((staff) => staffRange(staff))).toEqual([
      {lowest: 60, highest: 127},
      {lowest: 0, highest: 59},
    ]);
  });

  it('gives a middle staff from its split note up to the next split note less one', () => {
    const staves = scoresStaves([midi(48), midi(72)], organWithPipes([60, 62]), []);

    expect(staves.map((staff) => staffRange(staff))).toEqual([
      {lowest: 72, highest: 127},
      {lowest: 48, highest: 71},
      {lowest: 0, highest: 47},
    ]);
  });
});

describe('scoresStaves gives an octave clef when most notes of a staff need three ledger lines fewer (FR-006, R9)', () => {
  it('gives treble-8va to a treble staff whose notes mostly need three ledger lines fewer with the octave clef', () => {
    // G6 needs four ledger lines on the plain treble clef and none drawn an octave lower (G5 sits in a space).
    const staves = scoresStaves([], organWithPipes([60, 62]), [91, 91, 91].map((pitch) => scoresNoteAt(pitch)));

    expect(staves.map(({clef}) => clef)).toEqual(['treble-8va']);
  });

  it('gives bass-8vb to a bass staff whose notes mostly need three ledger lines fewer with the octave clef', () => {
    // F1 needs four ledger lines on the plain bass clef and none drawn an octave higher (F2 sits in a space).
    const staves = scoresStaves([], organWithPipes([29, 31]), [29, 29, 29].map((pitch) => scoresNoteAt(pitch)));

    expect(staves.map(({clef}) => clef)).toEqual(['bass-8vb']);
  });

  it('keeps the plain treble clef when half the notes or fewer save three ledger lines', () => {
    // Two G6 notes save four ledger lines each; two C4 notes save none, so half of the notes is not more than half.
    const notes = [91, 91, 60, 60].map((pitch) => scoresNoteAt(pitch));

    const staves = scoresStaves([], organWithPipes([60, 62]), notes);

    expect(staves.map(({clef}) => clef)).toEqual(['treble']);
  });

  it('keeps the plain clef of a staff without notes', () => {
    const staves = scoresStaves([], organWithPipes([60, 62]), []);

    expect(staves.map(({clef}) => clef)).toEqual(['treble']);
  });
});

describe('staffPipes gives the Pipes a staff plays, from its lowest to its highest (FR-005, UX must 1)', () => {
  it('gives the lowest and the highest of the Pipes a staff holds, and how many it holds', () => {
    const organ = organWithPipes([48, 60, 62, 84]);
    const top = defined(scoresStaves([midi(60)], organ, [])[0], 'top staff');

    expect(staffPipes(top, organ)).toEqual({lowest: 60, highest: 84, count: 3});
  });

  it('gives the Pipes of the bottom staff only, not those of the staff above it', () => {
    const organ = organWithPipes([48, 60, 62, 84]);
    const bottom = defined(scoresStaves([midi(60)], organ, []).at(-1), 'bottom staff');

    expect(staffPipes(bottom, organ)).toEqual({lowest: 48, highest: 48, count: 1});
  });

  it('gives nothing for a staff that holds no Pipe of the Organ', () => {
    const organ = organWithPipes([72, 74]);
    const bottom = defined(scoresStaves([midi(60)], organ, []).at(-1), 'bottom staff');

    expect(staffPipes(bottom, organ)).toBeUndefined();
  });
});
