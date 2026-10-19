import {
  changeHoleLength,
  column,
  columnCount,
  moveHole,
  removeHole,
  type Hole,
  type HoleEditRefusal,
  type Organ,
  type Result,
  type Tape,
} from '@api/index';
import type {EditIntent} from './edit-keys';
import type {DragTarget, HoleDrag} from './hole-drag';
import type {SelectableHole} from './hole-selection';

/** What an edit of one Hole comes to: a new Tape with the selection, a refusal to explain, or no change. */
export type EditOutcome =
  | {readonly kind: 'applied'; readonly tape: Tape; readonly selection: SelectableHole | undefined}
  | {readonly kind: 'refused'; readonly other: Hole}
  | {readonly kind: 'nothing'};

const NOTHING: EditOutcome = {kind: 'nothing'};

function edited(result: Result<{readonly tape: Tape}, HoleEditRefusal>, selection: SelectableHole): EditOutcome {
  if (result.ok) return {kind: 'applied', tape: result.value.tape, selection};
  return result.error.code === 'overlaps' ? {kind: 'refused', other: result.error.other} : NOTHING;
}

/** After a Hole is gone, the next Hole of its row is selected, else the previous one. */
function neighbourOf(tape: Tape, removed: Hole, row: number): SelectableHole | undefined {
  const sameRow = tape.holes.filter((hole) => hole.pipe === removed.pipe && hole.start !== removed.start);
  const next = sameRow.filter((hole) => hole.start > removed.start).sort((a, b) => a.start - b.start)[0];
  const previous = sameRow.filter((hole) => hole.start < removed.start).sort((a, b) => b.start - a.start)[0];
  const neighbour = next ?? previous;
  return neighbour === undefined ? undefined : {row, start: neighbour.start};
}

/** The result of an edit key on the selected Hole. */
export function keyEdit(tape: Tape, organ: Organ, selected: SelectableHole, intent: EditIntent): EditOutcome {
  const pipe = organ.pipes[selected.row - 1]?.note;
  const hole = tape.holes.find((candidate) => candidate.pipe === pipe && candidate.start === selected.start);
  if (hole === undefined) return NOTHING;
  switch (intent.kind) {
    case 'remove': {
      const result = removeHole(tape, hole);
      return result.ok ? {kind: 'applied', tape: result.value, selection: neighbourOf(tape, hole, selected.row)} : NOTHING;
    }
    case 'move-column': {
      const start = column(hole.start + intent.by);
      return start === undefined ? NOTHING : edited(moveHole(tape, organ, hole, {pipe: hole.pipe, start}), {row: selected.row, start});
    }
    case 'move-row': {
      const row = selected.row + intent.by;
      const to = organ.pipes[row - 1]?.note;
      return to === undefined ? NOTHING : edited(moveHole(tape, organ, hole, {pipe: to, start: hole.start}), {row, start: hole.start});
    }
    case 'move-end': {
      const length = columnCount(hole.length + intent.by);
      return length === undefined ? NOTHING : edited(changeHoleLength(tape, hole, {start: hole.start, length}), selected);
    }
    case 'move-start': {
      const start = column(hole.start + intent.by);
      const length = columnCount(hole.length - intent.by);
      if (start === undefined || length === undefined) return NOTHING;
      return edited(changeHoleLength(tape, hole, {start, length}), {row: selected.row, start});
    }
  }
}

/** The result of dragging a part of a Hole to `target`. */
export function dragEdit(tape: Tape, organ: Organ, drag: HoleDrag, target: DragTarget | undefined): EditOutcome {
  if (target === undefined) return NOTHING;
  const {hole} = drag;
  if (target.part === 'body') {
    if (target.pipe === hole.pipe && target.start === hole.start) return NOTHING;
    const row = organ.pipes.findIndex((pipe) => pipe.note === target.pipe) + 1;
    return edited(moveHole(tape, organ, hole, {pipe: target.pipe, start: target.start}), {row, start: target.start});
  }
  if (target.start === hole.start && target.length === hole.length) return NOTHING;
  return edited(changeHoleLength(tape, hole, {start: target.start, length: target.length}), {row: drag.hole.row, start: target.start});
}
