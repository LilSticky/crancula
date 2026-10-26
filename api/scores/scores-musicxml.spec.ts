/*
 * Expected API of api/scores/scores-musicxml.ts (T021, contracts/musicxml-output.md, data-model.md "The writer"):
 *
 *   interface ScoresInput { tape: Tape; organ: Organ; song: Song | undefined; choices: ScoresChoices }
 *   scoresMusicXml(input: ScoresInput): string
 *     The whole MusicXML 4.0 score-partwise document, UTF-8 text. Pure and deterministic.
 *
 * The output is checked by parsing it with parseXml (api/song/musicxml/xml.ts) and by reading it back with
 * readScoreSong (api/song/musicxml/read-score-song.ts, slice 010), as research R2 says. The golden file
 * api/scores/scores.reference.musicxml is recorded by the implementer (T021) from the Story 1.3 Tape below,
 * after the output is checked by eye; this spec does not write it.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {crankSpeed} from '../tape/crank-speed';
import {tapeOf} from '../tape/tape-fixture';
import {column, columnCount, tapeId, transposition, type Hole, type Tape} from '../tape/tape';
import {note, part, partIndex, song, songId, tick, ticksPerQuarter, type Key, type Part, type Song, type TimeSignature} from '../song/song';
import {parseXml, type XmlElement} from '../song/musicxml/xml';
import {readScoreSong} from '../song/musicxml/read-score-song';
import type {ScoresChoices} from './scores-choices';
import {scoresMusicXml, type ScoresInput} from './scores-musicxml';

const QUARTER = 480;
const SONG_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ORGAN_ID = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';
const TAPE_ID = '00000000-0000-4000-8000-0000000000dd';
const DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function midi(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

function at(ticks: number) {
  return defined(tick(ticks), `tick ${ticks}`);
}

function hole(pipe: number, start: number, length: number): Hole {
  return {
    pipe: midi(pipe),
    start: defined(column(start), `start ${start}`),
    length: defined(columnCount(length), `length ${length}`),
  };
}

/** The Pipes 60 to 69 of the reference Organ of spec 003. */
const REFERENCE_PIPES: readonly number[] = Array.from({length: 10}, (_, row) => 60 + row);

/** The Pipes 55 to 69: some below C4, for the two-staff exports. */
const LOW_PIPES: readonly number[] = Array.from({length: 15}, (_, row) => 55 + row);

/** The reference Organ of spec 003 (Pipes 60 to 69 unless others are given), with the Tape per Crank turn in mm. */
function organWith(tapePerCrankTurn: number | null, pipes: readonly number[] = REFERENCE_PIPES): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Reference organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn,
    pipes: pipes.map((note) => ({note})),
  });
  if (!result.ok) throw new Error('invalid Organ fixture');
  return result.value;
}

function aPart(): Part {
  const aNote = defined(
    note({noteNumber: midi(60), start: at(0), duration: at(QUARTER)}),
    'note',
  );
  return defined(part({name: 'Melody', percussion: false, notes: [aNote]}), 'part');
}

/** Story 1.3: a Song in 3/4 with an upbeat of one quarter and G major. */
function storySong(): Song {
  const threeFour: TimeSignature = {start: at(0), beats: 3, beatType: 4};
  const gMajor: Key = {start: at(0), fifths: 1, mode: 'major'};
  return defined(
    song({
      id: defined(songId(SONG_ID), 'song id'),
      name: 'Waltz',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [aPart()],
      timeSignatures: [threeFour],
      upbeat: at(QUARTER),
      keys: [gMajor],
    }),
    'song',
  );
}

/** The Holes of the Story 1.3 Tape: Pipe 67 (G4) in the upbeat, a quarter of C4, a half of E4, a dotted half of G4. */
const STORY_HOLES: readonly Hole[] = [hole(67, 0, 8), hole(60, 8, 8), hole(64, 16, 16), hole(67, 32, 24)];

interface StoryFields {
  readonly name?: string;
  readonly organ?: Organ;
  readonly holes?: readonly Hole[];
}

