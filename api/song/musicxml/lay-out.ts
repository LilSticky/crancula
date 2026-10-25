import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {beatTypeOf, tick, ticksPerQuarter, type Key, type Tick, type TicksPerQuarter, type TimeSignature} from '../song';
import type {LeftOut} from '../read-song-source';
import type {ScoreKey, ScoreMeasure, ScoreNote, ScorePart, ScoreTime, ScoreTranspose} from './score-measures';

export interface LaidOutNote {
  /** The sounding pitch. */
  readonly noteNumber: MidiNoteNumber;
  readonly start: Tick;
  readonly duration: Tick;
}

/** The Notes of one staff of one part, the voices of the staff together. */
export interface LaidOutStaff {
  /** The index of the part in the parts given to {@link layOut}. */
  readonly part: number;
  readonly staff: number;
  /** Sorted by start, then note number. */
  readonly notes: readonly LaidOutNote[];
  /**
   * The grace notes and ornaments of the staff, counted in played-out order (research R8): each grace note once,
   * each Note with an ornament once, each arpeggiated chord once. `0` and `0` when there are none.
   */
  readonly leftOut: LeftOut;
}

export interface LaidOut {
  readonly ticksPerQuarter: TicksPerQuarter;
  /** One entry per part and staff that has Notes, in part then staff order. */
  readonly staves: readonly LaidOutStaff[];
  /** From the first part: each Time signature at the Tick where its Bar starts, sorted; `[]` for free time. */
  readonly timeSignatures: readonly TimeSignature[];
  /** The length of the first played measure when it is a shorter upbeat; `undefined` when it is not. */
  readonly upbeat: Tick | undefined;
  /** From the first part: each Key at its Tick, sorted; equal Keys in a row are kept once. */
  readonly keys: readonly Key[];
}

const FALLBACK_TICKS_PER_QUARTER = 960;
const MAXIMUM_TICKS_PER_QUARTER = 32767;
/** The most beats a Bar of a Song may have (song.ts). */
const MAXIMUM_BEATS = 99;
/** The most fifths a Key of a Song may have (song.ts). */
const MAXIMUM_FIFTHS = 7;
const SEMITONES_PER_OCTAVE = 12;
const MINIMUM_MIDI_NOTE = 0;
const MAXIMUM_MIDI_NOTE = 127;

