import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {err, ok, type Result} from '../../result';
import {modeOf, type Mode} from '../song';
import type {XmlElement} from './xml';

export type ScoreRejection = 'not-a-score';

/** A Note as written: its position and length in divisions, the position from the start of its measure. */
export interface ScoreNote {
  readonly staff: number;
  readonly start: number;
  readonly length: number;
  /** The written pitch, before the transposition of its measure; `'unpitched'` for a Note without pitch. */
  readonly pitch: MidiNoteNumber | 'unpitched';
}

export interface ScoreTranspose {
  readonly chromatic: number;
  readonly octaveChange: number;
}

export interface ScoreTime {
  readonly beats: number;
  readonly beatType: number;
}

export interface ScoreKey {
  readonly fifths: number;
  readonly mode: Mode;
}

/** A measure of one part, with the attributes in force at it. */
export interface ScoreMeasure {
  readonly number: string;
  readonly divisions: number;
  readonly transpose: ScoreTranspose;
  readonly time: ScoreTime | undefined;
  readonly key: ScoreKey | undefined;
  readonly staves: number;
  /** The furthest position any voice reached, in divisions. */
  readonly length: number;
  readonly notes: readonly ScoreNote[];
}

export interface ScorePart {
  readonly id: string;
  readonly measures: readonly ScoreMeasure[];
}

/** Thrown inside the reader for any structure it cannot read; never leaves {@link scoreMeasures}. */
class NotAScore extends Error {}

function notAScore(): never {
  throw new NotAScore();
}

const INTEGER = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const STEP_SEMITONES: ReadonlyMap<string, number> = new Map([
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
  ['B', 11],
]);
const SEMITONES_PER_OCTAVE = 12;
const NO_TRANSPOSE: ScoreTranspose = {chromatic: 0, octaveChange: 0};
/** MusicXML requires divisions in the first measure; without them a quarter is read as one division. */
const DEFAULT_DIVISIONS = 1;
const DEFAULT_STAVES = 1;

/** What the attributes of a part give in force. */
interface Attributes {
  readonly divisions: number;
  readonly transpose: ScoreTranspose;
  readonly time: ScoreTime | undefined;
  readonly key: ScoreKey | undefined;
  readonly staves: number;
}

const NOTHING_IN_FORCE: Attributes = {
  divisions: DEFAULT_DIVISIONS,
  transpose: NO_TRANSPOSE,
  time: undefined,
  key: undefined,
  staves: DEFAULT_STAVES,
};

/** A measure as read from the tree: its number and the elements it is made of. */
interface MeasureSource {
  readonly number: string;
  readonly content: readonly XmlElement[];
}

interface PartSource {
  readonly id: string;
  readonly measures: readonly MeasureSource[];
}

function childrenNamed(parent: XmlElement, name: string): readonly XmlElement[] {
  return parent.children.filter((child) => child.name === name);
}

function childNamed(parent: XmlElement, name: string): XmlElement | undefined {
  return parent.children.find((child) => child.name === name);
}

function requiredChild(parent: XmlElement, name: string): XmlElement {
  return childNamed(parent, name) ?? notAScore();
}

function attributeOf(element: XmlElement, name: string): string {
  return element.attributes.get(name) ?? notAScore();
}

function textOf(element: XmlElement): string {
  return element.text.trim();
}

function integerOf(element: XmlElement, minimum: number): number {
  const text = textOf(element);
  const value = Number(text);
  return INTEGER.test(text) && Number.isSafeInteger(value) && value >= minimum ? value : notAScore();
}

/** The integer of the child `name`, or `undefined` when there is no such child. */
function integerIn(parent: XmlElement, name: string, minimum = Number.MIN_SAFE_INTEGER): number | undefined {
  const child = childNamed(parent, name);
  return child === undefined ? undefined : integerOf(child, minimum);
}

function requiredInteger(parent: XmlElement, name: string, minimum = Number.MIN_SAFE_INTEGER): number {
  return integerIn(parent, name, minimum) ?? notAScore();
}

function decimalIn(parent: XmlElement, name: string): number | undefined {
  const child = childNamed(parent, name);
  if (child === undefined) return undefined;
  const text = textOf(child);
  return DECIMAL.test(text) ? Number(text) : notAScore();
}

function timeOf(element: XmlElement): ScoreTime {
  return {beats: requiredInteger(element, 'beats', 1), beatType: requiredInteger(element, 'beat-type', 1)};
}

/** A key with a mode other than major or minor leaves no Key in force; a key without a mode is major. */
function keyOf(element: XmlElement): ScoreKey | undefined {
  const fifths = requiredInteger(element, 'fifths');
  const modeElement = childNamed(element, 'mode');
  const mode = modeOf(modeElement === undefined ? 'major' : textOf(modeElement));
  return mode === undefined ? undefined : {fifths, mode};
}

function transposeOf(element: XmlElement): ScoreTranspose {
  return {
    chromatic: requiredInteger(element, 'chromatic'),
    octaveChange: integerIn(element, 'octave-change') ?? 0,
  };
}

