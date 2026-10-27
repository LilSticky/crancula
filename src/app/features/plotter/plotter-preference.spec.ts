import {TestBed} from '@angular/core/testing';
import {newPlotterId, type Plotter, type PlotterDraft, type PlotterId, toPlotterSnapshot, validatePlotter} from '@api/index';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {PlotterLibrary} from './plotter-library.store';
import {PlotterPreference} from './plotter-preference';

const PLOTTER_KEY = 'crancula.plotter';

// jsdom's localStorage is unavailable here, so the app's UI preference store is an in-memory stand-in.
function stubLocalStorage(initial?: string): void {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(PLOTTER_KEY, initial);
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
}

function plotter(name: string, id: PlotterId = newPlotterId()): Plotter {
  const draft: PlotterDraft = {id, name, workingWidth: 300, roll: false, workingLength: 120, overlap: 20, tapeSpacing: 3};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error('invalid test Plotter');
  return result.value;
}

async function createPreference(plotters: Plotter[] = []): Promise<PlotterPreference> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, undefined, {}, toPlotterSnapshot(plotters))},
    ],
  });
  await TestBed.inject(PlotterLibrary).load();
  return TestBed.inject(PlotterPreference);
}

describe('PlotterPreference', () => {
  beforeEach(() => stubLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('has no Plotter picked when no id was stored', async () => {
    const preference = await createPreference();

    expect(preference.picked()).toBeUndefined();
  });

  it('remembers the picked Plotter id in localStorage', async () => {
    const stored = plotter('Cutting mat');
    const preference = await createPreference([stored]);

    preference.pick(stored.id);

    expect(localStorage.getItem(PLOTTER_KEY)).toBe(stored.id);
  });

  it('reads a stored id that is not in the library as no Plotter', async () => {
    stubLocalStorage(newPlotterId());
    const preference = await createPreference([plotter('Another mat')]);

    expect(preference.picked()).toBeUndefined();
  });

  it('removes the stored id when No Plotter is picked', async () => {
    const stored = plotter('Cutting mat');
    stubLocalStorage(stored.id);
    const preference = await createPreference([stored]);

    preference.pick(undefined);

    expect(localStorage.getItem(PLOTTER_KEY)).toBeNull();
  });
});
