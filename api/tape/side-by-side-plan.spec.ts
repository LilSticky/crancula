import {describe, expect, it} from 'vitest';
import type {RollPlotter} from '../plotter/plotter';
import type {LaneInput} from './side-by-side-refusals';
import {sideBySideRefusals} from './side-by-side-refusals';
import {sideBySidePlan} from './side-by-side-plan';
import {sideBySideCut} from './side-by-side-cut';
import {plotterOf, referenceOrgan, referenceTape} from './tape-fixture';

/** The Vinyl cutter of spec 013: a roll Plotter with working width 300 mm and Tape spacing 3 mm. */
function rollPlotter(): RollPlotter {
  const plotter = plotterOf({
    name: 'Vinyl cutter',
    workingWidth: 300,
    roll: true,
    workingLength: null,
    overlap: null,
    tapeSpacing: 3,
  });
  if (!plotter.roll) throw new Error('expected a roll Plotter');
  return plotter;
}

const street = referenceOrgan();
const reference = referenceTape(street);

describe('sideBySidePlan', () => {
  it('is ok with the cut of the Lanes when no reason keeps them from being saved', () => {
    const plotter = rollPlotter();
    const lanes: readonly LaneInput[] = [{tape: reference, organ: street}];

    expect(sideBySidePlan(lanes, plotter)).toEqual({ok: true, cut: sideBySideCut([{tape: reference, organ: street}], plotter)});
  });

  it('is not ok, with the refusals of the Lanes, when a Lane does not fit the working width', () => {
    const plotter = rollPlotter();
    const lanes: readonly LaneInput[] = [
      {tape: reference, organ: street},
      {tape: reference, organ: street},
      {tape: reference, organ: street},
    ];

    expect(sideBySidePlan(lanes, plotter)).toEqual({
      ok: false,
      refusals: [{code: 'lane-does-not-fit', lane: 3, tapeName: 'Reference', needed: 103, free: 97}],
    });
    expect(sideBySidePlan(lanes, plotter)).toEqual({ok: false, refusals: sideBySideRefusals(lanes, plotter)});
  });

  it('is not ok without a roll Plotter, with the no-plotter refusal', () => {
    const lanes: readonly LaneInput[] = [{tape: reference, organ: street}];

    expect(sideBySidePlan(lanes, undefined)).toEqual({ok: false, refusals: [{code: 'no-plotter'}]});
  });
});