/** The Story 1.3 export: a 56-Column Tape of 3/4 Bars (upbeat of 8 Columns), 5 mm Columns, Crank speed 60, transposition 5. */
function storyInput(fields: StoryFields = {}): ScoresInput {
  const organ = fields.organ ?? organWith(100);
  const of = storySong();
  const tape: Tape = tapeOf({
    id: defined(tapeId(TAPE_ID), 'tape id'),
    name: fields.name ?? 'Waltz',
    organId: organ.id,
    songId: of.id,
    selectedParts: [defined(partIndex(0, 1), 'part index')],
    transposition: defined(transposition(5), 'transposition'),
    columnLength: defined(millimetres(5), 'column length'),
    crankSpeed: defined(crankSpeed(60), 'crank speed'),
    length: defined(columnCount(56), 'length'),
    holes: fields.holes ?? STORY_HOLES,
  });
  const choices: ScoresChoices = {timeSignature: 'song', upbeat: 8, splitNotes: []};
  return {tape, organ, song: of, choices};
}

/** A 32-Column Tape with no Holes, no Song and 4/4 without an upbeat. */
function emptyInput(): ScoresInput {
  const organ = organWith(100);
  const tape: Tape = tapeOf({
    id: defined(tapeId(TAPE_ID), 'tape id'),
    name: 'Empty',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(5), 'column length'),
    length: defined(columnCount(32), 'length'),
    holes: [],
  });
  return {tape, organ, song: undefined, choices: {timeSignature: {beats: 4, beatType: 4}, upbeat: 0, splitNotes: []}};
}

function parsed(text: string): XmlElement {
  return defined(parseXml(new TextEncoder().encode(text)), 'well-formed MusicXML');
}

/** The children of `parent` named `name`. */
function named(parent: XmlElement, name: string): XmlElement[] {
  return parent.children.filter((child) => child.name === name);
}

/** Every element named `name` below `parent`, in document order. */
function all(parent: XmlElement, name: string): XmlElement[] {
  return parent.children.flatMap((child) => [...(child.name === name ? [child] : []), ...all(child, name)]);
}

/** The trimmed text of the first child named `name`. */
function textOf(parent: XmlElement, name: string): string {
  return defined(named(parent, name)[0], `child ${name}`).text.trim();
}

/** The sum of the durations of the notes of each voice in a measure; a chord's further pitches add nothing. */
function voiceSums(measure: XmlElement): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const noteElement of named(measure, 'note')) {
    if (named(noteElement, 'chord').length > 0) continue;
    const voice = textOf(noteElement, 'voice');
    sums[voice] = (sums[voice] ?? 0) + Number(textOf(noteElement, 'duration'));
  }
  return sums;
}

function firstPartOf(root: XmlElement): XmlElement {
  return defined(named(root, 'part')[0], 'part');
}

/** The measures of the first part, in document order. */
function measuresOf(root: XmlElement): XmlElement[] {
  return named(firstPartOf(root), 'measure');
}

function measureAt(root: XmlElement, index: number): XmlElement {
  return defined(measuresOf(root)[index], `measure ${index}`);
}

const STEP_SEMITONES: ReadonlyMap<string, number> = new Map([
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
  ['B', 11],
]);

/** The spelled pitch of a `<pitch>` element, as in "C4", "F#3" or "Bb2". */
function pitchNameOf(pitch: XmlElement): string {
  const alter = Number(named(pitch, 'alter')[0]?.text.trim() ?? 0);
  const accidental = alter === 1 ? '#' : alter === -1 ? 'b' : '';
  return `${textOf(pitch, 'step')}${accidental}${textOf(pitch, 'octave')}`;
}

/** The MIDI note number a `<pitch>` element sounds at, from its step, alter and octave. */
function midiOf(pitch: XmlElement): number {
  const semitones = defined(STEP_SEMITONES.get(textOf(pitch, 'step')), 'step');
  const alter = Number(named(pitch, 'alter')[0]?.text.trim() ?? 0);
  return (Number(textOf(pitch, 'octave')) + 1) * 12 + semitones + alter;
}

