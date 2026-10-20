import {noteName, type HoleProblem} from '@api/index';
import {formatNumber} from '../../shared/format-number';

/** A translation key with its parameters. */
export interface ProblemText {
  readonly key: string;
  readonly params: Readonly<Record<string, string>>;
}

/** The translated text of a Cutting Problem, with mm values and Columns (from 1) written for the language. */
export function cuttingProblemText(problem: HoleProblem, language: string): ProblemText {
  const mm = (value: number): string => formatNumber(value, language);
  const base = {note: noteName(problem.pipe), column: String(problem.start + 1)};
  switch (problem.code) {
    case 'no-pipe':
      return {key: 'TAPE.CUTTING_PROBLEM.NO_PIPE', params: base};
    case 'too-short':
      return {
        key: 'TAPE.CUTTING_PROBLEM.TOO_SHORT',
        params: {...base, length: mm(problem.lengthMm), minimum: mm(problem.minimumHoleLengthMm)},
      };
    case 'too-close':
      return {
        key: 'TAPE.CUTTING_PROBLEM.TOO_CLOSE',
        params: {...base, next: String(problem.nextStart + 1), gap: mm(problem.gapMm), minimum: mm(problem.minimumGapMm)},
      };
    case 'too-close-previous':
      return {
        key: 'TAPE.CUTTING_PROBLEM.TOO_CLOSE_PREVIOUS',
        params: {...base, previous: String(problem.previousStart + 1), gap: mm(problem.gapMm), minimum: mm(problem.minimumGapMm)},
      };
  }
}
