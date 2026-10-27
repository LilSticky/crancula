import type {RollPlotter} from '../plotter/plotter';
import {sideBySideCut, type LaneTape, type SideBySideCut} from './side-by-side-cut';
import {sideBySideRefusals, type LaneInput, type SideBySideRefusal} from './side-by-side-refusals';

/** A side-by-side cut that can be saved, or the reasons it can not. */
export type SideBySidePlan =
  | {readonly ok: true; readonly cut: SideBySideCut}
  | {readonly ok: false; readonly refusals: readonly SideBySideRefusal[]};

/**
 * The cut of the Lanes on `plotter`, once every Lane has its Organ; undefined without a roll Plotter or while a Lane
 * has no Organ. It is the layout to show, whether or not the Lanes can be saved.
 */
export function sideBySideLayout(lanes: readonly LaneInput[], plotter: RollPlotter | undefined): SideBySideCut | undefined {
  if (plotter === undefined) return undefined;
  const ready = lanes.flatMap(({tape, organ}): LaneTape[] => (organ === undefined ? [] : [{tape, organ}]));
  return ready.length === lanes.length ? sideBySideCut(ready, plotter) : undefined;
}

/** The cut of the Lanes when no reason keeps them from being saved, otherwise every such reason. */
export function sideBySidePlan(lanes: readonly LaneInput[], plotter: RollPlotter | undefined): SideBySidePlan {
  const refusals = sideBySideRefusals(lanes, plotter);
  const cut = sideBySideLayout(lanes, plotter);
  if (cut === undefined || refusals.length > 0) return {ok: false, refusals};
  return {ok: true, cut};
}
