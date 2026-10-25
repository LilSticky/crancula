/*
 * Expected API of api/song/musicxml/read-score-song.ts (T022), as these tests use it:
 *
 *   readScoreSong(bytes: Uint8Array, fileName: string): Result<SongReading, SongRejection>
 *     bytes: an uncompressed MusicXML file (score-partwise or score-timewise). A compressed .mxl is unzipped
 *     first with unzipScore (mxl.ts), as readSongSource does. fileName: only the Song name fallback.
 *     SongReading and SongRejection are the types of api/song/read-song-source.ts.
 *     Never throws. Malformed XML, or a root other than score-partwise/score-timewise: 'not-a-score'.
 *     No Part with Notes: 'no-notes'.
 *
 *   SongReading.leftOut (NEW, T039; the type is LeftOut in read-song-source.ts): for a Score, a Map keyed by the
 *     PartIndex of each Part, one entry per Part (0 and 0 when none), counting grace notes and ornaments in
 *     played-out order (R8). A staff that gives no Part has no entry.
 *
 *   Ties (FR-008, NEW, T036): a tie joins a Note with the next Note of its pitch in its staff, in played-out order,
 *     when that starts exactly where the tied Note ends; the joined Note is one Note of the Part (lay-out.spec.ts).
 *   Grace notes and ornaments (FR-009, FR-010, NEW, T038): a grace note is no Note; a Note with an ornament is one
 *     plain Note as long as it is written; an arpeggiated chord starts together. Each is counted in leftOut.
 *
 *   Parts (FR-004, FR-005, R8): one per staff with Notes, of each part, in part-list then staff order.
 *     name: the part name, plus ' n' (the staff number) when the part has several staves; an empty part
 *     name gives an unnamed Part (name undefined). A staff with a percussion clef, or with only unpitched
 *     Notes, is a percussion Part. A staff without Notes is no Part.
 *     A Note whose sounding pitch (written pitch plus the transposition in force) is outside the MIDI note
 *     numbers 0 to 127 is left out of its Part. The docs give no other report for it: see the test.
 *
 *   Song name (FR-013): the work title, else the movement title, else the file name without its extension.
 *
 * T023 (SC-001) is in this file too: createTape (api/tape/create-tape.ts) takes the Song read by
 * readScoreSong and the Song read from the same music as MIDI, and gives the same Holes. It sits here, not in
 * create-tape.spec.ts, so that the missing module fails only this file.
 */
import {describe, expect, it} from 'vitest';
import {DEFAULT_CRANK_SPEED_RANGE} from '../../organ/crank-speed-range';
import {asValidOrgan, millimetres, organId, type Organ} from '../../organ/organ';
import {midiNoteNumber} from '../../organ/midi-note-number';
import type {Result} from '../../result';
import {createTape, type CreateTapeInput} from '../../tape/create-tape';
import {transposition, type Transposition} from '../../tape/tape';
import {readMidiSong} from '../midi/read-midi-song';
import {encodeSmf, type SmfTimedEvent, type SmfTrack} from '../midi/smf-test-helper';
import type {LeftOut, SongReading, SongRejection} from '../read-song-source';
import {partIndex, type Part, type PartIndex, type Song} from '../song';
import {readScoreSong} from './read-score-song';
import {
  scoreXml,
  type MeasureEntry,
  type MeasureSpec,
  type NoteSpec,
  type Ornament,
  type PitchSpec,
  type ScoreSpec,
} from './score-test-helper';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function readingOf(result: Result<SongReading, SongRejection>): SongReading {
  if (!result.ok) throw new Error(`expected a Song, got ${result.error}`);
  return result.value;
}

