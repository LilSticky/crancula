/*
 * Expected API of api/song/musicxml/lay-out.ts (T020), as these tests use it:
 *
 *   layOut(parts: readonly ScorePart[], playedOrder: readonly number[]): LaidOut
 *     parts: from scoreMeasures (score-measures.ts). playedOrder: the indices of the measures in the order
 *     they are played; here always the straight order 0, 1, 2, … (repeats come later).
 *     Each measure starts where the one played before it ends; a measure ends after its own length
 *     (ScoreMeasure.length in its divisions), not after its Time signature.
 *
 *   LaidOut { ticksPerQuarter: TicksPerQuarter; staves: readonly LaidOutStaff[] }
 *     ticksPerQuarter: the least common multiple of every divisions value in force in the parts when it is
 *     at most 32767; otherwise 960, and every start and length is rounded to the nearest Tick (research R6).
 *     staves: one entry per part and staff that has Notes, in part then staff order.
 *   LaidOutStaff { part: number (index in parts); staff: number; notes: readonly LaidOutNote[];
 *                  leftOut: { graceNotes: number; ornaments: number } }                       (NEW, T038)
 *     notes: all the Notes of the staff, the voices of the staff together, sorted by start, then note number.
 *       A grace note is no Note; a tied Note joined with the next one is one Note (see below).
 *     leftOut: the grace notes and ornaments of the staff, counted in played-out order (research R8): each
 *       grace note once, each Note with an ornament once, each arpeggiated chord once; 0 and 0 when none.
 *     One entry per part and staff that has Notes, or a grace note, or an ornament. A staff of only a grace
 *     note therefore has an entry with notes []; the reader gives it no Part (read-score-song.spec.ts).
 *   LaidOutNote { noteNumber: MidiNoteNumber | 'unpitched'; start: Tick; duration: Tick }
 *     noteNumber: the sounding pitch, the written pitch plus the transposition in force in its measure
 *     (chromatic + 12 × octaveChange); unpitched Notes are kept as 'unpitched'.
 *
 * Ties (research R8, NEW, T036): per staff, a Note with `tie.start` waits; the next Note of the same note number
 * in the same staff, in played-out order, joins it when it starts exactly where the waiting Note ends. The joined
 * Note starts with the first and lasts the sum of both. Any other next Note ends the waiting Note as written.
 *
 * Types from score-measures.ts: ScorePart, ScoreMeasure, ScoreNote (see its header). Types from song.ts:
 * Tick, TicksPerQuarter. MidiNoteNumber from api/organ/midi-note-number.ts. LeftOut is the shape
 * { graceNotes, ornaments } of read-song-source.ts; these tests write it structurally.
 *
 * ScoreNote gains the following fields (NEW, T036/T038; the reader fills them in T037/T039). They are
 * written as the tests build ScoreNote values, so a Note without them is a type error:
 *   grace: boolean               a <grace/> Note: no duration, so length 0 here; its start is where it is written.
 *   chord: boolean               a Note with <chord/>, sounding with the Note before it.
 *   tie: { start: boolean; stop: boolean }   from its <tie type="start"/> and <tie type="stop"/>.
 *   ornament: boolean            anything in <ornaments> (trill, mordent, turn, tremolo, …).
 *   arpeggiate: boolean          an <arpeggiate/>; written on each Note of an arpeggiated chord.
 * The reader includes a grace Note in ScoreMeasure.notes with grace: true; lay-out leaves it out.
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import type {MeasureMarks, ScoreMeasure, ScoreNote, ScorePart} from './score-measures';
import {layOut, type LaidOut, type LaidOutNote, type LaidOutStaff} from './lay-out';

const QUARTER = 480;

function pitch(value: number): MidiNoteNumber {
  const noteNumber = midiNoteNumber(value);
  if (noteNumber === undefined) throw new Error(`${value} is not a MIDI note number`);
  return noteNumber;
}

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

interface ScoreNoteFields {
  readonly staff?: number;
  readonly start: number;
  readonly length: number;
  readonly pitch: number;
  readonly grace?: boolean;
  readonly chord?: boolean;
  readonly tie?: ScoreNote['tie'];
  readonly ornament?: boolean;
  readonly arpeggiate?: boolean;
}

const NO_TIE: ScoreNote['tie'] = { start: false, stop: false };
const TIE_START: ScoreNote['tie'] = { start: true, stop: false };
const TIE_STOP: ScoreNote['tie'] = { start: false, stop: true };

/** A Note of staff 1 that is no grace note, chord, tie, ornament or arpeggio, unless the fields say otherwise. */
function scoreNote(fields: ScoreNoteFields): ScoreNote {
  return {
    staff: fields.staff ?? 1,
    start: fields.start,
    length: fields.length,
    pitch: pitch(fields.pitch),
    grace: fields.grace ?? false,
    chord: fields.chord ?? false,
    tie: fields.tie ?? NO_TIE,
    ornament: fields.ornament ?? false,
    arpeggiate: fields.arpeggiate ?? false,
  };
}