/** One `<note>` of a measure as read back; a field the note does not have is undefined or empty. */
interface Entry {
  readonly rest: boolean;
  readonly measureRest: boolean;
  readonly chord: boolean;
  readonly pitch: string | undefined;
  readonly midi: number | undefined;
  readonly type: string | undefined;
  readonly dotted: boolean;
  readonly duration: number;
  readonly ties: readonly string[];
  readonly voice: string;
  readonly staff: string | undefined;
  readonly stem: string | undefined;
}

function entryOf(noteElement: XmlElement): Entry {
  const pitch = named(noteElement, 'pitch')[0];
  const rest = named(noteElement, 'rest')[0];
  return {
    rest: rest !== undefined,
    measureRest: rest?.attributes.get('measure') === 'yes',
    chord: named(noteElement, 'chord').length > 0,
    pitch: pitch === undefined ? undefined : pitchNameOf(pitch),
    midi: pitch === undefined ? undefined : midiOf(pitch),
    type: named(noteElement, 'type')[0]?.text.trim(),
    dotted: named(noteElement, 'dot').length > 0,
    duration: Number(textOf(noteElement, 'duration')),
    ties: named(noteElement, 'tie').map((tie) => tie.attributes.get('type') ?? ''),
    voice: textOf(noteElement, 'voice'),
    staff: named(noteElement, 'staff')[0]?.text.trim(),
    stem: named(noteElement, 'stem')[0]?.text.trim(),
  };
}

/** The `<note>` elements of a measure, in the order they are written. */
function entriesOf(measure: XmlElement): Entry[] {
  return named(measure, 'note').map(entryOf);
}

interface InputFields {
  readonly holes: readonly Hole[];
  /** In Columns; 64 when left out (two Bars of 32 Columns). */
  readonly length?: number;
  readonly organ?: Organ;
  readonly song?: Song;
  readonly splitNotes?: readonly MidiNoteNumber[];
}

/**
 * A Tape of 3 mm Columns, so the Minimum Gap of 2 mm rounds up to one Column (Story 2). Without a Song it is in
 * 4/4 with no upbeat; with one, its Time signatures are kept.
 */
function tapeInput(fields: InputFields): ScoresInput {
  const organ = fields.organ ?? organWith(100);
  const tape: Tape = tapeOf({
    id: defined(tapeId(TAPE_ID), 'tape id'),
    name: 'Plain',
    organId: organ.id,
    songId: fields.song?.id,
    selectedParts: fields.song === undefined ? undefined : [defined(partIndex(0, 1), 'part index')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(3), 'column length'),
    length: defined(columnCount(fields.length ?? 64), 'length'),
    holes: fields.holes,
  });
  return {
    tape,
    organ,
    song: fields.song,
    choices: {
      timeSignature: fields.song === undefined ? {beats: 4, beatType: 4} : 'song',
      upbeat: 0,
      splitNotes: fields.splitNotes ?? [],
    },
  };
}

