import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import type {Song, TimeSignature} from '../song/song';
import {columnOfTick} from '../tape/quantisation';
import {songKeepsBarsOnColumns} from './scores-bars';

/** The beat types the export dialog offers (FR-004); the Song model also allows 64. */
export type ScoresBeatType = 1 | 2 | 4 | 8 | 16 | 32;

/** The beat types the export dialog offers, in the order it lists them. */
export const SCORES_BEAT_TYPES: readonly ScoresBeatType[] = [1, 2, 4, 8, 16, 32];

/** A Time signature chosen for the whole Tape in the export dialog. */
export interface ChosenTimeSignature {
  /** Whole, 1–99. */
  readonly beats: number;
  readonly beatType: ScoresBeatType;
}

/** What one export uses; prefilled, never stored on the Tape (spec: "Export choices"). */
export interface ScoresChoices {
  /** 'song': the Song's Time signatures at their Columns; else one for the whole Tape. */
  readonly timeSignature: 'song' | ChosenTimeSignature;
  /** In Columns; 0 is no upbeat. */
  readonly upbeat: number;
  /** Sorted ascending, distinct, each 0–127; empty is one staff. */
  readonly splitNotes: readonly MidiNoteNumber[];
}

/**
 * What the export dialog holds before it is valid: numbers or null, never stored (FR-004). Only
 * {@link ScoresChoices} reach the writer.
 */
export interface ScoresChoicesInput {
  readonly timeSignature: 'song' | { readonly beats: number | null; readonly beatType: number | null };
  /** The upbeat as a count of a note value: 1 × 1/4 is one quarter; a count of 0 is no upbeat. */
  readonly upbeat: { readonly count: number | null; readonly noteValue: number | null };
  /** The split notes as the dialog holds them, in any order; the ones that are not MIDI notes are violations. */
  readonly splitNotes: readonly number[];
}

/** A value of the export choices that the dialog must correct before the Scores can be written. */
export interface ScoresChoicesViolation {
  readonly field: 'splitNotes';
  readonly code: 'not-distinct' | 'out-of-range';
}

/** The split note that a Organ with Pipes on both sides of it is prefilled with: middle C (FR-005). */
const MIDDLE_C = 60 as MidiNoteNumber;
const FOUR_FOUR: Pick<TimeSignature, 'beats' | 'beatType'> = {beats: 4, beatType: 4};
const NO_UPBEAT = {count: 0, noteValue: 4};
/** Columns in a whole note: a 1/32 note is one Column (DICTIONARY). */
const COLUMNS_PER_WHOLE = 32;

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** The Song's upbeat as a count of a note value in lowest terms, from its Columns (research R3). */
function upbeatOf(song: Song): ScoresChoicesInput['upbeat'] {
  if (song.upbeat === undefined) return NO_UPBEAT;
  const columns: number = columnOfTick(song.upbeat, song.ticksPerQuarter);
  if (columns === 0) return NO_UPBEAT;
  const divisor = greatestCommonDivisor(columns, COLUMNS_PER_WHOLE);
  return {count: columns / divisor, noteValue: COLUMNS_PER_WHOLE / divisor};
}

/** The remembered split notes, else middle C when the Organ has Pipes on both sides of it, else none. */
function splitNotesOf(organ: Organ, remembered: readonly MidiNoteNumber[] | undefined): readonly MidiNoteNumber[] {
  if (remembered !== undefined) return remembered;
  const pitches = organ.pipes.map((pipe) => pipe.note);
  const belowMiddleC = pitches.some((pitch) => pitch < MIDDLE_C);
  const atOrAboveMiddleC = pitches.some((pitch) => pitch >= MIDDLE_C);
  return belowMiddleC && atOrAboveMiddleC ? [MIDDLE_C] : [];
}

/**
 * The choices an export dialog starts with (FR-004, FR-005). The Song's Time signatures and upbeat are kept
 * only when the Song keeps its Bars on Columns; otherwise 4/4 and no upbeat. Nothing here is stored.
 */
