import {cuttingProblems, noteName, type Hole, type Organ, type Tape} from '@api/index';

export interface HoleGap {
  /** What the gap runs to: the next Hole of the row, or the end of the Tape. */
  readonly to: 'nextHole' | 'tapeEnd';
  readonly columns: number;
  readonly mm: number;
}

export interface HoleWarning {
  readonly kind: 'tooShort' | 'gapTooSmall';
  readonly mm: number;
  readonly minimumMm: number;
}

export interface HoleInspection {
  /** Counted from 1. */
  readonly row: number;
  readonly noteName: string;
  /** The first and last Column the Hole covers, counted from 1. */
  readonly fromColumn: number;
  readonly toColumn: number;
  readonly lengthColumns: number;
  readonly lengthMm: number;
  readonly gap: HoleGap;
  readonly warnings: readonly HoleWarning[];
}

/** What the Selected Hole section tells about `hole` of `tape`, with the limits of `organ` as warnings. */
export function inspectHole(tape: Tape, organ: Organ, hole: Hole): HoleInspection {
  const sameRow = tape.holes.filter(({pipe}) => pipe === hole.pipe).sort((a, b) => a.start - b.start);
  const index = sameRow.indexOf(hole);
  const next = sameRow[index + 1];
  const end = hole.start + hole.length;
  const mm = (columns: number): number => columns * tape.columnLength;

  const gap: HoleGap =
    next === undefined
      ? {to: 'tapeEnd', columns: tape.length - end, mm: mm(tape.length - end)}
      : {to: 'nextHole', columns: next.start - end, mm: mm(next.start - end)};

  const warnings = warningsOf(tape, organ, hole);

  const pipeIndex = organ.pipes.findIndex(({note}) => note === hole.pipe);
  return {
    row: pipeIndex + 1,
    noteName: noteName(hole.pipe),
    fromColumn: hole.start + 1,
    toColumn: end,
    lengthColumns: hole.length,
    lengthMm: mm(hole.length),
    gap,
    warnings,
  };
}

/** The export problems that concern `hole`: its own length and the gaps to both neighbours in its row. */
function warningsOf(tape: Tape, organ: Organ, hole: Hole): HoleWarning[] {
  const warnings: HoleWarning[] = [];
  const gaps: {readonly mm: number; readonly minimumMm: number}[] = [];
  for (const problem of cuttingProblems(tape, organ)) {
    if (problem.pipe !== hole.pipe) continue;
    if (problem.code === 'too-short' && problem.start === hole.start) {
      warnings.push({kind: 'tooShort', mm: problem.lengthMm, minimumMm: problem.minimumHoleLengthMm});
    } else if (problem.code === 'too-close' && (problem.start === hole.start || problem.nextStart === hole.start)) {
      gaps.push({mm: problem.gapMm, minimumMm: problem.minimumGapMm});
    }
  }
  const smallest = gaps.reduce<{readonly mm: number; readonly minimumMm: number} | undefined>(
    (least, gap) => (least === undefined || gap.mm < least.mm ? gap : least),
    undefined,
  );
  if (smallest !== undefined) warnings.push({kind: 'gapTooSmall', ...smallest});
  return warnings;
}
