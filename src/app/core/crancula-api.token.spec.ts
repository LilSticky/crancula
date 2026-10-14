import {TestBed} from '@angular/core/testing';
import type {CranculaApi, OrganLibrarySnapshot} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from './crancula-api.token';

const snapshot: OrganLibrarySnapshot = {
  version: 1,
  organs: [
    {
      id: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
      name: 'Street organ',
      tapeBed: {tapeWidth: 120, border: 5, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      pipes: [{note: 60}],
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
    await expect(createInMemoryCranculaApi().app.setLanguage('de')).resolves.toBeUndefined();
  });
});
