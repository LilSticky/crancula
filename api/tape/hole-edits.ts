import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import {err, ok, type Result} from '../result';
import {holeLimitsOf} from './hole-fixes';
import {column, columnCount, validTape, type Column, type ColumnCount, type Hole, type Tape} from './tape';

/** Names a Hole of a Tape: a Pipe has at most one Hole at a start. */
export type HoleRef = Pick<Hole, 'pipe' | 'start'>;

export interface HoleEdit {
  readonly tape: Tape;
  /** The added, moved or changed Hole as it is now. */
  readonly hole: Hole;
}

export type HoleEditRefusal =
  | {readonly code: 'no-such-hole'}
  | {readonly code: 'not-on-the-organ'; readonly pipe: MidiNoteNumber}
  | {readonly code: 'overlaps'; readonly other: Hole};

function sameHole(a: HoleRef, b: HoleRef): boolean {
  return a.pipe === b.pipe && a.start === b.start;
}

function byPipeThenStart(a: Hole, b: Hole): number {
  return a.pipe - b.pipe || a.start - b.start;
}

function withHoles(tape: Tape, holes: readonly Hole[]): Tape {
  const end = Math.max(0, ...holes.map((hole) => hole.start + hole.length));
  const length = columnCount(Math.max(tape.length, end)) ?? tape.length;
  const result = validTape({...tape, length, holes: [...holes].sort(byPipeThenStart)});
  if (!result.ok) throw new Error(`editing a Hole broke a Tape rule: ${result.error.code}`);
  return result.value;
}

/** Replaces `target` (or adds, without one) by `replacement`, unless the replacement covers a Column of another Hole of its Pipe. */
function replaceHole(tape: Tape, target: HoleRef | undefined, replacement: Hole): Result<HoleEdit, HoleEditRefusal> {
  const others = tape.holes.filter((hole) => target === undefined || !sameHole(hole, target));
  const replacementEnd = replacement.start + replacement.length;
  const other = others.find(
    (hole) =>
      hole.pipe === replacement.pipe &&
      hole.start < replacementEnd &&
      replacement.start < hole.start + hole.length,
  );
  if (other) return err({code: 'overlaps', other});
  return ok({tape: withHoles(tape, [...others, replacement]), hole: replacement});
}

function find(tape: Tape, ref: HoleRef): Hole | undefined {
  return tape.holes.find((hole) => sameHole(hole, ref));
}

/** Moves the Hole along its row and/or to another Pipe of the Organ; keeps its length. */
export function moveHole(
  tape: Tape,
  organ: Organ,
  hole: HoleRef,
  to: {readonly pipe: MidiNoteNumber; readonly start: Column},
): Result<HoleEdit, HoleEditRefusal> {
  const existing = find(tape, hole);
  if (existing === undefined) return err({code: 'no-such-hole'});
  if (!organ.pipes.some((pipe) => pipe.note === to.pipe)) return err({code: 'not-on-the-organ', pipe: to.pipe});
  return replaceHole(tape, hole, {...existing, pipe: to.pipe, start: to.start});
}

/** Gives the Hole a new start and length on its Pipe: moves either end, or both. */
export function changeHoleLength(
  tape: Tape,
  hole: HoleRef,
  to: {readonly start: Column; readonly length: ColumnCount},
): Result<HoleEdit, HoleEditRefusal> {
  const existing = find(tape, hole);
  if (existing === undefined) return err({code: 'no-such-hole'});
  return replaceHole(tape, hole, {...existing, start: to.start, length: to.length});
}

/** Removes the Hole; the Tape keeps its length. */
export function removeHole(tape: Tape, hole: HoleRef): Result<Tape, HoleEditRefusal> {
  if (find(tape, hole) === undefined) return err({code: 'no-such-hole'});
  return ok(withHoles(tape, tape.holes.filter((other) => !sameHole(other, hole))));
}

/** Adds a Hole at `start` on the Pipe: the Minimum Hole Length, shortened to stop at the next Hole of the Pipe. */
export function addHole(
  tape: Tape,
  organ: Organ,
  pipe: MidiNoteNumber,
  start: Column,
): Result<HoleEdit, HoleEditRefusal> {
  if (!organ.pipes.some((candidate) => candidate.note === pipe)) return err({code: 'not-on-the-organ', pipe});
  const minimum = holeLimitsOf(organ, tape.columnLength).minimumHoleLength;
  const next = tape.holes.find((hole) => hole.pipe === pipe && hole.start > start);
  const length = next === undefined ? minimum : (columnCount(Math.min(minimum, next.start - start)) ?? minimum);
  return replaceHole(tape, undefined, {pipe, start, length});
}

/** The Hole of `pipe` that covers the Column (from its start to its last Column), or `undefined` on a free Column. */
export function holeCovering(tape: Tape, pipe: MidiNoteNumber, at: Column): Hole | undefined {
  return tape.holes.find((hole) => hole.pipe === pipe && hole.start <= at && at < hole.start + hole.length);
}

/** The first Column after the selected Hole that no Hole of its Pipe covers; Column 0 without a selected Hole. */
export function firstFreeColumnAfter(tape: Tape, selected: HoleRef | undefined): Column {
  const hole = selected && find(tape, selected);
  if (hole === undefined) return 0 as Column;
  let free = hole.start + hole.length;
  const covering = (): Hole | undefined => {
    const at = column(free);
    return at === undefined ? undefined : holeCovering(tape, hole.pipe, at);
  };
  for (let next = covering(); next !== undefined; next = covering()) free = next.start + next.length;
  return free as Column;
}