describe('scoresMusicXml writes the MusicXML 4.0 document of the Story 1.3 Tape', () => {
  it('starts with the XML declaration and the MusicXML 4.0 partwise DOCTYPE', () => {
    const text = scoresMusicXml(storyInput());

    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')).toBe(true);
    expect(text).toContain(DOCTYPE);
    expect(text).toContain('<score-partwise version="4.0">');
  });

  it('writes the Tape\'s name as the work title, XML-escaped (FR-015)', () => {
    const root = parsed(scoresMusicXml(storyInput({name: 'Waltz & <1>'})));

    expect(all(root, 'work-title').map((title) => title.text)).toEqual(['Waltz & <1>']);
  });

  it('writes divisions 8, the key of G major and 3/4 in the first measure', () => {
    const root = parsed(scoresMusicXml(storyInput()));
    const firstMeasure = defined(named(firstPartOf(root), 'measure')[0], 'measure 0');
    const attributes = defined(named(firstMeasure, 'attributes')[0], 'attributes');
    const key = defined(named(attributes, 'key')[0], 'key');
    const time = defined(named(attributes, 'time')[0], 'time');

    expect(textOf(attributes, 'divisions')).toBe('8');
    expect(textOf(key, 'fifths')).toBe('1');
    expect(textOf(key, 'mode')).toBe('major');
    expect(textOf(time, 'beats')).toBe('3');
    expect(textOf(time, 'beat-type')).toBe('4');
  });

  it('writes the upbeat as the implicit measure 0 and the Bars after it from 1', () => {
    const measures = named(firstPartOf(parsed(scoresMusicXml(storyInput()))), 'measure');

    expect(measures.map((measure) => measure.attributes.get('number'))).toEqual(['0', '1', '2']);
    expect(measures[0]?.attributes.get('implicit')).toBe('yes');
  });

  it('writes the tempo as a quarter note metronome mark of 150 and a sound tempo of 150 (Story 1.5)', () => {
    const root = parsed(scoresMusicXml(storyInput()));
    const metronome = defined(all(root, 'metronome')[0], 'metronome');
    const sound = defined(all(root, 'sound')[0], 'sound');

    expect(textOf(metronome, 'beat-unit')).toBe('quarter');
    expect(textOf(metronome, 'per-minute')).toBe('150');
    expect(sound.attributes.get('tempo')).toBe('150');
  });

  it('writes no tempo mark for an Organ without a Tape per Crank turn (FR-013)', () => {
    const root = parsed(scoresMusicXml(storyInput({organ: organWith(null)})));

    expect(all(root, 'metronome')).toHaveLength(0);
    expect(all(root, 'sound')).toHaveLength(0);
  });

  it('writes the Pipe 67 as G4 whatever the Transposition of the Tape (Story 1.6)', () => {
    const measure = defined(named(firstPartOf(parsed(scoresMusicXml(storyInput()))), 'measure')[0], 'measure 0');
    const pitch = defined(all(measure, 'pitch')[0], 'pitch');

    expect(textOf(pitch, 'step')).toBe('G');
    expect(textOf(pitch, 'octave')).toBe('4');
    expect(named(pitch, 'alter')).toHaveLength(0);
  });

  it('fills every voice of every Bar exactly: 8 Columns for the upbeat, 24 for the others (SC-002)', () => {
    const measures = named(firstPartOf(parsed(scoresMusicXml(storyInput()))), 'measure');

    expect(measures.map(voiceSums)).toEqual([{1: 8}, {1: 24}, {1: 24}]);
  });

  it('writes a Hole whose Pipe is not on the Organ as an ordinary note (FR-007)', () => {
    const root = parsed(scoresMusicXml(storyInput({holes: [hole(72, 0, 8)]})));
    const pitches = all(root, 'pitch').filter((pitch) => textOf(pitch, 'step') === 'C' && textOf(pitch, 'octave') === '5');

    expect(pitches).toHaveLength(1);
  });

  it('reads back with readScoreSong as one Part whose Notes are the Holes (research R2)', () => {
    const text = scoresMusicXml(storyInput());

    const result = readScoreSong(new TextEncoder().encode(text), 'Waltz.musicxml');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [only] = result.value.song.parts;
    expect(result.value.song.parts).toHaveLength(1);
    expect(only?.notes.map(({noteNumber, start, duration}) => ({noteNumber, start, duration}))).toEqual([
      {noteNumber: 67, start: 0, duration: 8},
      {noteNumber: 60, start: 8, duration: 8},
      {noteNumber: 64, start: 16, duration: 16},
      {noteNumber: 67, start: 32, duration: 24},
    ]);
  });

  it('writes an empty Tape as one whole-Bar rest and no pitch', () => {
    const root = parsed(scoresMusicXml(emptyInput()));
    const wholeBarRests = all(root, 'rest').filter((rest) => rest.attributes.get('measure') === 'yes');

    expect(all(root, 'pitch')).toHaveLength(0);
    expect(wholeBarRests).toHaveLength(1);
  });

  it('writes the same text for the same input', () => {
    expect(scoresMusicXml(storyInput())).toBe(scoresMusicXml(storyInput()));
  });

  it('leaves the Tape, the Song and the Organ as they were (FR-017, SC-006)', () => {
    const input = storyInput();
    const before = structuredClone(input);

    scoresMusicXml(input);

    expect(input).toEqual(before);
  });

  it('writes the reference file api/scores/scores.reference.musicxml for the Story 1.3 Tape', () => {
    const golden = readFileSync(new URL('./scores.reference.musicxml', import.meta.url), 'utf8');

    expect(scoresMusicXml(storyInput())).toBe(golden);
  });
});