function rejectionOf(result: Result<SongReading, SongRejection>): SongRejection {
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

/** The Song read from a Score written from the description with the helper. */
function songOf(spec: ScoreSpec, fileName = 'score.musicxml'): Song {
  return readingOf(readScoreSong(utf8(scoreXml(spec)), fileName)).song;
}

function namesOf(song: Song): (string | undefined)[] {
  return song.parts.map((part) => part.name);
}

function noteNumbersOf(part: Part): number[] {
  return part.notes.map((note) => note.noteNumber);
}

function note(step: PitchSpec['step'], octave: number, duration: number, staff?: number): NoteSpec {
  return {kind: 'note', pitch: {step, octave}, duration, staff};
}

function rest(duration: number, staff?: number): MeasureEntry {
  return {kind: 'rest', duration, staff};
}

function measure(...entries: MeasureEntry[]): MeasureSpec {
  return {entries};
}

describe('readScoreSong gives one Part per staff, named after its part', () => {
  it('gives a piano with two staves two Parts, "Piano 1" and "Piano 2", with their Notes', () => {
    const song = songOf({
      parts: [
        {
          name: 'Piano',
          staves: 2,
          measures: [
            measure(
              note('C', 4, 1, 1),
              note('D', 4, 1, 1),
              {kind: 'backup', duration: 2},
              note('C', 3, 2, 2),
            ),
          ],
        },
      ],
    });

    expect(namesOf(song)).toEqual(['Piano 1', 'Piano 2']);
    expect(song.parts.map((part) => part.notes.length)).toEqual([2, 1]);
  });

  it('names a one-staff part after the part alone', () => {
    const song = songOf({parts: [{name: 'Flute', measures: [measure(note('E', 5, 1))]}]});

    expect(namesOf(song)).toEqual(['Flute']);
  });

  it('leaves a part without a name unnamed', () => {
    const song = songOf({parts: [{measures: [measure(note('E', 5, 1))]}]});

    expect(namesOf(song)).toEqual([undefined]);
  });

  it('gives one Part per staff of each part, in part-list then staff order', () => {
    const song = songOf({
      parts: [
        {name: 'Flute', measures: [measure(note('E', 5, 1))]},
        {name: 'Violin', measures: [measure(note('A', 5, 1))]},
        {
          name: 'Piano',
          staves: 2,
          measures: [measure(note('C', 4, 1, 1), {kind: 'backup', duration: 1}, note('C', 3, 1, 2))],
        },
      ],
    });

    expect(namesOf(song)).toEqual(['Flute', 'Violin', 'Piano 1', 'Piano 2']);
  });

  it('gives no Part to a staff without Notes', () => {
    const song = songOf({
      parts: [
        {
          name: 'Piano',
          staves: 2,
          measures: [measure(note('C', 4, 1, 1), {kind: 'backup', duration: 1}, rest(1, 2))],
        },
      ],
    });

    expect(namesOf(song)).toEqual(['Piano 1']);
  });
});

describe('readScoreSong makes percussion Parts', () => {
  it('makes a staff with a percussion clef a percussion Part', () => {
    const song = songOf({
      parts: [
        {
          name: 'Drums',
          measures: [measure({kind: 'attributes', divisions: 1, clef: {sign: 'percussion'}}, note('C', 5, 1))],
        },
      ],
    });

    expect(song.parts.map((part) => part.percussion)).toEqual([true]);
  });

  it('makes a staff of only unpitched Notes a percussion Part', () => {
    // The helper writes an unpitched Note without its display pitch, so this Score is written by hand.
    const drums = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Drums</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>
    <note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>
  </measure></part>
</score-partwise>`;

    const song = readingOf(readScoreSong(utf8(drums), 'drums.musicxml')).song;

    expect(song.parts.map((part) => part.percussion)).toEqual([true]);
  });
});

describe('readScoreSong, the sounding pitch of a Note', () => {
  it('folds a Note whose sounding pitch after the Transposition is outside 0 to 127 by whole octaves, so it is kept', () => {
    // G9 is MIDI 127; with chromatic +2 it sounds at 129, so it folds down an octave to 117. C4 sounds at 62.
    const song = songOf({
      parts: [
        {
          name: 'Flute',
          measures: [measure({kind: 'attributes', transpose: {chromatic: 2}}, note('G', 9, 1), note('C', 4, 1))],
        },
      ],
    });

    expect(song.parts.map(noteNumbersOf)).toEqual([[117, 62]]);
  });
});

describe('readScoreSong names the Song', () => {
  it('names the Song by the work title first', () => {
    const song = songOf(
      {workTitle: 'Sonata', movementTitle: 'Allegro', parts: [{measures: [measure(note('E', 5, 1))]}]},
      'piece.musicxml',
    );

    expect(song.name).toBe('Sonata');
  });

  it('names the Song by the movement title when the Score has no work title', () => {
    const song = songOf(
      {movementTitle: 'Allegro', parts: [{measures: [measure(note('E', 5, 1))]}]},
      'piece.musicxml',
    );

    expect(song.name).toBe('Allegro');
  });

  it('names the Song by the file name without its extension when the Score has no title', () => {
    const song = songOf({parts: [{measures: [measure(note('E', 5, 1))]}]}, 'Bach Invention.musicxml');

    expect(song.name).toBe('Bach Invention');
  });
});

describe('readScoreSong rejects what is not a Score with Notes', () => {
  it('rejects XML that is not well formed as not-a-score', () => {
    const result = readScoreSong(utf8('<score-partwise version="4.0"><part-list>'), 'broken.musicxml');

    expect(rejectionOf(result)).toBe('not-a-score');
  });

  it('rejects a Score in which no Part has Notes as no-notes', () => {
    const result = readScoreSong(
      utf8(scoreXml({parts: [{name: 'Flute', measures: [measure(rest(1))]}]})),
      'silence.musicxml',
    );

    expect(rejectionOf(result)).toBe('no-notes');
  });
});

/*
 * T023, SC-001: the same two-staff music as MusicXML and as MIDI gives, through createTape with the same
 * Organ and Transposition, identical Holes.
 */

const ORGAN_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const MIDI_TICKS_PER_QUARTER = 96;

/** Pipes C4 to C6 without F#. */
const PIPES_WITHOUT_F_SHARP = Array.from({length: 25}, (_, index) => 60 + index).filter((pipe) => pipe % 12 !== 6);

function anOrgan(): Organ {
  const mm = (value: number) => defined(millimetres(value), 'millimetres');
  return asValidOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: mm(100), holeDiameter: mm(1), rowSpacing: mm(2)},
    minimumGap: mm(1),
    leadIn: mm(0),
    crankSpeedRange: DEFAULT_CRANK_SPEED_RANGE,
    pipes: PIPES_WITHOUT_F_SHARP.map((each) => ({note: defined(midiNoteNumber(each), 'pipe')})),
  });
}

interface MidiNote {
  readonly note: number;
  readonly startTick: number;
  readonly ticks: number;
}

/** One track per staff; each track is one Part of the MIDI Song. */
function midiSongOf(...tracks: readonly (readonly MidiNote[])[]): Song {
  const smfTracks: SmfTrack[] = tracks.map((notes) => {
    const events: SmfTimedEvent[] = [];
    let clock = 0;
    for (const {note, startTick, ticks} of notes) {
      events.push({delta: startTick - clock, event: {type: 'noteOn', channel: 0, note, velocity: 64}});
      events.push({delta: ticks, event: {type: 'noteOff', channel: 0, note, velocity: 0}});
      clock = startTick + ticks;
    }
    return {events};
  });
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: MIDI_TICKS_PER_QUARTER},
    tracks: smfTracks,
  });
  const result = readMidiSong(bytes, 'tune.mid');
  if (!result.ok) throw new Error(`test Song rejected: ${result.error}`);
  return result.value;
}

/** The spelling of each pitch of the reference music, so that both Scores write the same notes. */
const SPELLING: ReadonlyMap<number, PitchSpec> = new Map<number, PitchSpec>([
  [48, {step: 'C', octave: 3}],
  [52, {step: 'E', octave: 3}],
  [55, {step: 'G', octave: 3}],
  [60, {step: 'C', octave: 4}],
  [64, {step: 'E', octave: 4}],
  [67, {step: 'G', octave: 4}],
  [69, {step: 'A', octave: 4}],
]);

/** A written Note of the reference music; `duration` is in divisions (4 per quarter note). */
function written(noteNumber: number, duration: number, staff: number): NoteSpec {
  return {kind: 'note', pitch: defined(SPELLING.get(noteNumber), `spelling of ${noteNumber}`), duration, staff};
}

/** The reference music: a treble staff with a melody and a bass staff under it, two 4/4 Bars. */
const TWO_STAVES: ScoreSpec = {
  parts: [
    {
      name: 'Piano',
      staves: 2,
      measures: [
        measure(
          {kind: 'attributes', divisions: 4, time: {beats: 4, beatType: 4}},
          written(60, 4, 1),
          written(64, 4, 1),
          written(67, 8, 1),
          {kind: 'backup', duration: 16},
          written(48, 8, 2),
          written(55, 8, 2),
        ),
        measure(
          written(69, 16, 1),
          {kind: 'backup', duration: 16},
          written(52, 4, 2),
          written(55, 4, 2),
          written(48, 4, 2),
          written(52, 4, 2),
        ),
      ],
    },
  ],
};

/** The same music as two MIDI tracks, one per staff, in 96 Ticks per quarter note. */
const TREBLE_MIDI: readonly MidiNote[] = [
  {note: 60, startTick: 0, ticks: 96},
  {note: 64, startTick: 96, ticks: 96},
  {note: 67, startTick: 192, ticks: 192},
  {note: 69, startTick: 384, ticks: 384},
];
const BASS_MIDI: readonly MidiNote[] = [
  {note: 48, startTick: 0, ticks: 192},
  {note: 55, startTick: 192, ticks: 192},
  {note: 52, startTick: 384, ticks: 96},
  {note: 55, startTick: 480, ticks: 96},
  {note: 48, startTick: 576, ticks: 96},
  {note: 52, startTick: 672, ticks: 96},
];

function partsOf(...indexes: readonly number[]): ReadonlySet<PartIndex> {
  return new Set(indexes.map((index) => defined(partIndex(index, 100), 'part index')));
}

function holesOfTape(song: Song, transposed: Transposition): readonly {pipe: number; start: number; length: number}[] {
  const input: CreateTapeInput = {
    song,
    selectedParts: partsOf(0, 1),
    organ: anOrgan(),
    transposition: transposed,
    name: 'Piano',
    columnLength: 1,
  };
  const result = createTape(input);
  if (!result.ok) throw new Error(`createTape failed: ${JSON.stringify(result.error)}`);
  return result.value.tape.holes.map(({pipe, start, length}) => ({pipe, start, length}));
}

describe('readScoreSong and createTape, the same music from MusicXML and from MIDI (SC-001)', () => {
  it('puts the same Holes on the Tape from MusicXML as from MIDI, with the same Organ and Transposition', () => {
    const twelveUp = defined(transposition(12), 'transposition');
    const readFromScore = readingOf(readScoreSong(utf8(scoreXml(TWO_STAVES)), 'piano.musicxml')).song;
    const readFromMidi = midiSongOf(TREBLE_MIDI, BASS_MIDI);

    expect(holesOfTape(readFromScore, twelveUp)).toEqual(holesOfTape(readFromMidi, twelveUp));
  });
});

/*
 * User Story 2 (T032) and SC-005 (T034): the repeats of the Score are played out before the Notes are laid out.
 * A Bar is one whole note; the divisions are 4 per quarter note, so a whole note in 4/4 is 16 divisions.
 */

const DIVISIONS = 4;
const WHOLE_NOTE = 16;

/** The Bars 1 to 8 of the reference Score, the treble pitch of each; the piano's staves sound an octave and two below. */
const BAR_PITCHES: readonly PitchSpec[] = [
  {step: 'C', octave: 4},
  {step: 'D', octave: 4},
  {step: 'E', octave: 4},
  {step: 'F', octave: 4},
  {step: 'G', octave: 4},
  {step: 'A', octave: 4},
  {step: 'B', octave: 4},
  {step: 'C', octave: 5},
];
/** The MIDI note numbers of the Notes of each staff, in Bar order. */
const FLUTE_MIDI: readonly number[] = [60, 62, 64, 65, 67, 69, 71, 72];
const PIANO_UPPER_MIDI: readonly number[] = [48, 50, 52, 53, 55, 57, 59, 60];
const PIANO_LOWER_MIDI: readonly number[] = [36, 38, 40, 41, 43, 45, 47, 48];

/** The Bars in played order, 0-based: Bars 1 to 4, then Bars 1 to 3 again, then Bars 5 to 8 (first ending, second ending). */
const PLAYED_BARS: readonly number[] = [0, 1, 2, 3, 0, 1, 2, 4, 5, 6, 7];

/** The entries a Bar begins with: the Time signature and divisions, in the first Bar only. */
function attributesAt(index: number): MeasureEntry[] {
  return index === 0 ? [{kind: 'attributes', divisions: DIVISIONS, time: {beats: 4, beatType: 4}}] : [];
}

/** The barlines of a Bar: a forward repeat before Bar 1, a first ending on Bar 4 with a backward repeat, a second ending on Bar 5. */
function barlinesAt(index: number): MeasureEntry[] {
  switch (index) {
    case 0:
      return [{kind: 'barline', location: 'left', repeat: 'forward'}];
    case 3:
      return [
        {kind: 'barline', location: 'left', ending: {number: '1', type: 'start'}},
        {kind: 'barline', location: 'right', ending: {number: '1', type: 'stop'}, repeat: 'backward'},
      ];
    case 4:
      return [
        {kind: 'barline', location: 'left', ending: {number: '2', type: 'start'}},
        {kind: 'barline', location: 'right', ending: {number: '2', type: 'stop'}},
      ];
    default:
      return [];
  }
}

/** A Bar of the piano: its upper staff is written an octave below the treble pitch, its lower staff two octaves below. */
function pianoBarAt(index: number, pitch: PitchSpec): MeasureSpec {
  const upper: PitchSpec = {step: pitch.step, octave: pitch.octave - 1};
  const lower: PitchSpec = {step: pitch.step, octave: pitch.octave - 2};
  return measure(
    ...attributesAt(index),
    note(upper.step, upper.octave, WHOLE_NOTE, 1),
    {kind: 'backup', duration: WHOLE_NOTE},
    note(lower.step, lower.octave, WHOLE_NOTE, 2),
  );
}

/** The 8-Bar reference Score: a flute with the repeats and endings, and a two-staff piano with no barlines of its own. */
const EIGHT_BARS: ScoreSpec = {
  parts: [
    {
      name: 'Flute',
      measures: BAR_PITCHES.map((pitch, index) =>
        measure(...attributesAt(index), note(pitch.step, pitch.octave, WHOLE_NOTE), ...barlinesAt(index)),
      ),
    },
    {
      name: 'Piano',
      staves: 2,
      measures: BAR_PITCHES.map((pitch, index) => pianoBarAt(index, pitch)),
    },
  ],
};

/** The Notes of a Part in played order: one whole note per played Bar, at the Tick where that Bar is played. */
function playedNotesOf(midi: readonly number[], wholeNote: number) {
  return PLAYED_BARS.map((bar, position) => ({
    noteNumber: defined(midi[bar], `pitch of Bar ${bar + 1}`),
    start: position * wholeNote,
    duration: wholeNote,
  }));
}

describe('readScoreSong plays the repeats out, every staff following the marks of the first part (US2)', () => {
  it('gives the Notes of the 8-Bar reference Score at the Ticks of the played-out Bars, on every staff', () => {
    const song = songOf(EIGHT_BARS, 'eight-bars.musicxml');
    const wholeNote = 4 * song.ticksPerQuarter;

    expect(namesOf(song)).toEqual(['Flute', 'Piano 1', 'Piano 2']);
    expect(
      song.parts.map((songPart) =>
        songPart.notes.map(({noteNumber, start, duration}) => ({noteNumber, start, duration})),
      ),
    ).toEqual([
      playedNotesOf(FLUTE_MIDI, wholeNote),
      playedNotesOf(PIANO_UPPER_MIDI, wholeNote),
      playedNotesOf(PIANO_LOWER_MIDI, wholeNote),
    ]);
  });
});

/** 5 minutes at 120 quarter notes a minute: 600 quarter notes, in 4/4 Bars of 4 quarter notes (SC-005). */
const FIVE_MINUTE_QUARTERS = 600;
const QUARTERS_PER_BAR = 4;
const STAVES = 16;
/** The Bars written; the first repeat is played this many times, so the Score lasts 5 minutes after play-out. */
const WRITTEN_BARS = 15;
const PASSES = FIVE_MINUTE_QUARTERS / QUARTERS_PER_BAR / WRITTEN_BARS;
/** The bound of SC-005, in milliseconds; generous, so that a slow CI machine does not make the test flaky. */
const READ_BOUND_MS = 5000;

/** The Tick at which the last Note of a Song ends. */
function endOf(song: Song): number {
  return song.parts.reduce(
    (end, songPart) => songPart.notes.reduce((partEnd, each) => Math.max(partEnd, each.start + each.duration), end),
    0,
  );
}

describe('readScoreSong reads a long Score in time (SC-005)', () => {
  it('reads a 5 minute Score of 16 staves, its repeats played out, into Notes that last 5 minutes, in under 5 seconds', () => {
    const measures: MeasureSpec[] = Array.from({length: WRITTEN_BARS}, (_, index) => {
      const entries: MeasureEntry[] = [...attributesAt(index)];
      if (index === 0) entries.push({kind: 'barline', location: 'left', repeat: 'forward'});
      for (let staff = 1; staff <= STAVES; staff++) {
        if (staff > 1) entries.push({kind: 'backup', duration: WHOLE_NOTE});
        entries.push(note('C', 3, WHOLE_NOTE, staff));
      }
      if (index === WRITTEN_BARS - 1) {
        entries.push({kind: 'barline', location: 'right', repeat: 'backward', times: PASSES});
      }
      return measure(...entries);
    });
    const bytes = utf8(scoreXml({parts: [{name: 'Ensemble', staves: STAVES, measures}]}));

    const started = performance.now();
    const result = readScoreSong(bytes, 'ensemble.musicxml');
    const elapsed = performance.now() - started;

    const song = readingOf(result).song;
    expect(song.parts).toHaveLength(STAVES);
    expect(endOf(song)).toBe(FIVE_MINUTE_QUARTERS * song.ticksPerQuarter);
    expect(elapsed).toBeLessThan(READ_BOUND_MS);
  });
});

/*
 * US3, ties, grace notes and ornaments (T036, T038, T040 is the Import Summary): the Score is read with its ties
 * joined, its grace notes and ornaments left out, and each Part's counts in leftOut keyed by its PartIndex.
 */

function firstPartOf(song: Song): Part {
  return defined(song.parts[0], 'the first Part');
}

function timingOf(songPart: Part): {noteNumber: number; start: number; duration: number}[] {
  return songPart.notes.map(({noteNumber, start, duration}) => ({noteNumber, start, duration}));
}

function readingOfScore(spec: ScoreSpec): SongReading {
  return readingOf(readScoreSong(utf8(scoreXml(spec)), 'score.musicxml'));
}

function leftOutIn(reading: SongReading): ReadonlyMap<PartIndex, LeftOut> {
  return defined(reading.leftOut, 'leftOut of a Score');
}

function partAt(index: number, partCount: number): PartIndex {
  return defined(partIndex(index, partCount), `Part ${index}`);
}

/** The same Note, with the tie elements of the given types. */
function tied(spec: NoteSpec, tie: readonly ('start' | 'stop')[]): NoteSpec {
  return {...spec, tie};
}

/** A grace Note: it has no duration, so it takes no time in its measure. */
function graceNote(step: PitchSpec['step'], octave: number, staff?: number): NoteSpec {
  return {kind: 'note', pitch: {step, octave}, grace: true, staff};
}

describe('readScoreSong joins a tie into one Note (US3, R8)', () => {
  it('joins a half Note tied over the bar line to a quarter of the same pitch into one Note of 3 quarters', () => {
    const song = songOf({
      parts: [
        {
          name: 'Flute',
          measures: [
            measure(...attributesAt(0), rest(8), tied(note('C', 4, 8), ['start'])),
            measure(tied(note('C', 4, 4), ['stop']), rest(12)),
          ],
        },
      ],
    });
    const quarter = song.ticksPerQuarter;

    expect(timingOf(firstPartOf(song))).toEqual([{noteNumber: 60, start: 2 * quarter, duration: 3 * quarter}]);
  });

  it('joins a G sharp tied to an A flat, which sound the same Note', () => {
    const song = songOf({
      parts: [
        {
          name: 'Flute',
          measures: [
            measure(
              ...attributesAt(0),
              rest(12),
              tied({kind: 'note', pitch: {step: 'G', octave: 4, alter: 1}, duration: DIVISIONS}, ['start']),
            ),
            measure(
              tied({kind: 'note', pitch: {step: 'A', octave: 4, alter: -1}, duration: DIVISIONS}, ['stop']),
              rest(12),
            ),
          ],
        },
      ],
    });

    const quarter = song.ticksPerQuarter;

    expect(timingOf(firstPartOf(song))).toEqual([{noteNumber: 68, start: 3 * quarter, duration: 2 * quarter}]);
  });

  it('joins a tie at the end of a repeat to the Note of its pitch at the repeat start, in played-out order', () => {
    const song = songOf({
      parts: [
        {
          name: 'Flute',
          measures: [
            measure(
              ...attributesAt(0),
              {kind: 'barline', location: 'left', repeat: 'forward'},
              tied(note('C', 4, 8), ['stop']),
            ),
            measure(tied(note('C', 4, 8), ['start']), {kind: 'barline', location: 'right', repeat: 'backward'}),
          ],
        },
      ],
    });
    const half = 2 * song.ticksPerQuarter;

    expect(timingOf(firstPartOf(song))).toEqual([
      {noteNumber: 60, start: 0, duration: half},
      {noteNumber: 60, start: half, duration: 2 * half},
      {noteNumber: 60, start: 3 * half, duration: half},
    ]);
  });
});

describe('readScoreSong leaves grace notes and ornaments out and counts them (US3, R8)', () => {
  it('leaves a grace note out, so the main Note starts where it is written, and counts it', () => {
    const reading = readingOfScore({
      parts: [{name: 'Flute', measures: [measure(...attributesAt(0), rest(4), graceNote('E', 5), note('D', 5, 4), rest(8))]}],
    });
    const quarter = reading.song.ticksPerQuarter;

    expect(timingOf(firstPartOf(reading.song))).toEqual([{noteNumber: 74, start: quarter, duration: quarter}]);
    expect(leftOutIn(reading).get(partAt(0, 1))).toEqual({graceNotes: 1, ornaments: 0});
  });

  it.each<Ornament>(['trill-mark', 'mordent', 'turn', 'tremolo'])(
    'keeps a Note with a %s as one plain Note as long as it is written, and counts it',
    (ornament) => {
      const reading = readingOfScore({
        parts: [{name: 'Flute', measures: [measure(...attributesAt(0), {...note('C', 5, 8), ornaments: [ornament]}, rest(8))]}],
      });

      expect(timingOf(firstPartOf(reading.song))).toEqual([
        {noteNumber: 72, start: 0, duration: 2 * reading.song.ticksPerQuarter},
      ]);
      expect(leftOutIn(reading).get(partAt(0, 1))).toEqual({graceNotes: 0, ornaments: 1});
    },
  );

  it('keeps the Notes of an arpeggiated chord starting together, and counts the chord once', () => {
    const reading = readingOfScore({
      parts: [
        {
          name: 'Piano',
          measures: [
            measure(
              ...attributesAt(0),
              {...note('C', 4, 8), arpeggiate: true},
              {...note('E', 4, 8), chord: true, arpeggiate: true},
              {...note('G', 4, 8), chord: true, arpeggiate: true},
            ),
          ],
        },
      ],
    });
    const half = 2 * reading.song.ticksPerQuarter;

    expect(timingOf(firstPartOf(reading.song))).toEqual([
      {noteNumber: 60, start: 0, duration: half},
      {noteNumber: 64, start: 0, duration: half},
      {noteNumber: 67, start: 0, duration: half},
    ]);
    expect(leftOutIn(reading).get(partAt(0, 1))).toEqual({graceNotes: 0, ornaments: 1});
  });
});

describe('readScoreSong gives leftOut per Part, keyed by its PartIndex (US3, R8)', () => {
  it('counts the grace notes and ornaments of each Part under its own PartIndex, zero included', () => {
    const leftOut = leftOutIn(
      readingOfScore({
        parts: [
          {
            name: 'Flute',
            measures: [
              measure(
                ...attributesAt(0),
                graceNote('E', 5),
                graceNote('F', 5),
                {...note('C', 5, 4), ornaments: ['trill-mark']},
                rest(12),
              ),
            ],
          },
          {name: 'Piano', measures: [measure(...attributesAt(0), note('C', 4, 16))]},
        ],
      }),
    );

    expect(leftOut.get(partAt(0, 2))).toEqual({graceNotes: 2, ornaments: 1});
    expect(leftOut.get(partAt(1, 2))).toEqual({graceNotes: 0, ornaments: 0});
  });

  it('counts the grace notes and ornaments of a repeated measure once for each time it is played', () => {
    const leftOut = leftOutIn(
      readingOfScore({
        parts: [
          {
            name: 'Flute',
            measures: [
              measure(
                ...attributesAt(0),
                {kind: 'barline', location: 'left', repeat: 'forward'},
                graceNote('E', 5),
                {...note('C', 5, 4), ornaments: ['trill-mark']},
                rest(12),
              ),
              measure(note('D', 5, 16), {kind: 'barline', location: 'right', repeat: 'backward'}),
            ],
          },
        ],
      }),
    );

    expect(leftOut.get(partAt(0, 1))).toEqual({graceNotes: 2, ornaments: 2});
  });

  it('gives no Part to a staff of only a grace note, and no leftOut entry for it', () => {
    const reading = readingOfScore({
      parts: [
        {
          name: 'Piano',
          staves: 2,
          measures: [
            measure(
              ...attributesAt(0),
              note('C', 4, 4, 1),
              {kind: 'backup', duration: 4},
              graceNote('E', 4, 2),
              rest(4, 2),
            ),
          ],
        },
      ],
    });

    expect(namesOf(reading.song)).toEqual(['Piano 1']);
    expect([...leftOutIn(reading).keys()]).toEqual([partAt(0, 1)]);
  });

  it('gives every Part zero grace notes and zero ornaments for a Score with neither', () => {
    const leftOut = leftOutIn(
      readingOfScore({
        parts: [
          {name: 'Flute', measures: [measure(...attributesAt(0), note('E', 5, 16))]},
          {name: 'Violin', measures: [measure(...attributesAt(0), note('A', 5, 16))]},
        ],
      }),
    );

    expect(leftOut.get(partAt(0, 2))).toEqual({graceNotes: 0, ornaments: 0});
    expect(leftOut.get(partAt(1, 2))).toEqual({graceNotes: 0, ornaments: 0});
  });
});