interface MeasureFields {
  readonly divisions?: number;
  readonly length?: number;
  readonly notes?: readonly ScoreNote[];
  readonly time?: ScoreMeasure['time'];
  readonly transpose?: ScoreMeasure['transpose'];
  readonly staves?: number;
}

/** The marks of a measure with none: no repeat, ending or jump. */
const NO_MARKS: MeasureMarks = {
  repeatForward: false,
  repeatBackward: undefined,
  endings: [],
  segno: false,
  coda: false,
  toCoda: false,
  fine: false,
  daCapo: false,
  dalSegno: false,
};

/** A measure with the defaults of a plain 4/4 measure of quarter-note divisions, its length given or its Notes' end. */
function measure(fields: MeasureFields): ScoreMeasure {
  const notes = fields.notes ?? [];
  const furthest = notes.reduce((end, note) => Math.max(end, note.start + note.length), 0);
  return {
    number: '1',
    divisions: fields.divisions ?? QUARTER,
    transpose: fields.transpose ?? { chromatic: 0, octaveChange: 0 },
    time: fields.time,
    key: undefined,
    staves: fields.staves ?? 1,
    length: fields.length ?? furthest,
    notes,
    marks: NO_MARKS,
  };
}

function part(...measures: readonly ScoreMeasure[]): ScorePart {
  return { id: 'P1', measures, percussionStaves: new Set() };
}