describe('scoresMusicXml writes one staff per range of Pipes (FR-005, FR-006, FR-007, FR-010)', () => {
  const split = [midi(60)];

  it('writes two staves split at C4 with a treble clef on the top staff and a bass clef below (FR-005, FR-006)', () => {
    const root = parsed(
      scoresMusicXml(tapeInput({holes: [hole(67, 0, 8), hole(55, 8, 8)], length: 32, organ: organWith(100, LOW_PIPES), splitNotes: split})),
    );
    const attributes = defined(named(measureAt(root, 0), 'attributes')[0], 'attributes');
    const clefs = named(attributes, 'clef').map((clef) => [clef.attributes.get('number'), textOf(clef, 'sign')]);

    expect(named(attributes, 'staves').map((staves) => staves.text.trim())).toEqual(['2']);
    expect(clefs).toEqual([
      ['1', 'G'],
      ['2', 'F'],
    ]);
    expect(all(root, 'backup').length).toBeGreaterThan(0);
  });

  it('puts every Hole on the staff of its pitch: the Pipes at C4 and above on the top staff, the rest below (FR-005, FR-007)', () => {
    const input = tapeInput({
      holes: [hole(67, 0, 8), hole(55, 8, 8), hole(60, 16, 8)],
      length: 32,
      organ: organWith(100, LOW_PIPES),
      splitNotes: split,
    });

    const result = readScoreSong(new TextEncoder().encode(scoresMusicXml(input)), 'Plain.musicxml');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.song.parts.map((each) => each.notes.map(({noteNumber, start, duration}) => ({noteNumber, start, duration}))),
    ).toEqual([
      [
        {noteNumber: 67, start: 0, duration: 8},
        {noteNumber: 60, start: 16, duration: 8},
      ],
      [{noteNumber: 55, start: 8, duration: 8}],
    ]);
  });

  it('writes a Bar with no note on a staff as one whole-Bar rest on that staff (FR-010)', () => {
    const root = parsed(
      scoresMusicXml(tapeInput({holes: [hole(67, 0, 8)], length: 32, organ: organWith(100, LOW_PIPES), splitNotes: split})),
    );
    const entries = entriesOf(measureAt(root, 0));

    expect(entries.filter((entry) => entry.staff === '2')).toMatchObject([{rest: true, measureRest: true, duration: 32}]);
  });

  it('writes a Hole whose Pipe is not on the Organ as an ordinary note on the staff of its pitch (FR-007)', () => {
    const text = scoresMusicXml(
      tapeInput({holes: [hole(50, 0, 8)], length: 32, organ: organWith(100, LOW_PIPES), splitNotes: split}),
    );
    const entries = entriesOf(measureAt(parsed(text), 0));

    expect(entries.filter((entry) => entry.staff === '2' && !entry.rest)).toMatchObject([
      {pitch: 'D3', midi: 50, chord: false, type: 'quarter', duration: 8, ties: []},
    ]);
    expect(text).not.toMatch(/<(accidental|notehead|cue|grace)\b/);
  });

  it('writes MIDI notes 0 to 11 one octave up, in octave 0, with no mark (FR-007)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(0, 0, 8), hole(11, 8, 8)]})));
    const pitches = entriesOf(measureAt(root, 0)).filter((entry) => !entry.rest).map((entry) => entry.pitch);

    expect(pitches).toEqual(['C0', 'B0']);
  });
});

