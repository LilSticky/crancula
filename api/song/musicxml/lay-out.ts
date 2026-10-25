import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {tick, ticksPerQuarter, type Tick, type TicksPerQuarter} from '../song';
import type {LeftOut} from '../read-song-source';
import type {ScoreMeasure, ScoreNote, ScorePart, ScoreTranspose} from './score-measures';

export interface LaidOutNote {
  /** The sounding pitch; `'unpitched'` for a Note without pitch. */
  readonly noteNumber: MidiNoteNumber | 'unpitched';
  readonly start: Tick;
  readonly duration: Tick;
}

/** The Notes of one staff of one part, the voices of the staff together. */
export interface LaidOutStaff {
  /** The index of the part in the parts given to {@link layOut}. */
  readonly part: number;
  readonly staff: number;
  /** Sorted by start, then note number; unpitched Notes first among equal starts. */
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
}

const FALLBACK_TICKS_PER_QUARTER = 960;
const MAXIMUM_TICKS_PER_QUARTER = 32767;
const SEMITONES_PER_OCTAVE = 12;
const MINIMUM_MIDI_NOTE = 0;
const MAXIMUM_MIDI_NOTE = 127;
const UNPITCHED_KEY = -1;

/** A staff being filled, keyed by part and staff. */
interface StaffBuild {
  readonly part: number;
  readonly staff: number;
  readonly notes: LaidOutNote[];
  /** The index in `notes` of the Note that waits for the next Note of the staff to join it through a tie. */
  waiting: number | undefined;
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
function soundingPitchOf(written: MidiNoteNumber | 'unpitched', transpose: ScoreTranspose): MidiNoteNumber | 'unpitched' {
  if (written === 'unpitched') return 'unpitched';
  return foldIntoMidiRange(written + transpose.chromatic + SEMITONES_PER_OCTAVE * transpose.octaveChange);
}

function noteKey(note: LaidOutNote): number {
  return note.noteNumber === 'unpitched' ? UNPITCHED_KEY : note.noteNumber;
}

function byStartThenNoteNumber(a: LaidOutNote, b: LaidOutNote): number {
  return a.start - b.start || noteKey(a) - noteKey(b);
}

function staffFor(staves: Map<string, StaffBuild>, part: number, staff: number): StaffBuild {
  const key = `${part}/${staff}`;
  const existing = staves.get(key);
  if (existing !== undefined) return existing;
  const created: StaffBuild = {part, staff, notes: [], waiting: undefined, graceNotes: 0, ornaments: 0};
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
 * Whether the Note that waits for a tie joins the next Note of its staff: the same MIDI note number, starting
 * exactly where the waiting Note ends. An unpitched Note joins nothing.
 */
function tieJoins(waiting: LaidOutNote, noteNumber: MidiNoteNumber | 'unpitched', start: Tick): boolean {
  return noteNumber !== 'unpitched' && waiting.noteNumber === noteNumber && waiting.start + waiting.duration === start;
}

/**
 * Adds a Note to its staff. A grace note is no Note (research R8). A Note that waits for a tie is joined with the
 * next Note of its staff when that one joins it; any other next Note ends the waiting Note as written.
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
  if (note.ornament) build.ornaments += 1;
  // An arpeggiate is written on each Note of a chord; the chord is counted once, at its first Note.
  if (note.arpeggiate && !note.chord) build.ornaments += 1;
  const noteNumber = soundingPitchOf(note.pitch, measure.transpose);
  const start = knownTick(measureStart + ticksOf(note.start, measure.divisions, perQuarter));
  const duration = knownTick(ticksOf(note.length, measure.divisions, perQuarter));
  const waitingIndex = build.waiting;
  const waiting = waitingIndex === undefined ? undefined : build.notes[waitingIndex];
  build.waiting = undefined;
  if (waitingIndex !== undefined && waiting !== undefined && tieJoins(waiting, noteNumber, start)) {
    build.notes[waitingIndex] = {noteNumber, start: waiting.start, duration: knownTick(waiting.duration + duration)};
    build.waiting = note.tie.start ? waitingIndex : undefined;
    return;
  }
  build.notes.push({noteNumber, start, duration});
  if (note.tie.start) build.waiting = build.notes.length - 1;
}

/**
 * Lays the parts out on one timeline, the measures in the order given (repeats are played out by the caller).
 * Each measure starts where the one before it ends; its length is the longest of its parts (research R6).
 */
export function layOut(parts: readonly ScorePart[], playedOrder: readonly number[]): LaidOut {
  const perQuarter = ticksPerQuarterOf(parts);
  const staves = new Map<string, StaffBuild>();
  let measureStart = 0;
  for (const index of playedOrder) {
    let measureLength = 0;
    for (const [partIndex, part] of parts.entries()) {
      const measure = part.measures[index];
      if (measure === undefined) continue;
      addMeasure(staves, partIndex, measure, measureStart, perQuarter);
      measureLength = Math.max(measureLength, ticksOf(measure.length, measure.divisions, perQuarter));
    }
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
  };
}