export function prefilledScoresChoices(
  organ: Organ,
  song: Song | undefined,
  rememberedSplitNotes: readonly MidiNoteNumber[] | undefined,
): ScoresChoicesInput {
  const splitNotes = splitNotesOf(organ, rememberedSplitNotes);
  if (song === undefined || !songKeepsBarsOnColumns(song)) {
    return {timeSignature: {...FOUR_FOUR}, upbeat: NO_UPBEAT, splitNotes};
  }
  return {timeSignature: 'song', upbeat: upbeatOf(song), splitNotes};
}

function isBeatType(value: number): value is ScoresBeatType {
  return (SCORES_BEAT_TYPES as readonly number[]).includes(value);
}

/** Whether no two of the values are equal. */
function isDistinct(values: readonly number[]): boolean {
  return new Set(values).size === values.length;
}

/** The violations of the split notes: a value that is not a MIDI note, and two equal split notes (FR-005). */
function splitNoteViolationsOf(splitNotes: readonly number[]): readonly ScoresChoicesViolation[] {
  const violations: ScoresChoicesViolation[] = [];
  if (splitNotes.some((value) => midiNoteNumber(value) === undefined)) {
    violations.push({field: 'splitNotes', code: 'out-of-range'});
  }
  if (!isDistinct(splitNotes)) violations.push({field: 'splitNotes', code: 'not-distinct'});
  return violations;
}

/**
 * The violations the export dialog must show before Export is enabled (FR-004, FR-005, data-model.md). Split
 * notes only for now; the Time signature and upbeat rules follow.
 */
export function validateScoresChoices(
  input: ScoresChoicesInput,
  song: Song | undefined,
): readonly ScoresChoicesViolation[] {
  return splitNoteViolationsOf(input.splitNotes);
}

/** The split notes as MIDI notes sorted ascending, or undefined when one of them is not a MIDI note. */
function sortedSplitNotesOf(splitNotes: readonly number[]): readonly MidiNoteNumber[] | undefined {
  const notes: MidiNoteNumber[] = [];
  for (const value of splitNotes) {
    const note = midiNoteNumber(value);
    if (note === undefined) return undefined;
    notes.push(note);
  }
  return notes.sort((a, b) => a - b);
}

/**
 * The choices the Scores are written with, or undefined while the dialog holds a value that is not yet a choice
 * (a missing number, a beat type it does not offer, an upbeat that is not a whole number of Columns, split notes
 * that are not distinct MIDI notes).
 */
export function scoresChoicesOf(input: ScoresChoicesInput): ScoresChoices | undefined {
  const timeSignature = chosenTimeSignatureOf(input.timeSignature);
  const upbeat = upbeatColumnsOf(input.upbeat);
  const splitNotes = sortedSplitNotesOf(input.splitNotes);
  if (timeSignature === undefined || upbeat === undefined || splitNotes === undefined) return undefined;
  if (!isDistinct(input.splitNotes)) return undefined;
  return {timeSignature, upbeat, splitNotes};
}

function chosenTimeSignatureOf(input: ScoresChoicesInput['timeSignature']): ScoresChoices['timeSignature'] | undefined {
  if (input === 'song') return 'song';
  if (input.beats === null || input.beatType === null || !isBeatType(input.beatType)) return undefined;
  return {beats: input.beats, beatType: input.beatType};
}

/** The upbeat in Columns: its count of a note value, where a 1/32 note is one Column; undefined unless a whole number. */
function upbeatColumnsOf(upbeat: ScoresChoicesInput['upbeat']): number | undefined {
  if (upbeat.count === null || upbeat.noteValue === null) return undefined;
  const columns = (upbeat.count * COLUMNS_PER_WHOLE) / upbeat.noteValue;
  return Number.isInteger(columns) && columns >= 0 ? columns : undefined;
}