describe('scoresMusicXml writes chords, voices and ties (FR-009, FR-012)', () => {
  it('writes two Holes that start and end together on one staff as one chord (FR-012)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 8), hole(64, 0, 8)]})));
    const [first, second] = entriesOf(measureAt(root, 0));

    expect(first).toMatchObject({pitch: 'C4', chord: false, type: 'quarter', duration: 8});
    expect(second).toMatchObject({pitch: 'E4', chord: true, duration: 8});
  });

  it('writes a note that overlaps one of another length in voice 2, stems up in voice 1 and down in voice 2 (FR-012)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(67, 0, 16), hole(64, 8, 8)]})));
    const entries = entriesOf(measureAt(root, 0));

    expect(entries.filter((entry) => entry.voice === '1' && !entry.rest)).toMatchObject([
      {pitch: 'G4', duration: 16, stem: 'up'},
    ]);
    expect(entries.filter((entry) => entry.voice === '2' && !entry.rest)).toMatchObject([
      {pitch: 'E4', duration: 8, stem: 'down'},
    ]);
    expect(voiceSums(measureAt(root, 0))).toEqual({1: 32, 2: 32});
  });

  it('ties a note that crosses a bar line into the next Bar, and reads it back as one note (FR-009, Story 2.4)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 24, 16)]})));

    expect(entriesOf(measureAt(root, 0)).at(-1)).toMatchObject({pitch: 'C4', duration: 8, type: 'quarter', ties: ['start']});
    expect(entriesOf(measureAt(root, 1))[0]).toMatchObject({pitch: 'C4', duration: 8, type: 'quarter', ties: ['stop']});

    const result = readScoreSong(new TextEncoder().encode(scoresMusicXml(tapeInput({holes: [hole(60, 24, 16)]}))), 'Plain.musicxml');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.song.parts[0]?.notes.map(({noteNumber, start, duration}) => ({noteNumber, start, duration}))).toEqual([
      {noteNumber: 60, start: 24, duration: 16},
    ]);
  });

  it('ties a note that crosses a Time signature change, where the Bar changes from 3/4 to 4/4 (FR-009)', () => {
    const threeToFour = defined(
      song({
        id: defined(songId(SONG_ID), 'song id'),
        name: 'Waltz',
        ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
        parts: [aPart()],
        timeSignatures: [
          {start: at(0), beats: 3, beatType: 4},
          {start: at(3 * QUARTER), beats: 4, beatType: 4},
        ],
      }),
      'song',
    );
    const root = parsed(scoresMusicXml(tapeInput({song: threeToFour, holes: [hole(60, 16, 16)], length: 56})));
    const time = defined(all(measureAt(root, 1), 'time')[0], 'time of Bar 1');

    expect(entriesOf(measureAt(root, 0)).at(-1)).toMatchObject({pitch: 'C4', duration: 8, ties: ['start']});
    expect(entriesOf(measureAt(root, 1))[0]).toMatchObject({pitch: 'C4', duration: 8, ties: ['stop']});
    expect(textOf(time, 'beats')).toBe('4');
  });
});

describe('scoresMusicXml closes small gaps and writes few note values (Story 2)', () => {
  it('writes a 7-Column Hole followed 1 Column later by the next Hole as one quarter note, with no rest (Story 2.1)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 7), hole(60, 8, 8)]})));

    expect(entriesOf(measureAt(root, 0)).slice(0, 2)).toMatchObject([
      {pitch: 'C4', type: 'quarter', dotted: false, duration: 8, ties: []},
      {pitch: 'C4', rest: false},
    ]);
  });

  it('keeps a gap of 2 Columns: a 7-Column Hole is a dotted eighth tied to a 32nd, then a sixteenth rest (Story 2.2)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 7), hole(60, 9, 8)]})));

    expect(entriesOf(measureAt(root, 0)).slice(0, 3)).toMatchObject([
      {pitch: 'C4', type: 'eighth', dotted: true, duration: 6, ties: ['start']},
      {pitch: 'C4', type: '32nd', dotted: false, duration: 1, ties: ['stop']},
      {rest: true, type: '16th', duration: 2},
    ]);
  });

  it('writes a 12-Column Hole with nothing after it as a dotted quarter (Story 2.3)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 12)]})));

    expect(entriesOf(measureAt(root, 0)).slice(0, 1)).toMatchObject([
      {pitch: 'C4', type: 'quarter', dotted: true, duration: 12, ties: []},
    ]);
  });

  it('writes a 3-Column Hole as a dotted sixteenth (Story 2.3)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 3)]})));

    expect(entriesOf(measureAt(root, 0)).slice(0, 1)).toMatchObject([
      {pitch: 'C4', type: '16th', dotted: true, duration: 3, ties: []},
    ]);
  });

  it('writes a 5-Column Hole as an eighth tied to a 32nd (Story 2.3)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 5)]})));

    expect(entriesOf(measureAt(root, 0)).slice(0, 2)).toMatchObject([
      {pitch: 'C4', type: 'eighth', dotted: false, duration: 4, ties: ['start']},
      {pitch: 'C4', type: '32nd', dotted: false, duration: 1, ties: ['stop']},
    ]);
  });

  it('writes a 23-Column Hole with the fewest tied values, three: a dotted quarter, a quarter and a dotted sixteenth (SC-003)', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 23)]})));

    expect(entriesOf(measureAt(root, 0)).filter((entry) => entry.pitch === 'C4')).toHaveLength(3);
  });
});