/** Applies one attributes element: each value it gives replaces the value in force. */
function withAttributes(inForce: Attributes, attributes: XmlElement): Attributes {
  const time = childNamed(attributes, 'time');
  const key = childNamed(attributes, 'key');
  const transpose = childNamed(attributes, 'transpose');
  return {
    divisions: integerIn(attributes, 'divisions', 1) ?? inForce.divisions,
    transpose: transpose === undefined ? inForce.transpose : transposeOf(transpose),
    time: time === undefined ? inForce.time : timeOf(time),
    key: key === undefined ? inForce.key : keyOf(key),
    staves: integerIn(attributes, 'staves', 1) ?? inForce.staves,
  };
}

/** The MIDI note number of a written pitch: C4 is 60, and an alter is rounded to the nearest semitone. */
function pitchOf(pitch: XmlElement): MidiNoteNumber {
  const step = STEP_SEMITONES.get(textOf(requiredChild(pitch, 'step'))) ?? notAScore();
  const octave = requiredInteger(pitch, 'octave');
  const alter = decimalIn(pitch, 'alter') ?? 0;
  return midiNoteNumber(Math.round((octave + 1) * SEMITONES_PER_OCTAVE + step + alter)) ?? notAScore();
}

function writtenPitchOf(note: XmlElement): MidiNoteNumber | 'unpitched' {
  return childNamed(note, 'unpitched') === undefined ? pitchOf(requiredChild(note, 'pitch')) : 'unpitched';
}

function staffOf(note: XmlElement): number {
  return integerIn(note, 'staff', 1) ?? 1;
}

/** The Notes and the length of one measure. The cursor moves with notes, rests, backup and forward. */
function bodyOf(content: readonly XmlElement[]): {readonly notes: ScoreNote[]; readonly length: number} {
  const notes: ScoreNote[] = [];
  let position = 0;
  let noteStart = 0;
  let length = 0;
  for (const element of content) {
    if (element.name === 'note') {
      // Grace notes have no duration and are not read yet.
      if (childNamed(element, 'grace') !== undefined) continue;
      const duration = requiredInteger(element, 'duration', 0);
      const isChord = childNamed(element, 'chord') !== undefined;
      if (!isChord) {
        noteStart = position;
        position += duration;
      }
      if (childNamed(element, 'rest') === undefined) {
        notes.push({staff: staffOf(element), start: noteStart, length: duration, pitch: writtenPitchOf(element)});
      }
      length = Math.max(length, noteStart + duration, position);
    } else if (element.name === 'backup') {
      position -= requiredInteger(element, 'duration', 0);
      if (position < 0) notAScore();
    } else if (element.name === 'forward') {
      position += requiredInteger(element, 'duration', 0);
      length = Math.max(length, position);
    }
  }
  return {notes, length};
}

/** One part: its measures in order, each with the attributes in force at it. */
function partOf(source: PartSource): ScorePart {
  const measures: ScoreMeasure[] = [];
  let inForce = NOTHING_IN_FORCE;
  for (const measure of source.measures) {
    inForce = measure.content
      .filter((element) => element.name === 'attributes')
      .reduce(withAttributes, inForce);
    const body = bodyOf(measure.content);
    measures.push({
      number: measure.number,
      divisions: inForce.divisions,
      transpose: inForce.transpose,
      time: inForce.time,
      key: inForce.key,
      staves: inForce.staves,
      length: body.length,
      notes: body.notes,
    });
  }
  return {id: source.id, measures};
}

function partwiseSources(root: XmlElement): readonly PartSource[] {
  return childrenNamed(root, 'part').map((part) => ({
    id: attributeOf(part, 'id'),
    measures: childrenNamed(part, 'measure').map((measure) => ({
      number: attributeOf(measure, 'number'),
      content: measure.children,
    })),
  }));
}

/** A score-timewise nests its parts in its measures; this regroups them by part, in order of appearance. */
function timewiseSources(root: XmlElement): readonly PartSource[] {
  const measuresById = new Map<string, MeasureSource[]>();
  for (const measure of childrenNamed(root, 'measure')) {
    const number = attributeOf(measure, 'number');
    for (const part of childrenNamed(measure, 'part')) {
      const id = attributeOf(part, 'id');
      const measures = measuresById.get(id) ?? [];
      measures.push({number, content: part.children});
      measuresById.set(id, measures);
    }
  }
  return [...measuresById].map(([id, measures]) => ({id, measures}));
}

function sourcesOf(root: XmlElement): readonly PartSource[] {
  switch (root.name) {
    case 'score-partwise':
      return partwiseSources(root);
    case 'score-timewise':
      return timewiseSources(root);
    default:
      return notAScore();
  }
}

/**
 * The parts of a score-partwise or score-timewise, each with its measures: the Notes with their written
 * position and length in divisions, and the attributes in force (research R5, R6). Never throws.
 */
export function scoreMeasures(root: XmlElement): Result<readonly ScorePart[], ScoreRejection> {
  try {
    return ok(sourcesOf(root).map(partOf));
  } catch (error) {
    if (error instanceof NotAScore) return err('not-a-score');
    throw error;
  }
}
