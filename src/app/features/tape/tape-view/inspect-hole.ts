import {minimumHoleLength, noteName, type Hole, type Organ, type Tape} from '@api/index';

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
  const previous = sameRow[index - 1];
  const end = hole.start + hole.length;
  const mm = (columns: number): number => columns * tape.columnLength;

  const gap: HoleGap =
    next === undefined
      ? {to: 'tapeEnd', columns: tape.length - end, mm: mm(tape.length - end)}
      : {to: 'nextHole', columns: next.start - end, mm: mm(next.start - end)};

  const warnings: HoleWarning[] = [];
  const minimumLength = minimumHoleLength(organ.tapeBed);
  if (mm(hole.length) < minimumLength) warnings.push({kind: 'tooShort', mm: mm(hole.length), minimumMm: minimumLength});

  const gapsMm = [
    ...(next === undefined ? [] : [gap.mm]),
    ...(previous === undefined ? [] : [mm(hole.start - (previous.start + previous.length))]),
  ];
  const smallest = Math.min(...gapsMm);
  if (gapsMm.length > 0 && smallest < organ.minimumGap) warnings.push({kind: 'gapTooSmall', mm: smallest, minimumMm: organ.minimumGap});

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
