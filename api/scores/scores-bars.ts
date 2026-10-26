import type {Key, Song, Tick, TicksPerQuarter, TimeSignature} from '../song/song';
import {columnOfTick} from '../tape/quantisation';
import type {Column, ColumnCount, Tape} from '../tape/tape';
import type {ChosenTimeSignature, ScoresChoices} from './scores-choices';

type MetreFields = Pick<TimeSignature, 'beats' | 'beatType'>;
type KeyFields = Pick<Key, 'fifths' | 'mode'>;

/** A Bar of the Scores: number 0 for the upbeat, then 1, 2, …; the last one is full (FR-011). */
export interface Bar {
  readonly number: number;
  readonly start: Column;
  readonly length: ColumnCount;
  readonly timeSignature: MetreFields;
  readonly key: KeyFields;
  /** True on the first Bar and where the Time signature differs from the Bar before (FR-014). */
  readonly showsTimeSignature: boolean;
  /** True on the first Bar and where the Key differs from the Bar before (FR-014). */
  readonly showsKey: boolean;
}

/** A value in force from a Column on, in Columns (research R3, R4). */
interface Change<T> {
  readonly column: number;
  readonly value: T;
}

/** The Time signature of a Tape without one at Column 0 (research R3). */
const COMMON_TIME: MetreFields = {beats: 4, beatType: 4};
/** The Key of a Tape without a Song, or a Song without Keys (research R4). */
const C_MAJOR: KeyFields = {fifths: 0, mode: 'major'};

/** Columns in a full Bar: 32 Columns make a whole note (research R3). */
export function fullBarColumns(timeSignature: MetreFields): number {
  return (timeSignature.beats * 32) / timeSignature.beatType;
}

/** The Column of each item, in the order given; a later item on one Column replaces an earlier one. */
function changesOf<Item extends { readonly start: Tick }, T>(
  items: readonly Item[],
  perQuarter: TicksPerQuarter,
  valueOf: (item: Item) => T,
): readonly Change<T>[] {
  const byColumn = new Map<number, T>();
  for (const item of items) byColumn.set(columnOfTick(item.start, perQuarter), valueOf(item));
  return [...byColumn].map(([column, value]) => ({column, value}));
}

/** The value of the last change at or before `at`, or `fallback` before the first one. */
function valueAt<T>(changes: readonly Change<T>[], fallback: T, at: number): T {
  let found = fallback;
  for (const change of changes) {
    if (change.column <= at) found = change.value;
  }
  return found;
}

/** The first Column after `at` where a Time signature changes, or infinity when none does. */
function nextChangeAfter<T>(changes: readonly Change<T>[], at: number): number {
  return changes.find((change) => change.column > at)?.column ?? Number.POSITIVE_INFINITY;
}

/**
 * True when the Song has Time signatures and every one of its Bars is a whole number of Columns. A 3/64
 * Bar is 1.5 Columns, so such a Song cannot keep its Bars on Columns (research R3).
 */
export function songKeepsBarsOnColumns(song: Song): boolean {
  return song.timeSignatures.length > 0 && song.timeSignatures.every((each) => Number.isInteger(fullBarColumns(each)));
}

/** The Time signature changes of the Tape: its one chosen Time signature, or the Song's (FR-004). */
function metreChangesOf(song: Song | undefined, chosen: 'song' | ChosenTimeSignature): readonly Change<MetreFields>[] {
  if (chosen !== 'song') return [{column: 0, value: chosen}];
  if (song === undefined) return [];
  if (!songKeepsBarsOnColumns(song)) throw new Error('the Time signatures of this Song do not fall on Columns');
  return changesOf(song.timeSignatures, song.ticksPerQuarter, ({beats, beatType}) => ({beats, beatType}));
}

function sameMetre(a: MetreFields, b: MetreFields): boolean {
  return a.beats === b.beats && a.beatType === b.beatType;
}

function sameKey(a: KeyFields, b: KeyFields): boolean {
  return a.fifths === b.fifths && a.mode === b.mode;
}

/**
 * The Bars that cover the Tape from Column 0 (research R3, R4). The Time signature is the chosen one or the
 * Song's; a Bar ends short where the Time signature changes. The upbeat is Bar 0 when there is one, and the
 * Bars after it count from 1. The Key of a Bar is the one in force at its last Column, so a Key starting in
 * the Bar applies from its start.
 */
export function scoresBars(tape: Tape, song: Song | undefined, choices: ScoresChoices): readonly Bar[] {
  const metre = metreChangesOf(song, choices.timeSignature);
  const keys = song === undefined ? [] : changesOf(song.keys, song.ticksPerQuarter, ({fifths, mode}) => ({fifths, mode}));

  const bars: Bar[] = [];
  let start = 0;
  let number = choices.upbeat > 0 ? 0 : 1;
  while (start < tape.length) {
    const timeSignature = valueAt(metre, COMMON_TIME, start);
    const nominal = number === 0 ? choices.upbeat : fullBarColumns(timeSignature);
    const length = Math.min(nominal, nextChangeAfter(metre, start) - start);
    const key = valueAt(keys, C_MAJOR, start + length - 1);
    const previous = bars.at(-1);
    bars.push({
      number,
      start: start as Column,
      length: length as ColumnCount,
      timeSignature,
      key,
      showsTimeSignature: previous === undefined || !sameMetre(previous.timeSignature, timeSignature),
      showsKey: previous === undefined || !sameKey(previous.key, key),
    });
    start += length;
    number = number === 0 ? 1 : number + 1;
  }
  return bars;
}
