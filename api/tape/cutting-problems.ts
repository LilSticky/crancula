import type {MidiNoteNumber} from '../organ/midi-note-number';
import {minimumHoleLength, type Millimetres, type Organ} from '../organ/organ';
import {holeLimitsOf} from './hole-fixes';
import type {Column, Hole, Tape} from './tape';

export type CuttingProblemCode = 'no-pipe' | 'too-short' | 'too-close';

/** Why a Tape can not be cut yet. Columns are counted from 0, as in the Tape. */
export type CuttingProblem =
  | {readonly code: 'no-pipe'; readonly pipe: MidiNoteNumber; readonly start: Column}
  | {
      readonly code: 'too-short';
      readonly pipe: MidiNoteNumber;
      readonly start: Column;
      readonly lengthMm: number;
      readonly minimumHoleLengthMm: Millimetres;
    }
  | {
      readonly code: 'too-close';
      readonly pipe: MidiNoteNumber;
      readonly start: Column;
      readonly nextStart: Column;
      /** 0 when the Holes touch; never negative on a valid Tape. */
      readonly gapMm: number;
      readonly minimumGapMm: Millimetres;
    };

const CODE_ORDER: readonly CuttingProblemCode[] = ['too-short', 'too-close', 'no-pipe'];

/**
 * Everything that keeps `tape` from being cut on `organ`: Holes without a Pipe, Holes below the
 * Minimum Hole Length and neighbours below the Minimum Gap. Compared in Columns, like `createTape`.
 */
export function cuttingProblems(tape: Tape, organ: Organ): readonly CuttingProblem[] {
  const limits = holeLimitsOf(organ, tape.columnLength);
  const mm = (columns: number): number => columns * tape.columnLength;
  const rowOf = new Map(organ.pipes.map((pipe, index) => [pipe.note, index]));
  const problems: CuttingProblem[] = [];

  const byStart = (a: Hole, b: Hole): number => a.start - b.start;
  const sorted = [...tape.holes].sort(byStart);
  const nextInRow = new Map<Hole, Hole>();
  const lastOfRow = new Map<MidiNoteNumber, Hole>();
  for (const hole of sorted) {
    const previous = lastOfRow.get(hole.pipe);
    if (previous !== undefined) nextInRow.set(previous, hole);
    lastOfRow.set(hole.pipe, hole);
  }

  for (const hole of sorted) {
    if (!rowOf.has(hole.pipe)) {
      problems.push({code: 'no-pipe', pipe: hole.pipe, start: hole.start});
      continue;
    }
    if (hole.length < limits.minimumHoleLength) {
      problems.push({
        code: 'too-short',
        pipe: hole.pipe,
        start: hole.start,
        lengthMm: mm(hole.length),
        minimumHoleLengthMm: minimumHoleLength(organ.tapeBed),
      });
    }
    const next = nextInRow.get(hole);
    if (next !== undefined && next.start - (hole.start + hole.length) < limits.minimumGap) {
      problems.push({
        code: 'too-close',
        pipe: hole.pipe,
        start: hole.start,
        nextStart: next.start,
        gapMm: mm(next.start - (hole.start + hole.length)),
        minimumGapMm: organ.minimumGap,
      });
    }
  }

  const row = (problem: CuttingProblem): number => rowOf.get(problem.pipe) ?? Number.POSITIVE_INFINITY;
  return problems.sort(
    (a, b) => a.start - b.start || row(a) - row(b) || CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code),
  );
}

/** A Hole by its Pipe and start Column. */
type HoleRef = Pick<Hole, 'pipe' | 'start'>;

/** A Cutting Problem seen from one Hole: a too-close pair marks both Holes. */
export type HoleProblem =
  | CuttingProblem
  | {
      readonly code: 'too-close-previous';
      readonly pipe: MidiNoteNumber;
      readonly start: Column;
      readonly previousStart: Column;
      readonly gapMm: number;
      readonly minimumGapMm: Millimetres;
    };

/** A Hole with at least one Cutting Problem. */
export interface HoleCuttingProblems {
  readonly hole: HoleRef;
  readonly problems: readonly HoleProblem[];
}

/** One entry per Hole that has a Cutting Problem, in the order of the problems; its length is the count shown. */
export function holesWithCuttingProblems(problems: readonly CuttingProblem[]): readonly HoleCuttingProblems[] {
  const entries = new Map<string, {hole: HoleRef; problems: HoleProblem[]}>();
  const add = (hole: HoleRef, problem: HoleProblem): void => {
    const key = `${hole.pipe}:${hole.start}`;
    const entry = entries.get(key) ?? {hole, problems: []};
    entry.problems.push(problem);
    entries.set(key, entry);
  };
  for (const problem of problems) {
    add({pipe: problem.pipe, start: problem.start}, problem);
    if (problem.code === 'too-close') {
      add(
        {pipe: problem.pipe, start: problem.nextStart},
        {
          code: 'too-close-previous',
          pipe: problem.pipe,
          start: problem.nextStart,
          previousStart: problem.start,
          gapMm: problem.gapMm,
          minimumGapMm: problem.minimumGapMm,
        },
      );
    }
  }
  return [...entries.values()];
}
