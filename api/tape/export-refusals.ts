import type {Organ} from '../organ/organ';
import type {Plotter} from '../plotter/plotter';
import {cuttingProblems, type CuttingProblem} from './cutting-problems';
import type {Tape} from './tape';
import {tapeGeometry} from './tape-geometry';
import {tapePieces} from './tape-pieces';

/** The Tape is wider than the working width of the picked Plotter (FR-017). */
export interface TooWideRefusal {
  readonly code: 'too-wide';
}

/** A reason a Tape can not be saved for the picked Plotter: too wide, or a Cutting Problem. */
export type ExportRefusal = CuttingProblem | TooWideRefusal;

/**
 * Why `tape` can not be saved for `plotter` (FR-019): too wide first, then the Cutting Problems. Without a Plotter only the
 * Cutting Problems count. Empty when the Tape can be saved.
 */
export function exportRefusals(tape: Tape, organ: Organ, plotter: Plotter | undefined): readonly ExportRefusal[] {
  const problems = cuttingProblems(tape, organ, plotter);
  if (plotter === undefined) return problems;
  const cut = tapePieces(tapeGeometry(tape, organ), plotter);
  return cut.kind === 'too-wide' ? [{code: 'too-wide'}, ...problems] : problems;
}