/** A staff being filled, keyed by part and staff. */
interface StaffBuild {
  readonly part: number;
  readonly staff: number;
  readonly notes: LaidOutNote[];
  /**
   * Per note number, the index in `notes` of the Note that waits for the next Note of that pitch in the staff to
   * join it through a tie. Voices of the staff and the Notes of a chord wait apart.
   */
  readonly waiting: Map<MidiNoteNumber, number>;
  graceNotes: number;
  ornaments: number;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** @returns the least common multiple, or `undefined` when it exceeds {@link MAXIMUM_TICKS_PER_QUARTER} */
function leastCommonMultiple(values: ReadonlySet<number>): number | undefined {
  let multiple = 1;
  for (const value of values) {
    multiple = (multiple / greatestCommonDivisor(multiple, value)) * value;
    if (multiple > MAXIMUM_TICKS_PER_QUARTER) return undefined;
  }
  return multiple;
}

/** The Ticks per quarter of the parts: the least common multiple of their divisions, else 960 (research R6). */
function ticksPerQuarterOf(parts: readonly ScorePart[]): TicksPerQuarter {
  const divisions = new Set(parts.flatMap((part) => part.measures.map((measure) => measure.divisions)));
  return knownTicksPerQuarter(leastCommonMultiple(divisions) ?? FALLBACK_TICKS_PER_QUARTER);
}

/** The value is one that the caller has checked to lie in the range of Ticks per quarter. */
function knownTicksPerQuarter(value: number): TicksPerQuarter {
  const checked = ticksPerQuarter(value);
  if (checked === undefined) throw new RangeError(`${value} is not a number of Ticks per quarter`);
  return checked;
}

function knownTick(value: number): Tick {
  const checked = tick(value);
  if (checked === undefined) throw new RangeError(`${value} is not a Tick`);
  return checked;
}

/** A position or length in divisions, in Ticks, rounded to the nearest Tick (research R6). */
function ticksOf(divisionsValue: number, divisions: number, perQuarter: TicksPerQuarter): number {
  return Math.round((divisionsValue * perQuarter) / divisions);
}

/** Folds a sounding pitch by whole octaves into the MIDI range, so that no written Note is lost (SC-003). */
function foldIntoMidiRange(sounding: number): MidiNoteNumber {
  let folded = sounding;
  if (folded > MAXIMUM_MIDI_NOTE) {
    folded -= SEMITONES_PER_OCTAVE * Math.ceil((folded - MAXIMUM_MIDI_NOTE) / SEMITONES_PER_OCTAVE);
  }
  if (folded < MINIMUM_MIDI_NOTE) {
    folded += SEMITONES_PER_OCTAVE * Math.ceil((MINIMUM_MIDI_NOTE - folded) / SEMITONES_PER_OCTAVE);
  }
  return knownMidiNoteNumber(folded);
}

function knownMidiNoteNumber(value: number): MidiNoteNumber {
  const checked = midiNoteNumber(value);
  if (checked === undefined) throw new RangeError(`${value} is not a MIDI note number`);
  return checked;
}

/** The sounding pitch: the written pitch plus the transposition in force, folded into the MIDI range. */
function soundingPitchOf(written: MidiNoteNumber, transpose: ScoreTranspose): MidiNoteNumber {
  return foldIntoMidiRange(written + transpose.chromatic + SEMITONES_PER_OCTAVE * transpose.octaveChange);
}

function byStartThenNoteNumber(a: LaidOutNote, b: LaidOutNote): number {
  return a.start - b.start || a.noteNumber - b.noteNumber;
}

function staffFor(staves: Map<string, StaffBuild>, part: number, staff: number): StaffBuild {
  const key = `${part}/${staff}`;
  const existing = staves.get(key);
  if (existing !== undefined) return existing;
  const created: StaffBuild = {part, staff, notes: [], waiting: new Map(), graceNotes: 0, ornaments: 0};
  staves.set(key, created);
  return created;
}

/** Adds the Notes of one measure, which starts at `measureStart` Ticks, to their staves. */
function addMeasure(
  staves: Map<string, StaffBuild>,
  partIndex: number,
  measure: ScoreMeasure,
  measureStart: number,
  perQuarter: TicksPerQuarter,
): void {
  for (const note of measure.notes) {
    addNote(staves, partIndex, note, measure, measureStart, perQuarter);
  }
}

/**
 * Adds a Note to its staff. A grace note is no Note (research R8). A Note that waits for a tie is joined with the
 * next Note of its pitch in its staff when that one starts exactly where the waiting Note ends; another Note of
 * its pitch ends the waiting Note as written.
 */
function addNote(
  staves: Map<string, StaffBuild>,
  partIndex: number,
  note: ScoreNote,
  measure: ScoreMeasure,
  measureStart: number,
  perQuarter: TicksPerQuarter,
): void {
  const build = staffFor(staves, partIndex, note.staff);
  if (note.grace) {
    build.graceNotes += 1;
    return;
  }
  // A Note counts once, for an ornament or an arpeggiate. An arpeggiate is written on each Note of a chord; the
  // chord is counted once, at its first Note.
  if (note.ornament || (note.arpeggiate && !note.chord)) build.ornaments += 1;
  const noteNumber = soundingPitchOf(note.pitch, measure.transpose);
  const start = knownTick(measureStart + ticksOf(note.start, measure.divisions, perQuarter));
  const duration = knownTick(ticksOf(note.length, measure.divisions, perQuarter));
  const waitingIndex = build.waiting.get(noteNumber);
  const waiting = waitingIndex === undefined ? undefined : build.notes[waitingIndex];
  build.waiting.delete(noteNumber);
  if (waitingIndex !== undefined && waiting !== undefined && waiting.start + waiting.duration === start) {
    build.notes[waitingIndex] = {noteNumber, start: waiting.start, duration: knownTick(waiting.duration + duration)};
    if (note.tie.start) build.waiting.set(noteNumber, waitingIndex);
    return;
  }
  build.notes.push({noteNumber, start, duration});
  if (note.tie.start) build.waiting.set(noteNumber, build.notes.length - 1);
}

/** A Time signature as a Song keeps it, or `undefined` when the Score writes one a Song cannot keep. */
function timeSignatureOf(time: ScoreTime | undefined): Omit<TimeSignature, 'start'> | undefined {
  if (time === undefined || time.beats > MAXIMUM_BEATS) return undefined;
  const beatType = beatTypeOf(time.beatType);
  return beatType === undefined ? undefined : {beats: time.beats, beatType};
}

/** The length of a Bar in Ticks, exact as in song.ts. */
function barLengthOf(time: Omit<TimeSignature, 'start'>, perQuarter: TicksPerQuarter): number {
  return (time.beats * perQuarter * 4) / time.beatType;
}

/** A Key as a Song keeps it, or `undefined` when the Score writes one a Song cannot keep. */
function keyOf(key: ScoreKey | undefined): Omit<Key, 'start'> | undefined {
  return key === undefined || Math.abs(key.fifths) > MAXIMUM_FIFTHS ? undefined : {fifths: key.fifths, mode: key.mode};
}

/** The Time signatures, Keys and upbeat kept so far, of the first part, in played-out order (research R9). */
interface MetreBuild {
  readonly timeSignatures: TimeSignature[];
  readonly keys: Key[];
  upbeat: Tick | undefined;
  /** The Time signature of the measure before, `undefined` for free time. */
  timeInForce: Omit<TimeSignature, 'start'> | undefined;
  /** The Key of the measure before, `undefined` before the first Key. */
  keyInForce: Omit<Key, 'start'> | undefined;
  /** Whether the measure before is of irregular length, so that the Bar after it starts with its Time signature again. */
  afterIrregular: boolean;
}

/** Replaces the last entry when it starts at the same Tick, as a later one in the same place is the one in force. */
function setAt<T extends {readonly start: Tick}>(entries: T[], entry: T): void {
  if (entries.at(-1)?.start === entry.start) entries[entries.length - 1] = entry;
  else entries.push(entry);
}

function sameTimeSignature(a: Omit<TimeSignature, 'start'>, b: Omit<TimeSignature, 'start'> | undefined): boolean {
  return b !== undefined && a.beats === b.beats && a.beatType === b.beatType;
}

function sameKey(a: Omit<Key, 'start'>, b: Omit<Key, 'start'> | undefined): boolean {
  return b !== undefined && a.fifths === b.fifths && a.mode === b.mode;
}

/** Adds the metre of a measure of the first part, which starts at `start` Ticks; `first` when it is the first played. */
function addMetre(build: MetreBuild, measure: ScoreMeasure, start: number, first: boolean, perQuarter: TicksPerQuarter): void {
  const length = ticksOf(measure.length, measure.divisions, perQuarter);
  const time = timeSignatureOf(measure.time);
  const startTick = knownTick(start);
  if (time !== undefined) {
    if (!sameTimeSignature(time, build.timeInForce) || build.afterIrregular) {
      setAt(build.timeSignatures, {start: startTick, ...time});
    }
    if (first && length > 0 && length < barLengthOf(time, perQuarter)) build.upbeat = knownTick(length);
  }
  build.afterIrregular = time !== undefined && length !== barLengthOf(time, perQuarter);
  build.timeInForce = time;

  const key = keyOf(measure.key);
  if (key !== undefined && !sameKey(key, build.keyInForce)) setAt(build.keys, {start: startTick, ...key});
  build.keyInForce = key;
}

/**
 * Lays the parts out on one timeline, the measures in the order given (repeats are played out by the caller).
 * Each measure starts where the one before it ends; its length is the longest of its parts (research R6).
 * The Time signatures, upbeat and Keys come from the first part (research R9).
 */
export function layOut(parts: readonly ScorePart[], playedOrder: readonly number[]): LaidOut {
  const perQuarter = ticksPerQuarterOf(parts);
  const staves = new Map<string, StaffBuild>();
  const lead = parts[0];
  const metre: MetreBuild = {
    timeSignatures: [],
    keys: [],
    upbeat: undefined,
    timeInForce: undefined,
    keyInForce: undefined,
    afterIrregular: false,
  };
  let measureStart = 0;
  for (const [position, index] of playedOrder.entries()) {
    let measureLength = 0;
    for (const [partIndex, part] of parts.entries()) {
      const measure = part.measures[index];
      if (measure === undefined) continue;
      addMeasure(staves, partIndex, measure, measureStart, perQuarter);
      measureLength = Math.max(measureLength, ticksOf(measure.length, measure.divisions, perQuarter));
    }
    const leadMeasure = lead?.measures[index];
    if (leadMeasure !== undefined) addMetre(metre, leadMeasure, measureStart, position === 0, perQuarter);
    measureStart += measureLength;
  }
  return {
    ticksPerQuarter: perQuarter,
    staves: [...staves.values()]
      .sort((a, b) => a.part - b.part || a.staff - b.staff)
      .map((build) => ({
        part: build.part,
        staff: build.staff,
        notes: build.notes.sort(byStartThenNoteNumber),
        leftOut: {graceNotes: build.graceNotes, ornaments: build.ornaments},
      })),
    timeSignatures: metre.timeSignatures,
    upbeat: metre.upbeat,
    keys: metre.keys,
  };
}
