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

/** The reference Organ of spec 003 (Pipes 60 to 69), with the given Tape per Crank turn in millimetres. */
function organWith(tapePerCrankTurn: number | null): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Reference organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn,
    pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
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
