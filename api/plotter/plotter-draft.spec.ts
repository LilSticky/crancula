import {describe, expect, it} from 'vitest';
import {type Plotter, type PlotterId, plotterId} from './plotter';
import {draftOf, emptyPlotterDraft, type PlotterDraft} from './plotter-draft';
import {validatePlotter} from './validate-plotter';

const STORED_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function idOf(value: string): PlotterId {
  const id = plotterId(value);
  if (id === undefined) throw new Error(`invalid test id ${value}`);
  return id;
}

/** Validates a draft that is known to be valid, so that a test can start from a real Plotter. */
function plotterOf(draft: PlotterDraft): Plotter {
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test draft: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('emptyPlotterDraft', () => {
  it('is a sheet Plotter with the default Overlap and nothing else filled in', () => {
    expect(emptyPlotterDraft()).toEqual({
      name: '',
      workingWidth: null,
      roll: false,
      workingLength: null,
      overlap: 20,
    });
  });
});

describe('draftOf', () => {
  it('copies all fields of a sheet Plotter', () => {
    const plotter = plotterOf({
      ...emptyPlotterDraft(),
      id: idOf(STORED_ID),
      name: 'Cutting mat',
      workingWidth: 120,
      workingLength: 300,
      overlap: 35,
    });

    expect(draftOf(plotter)).toEqual({
      id: STORED_ID,
      name: 'Cutting mat',
      workingWidth: 120,
      roll: false,
      workingLength: 300,
      overlap: 35,
    });
  });

  it('leaves the working length empty and keeps the default Overlap for a roll Plotter', () => {
    const plotter = plotterOf({
      ...emptyPlotterDraft(),
      name: 'Vinyl cutter',
      workingWidth: 120,
      roll: true,
    });

    const draft = draftOf(plotter);

    expect(draft.roll).toBe(true);
    expect(draft.workingWidth).toBe(120);
    expect(draft.workingLength).toBeNull();
    expect(draft.overlap).toBe(20);
  });

  it('gives a draft that validates to the same Plotter', () => {
    const plotter = plotterOf({
      ...emptyPlotterDraft(),
      id: idOf(STORED_ID),
      name: 'Cutting mat',
      workingWidth: 120,
      workingLength: 300,
      overlap: 20,
    });

    const result = validatePlotter(draftOf(plotter));

    expect(result).toEqual({ok: true, value: plotter});
  });
});

describe('switching roll', () => {
  it('keeps the working length and Overlap when roll is switched on and back off', () => {
    const sheet: PlotterDraft = {
      ...emptyPlotterDraft(),
      name: 'Cutting mat',
      workingWidth: 120,
      workingLength: 300,
      overlap: 35,
    };

    const switchedOn = {...sheet, roll: true};
    const switchedOff = {...switchedOn, roll: false};

    expect(validatePlotter(switchedOn).ok).toBe(true);
    const result = validatePlotter(switchedOff);
    expect(result.ok && result.value).toMatchObject({roll: false, workingLength: 300, overlap: 35});
  });
});
