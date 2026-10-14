import {ApplicationInitStatus} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  type CranculaApi,
  type Organ,
  type OrganDraft,
  type OrganLibrarySaveResult,
  toSnapshot,
  validateOrgan,
} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {OrganLibrary, provideOrganLibrary} from './organ-library.store';

function organ(name: string, id?: string): Organ {
  const draft: OrganDraft = {
    id: id as OrganDraft['id'],
    name,
    tapeBed: {tapeWidth: 120, border: 5, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    pipes: [{note: 60}, {note: 62}],
  };
  const result = validateOrgan(draft);
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
}

function setup(api: CranculaApi = createInMemoryCranculaApi()) {
  TestBed.configureTestingModule({providers: [{provide: CRANCULA_API, useValue: api}]});
  return {api, library: TestBed.inject(OrganLibrary)};
}

describe('OrganLibrary', () => {
  describe('load', () => {
    it('starts empty without a snapshot', async () => {
      const {library} = setup();
      await library.load();
      expect(library.entities()).toEqual([]);
      expect(library.loadProblem()).toBeNull();
    });

    it('holds the Organs of the snapshot', async () => {
      const stored = organ('Street organ');
      const {library} = setup(createInMemoryCranculaApi(toSnapshot([stored])));

      await library.load();

      expect(library.entities()).toEqual([stored]);
      expect(library.entityMap()[stored.id]).toEqual(stored);
    });

    it('reports an unreadable snapshot', async () => {
      const api = createInMemoryCranculaApi();
      api.organs.load = () => Promise.resolve({status: 'unreadable', backupPath: 'C:/backup.json', reason: 'bad JSON'});
      const {library} = setup(api);

      await library.load();

      expect(library.entities()).toEqual([]);
      expect(library.loadProblem()).toEqual({backupPath: 'C:/backup.json', reason: 'bad JSON'});
    });
  });

  describe('put', () => {
    it('adds a new Organ and saves all Organs', async () => {
      const {api, library} = setup();
      const first = organ('First');
      const second = organ('Second');

      await library.put(first);
      await library.put(second);

      expect(library.entities()).toEqual([first, second]);
      expect(await api.organs.load()).toEqual({status: 'loaded', snapshot: toSnapshot([first, second])});
    });

    it('replaces a stored Organ in place', async () => {
      const {library} = setup();
      const first = organ('First');
      const second = organ('Second');
      await library.put(first);
      await library.put(second);

      const renamed = organ('Renamed', first.id);
      await library.put(renamed);

      expect(library.entities()).toEqual([renamed, second]);
    });
  });

  describe('put outcome', () => {
    function apiSaving(result: OrganLibrarySaveResult): CranculaApi {
      const inMemory = createInMemoryCranculaApi();
      return {organs: {load: () => inMemory.organs.load(), save: () => Promise.resolve(result)}};
    }

    it('resolves true when the Organs were written to disk', async () => {
      const {library} = setup(apiSaving({status: 'saved'}));

      expect(await library.put(organ('First'))).toBe(true);
    });

    it('resolves false when writing failed, and keeps the Organ in memory', async () => {
      const {library} = setup(apiSaving({status: 'failed', reason: 'disk full'}));
      const first = organ('First');

      expect(await library.put(first)).toBe(false);

      expect(library.entities()).toEqual([first]);
      expect(library.saveProblem()).toEqual({reason: 'disk full'});
    });
  });

  describe('remove', () => {
    it('removes the Organ and saves the rest', async () => {
      const {api, library} = setup();
      const first = organ('First');
      const second = organ('Second');
      await library.put(first);
      await library.put(second);

      await library.remove(first.id);

      expect(library.entities()).toEqual([second]);
      expect(await api.organs.load()).toEqual({status: 'loaded', snapshot: toSnapshot([second])});
    });
  });

  describe('save problems', () => {
    it('are reported and cleared by the next successful save', async () => {
      const inMemory = createInMemoryCranculaApi();
      let next: OrganLibrarySaveResult = {status: 'failed', reason: 'disk full'};
      const api: CranculaApi = {
        organs: {
          load: () => inMemory.organs.load(),
          save: (snapshot) => (next.status === 'saved' ? inMemory.organs.save(snapshot) : Promise.resolve(next)),
        },
      };
      const {library} = setup(api);

      await library.put(organ('First'));
      expect(library.saveProblem()).toEqual({reason: 'disk full'});

      next = {status: 'saved'};
      await library.put(organ('Second'));
      expect(library.saveProblem()).toBeNull();
    });
  });
});

describe('provideOrganLibrary', () => {
  it('loads the library while the app starts', async () => {
    const stored = organ('Street organ');
    TestBed.configureTestingModule({
      providers: [{provide: CRANCULA_API, useValue: createInMemoryCranculaApi(toSnapshot([stored]))}, provideOrganLibrary()],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(OrganLibrary).entities()).toEqual([stored]);
  });
});
