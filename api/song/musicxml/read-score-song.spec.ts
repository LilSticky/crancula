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
import type {SongReading, SongRejection} from '../read-song-source';
import {partIndex, type Part, type PartIndex, type Song} from '../song';
import {readScoreSong} from './read-score-song';
import {
  scoreXml,
  type MeasureEntry,
  type MeasureSpec,
  type NoteSpec,
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
