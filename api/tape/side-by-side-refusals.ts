import type {Millimetres, Organ} from '../organ/organ';
import type {RollPlotter} from '../plotter/plotter';
import {cuttingProblems, type HoleCuttingProblem} from './cutting-problems';
import {laneRoom, sideBySideCut, type LaneTape} from './side-by-side-cut';
import type {Tape} from './tape';

/** A Lane as the page holds it: its Tape, and the Organ of the Tape, `undefined` when the Organ is no longer there. */
export interface LaneInput {
  readonly tape: Tape;
  readonly organ: Organ | undefined;
}

/**
 * A reason a side-by-side cut can not be saved. Lanes are numbered from 1; Tapes are named as the user knows them.
 * `cutting-problems` names a Tape once, with the Cutting Problems of that Tape on its Organ.
 */
export type SideBySideRefusal =
  | {readonly code: 'no-plotter'}
  | {readonly code: 'no-lane'}
  | {readonly code: 'no-organ'; readonly lane: number; readonly tapeName: string}
  | {
      readonly code: 'lane-does-not-fit';
      readonly lane: number;
      readonly tapeName: string;
      /** The Tape's width, plus the Tape spacing before it. */
      readonly needed: Millimetres;
      /** The width left after the Lane before it, never negative. */
      readonly free: number;
    }
  | {
      readonly code: 'cutting-problems';
      readonly tapeName: string;
      readonly problems: readonly HoleCuttingProblem[];
    };

/**
 * Every reason the Lanes can not be saved on `plotter`, in reading order: no roll Plotter, no Lane, then per Lane a
 * Lane past the working width or a missing Organ, then the Cutting Problems of each Tape once. Without a Plotter the
 * width is not checked. A Lane after one without an Organ has no known width, so it is not checked for fit either.
 */
export function sideBySideRefusals(
  lanes: readonly LaneInput[],
  plotter: RollPlotter | undefined,
): readonly SideBySideRefusal[] {
  const missingPlotter: readonly SideBySideRefusal[] = plotter === undefined ? [{code: 'no-plotter'}] : [];
  const missingLanes: readonly SideBySideRefusal[] = lanes.length === 0 ? [{code: 'no-lane'}] : [];
  const placeable = placeableLanes(lanes);
  const notFitting = plotter === undefined ? [] : doesNotFitRefusals(placeable, plotter);
  const missingOrgans = lanes.flatMap((lane, index): SideBySideRefusal[] =>
    lane.organ === undefined ? [{code: 'no-organ', lane: index + 1, tapeName: lane.tape.name}] : [],
  );
  return [
    ...missingPlotter,
    ...missingLanes,
    ...notFitting,
    ...missingOrgans,
    ...cuttingProblemRefusals(lanes),
  ];
}

/** The Lanes up to the first one without an Organ: the ones whose width is known. */
function placeableLanes(lanes: readonly LaneInput[]): readonly LaneTape[] {
  const placed: LaneTape[] = [];
  for (const {tape, organ} of lanes) {
    if (organ === undefined) break;
    placed.push({tape, organ});
  }
  return placed;
}

/** One refusal per Lane that passes the working width, with the room it needs and the room left before it. */
function doesNotFitRefusals(lanes: readonly LaneTape[], plotter: RollPlotter): readonly SideBySideRefusal[] {
  return sideBySideCut(lanes, plotter).lanes.flatMap((lane, index): SideBySideRefusal[] => {
    if (lane.fits) return [];
    const room = laneRoom(sideBySideCut(lanes.slice(0, index), plotter), lane.organ.tapeBed.tapeWidth);
    return [
      {
        code: 'lane-does-not-fit',
        lane: lane.number,
        tapeName: lane.tape.name,
        needed: room.needed,
        free: Math.max(0, room.free),
      },
    ];
  });
}

/** One refusal per distinct Tape with Cutting Problems, in the order of its first Lane. */
function cuttingProblemRefusals(lanes: readonly LaneInput[]): readonly SideBySideRefusal[] {
  const firstLanes = lanes.filter(
    (lane, index) => lane.organ !== undefined && lanes.findIndex((other) => other.tape.id === lane.tape.id) === index,
  );
  return firstLanes.flatMap(({tape, organ}): SideBySideRefusal[] => {
    if (organ === undefined) return [];
    const problems = cuttingProblems(tape, organ);
    return problems.length === 0 ? [] : [{code: 'cutting-problems', tapeName: tape.name, problems}];
  });
}