describe('scoresMusicXml writes the octave clef of a staff, with its pitches unchanged (FR-006, R9)', () => {
  it('writes treble 8va as clef-octave-change 1, and the notes at the pitches they sound', () => {
    const root = parsed(
      scoresMusicXml(tapeInput({holes: [hole(91, 0, 8), hole(91, 8, 8), hole(91, 16, 8)], length: 32, organ: organWith(100, [60, 62])})),
    );
    const clef = defined(all(root, 'clef')[0], 'clef');

    expect(textOf(clef, 'sign')).toBe('G');
    expect(textOf(clef, 'clef-octave-change')).toBe('1');
    expect(entriesOf(measureAt(root, 0)).filter((entry) => !entry.rest).map((entry) => entry.midi)).toEqual([91, 91, 91]);
  });

  it('writes bass 8vb as clef-octave-change -1, and the notes at the pitches they sound', () => {
    const root = parsed(
      scoresMusicXml(tapeInput({holes: [hole(29, 0, 8), hole(29, 8, 8), hole(29, 16, 8)], length: 32, organ: organWith(100, [29, 31])})),
    );
    const clef = defined(all(root, 'clef')[0], 'clef');

    expect(textOf(clef, 'sign')).toBe('F');
    expect(textOf(clef, 'clef-octave-change')).toBe('-1');
    expect(entriesOf(measureAt(root, 0)).filter((entry) => !entry.rest).map((entry) => entry.midi)).toEqual([29, 29, 29]);
  });
});

/** A Song with the given Time signatures and Keys, from Tick 0, with the melody of `aPart`. */
function songWithMetre(timeSignatures: readonly TimeSignature[], keys: readonly Key[] = []): Song {
  return defined(
    song({
      id: defined(songId(SONG_ID), 'song id'),
      name: 'Waltz',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [aPart()],
      timeSignatures,
      keys,
    }),
    'song',
  );
}

/** The Time signatures a measure shows, as "beats/beat-type" strings. */
function timesOf(measure: XmlElement): string[] {
  return all(measure, 'time').map((time) => `${textOf(time, 'beats')}/${textOf(time, 'beat-type')}`);
}

describe('scoresMusicXml numbers the voices of a staff and spells the Key (FR-012, FR-014, research R8)', () => {
  it('numbers the four voices of the second staff 5 to 8, so that voices 3 and 4 are 7 and 8', () => {
    // Four notes below C4 starting together, with four different lengths: each takes its own voice.
    const holes = [hole(58, 0, 8), hole(57, 0, 16), hole(56, 0, 24), hole(55, 0, 32)];
    const root = parsed(
      scoresMusicXml(tapeInput({holes, length: 32, organ: organWith(100, LOW_PIPES), splitNotes: [midi(60)]})),
    );

    const bottom = entriesOf(measureAt(root, 0)).filter((entry) => entry.staff === '2' && !entry.rest);
    expect(bottom.map((entry) => entry.voice)).toEqual(['5', '6', '7', '8']);
  });

  it('spells Pipe 70 as B♭4 in F major, with an alter of -1 (FR-014)', () => {
    const fMajor: Key = {start: at(0), fifths: -1, mode: 'major'};
    const input = tapeInput({
      song: songWithMetre([{start: at(0), beats: 4, beatType: 4}], [fMajor]),
      holes: [hole(70, 0, 8)],
      length: 32,
    });

    const pitch = defined(all(measureAt(parsed(scoresMusicXml(input)), 0), 'pitch')[0], 'pitch');
    expect(textOf(pitch, 'step')).toBe('B');
    expect(textOf(pitch, 'alter')).toBe('-1');
    expect(textOf(pitch, 'octave')).toBe('4');
  });
});

