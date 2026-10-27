import {describe, expect, it} from 'vitest';
import {type Plotter, type PlotterId, plotterId} from './plotter';
import {emptyPlotterDraft, type PlotterDraft} from './plotter-draft';
import {parsePlotterLibrarySnapshot, toPlotterSnapshot, type PlotterLibrarySnapshot} from './plotter-library-snapshot';
import {validatePlotter} from './validate-plotter';

const ID_A = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ID_B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

/** "Cutting mat": a sheet Plotter as stored. */
const sheetSnapshot = {id: ID_A, name: 'Cutting mat', format: 'svg', workingWidth: 120, roll: false, workingLength: 300, overlap: 20};

/** "Vinyl cutter": a roll Plotter as stored in version 1, with no working length, no Overlap and no Tape spacing. */
const rollSnapshot = {id: ID_B, name: 'Vinyl cutter', format: 'svg', workingWidth: 120, roll: true};

/** "Vinyl cutter" as stored in version 2, with a Tape spacing of 5 mm. */
const rollSnapshotWithSpacing = {...rollSnapshot, workingWidth: 300, tapeSpacing: 5};

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
  it('writes version 2 with the fields of each Plotter, and the Tape spacing of a roll Plotter only', () => {
    const plotters = [
      plotterOf({...emptyPlotterDraft(), id: idOf(ID_A), name: 'Cutting mat', workingWidth: 120, workingLength: 300, overlap: 20}),
      plotterOf({...emptyPlotterDraft(), id: idOf(ID_B), name: 'Vinyl cutter', workingWidth: 300, roll: true, tapeSpacing: 5}),
    ];

    const snapshot: PlotterLibrarySnapshot = toPlotterSnapshot(plotters);

    expect(snapshot).toEqual({version: 2, plotters: [sheetSnapshot, rollSnapshotWithSpacing]});
  });

  it('writes no working length, no Overlap and no Tape spacing for a sheet Plotter', () => {
    const snapshot = toPlotterSnapshot([
      plotterOf({...emptyPlotterDraft(), id: idOf(ID_A), name: 'Cutting mat', workingWidth: 120, workingLength: 300, overlap: 20}),
    ]);

    expect(snapshot.plotters[0]).not.toHaveProperty('tapeSpacing');
  });

  it('writes no working length and no Overlap for a roll Plotter', () => {
    const snapshot = toPlotterSnapshot([plotterOf({...emptyPlotterDraft(), id: idOf(ID_B), name: 'Vinyl cutter', workingWidth: 120, roll: true})]);

    expect(snapshot.plotters[0]).not.toHaveProperty('workingLength');
    expect(snapshot.plotters[0]).not.toHaveProperty('overlap');
  });

  it('writes an empty library as version 2', () => {
    expect(toPlotterSnapshot([])).toEqual({version: 2, plotters: []});
  });
});

describe('parsePlotterLibrarySnapshot', () => {
  it('reads version 1 and keeps the order of the Plotters', () => {
    const plotters = parsedPlotters({version: 1, plotters: [sheetSnapshot, rollSnapshot]});

    expect(plotters.map((plotter) => plotter.name)).toEqual(['Cutting mat', 'Vinyl cutter']);
    expect(plotters[0]).toMatchObject({id: ID_A, format: 'svg', roll: false, workingWidth: 120, workingLength: 300, overlap: 20});
    expect(plotters[1]).toMatchObject({id: ID_B, format: 'svg', roll: true, workingWidth: 120});
  });

  it('gives every roll Plotter of version 1 a Tape spacing of 3 mm and changes nothing else', () => {
    const plotters = parsedPlotters({version: 1, plotters: [sheetSnapshot, rollSnapshot]});

    expect(plotters[1]).toMatchObject({roll: true, workingWidth: 120, tapeSpacing: 3});
    expect(plotters[0]).not.toHaveProperty('tapeSpacing');
    expect(plotters[0]).toMatchObject({workingWidth: 120, workingLength: 300, overlap: 20});
  });

  it('ignores a Tape spacing in version 1 as unknown data and reads 3 mm', () => {
    const plotters = parsedPlotters({version: 1, plotters: [{...rollSnapshot, tapeSpacing: 7}]});

    expect(plotters[0]).toMatchObject({roll: true, tapeSpacing: 3});
  });

  it('reads version 2 and keeps the Tape spacing of a roll Plotter', () => {
    const plotters = parsedPlotters({version: 2, plotters: [sheetSnapshot, rollSnapshotWithSpacing]});

    expect(plotters[1]).toMatchObject({id: ID_B, roll: true, workingWidth: 300, tapeSpacing: 5});
  });

  it('reads a Tape spacing of 0 in version 2, so that Tapes touch', () => {
    const plotters = parsedPlotters({version: 2, plotters: [{...rollSnapshot, tapeSpacing: 0}]});

    expect(plotters[0]).toMatchObject({roll: true, tapeSpacing: 0});
  });

  it('reads an empty library', () => {
    expect(parsePlotterLibrarySnapshot({version: 1, plotters: []})).toEqual({ok: true, value: []});
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['a missing version', {plotters: []}],
    ['an unknown version', {version: 3, plotters: []}],
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

  it.each([
    ['a roll Plotter without a Tape spacing', {...rollSnapshot, tapeSpacing: undefined}],
    ['a roll Plotter with a negative Tape spacing', {...rollSnapshotWithSpacing, tapeSpacing: -1}],
    ['a roll Plotter with a Tape spacing that is not finite', {...rollSnapshotWithSpacing, tapeSpacing: Number.NaN}],
    ['a sheet Plotter with a Tape spacing', {...sheetSnapshot, tapeSpacing: 3}],
  ])('refuses version 2 with %s', (_, plotter) => {
    expect(parsePlotterLibrarySnapshot({version: 2, plotters: [plotter]}).ok).toBe(false);
  });
});

describe('round trip', () => {
  it('reads version 1 and writes it back as version 2 with the default Tape spacing', () => {
    const parsed = parsedPlotters({version: 1, plotters: [sheetSnapshot, rollSnapshot]});

    const written = JSON.parse(JSON.stringify(toPlotterSnapshot(parsed))) as unknown;

    expect(written).toEqual({version: 2, plotters: [sheetSnapshot, {...rollSnapshot, tapeSpacing: 3}]});
    expect(parsePlotterLibrarySnapshot(written)).toEqual({ok: true, value: parsed});
  });

  it('reads what it writes in version 2, through JSON', () => {
    const parsed = parsedPlotters({version: 2, plotters: [sheetSnapshot, rollSnapshotWithSpacing]});

    const written = JSON.parse(JSON.stringify(toPlotterSnapshot(parsed))) as unknown;

    expect(written).toEqual({version: 2, plotters: [sheetSnapshot, rollSnapshotWithSpacing]});
    expect(parsePlotterLibrarySnapshot(written)).toEqual({ok: true, value: parsed});
  });
});
