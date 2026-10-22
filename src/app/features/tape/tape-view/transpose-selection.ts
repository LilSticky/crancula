import {column, type HoleRef, type Organ, type Tape} from '@api/index';
import type {HoleSelection} from './hole-selection';

/** Transposing needs a Hole whose Pipe the Organ has. */
export function canTranspose(tape: Tape, organ: Organ): boolean {
  return tape.holes.some((hole) => organ.pipes.some((pipe) => pipe.note === hole.pipe));
}

/** The selected Holes by Pipe and start Column; a row without a Pipe is skipped. */
export function holeRefsOf(selection: HoleSelection, organ: Organ): readonly HoleRef[] {
  return selection.flatMap(({row, start}) => {
    const pipe = organ.pipes[row - 1]?.note;
    const startColumn = column(start);
    return pipe === undefined || startColumn === undefined ? [] : [{pipe, start: startColumn}];
  });
}

/** The selection of the named Holes, by the row of their Pipe; a Pipe not on the Organ is skipped. */
export function selectionOfRefs(refs: readonly HoleRef[], organ: Organ): HoleSelection {
  return refs.flatMap(({pipe, start}) => {
    const row = organ.pipes.findIndex((candidate) => candidate.note === pipe) + 1;
    return row > 0 ? [{row, start}] : [];
  });
}
