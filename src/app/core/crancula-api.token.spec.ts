import {TestBed} from '@angular/core/testing';
import type {CranculaApi, OrganLibrarySnapshot, SvgSaveRequest, TapeLibrarySnapshot} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from './crancula-api.token';

const snapshot: OrganLibrarySnapshot = {
  version: 5,
  organs: [
    {
      id: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
      name: 'Street organ',
      tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      leadIn: 20,
      crankSpeedRange: {slowest: 30, fastest: 120},
      pipes: [{note: 60}],
    },
  ],
};

const tapeSnapshot: TapeLibrarySnapshot = {
  version: 3,
  songs: [
    {
      id: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
      name: 'Fur Elise',
      ticksPerQuarter: 480,
      parts: [{percussion: false, notes: [[64, 0, 240]]}],
    },
  ],
  tapes: [
    {
      id: '11111111-2222-4333-8444-555555555555',
      name: 'Fur Elise on Street organ',
      organId: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
      songId: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
      selectedParts: [0],
      transposition: 0,
      columnLength: 2.5,
      crankSpeed: 60,
      length: 10,
      holes: [[60, 0, 2]],
    },
  ],
};

describe('CRANCULA_API', () => {
  afterEach(() => {
    delete window.crancula;
  });

  it('uses the API the preload script exposed', () => {
    const exposed: CranculaApi = createInMemoryCranculaApi();
    window.crancula = exposed;

    expect(TestBed.inject(CRANCULA_API)).toBe(exposed);
  });

  it('falls back to an in-memory API outside Electron', async () => {
    const api = TestBed.inject(CRANCULA_API);

    expect(await api.organs.load()).toEqual({status: 'empty'});
    expect(await api.tapes.load()).toEqual({status: 'empty'});
  });
});

describe('createInMemoryCranculaApi', () => {
  it('loads what was saved', async () => {
    const api = createInMemoryCranculaApi();

    expect(await api.organs.save(snapshot)).toEqual({status: 'saved'});
    expect(await api.organs.load()).toEqual({status: 'loaded', snapshot});
  });

  it('starts with an initial snapshot', async () => {
    expect(await createInMemoryCranculaApi(snapshot).organs.load()).toEqual({status: 'loaded', snapshot});
  });

  it('accepts a language without effect', async () => {
    await expect(createInMemoryCranculaApi().app.setLanguage('de')).resolves.toEqual({status: 'set'});
  });

  describe('plotter', () => {
    const request: SvgSaveRequest = {
      suggestedFileName: 'Waltz.svg',
      svg: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
      dialogTitle: 'Export for the Plotter',
      filterName: 'SVG file',
    };

    it('records the request and answers saved with an in-memory path', async () => {
      const api = createInMemoryCranculaApi();

      expect(await api.plotter.saveSvg(request)).toEqual({status: 'saved', filePath: 'in-memory/Waltz.svg'});
      expect(api.plotter.lastSaveSvgRequest).toEqual(request);
    });

    it('rejects a forged request and records nothing', async () => {
      const api = createInMemoryCranculaApi();

      const reply = await api.plotter.saveSvg({...request, suggestedFileName: '../evil.svg'});

      expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
      expect(api.plotter.lastSaveSvgRequest).toBeUndefined();
    });

    it('answers cancelled when told to', async () => {
      const api = createInMemoryCranculaApi(undefined, undefined, {plotter: {saveSvg: 'cancelled'}});

      expect(await api.plotter.saveSvg(request)).toEqual({status: 'cancelled'});
    });

    it('answers failed when told to', async () => {
      const api = createInMemoryCranculaApi(undefined, undefined, {plotter: {saveSvg: 'failed'}});

      expect(await api.plotter.saveSvg(request)).toEqual({status: 'failed', reason: expect.any(String)});
    });
  });

  describe('tapes', () => {
    it('is empty without an initial Tape snapshot', async () => {
      expect(await createInMemoryCranculaApi().tapes.load()).toEqual({status: 'empty'});
    });

    it('starts with an initial Tape snapshot', async () => {
      const api = createInMemoryCranculaApi(undefined, tapeSnapshot);

      expect(await api.tapes.load()).toEqual({status: 'loaded', snapshot: tapeSnapshot});
    });

    it('loads what was saved', async () => {
      const api = createInMemoryCranculaApi();

      expect(await api.tapes.save(tapeSnapshot)).toEqual({status: 'saved'});
      expect(await api.tapes.load()).toEqual({status: 'loaded', snapshot: tapeSnapshot});
    });

    it('rejects an invalid snapshot and keeps what was stored', async () => {
      const api = createInMemoryCranculaApi(undefined, tapeSnapshot);
      const invalid: TapeLibrarySnapshot = {...tapeSnapshot, tapes: [{...tapeSnapshot.tapes[0], name: ''}]};

      expect(await api.tapes.save(invalid)).toEqual({status: 'rejected', reason: expect.any(String)});
      expect(await api.tapes.load()).toEqual({status: 'loaded', snapshot: tapeSnapshot});
    });

    it('keeps the Organ library apart from the Tape library', async () => {
      const api = createInMemoryCranculaApi(snapshot);

      expect(await api.tapes.load()).toEqual({status: 'empty'});
    });

    it('answers failed to a save when told to', async () => {
      const api = createInMemoryCranculaApi(undefined, undefined, {tapes: {save: 'failed'}});

      expect(await api.tapes.save(tapeSnapshot)).toEqual({status: 'failed', reason: expect.any(String)});
      expect(await api.tapes.load()).toEqual({status: 'empty'});
    });

    it('answers unreadable to a load when told to', async () => {
      const api = createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}});

      expect(await api.tapes.load()).toEqual({
        status: 'unreadable',
        backupPath: expect.any(String),
        reason: expect.any(String),
      });
    });
  });
});
