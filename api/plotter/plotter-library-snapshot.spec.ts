import {describe, expect, it} from 'vitest';
import {type Plotter, type PlotterId, plotterId} from './plotter';
import {emptyPlotterDraft, type PlotterDraft} from './plotter-draft';
import {parsePlotterLibrarySnapshot, toPlotterSnapshot, type PlotterLibrarySnapshot} from './plotter-library-snapshot';
import {validatePlotter} from './validate-plotter';

const ID_A = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ID_B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

/** "Cutting mat": a sheet Plotter as stored. */
const sheetSnapshot = {id: ID_A, name: 'Cutting mat', format: 'svg', workingWidth: 120, roll: false, workingLength: 300, overlap: 20};

/** "Vinyl cutter": a roll Plotter as stored, with no working length and no Overlap. */
const rollSnapshot = {id: ID_B, name: 'Vinyl cutter', format: 'svg', workingWidth: 120, roll: true};

function idOf(value: string): PlotterId {
  const id = plotterId(value);
  if (id === undefined) throw new Error(`invalid test id ${value}`);
  return id;
}

/** A Plotter that the validator accepts, for the writer. */
function plotterOf(draft: PlotterDraft): Plotter {
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test draft: ${JSON.stringify(result.error)}`);
  return result.value;
}

function parsedPlotters(input: unknown): Plotter[] {
  const result = parsePlotterLibrarySnapshot(input);
  if (!result.ok) throw new Error(`invalid test snapshot: ${result.error}`);
  return result.value;
}

describe('toPlotterSnapshot', () => {
  it('writes version 1 with the fields of each Plotter', () => {
    const plotters = [
      plotterOf({...emptyPlotterDraft(), id: idOf(ID_A), name: 'Cutting mat', workingWidth: 120, workingLength: 300, overlap: 20}),
      plotterOf({...emptyPlotterDraft(), id: idOf(ID_B), name: 'Vinyl cutter', workingWidth: 120, roll: true}),
    ];

    const snapshot: PlotterLibrarySnapshot = toPlotterSnapshot(plotters);

    expect(snapshot).toEqual({version: 1, plotters: [sheetSnapshot, rollSnapshot]});
  });

  it('writes no working length and no Overlap for a roll Plotter', () => {
    const snapshot = toPlotterSnapshot([plotterOf({...emptyPlotterDraft(), id: idOf(ID_B), name: 'Vinyl cutter', workingWidth: 120, roll: true})]);

    expect(snapshot.plotters[0]).not.toHaveProperty('workingLength');
    expect(snapshot.plotters[0]).not.toHaveProperty('overlap');
  });

  it('writes an empty library', () => {
    expect(toPlotterSnapshot([])).toEqual({version: 1, plotters: []});
  });
});

describe('parsePlotterLibrarySnapshot', () => {
  it('reads version 1 and keeps the order of the Plotters', () => {
    const plotters = parsedPlotters({version: 1, plotters: [sheetSnapshot, rollSnapshot]});

    expect(plotters.map((plotter) => plotter.name)).toEqual(['Cutting mat', 'Vinyl cutter']);
    expect(plotters[0]).toMatchObject({id: ID_A, format: 'svg', roll: false, workingWidth: 120, workingLength: 300, overlap: 20});
    expect(plotters[1]).toMatchObject({id: ID_B, format: 'svg', roll: true, workingWidth: 120});
  });

  it('reads an empty library', () => {
    expect(parsePlotterLibrarySnapshot({version: 1, plotters: []})).toEqual({ok: true, value: []});
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['a missing version', {plotters: []}],
    ['an unknown version', {version: 2, plotters: []}],
    ['version 0', {version: 0, plotters: []}],
    ['plotters that are not a list', {version: 1, plotters: {}}],
    ['a Plotter that is not an object', {version: 1, plotters: [42]}],
    ['a non-UUID id', {version: 1, plotters: [{...sheetSnapshot, id: 'plotter-1'}]}],
    ['a duplicate id', {version: 1, plotters: [sheetSnapshot, {...rollSnapshot, id: ID_A}]}],
    ['a format other than svg', {version: 1, plotters: [{...sheetSnapshot, format: 'dxf'}]}],
    ['a wrongly typed working width', {version: 1, plotters: [{...sheetSnapshot, workingWidth: '120'}]}],
    ['a wrongly typed roll flag', {version: 1, plotters: [{...sheetSnapshot, roll: 'no'}]}],
    ['a zero working width', {version: 1, plotters: [{...sheetSnapshot, workingWidth: 0}]}],
    ['a sheet Plotter without a working length', {version: 1, plotters: [{...sheetSnapshot, workingLength: undefined}]}],
    ['a sheet Plotter with an Overlap not below its working length', {version: 1, plotters: [{...sheetSnapshot, overlap: 300}]}],
    ['a roll Plotter with a working length', {version: 1, plotters: [{...rollSnapshot, workingLength: 300}]}],
    ['a roll Plotter with an Overlap', {version: 1, plotters: [{...rollSnapshot, overlap: 20}]}],
  ])('refuses a library with %s', (_, input) => {
    expect(parsePlotterLibrarySnapshot(input).ok).toBe(false);
  });
});

describe('round trip', () => {
  it('reads what it writes, through JSON', () => {
    const parsed = parsedPlotters({version: 1, plotters: [sheetSnapshot, rollSnapshot]});

    const written = JSON.parse(JSON.stringify(toPlotterSnapshot(parsed))) as unknown;

    expect(written).toEqual({version: 1, plotters: [sheetSnapshot, rollSnapshot]});
    expect(parsePlotterLibrarySnapshot(written)).toEqual({ok: true, value: parsed});
  });
});