function straight(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function layOutStraight(parts: readonly ScorePart[]): LaidOut {
  return layOut(parts, straight(nth(parts, 0).measures.length));
}

function staffOf(layout: LaidOut, partIndex: number, staff: number): LaidOutStaff {
  const found = layout.staves.find((entry) => entry.part === partIndex && entry.staff === staff);
  if (found === undefined) throw new Error(`no staff ${staff} for part ${partIndex}`);
  return found;
}

function notesOf(layout: LaidOut, partIndex: number, staff: number): readonly LaidOutNote[] {
  return staffOf(layout, partIndex, staff).notes;
}

describe('layOut takes the Ticks per quarter as the least common multiple of the divisions', () => {
  it('uses the least common multiple of the divisions in force when it is at most 32767', () => {
    const layout = layOutStraight([
      part(measure({ divisions: 4, length: 4 }), measure({ divisions: 6, length: 6 })),
    ]);

    expect(layout.ticksPerQuarter).toBe(12);
  });

  it('falls back to 960 Ticks per quarter when the least common multiple is over 32767', () => {
    const layout = layOutStraight([
      part(measure({ divisions: 256, length: 0 }), measure({ divisions: 257, length: 0 })),
    ]);

    expect(layout.ticksPerQuarter).toBe(960);
  });

  it('rounds each start and length to the nearest Tick when the fallback of 960 applies', () => {
    const layout = layOutStraight([
      part(
        measure({ divisions: 256, length: 0 }),
        measure({ divisions: 257, notes: [scoreNote({ start: 1, length: 1, pitch: 60 })] }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{ start: 4, duration: 4 }]);
  });
});

describe('layOut places the Notes of each measure one after another', () => {
  it('lays a quarter then a quarter one quarter apart, each a quarter long', () => {
    const layout = layOutStraight([
      part(
        measure({
          length: 2 * QUARTER,
          notes: [
            scoreNote({ start: 0, length: QUARTER, pitch: 60 }),
            scoreNote({ start: QUARTER, length: QUARTER, pitch: 62 }),
          ],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      { start: 0, duration: QUARTER },
      { start: QUARTER, duration: QUARTER },
    ]);
  });

  it('starts the three Notes of a chord together', () => {
    const layout = layOutStraight([
      part(
        measure({
          notes: [
            scoreNote({ start: 0, length: QUARTER, pitch: 60 }),
            scoreNote({ start: 0, length: QUARTER, pitch: 64 }),
            scoreNote({ start: 0, length: QUARTER, pitch: 67 }),
          ],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1).map((note) => note.start)).toEqual([0, 0, 0]);
  });

  it('puts the Notes of two voices of one staff in one list, sorted by start and then note number', () => {
    const layout = layOutStraight([
      part(
        measure({
          notes: [
            scoreNote({ start: 0, length: 2 * QUARTER, pitch: 48 }),
            scoreNote({ start: 0, length: QUARTER, pitch: 60 }),
            scoreNote({ start: QUARTER, length: QUARTER, pitch: 62 }),
          ],
        }),
      ),
    ]);

    expect(layout.staves).toHaveLength(1);
    expect(notesOf(layout, 0, 1)).toMatchObject([
      { noteNumber: 48, start: 0, duration: 2 * QUARTER },
      { noteNumber: 60, start: 0, duration: QUARTER },
      { noteNumber: 62, start: QUARTER, duration: QUARTER },
    ]);
  });

  it('sounds each Note at its written pitch plus the transposition in force', () => {
    const layout = layOutStraight([
      part(
        measure({
          transpose: { chromatic: -2, octaveChange: -1 },
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 60 })],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{ noteNumber: 46 }]);
  });

  it('folds a sounding pitch above 127 down by whole octaves, so the Note is kept', () => {
    const layout = layOutStraight([
      part(
        measure({
          transpose: { chromatic: 2, octaveChange: 0 },
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 127 })],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{ noteNumber: 117 }]);
  });

  it('folds a sounding pitch below 0 up by whole octaves, so the Note is kept', () => {
    const layout = layOutStraight([
      part(
        measure({
          transpose: { chromatic: 0, octaveChange: -1 },
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 2 })],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{ noteNumber: 2 }]);
  });

  it('plays the measures in the played order it is given', () => {
    const parts = [
      part(
        measure({ length: QUARTER, notes: [scoreNote({ start: 0, length: QUARTER, pitch: 60 })] }),
        measure({ length: QUARTER, notes: [scoreNote({ start: 0, length: QUARTER, pitch: 62 })] }),
      ),
    ];

    const layout = layOut(parts, [1, 0]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      { noteNumber: 62, start: 0 },
      { noteNumber: 60, start: QUARTER },
    ]);
  });
});

describe('layOut advances by the actual length of a measure, not by its Time signature', () => {
  it('advances a measure shorter than its Time signature by its content length', () => {
    const layout = layOutStraight([
      part(
        measure({
          time: { beats: 4, beatType: 4 },
          length: QUARTER,
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 60 })],
        }),
        measure({
          time: { beats: 4, beatType: 4 },
          length: QUARTER,
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 62 })],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      { noteNumber: 60, start: 0 },
      { noteNumber: 62, start: QUARTER },
    ]);
  });

  it('advances a measure longer than its Time signature by its content length', () => {
    const layout = layOutStraight([
      part(
        measure({
          time: { beats: 4, beatType: 4 },
          length: 5 * QUARTER,
          notes: [scoreNote({ start: 0, length: 5 * QUARTER, pitch: 60 })],
        }),
        measure({
          time: { beats: 4, beatType: 4 },
          length: QUARTER,
          notes: [scoreNote({ start: 0, length: QUARTER, pitch: 62 })],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      { noteNumber: 60, start: 0 },
      { noteNumber: 62, start: 5 * QUARTER },
    ]);
  });
});

describe('layOut joins a tied Note with the next Note of its pitch, in played-out order (R8)', () => {
  it('joins a half Note tied over the bar line to a quarter of the same pitch into one Note of 3 quarters', () => {
    const layout = layOutStraight([
      part(
        measure({notes: [scoreNote({start: 2 * QUARTER, length: 2 * QUARTER, pitch: 60, tie: TIE_START})]}),
        measure({notes: [scoreNote({start: 0, length: QUARTER, pitch: 60, tie: TIE_STOP})]}),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{noteNumber: 60, start: 2 * QUARTER, duration: 3 * QUARTER}]);
  });

  it('joins a tie at the end of a repeat to the Note of its pitch at the repeat start, where the tied Note ends', () => {
    const layout = layOut(
      [
        part(
          measure({notes: [scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_STOP})]}),
          measure({notes: [scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_START})]}),
        ),
      ],
      [0, 1, 0],
    );

    expect(notesOf(layout, 0, 1)).toMatchObject([
      {noteNumber: 60, start: 0, duration: 2 * QUARTER},
      {noteNumber: 60, start: 2 * QUARTER, duration: 4 * QUARTER},
    ]);
  });

  it('joins a G sharp tied to an A flat, since both sound as MIDI note 68', () => {
    const layout = layOutStraight([
      part(
        measure({notes: [scoreNote({start: 0, length: QUARTER, pitch: 68, tie: TIE_START})]}),
        measure({notes: [scoreNote({start: 0, length: QUARTER, pitch: 68, tie: TIE_STOP})]}),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([{noteNumber: 68, start: 0, duration: 2 * QUARTER}]);
  });

  it('does not join a tie whose next Note has another pitch, and still joins on another staff of the same pitch', () => {
    const layout = layOut(
      [
        part(
          measure({notes: [scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_STOP})]}),
          measure({
            notes: [
              scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_START}),
              scoreNote({staff: 2, start: 0, length: 2 * QUARTER, pitch: 64, tie: TIE_START}),
            ],
          }),
          measure({
            notes: [
              scoreNote({start: 0, length: 2 * QUARTER, pitch: 62, tie: TIE_STOP}),
              scoreNote({staff: 2, start: 0, length: 2 * QUARTER, pitch: 64, tie: TIE_STOP}),
            ],
          }),
        ),
      ],
      [0, 1, 2],
    );

    expect(notesOf(layout, 0, 1)).toMatchObject([
      {noteNumber: 60, start: 0, duration: 2 * QUARTER},
      {noteNumber: 60, start: 2 * QUARTER, duration: 2 * QUARTER},
      {noteNumber: 62, start: 4 * QUARTER, duration: 2 * QUARTER},
    ]);
    expect(notesOf(layout, 0, 2)).toMatchObject([{noteNumber: 64, start: 2 * QUARTER, duration: 4 * QUARTER}]);
  });

  it('does not join a tie whose next Note starts later, and still joins on another staff that starts at its end', () => {
    const layout = layOutStraight([
      part(
        measure({
          notes: [
            scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_START}),
            scoreNote({staff: 2, start: 0, length: 2 * QUARTER, pitch: 64, tie: TIE_START}),
          ],
        }),
        measure({
          notes: [
            scoreNote({start: QUARTER, length: QUARTER, pitch: 60, tie: TIE_STOP}),
            scoreNote({staff: 2, start: 0, length: QUARTER, pitch: 64, tie: TIE_STOP}),
          ],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      {noteNumber: 60, start: 0, duration: 2 * QUARTER},
      {noteNumber: 60, start: 3 * QUARTER, duration: QUARTER},
    ]);
    expect(notesOf(layout, 0, 2)).toMatchObject([{noteNumber: 64, start: 0, duration: 3 * QUARTER}]);
  });

  it('does not join a tie whose next Note starts earlier than the tied Note ends, and still joins on another staff', () => {
    const layout = layOutStraight([
      part(
        measure({
          length: QUARTER,
          notes: [
            scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, tie: TIE_START}),
            scoreNote({staff: 2, start: 0, length: QUARTER, pitch: 64, tie: TIE_START}),
          ],
        }),
        measure({
          notes: [
            scoreNote({start: 0, length: QUARTER, pitch: 60, tie: TIE_STOP}),
            scoreNote({staff: 2, start: 0, length: QUARTER, pitch: 64, tie: TIE_STOP}),
          ],
        }),
      ),
    ]);

    expect(notesOf(layout, 0, 1)).toMatchObject([
      {noteNumber: 60, start: 0, duration: 2 * QUARTER},
      {noteNumber: 60, start: QUARTER, duration: QUARTER},
    ]);
    expect(notesOf(layout, 0, 2)).toMatchObject([{noteNumber: 64, start: 0, duration: 2 * QUARTER}]);
  });
});

describe('layOut leaves grace notes and ornaments in, and counts them (R8, scenarios 3 to 5)', () => {
  it('leaves a grace note out, so the main Note starts where it is written, and counts it', () => {
    const layout = layOutStraight([
      part(
        measure({
          notes: [
            scoreNote({start: 0, length: QUARTER, pitch: 62}),
            scoreNote({start: QUARTER, length: 0, pitch: 61, grace: true}),
            scoreNote({start: QUARTER, length: QUARTER, pitch: 60}),
          ],
        }),
      ),
    ]);

    expect(staffOf(layout, 0, 1)).toMatchObject({
      notes: [
        {noteNumber: 62, start: 0, duration: QUARTER},
        {noteNumber: 60, start: QUARTER, duration: QUARTER},
      ],
      leftOut: {graceNotes: 1, ornaments: 0},
    });
  });

  it('keeps a Note with an ornament as one plain Note as long as it is written, and counts it once', () => {
    const layout = layOutStraight([
      part(measure({notes: [scoreNote({start: 0, length: 2 * QUARTER, pitch: 60, ornament: true})]})),
    ]);

    expect(staffOf(layout, 0, 1)).toMatchObject({
      notes: [{noteNumber: 60, start: 0, duration: 2 * QUARTER}],
      leftOut: {graceNotes: 0, ornaments: 1},
    });
  });

  it('starts the Notes of an arpeggiated chord together, and counts the chord once', () => {
    const layout = layOutStraight([
      part(
        measure({
          notes: [
            scoreNote({start: 0, length: QUARTER, pitch: 60, arpeggiate: true}),
            scoreNote({start: 0, length: QUARTER, pitch: 64, chord: true, arpeggiate: true}),
            scoreNote({start: 0, length: QUARTER, pitch: 67, chord: true, arpeggiate: true}),
          ],
        }),
      ),
    ]);

    expect(staffOf(layout, 0, 1)).toMatchObject({
      notes: [
        {noteNumber: 60, start: 0, duration: QUARTER},
        {noteNumber: 64, start: 0, duration: QUARTER},
        {noteNumber: 67, start: 0, duration: QUARTER},
      ],
      leftOut: {graceNotes: 0, ornaments: 1},
    });
  });

  it('gives a staff of only a grace note an entry with no Notes and the grace note counted', () => {
    const layout = layOutStraight([part(measure({notes: [scoreNote({start: 0, length: 0, pitch: 61, grace: true})]}))]);

    expect(staffOf(layout, 0, 1)).toMatchObject({notes: [], leftOut: {graceNotes: 1, ornaments: 0}});
  });

  it('counts zero grace notes and zero ornaments for a staff with Notes and neither', () => {
    const layout = layOutStraight([part(measure({notes: [scoreNote({start: 0, length: QUARTER, pitch: 60})]}))]);

    expect(staffOf(layout, 0, 1).leftOut).toEqual({graceNotes: 0, ornaments: 0});
  });

  it('counts a grace note and an ornament once for each pass when their measure is played twice', () => {
    const layout = layOut(
      [
        part(
          measure({
            notes: [
              scoreNote({start: 0, length: 0, pitch: 61, grace: true}),
              scoreNote({start: 0, length: QUARTER, pitch: 60, ornament: true}),
            ],
          }),
        ),
      ],
      [0, 0],
    );

    expect(staffOf(layout, 0, 1).leftOut).toEqual({graceNotes: 2, ornaments: 2});
  });
});