describe('scoresMusicXml fills the last Bar of a Tape that is not a whole number of Bars (FR-011, Story 2.5)', () => {
  it('ends a 40-Column Tape of 4/4 with a full last Bar of rests, as one whole-Bar rest', () => {
    const root = parsed(scoresMusicXml(tapeInput({holes: [hole(60, 0, 8)], length: 40})));
    const measures = measuresOf(root);
    const last = defined(measures[1], 'last Bar');

    expect(measures).toHaveLength(2);
    expect(voiceSums(last)).toEqual({1: 32});
    expect(entriesOf(last)).toMatchObject([{rest: true, measureRest: true, duration: 32}]);
  });
});

describe('scoresMusicXml follows the Time signature changes of the Song (Story 1.4, Story 4.5)', () => {
  it('writes 4/4 Bars up to Column 64 and 3/4 from Column 64 (Story 1.4)', () => {
    // 480 Ticks per quarter and 60 Ticks per Column: Tick 3840 is Column 64, two 4/4 Bars before it.
    const song = songWithMetre([
      {start: at(0), beats: 4, beatType: 4},
      {start: at(3840), beats: 3, beatType: 4},
    ]);

    const measures = measuresOf(parsed(scoresMusicXml(tapeInput({song, holes: [hole(60, 0, 8)], length: 88}))));

    expect(measures.map(voiceSums)).toEqual([{1: 32}, {1: 32}, {1: 24}]);
    expect(measures.map(timesOf)).toEqual([['4/4'], [], ['3/4']]);
  });

  it('replaces several Song changes by the one Time signature chosen, for the whole Tape (Story 4.5)', () => {
    const song = songWithMetre([
      {start: at(0), beats: 3, beatType: 4},
      {start: at(1440), beats: 4, beatType: 4},
      {start: at(2880), beats: 6, beatType: 8},
    ]);
    const input = tapeInput({song, holes: [hole(60, 0, 8)], length: 64});

    const root = parsed(
      scoresMusicXml({...input, choices: {timeSignature: {beats: 2, beatType: 4}, upbeat: 0, splitNotes: []}}),
    );

    const measures = measuresOf(root);
    expect(measures.map(voiceSums)).toEqual([{1: 16}, {1: 16}, {1: 16}, {1: 16}]);
    expect(measures.map(timesOf)).toEqual([['2/4'], [], [], []]);
  });
});

/** A Tape of 10 000 Columns with 3 000 Holes on the reference Pipes: ten minutes of a busy barrel (SC-005). */
function tenMinuteHoles(): Hole[] {
  return Array.from({length: 3000}, (_, index) => {
    const pipeRow = index % 10;
    const slot = Math.floor(index / 10);
    return hole(60 + pipeRow, slot * 33 + (index % 7), 2 + (index % 11));
  });
}

describe('scoresMusicXml exports a generated 10-minute Tape in time (SC-005, T055)', () => {
  it('writes a Tape of 10 000 Columns and 3 000 Holes in under 5 seconds', () => {
    const input = tapeInput({holes: tenMinuteHoles(), length: 10000});

    const started = performance.now();
    const text = scoresMusicXml(input);
    const elapsed = performance.now() - started;

    expect(text).toContain('<score-partwise version="4.0">');
    expect(elapsed).toBeLessThan(5000);
  });
});
