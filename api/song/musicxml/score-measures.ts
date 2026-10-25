import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {err, ok, type Result} from '../../result';
import type {Mode} from '../song';
import type {XmlElement} from './xml';

export type ScoreRejection = 'not-a-score';

/** A Note as written: its position and length in divisions, the position from the start of its measure. */
export interface ScoreNote {
  readonly staff: number;
  readonly start: number;
  readonly length: number;
  /**
   * The written pitch, before the transposition of its measure. An unpitched Note has the `midi-unpitched` of its
   * instrument, else its display pitch, where the notation puts it; `'unpitched'` when it has neither.
   */
  readonly pitch: MidiNoteNumber | 'unpitched';
  /** A grace Note: no duration, so length 0; its start is where it is written. */
  readonly grace: boolean;
  /** A Note with `<chord/>`: it sounds with the Note before it. */
  readonly chord: boolean;
  /** From its `<tie type="start"/>` and `<tie type="stop"/>`. */
  readonly tie: {readonly start: boolean; readonly stop: boolean};
  /** Anything in its `<ornaments>` (trill, mordent, turn, tremolo, …). */
  readonly ornament: boolean;
  /** An `<arpeggiate/>`; written on each Note of an arpeggiated chord. */
  readonly arpeggiate: boolean;
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

/** The repeat, ending and jump marks of a measure, from its barlines, sounds and words (research R7). */
export interface MeasureMarks {
  /** A forward repeat barline on the measure. */
  readonly repeatForward: boolean;
  /** A backward repeat barline on the measure, with the times it is played; `undefined` when there is none. */
  readonly repeatBackward: {readonly times: number} | undefined;
  /** The ending numbers of the measure, `[]` when it is in no ending. */
  readonly endings: readonly number[];
  readonly segno: boolean;
  readonly coda: boolean;
  readonly toCoda: boolean;
  readonly fine: boolean;
  readonly daCapo: boolean;
  readonly dalSegno: boolean;
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
  readonly marks: MeasureMarks;
}

export interface ScorePart {
  readonly id: string;
  readonly measures: readonly ScoreMeasure[];
  /**
   * The staves that are percussion: a percussion clef was in force on them in some measure, or all their
   * Notes are unpitched (research R8).
   */
  readonly percussionStaves: ReadonlySet<number>;
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
const NO_STAVES: ReadonlySet<number> = new Set();
/** MusicXML plays a repeat twice when its barline writes no times. */
const DEFAULT_REPEAT_TIMES = 2;
/** The jump words, matched in lower case: "D.C." or "Da Capo", "D.S." or "Dal Segno", "Fine", "To Coda". */
const DA_CAPO_WORDS = /\bd\.c\.|\bda capo\b/;
const DAL_SEGNO_WORDS = /\bd\.s\.|\bdal segno\b/;
const FINE_WORDS = /\bfine\b/;
const TO_CODA_WORDS = /\bto coda\b/;

/** What the attributes of a part give in force. */
interface Attributes {
  readonly divisions: number;
  readonly transpose: ScoreTranspose;
  readonly time: ScoreTime | undefined;
  readonly key: ScoreKey | undefined;
  readonly staves: number;
  /** The staves whose clef in force is a percussion clef. */
  readonly percussionStaves: ReadonlySet<number>;
}

const NOTHING_IN_FORCE: Attributes = {
  divisions: DEFAULT_DIVISIONS,
  transpose: NO_TRANSPOSE,
  time: undefined,
  key: undefined,
  staves: DEFAULT_STAVES,
  percussionStaves: NO_STAVES,
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

/** The beats of a Time signature: an integer, or a sum such as `3+2` (5). */
const BEATS_SUM = /^\d+(\+\d+)*$/;

/** A Time signature; `senza-misura` (free time) gives none, which is `undefined`. */
function timeOf(element: XmlElement): ScoreTime | undefined {
  if (childNamed(element, 'senza-misura') !== undefined) return undefined;
  const beatsText = textOf(requiredChild(element, 'beats'));
  const beats = BEATS_SUM.test(beatsText)
    ? beatsText.split('+').reduce((sum, part) => sum + Number(part), 0)
    : notAScore();
  return {beats: beats >= 1 ? beats : notAScore(), beatType: requiredInteger(element, 'beat-type', 1)};
}

/** The minor modes; every other mode, and no mode, is read as major with its fifths (research R9). */
const MINOR_MODES: ReadonlySet<string> = new Set(['minor', 'aeolian']);

function keyOf(element: XmlElement): ScoreKey {
  const fifths = requiredInteger(element, 'fifths');
  const modeElement = childNamed(element, 'mode');
  const mode: Mode = modeElement !== undefined && MINOR_MODES.has(textOf(modeElement)) ? 'minor' : 'major';
  return {fifths, mode};
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
    percussionStaves: percussionStavesAfter(inForce.percussionStaves, attributes),
  };
}

/** The MIDI note number of a step, octave and alter: C4 is 60, and an alter is rounded to the nearest semitone. */
function midiOf(stepName: string, octave: number, alter: number): MidiNoteNumber | undefined {
  const step = STEP_SEMITONES.get(stepName);
  if (step === undefined) return undefined;
  return midiNoteNumber(Math.round((octave + 1) * SEMITONES_PER_OCTAVE + step + alter));
}

function pitchOf(pitch: XmlElement): MidiNoteNumber {
  const stepName = textOf(requiredChild(pitch, 'step'));
  const octave = requiredInteger(pitch, 'octave');
  return midiOf(stepName, octave, decimalIn(pitch, 'alter') ?? 0) ?? notAScore();
}

/** The display pitch of an unpitched Note, where the notation puts its notehead; `'unpitched'` when none is written. */
function displayPitchOf(unpitched: XmlElement): MidiNoteNumber | 'unpitched' {
  const step = childNamed(unpitched, 'display-step');
  const octave = integerIn(unpitched, 'display-octave');
  if (step === undefined || octave === undefined) return 'unpitched';
  return midiOf(textOf(step), octave, 0) ?? 'unpitched';
}

/**
 * The MIDI note number of each instrument of the part-list that has a `midi-unpitched`. MusicXML counts them from 1,
 * MIDI note numbers from 0.
 */
function instrumentNumbersOf(root: XmlElement): ReadonlyMap<string, MidiNoteNumber> {
  const numbers = new Map<string, MidiNoteNumber>();
  const partList = childNamed(root, 'part-list');
  if (partList === undefined) return numbers;
  for (const scorePart of childrenNamed(partList, 'score-part')) {
    for (const midiInstrument of childrenNamed(scorePart, 'midi-instrument')) {
      const unpitched = childNamed(midiInstrument, 'midi-unpitched');
      if (unpitched === undefined) continue;
      const number = midiNoteNumber(integerOf(unpitched, 1) - 1) ?? notAScore();
      numbers.set(attributeOf(midiInstrument, 'id'), number);
    }
  }
  return numbers;
}

/**
 * The written pitch of a Note: a pitched Note has its pitch; an unpitched one its instrument's number, else its
 * display pitch.
 */
function writtenPitchOf(
  note: XmlElement,
  instruments: ReadonlyMap<string, MidiNoteNumber>,
): MidiNoteNumber | 'unpitched' {
  const unpitched = childNamed(note, 'unpitched');
  if (unpitched === undefined) return pitchOf(requiredChild(note, 'pitch'));
  const instrumentId = childNamed(note, 'instrument')?.attributes.get('id');
  const instrumentNumber = instrumentId === undefined ? undefined : instruments.get(instrumentId);
  return instrumentNumber ?? displayPitchOf(unpitched);
}

/** The staff a clef belongs to: its number, 1 when it has none. */
function clefStaffOf(clef: XmlElement): number {
  const number = clef.attributes.get('number');
  if (number === undefined) return DEFAULT_STAVES;
  const staff = Number(number);
  return INTEGER.test(number) && Number.isSafeInteger(staff) && staff >= 1 ? staff : notAScore();
}

/** The staves that are percussion after the clefs of one attributes element: each clef sets its own staff. */
function percussionStavesAfter(inForce: ReadonlySet<number>, attributes: XmlElement): ReadonlySet<number> {
  return childrenNamed(attributes, 'clef').reduce<ReadonlySet<number>>((staves, clef) => {
    const next = new Set(staves);
    const staff = clefStaffOf(clef);
    if (textOf(requiredChild(clef, 'sign')) === 'percussion') next.add(staff);
    else next.delete(staff);
    return next;
  }, inForce);
}

function staffOf(note: XmlElement): number {
  return integerIn(note, 'staff', 1) ?? 1;
}

/** The `<notations>` of a note: a note may have several. */
function notationsOf(note: XmlElement): readonly XmlElement[] {
  return childrenNamed(note, 'notations');
}

/** The tie types of a note, from its `<tie>` elements (its sound, not its notation). */
function tieOf(note: XmlElement): {readonly start: boolean; readonly stop: boolean} {
  const types = childrenNamed(note, 'tie').map((tie) => tie.attributes.get('type'));
  return {start: types.includes('start'), stop: types.includes('stop')};
}

/** A note has an ornament when its `<ornaments>` has anything in it. */
function ornamentOf(note: XmlElement): boolean {
  return notationsOf(note)
    .flatMap((notation) => childrenNamed(notation, 'ornaments'))
    .some((ornaments) => ornaments.children.length > 0);
}

/** What one measure holds: its Notes, its length, and which staves have pitched or unpitched Notes in it. */
interface MeasureBody {
  readonly notes: ScoreNote[];
  readonly length: number;
  readonly pitchedStaves: Set<number>;
  readonly unpitchedStaves: Set<number>;
}

/** The Notes and the length of one measure. The cursor moves with notes, rests, backup and forward. */
function bodyOf(
  content: readonly XmlElement[],
  instruments: ReadonlyMap<string, MidiNoteNumber>,
): MeasureBody {
  const notes: ScoreNote[] = [];
  const pitchedStaves = new Set<number>();
  const unpitchedStaves = new Set<number>();
  let position = 0;
  let noteStart = 0;
  let length = 0;
  for (const element of content) {
    if (element.name === 'note') {
      const isGrace = childNamed(element, 'grace') !== undefined;
      const isChord = childNamed(element, 'chord') !== undefined;
      // A grace Note has no duration and takes no time: it starts where the cursor is and does not move it.
      const duration = isGrace ? 0 : requiredInteger(element, 'duration', 0);
      if (isGrace) {
        noteStart = position;
      } else if (!isChord) {
        noteStart = position;
        position += duration;
      }
      if (childNamed(element, 'rest') === undefined) {
        const staff = staffOf(element);
        if (childNamed(element, 'unpitched') === undefined) pitchedStaves.add(staff);
        else unpitchedStaves.add(staff);
        notes.push({
          staff,
          start: noteStart,
          length: duration,
          pitch: writtenPitchOf(element, instruments),
          grace: isGrace,
          chord: isChord,
          tie: tieOf(element),
          ornament: ornamentOf(element),
          arpeggiate: notationsOf(element).some((notation) => childNamed(notation, 'arpeggiate') !== undefined),
        });
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
  return {notes, length, pitchedStaves, unpitchedStaves};
}

/** The times a backward repeat is played: as written, else the MusicXML default. */
function repeatTimesOf(repeat: XmlElement): number {
  const times = repeat.attributes.get('times');
  return times !== undefined && INTEGER.test(times) && Number(times) >= 1 ? Number(times) : DEFAULT_REPEAT_TIMES;
}

/** The ending numbers of an ending, "1, 2" giving both; a token that is no integer is left out. */
function endingNumbersOf(ending: XmlElement): readonly number[] {
  return (ending.attributes.get('number') ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => INTEGER.test(token))
    .map(Number);
}

/** A sound flag is given when its attribute is present and not "no"; a segno or coda names its own id. */
function soundFlagOf(sound: XmlElement, name: string): boolean {
  const value = sound.attributes.get(name);
  return value !== undefined && value !== 'no';
}

/** The repeat, ending and jump marks of a measure, from its own barlines, sounds, signs and words. */
function marksOf(content: readonly XmlElement[]): MeasureMarks {
  const barlines = content.filter((element) => element.name === 'barline');
  const repeats = barlines.flatMap((barline) => childrenNamed(barline, 'repeat'));
  const backward = repeats.find((repeat) => repeat.attributes.get('direction') === 'backward');
  const directions = content.filter((element) => element.name === 'direction');
  const sounds = directions.flatMap((direction) => childrenNamed(direction, 'sound'));
  const directionTypes = directions.flatMap((direction) => childrenNamed(direction, 'direction-type'));
  const words = directionTypes
    .flatMap((directionType) => childrenNamed(directionType, 'words'))
    .map((element) => textOf(element).toLowerCase());
  const signed = (name: string): boolean =>
    directionTypes.some((directionType) => childNamed(directionType, name) !== undefined);
  const soundSays = (name: string): boolean => sounds.some((sound) => soundFlagOf(sound, name));
  const wordsSay = (pattern: RegExp): boolean => words.some((text) => pattern.test(text));
  const endings = barlines.flatMap((barline) =>
    childrenNamed(barline, 'ending').flatMap((ending) => endingNumbersOf(ending)),
  );
  return {
    repeatForward: repeats.some((repeat) => repeat.attributes.get('direction') === 'forward'),
    repeatBackward: backward === undefined ? undefined : {times: repeatTimesOf(backward)},
    endings: [...new Set(endings)],
    segno: signed('segno') || soundSays('segno'),
    coda: signed('coda') || soundSays('coda'),
    toCoda: soundSays('tocoda') || wordsSay(TO_CODA_WORDS),
    fine: soundSays('fine') || wordsSay(FINE_WORDS),
    daCapo: soundSays('dacapo') || wordsSay(DA_CAPO_WORDS),
    dalSegno: soundSays('dalsegno') || wordsSay(DAL_SEGNO_WORDS),
  };
}

/** One part: its measures in order, each with the attributes in force at it. */
function partOf(source: PartSource, instruments: ReadonlyMap<string, MidiNoteNumber>): ScorePart {
  const measures: ScoreMeasure[] = [];
  const percussionStaves = new Set<number>();
  const pitchedStaves = new Set<number>();
  const unpitchedStaves = new Set<number>();
  let inForce = NOTHING_IN_FORCE;
  for (const measure of source.measures) {
    inForce = measure.content
      .filter((element) => element.name === 'attributes')
      .reduce(withAttributes, inForce);
    const body = bodyOf(measure.content, instruments);
    for (const staff of inForce.percussionStaves) percussionStaves.add(staff);
    for (const staff of body.pitchedStaves) pitchedStaves.add(staff);
    for (const staff of body.unpitchedStaves) unpitchedStaves.add(staff);
    measures.push({
      number: measure.number,
      divisions: inForce.divisions,
      transpose: inForce.transpose,
      time: inForce.time,
      key: inForce.key,
      staves: inForce.staves,
      length: body.length,
      notes: body.notes,
      marks: marksOf(measure.content),
    });
  }
  for (const staff of unpitchedStaves) {
    if (!pitchedStaves.has(staff)) percussionStaves.add(staff);
  }
  return {id: source.id, measures, percussionStaves};
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
    const instruments = instrumentNumbersOf(root);
    return ok(sourcesOf(root).map((source) => partOf(source, instruments)));
  } catch (error) {
    if (error instanceof NotAScore) return err('not-a-score');
    throw error;
  }
}
