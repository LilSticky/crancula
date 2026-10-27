import {ApplicationInitStatus} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  type CranculaApi,
  newPlotterId,
  type Plotter,
  type PlotterDraft,
  type PlotterId,
  type PlotterLibrarySaveResult,
  toPlotterSnapshot,
  validatePlotter,
} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {PlotterLibrary, providePlotterLibrary} from './plotter-library.store';

function plotter(name: string, id: PlotterId = newPlotterId()): Plotter {
  const draft: PlotterDraft = {id, name, workingWidth: 300, roll: false, workingLength: 120, overlap: 20};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error('invalid test Plotter');
  return result.value;
}

function setup(api: CranculaApi = createInMemoryCranculaApi()) {
  TestBed.configureTestingModule({providers: [{provide: CRANCULA_API, useValue: api}]});
  return {api, library: TestBed.inject(PlotterLibrary)};
}

describe('PlotterLibrary', () => {
  describe('load', () => {
    it('starts empty without a snapshot', async () => {
      const {library} = setup();
      await library.load();
      expect(library.entities()).toEqual([]);
      expect(library.loadProblem()).toBeNull();
    });

    it('holds the Plotters of the snapshot', async () => {
      const stored = plotter('Cutting mat');
      const {library} = setup(createInMemoryCranculaApi(undefined, undefined, {}, toPlotterSnapshot([stored])));

      await library.load();

      expect(library.entities()).toEqual([stored]);
      expect(library.entityMap()[stored.id]).toEqual(stored);
    });

    it('reports an unreadable snapshot', async () => {
      const api = createInMemoryCranculaApi();
      api.plotters.load = () => Promise.resolve({status: 'unreadable', backupPath: 'C:/backup.json', reason: 'bad JSON'});
      const {library} = setup(api);

      await library.load();

      expect(library.entities()).toEqual([]);
      expect(library.loadProblem()).toEqual({backupPath: 'C:/backup.json', reason: 'bad JSON'});
    });
  });

  describe('put', () => {
    it('adds a new Plotter and saves all Plotters', async () => {
      const {api, library} = setup();
      const first = plotter('First');
      const second = plotter('Second');

      await library.put(first);
      await library.put(second);

      expect(library.entities()).toEqual([first, second]);
      expect(await api.plotters.load()).toEqual({status: 'loaded', snapshot: toPlotterSnapshot([first, second])});
    });

    it('replaces a stored Plotter in place', async () => {
      const {library} = setup();
      const first = plotter('First');
      const second = plotter('Second');
      await library.put(first);
      await library.put(second);

      const renamed = plotter('Renamed', first.id);
      await library.put(renamed);

      expect(library.entities()).toEqual([renamed, second]);
    });
  });

  describe('put outcome', () => {
    function apiSaving(result: PlotterLibrarySaveResult): CranculaApi {
      const inMemory = createInMemoryCranculaApi();
      return {
        organs: inMemory.organs,
        tapes: inMemory.tapes,
        plotters: {load: () => inMemory.plotters.load(), save: () => Promise.resolve(result)},
        plotter: inMemory.plotter,
        recording: inMemory.recording,
        app: inMemory.app,
        edit: inMemory.edit,
        scores: inMemory.scores,
      };
    }

    it('resolves true when the Plotters were written to disk', async () => {
      const {library} = setup(apiSaving({status: 'saved'}));

      expect(await library.put(plotter('First'))).toBe(true);
    });

    it('resolves false when writing failed, and keeps the Plotter in memory', async () => {
      const {library} = setup(apiSaving({status: 'failed', reason: 'disk full'}));
      const first = plotter('First');

      expect(await library.put(first)).toBe(false);

      expect(library.entities()).toEqual([first]);
      expect(library.saveProblem()).toEqual({reason: 'disk full'});
    });
  });

  describe('remove', () => {
    it('removes the Plotter and saves the rest', async () => {
      const {api, library} = setup();
      const first = plotter('First');
      const second = plotter('Second');
      await library.put(first);
      await library.put(second);

      await library.remove(first.id);

      expect(library.entities()).toEqual([second]);
      expect(await api.plotters.load()).toEqual({status: 'loaded', snapshot: toPlotterSnapshot([second])});
    });
  });

  describe('save problems', () => {
    it('are reported and cleared by the next successful save', async () => {
      const inMemory = createInMemoryCranculaApi();
      let next: PlotterLibrarySaveResult = {status: 'failed', reason: 'disk full'};
      const api: CranculaApi = {
        organs: inMemory.organs,
        tapes: inMemory.tapes,
        plotters: {
          load: () => inMemory.plotters.load(),
          save: (snapshot) => (next.status === 'saved' ? inMemory.plotters.save(snapshot) : Promise.resolve(next)),
        },
        plotter: inMemory.plotter,
        recording: inMemory.recording,
        app: inMemory.app,
        edit: inMemory.edit,
        scores: inMemory.scores,
      };
      const {library} = setup(api);

      await library.put(plotter('First'));
      expect(library.saveProblem()).toEqual({reason: 'disk full'});

      next = {status: 'saved'};
      await library.put(plotter('Second'));
      expect(library.saveProblem()).toBeNull();
    });
  });
});

describe('providePlotterLibrary', () => {
  it('loads the library while the app starts', async () => {
    const stored = plotter('Cutting mat');
    TestBed.configureTestingModule({
      providers: [
        {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, undefined, {}, toPlotterSnapshot([stored]))},
        providePlotterLibrary(),
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(PlotterLibrary).entities()).toEqual([stored]);
  });
});
