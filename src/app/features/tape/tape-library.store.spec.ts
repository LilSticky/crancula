import {ApplicationInitStatus} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  type CranculaApi,
  midiNoteNumber,
  type MidiNoteNumber,
  parseTapeLibrarySnapshot,
  type Song,
  type Tape,
  type TapeLibrarySaveResult,
  type TapeLibrarySnapshot,
  toTapeLibrarySnapshot,
} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {provideTapeLibrary, TapeLibrary} from './tape-library.store';

const ORGAN_A = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const ORGAN_B = 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa';

function songSnapshot(id: string) {
  return {
    id,
    name: 'Fur Elise',
    ticksPerQuarter: 480,
    parts: [{percussion: false, notes: [[60, 0, 240], [62, 240, 240]]}],
  };
}

function tapeSnapshot(id: string, songId: string, organId = ORGAN_A, name = 'A Tape') {
  return {
    id,
    name,
    organId,
    songId,
    selectedParts: [0],
    transposition: 0,
    columnLength: 2.5,
    length: 10,
    holes: [[60, 0, 2], [60, 4, 1], [62, 2, 3]],
  };
}

function songId(n: number): string {
  return `3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e0${n}`;
}

function tapeId(n: number): string {
  return `11111111-2222-4333-8444-55555555555${n}`;
}

/** Builds valid Songs and Tapes through the snapshot parser, the only way to create them besides `createTape`. */
function library(...pairs: readonly {tape: number; song: number; organId?: string}[]): {songs: Song[]; tapes: Tape[]} {
  const songNumbers = [...new Set(pairs.map((pair) => pair.song))];
  const parsed = parseTapeLibrarySnapshot({
    version: 1,
    songs: songNumbers.map((n) => songSnapshot(songId(n))),
    tapes: pairs.map((pair) => tapeSnapshot(tapeId(pair.tape), songId(pair.song), pair.organId, `Tape ${pair.tape}`)),
  });
  if (!parsed.ok) throw new Error(`invalid test library: ${parsed.error}`);
  return parsed.value;
}

function snapshotOf(content: {songs: Song[]; tapes: Tape[]}): TapeLibrarySnapshot {
  return toTapeLibrarySnapshot(content.tapes, content.songs);
}

function pipes(...notes: number[]): ReadonlySet<MidiNoteNumber> {
  return new Set(
    notes.map((note) => {
      const pipe = midiNoteNumber(note);
      if (pipe === undefined) throw new Error('invalid test note');
      return pipe;
    }),
  );
}

function setup(api: CranculaApi = createInMemoryCranculaApi()) {
  TestBed.configureTestingModule({providers: [{provide: CRANCULA_API, useValue: api}]});
  return {api, store: TestBed.inject(TapeLibrary)};
}

function apiSaving(result: TapeLibrarySaveResult, initialTapes?: TapeLibrarySnapshot): CranculaApi {
  const inMemory = createInMemoryCranculaApi(undefined, initialTapes);
  return {
    organs: inMemory.organs,
    tapes: {load: () => inMemory.tapes.load(), save: () => Promise.resolve(result)},
    plotters: inMemory.plotters,
    plotter: inMemory.plotter,
    recording: inMemory.recording,
    app: inMemory.app,
    edit: inMemory.edit,
  };
}

async function storedTapes(api: CranculaApi): Promise<TapeLibrarySnapshot | undefined> {
  const result = await api.tapes.load();
  return result.status === 'loaded' ? result.snapshot : undefined;
}

describe('TapeLibrary', () => {
  describe('load', () => {
    it('starts empty without a snapshot', async () => {
      const {store} = setup();

      await store.load();

      expect(store.tapeEntities()).toEqual([]);
      expect(store.songEntities()).toEqual([]);
      expect(store.loadProblem()).toBeNull();
    });

    it('holds the Tapes and Songs of the snapshot in their order', async () => {
      const stored = library({tape: 1, song: 1}, {tape: 2, song: 2});
      const {store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));

      await store.load();

      expect(store.tapeEntities()).toEqual(stored.tapes);
      expect(store.songEntities()).toEqual(stored.songs);
      expect(store.tapeEntityMap()[stored.tapes[0].id]).toEqual(stored.tapes[0]);
      expect(store.songEntityMap()[stored.songs[1].id]).toEqual(stored.songs[1]);
    });

    it('reports an unreadable snapshot', async () => {
      const api = createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}});
      const {store} = setup(api);

      await store.load();

      expect(store.tapeEntities()).toEqual([]);
      expect(store.loadProblem()).toEqual({
        backupPath: 'tapes.json.bak',
        reason: 'the Tape library could not be read',
      });
    });
  });

  describe('create', () => {
    it('adds the Tape and its Song and saves the whole snapshot', async () => {
      const {api, store} = setup();
      const first = library({tape: 1, song: 1});
      const second = library({tape: 2, song: 2});

      expect(await store.create(first.tapes[0], first.songs[0])).toBe(true);
      expect(await store.create(second.tapes[0], second.songs[0])).toBe(true);

      expect(store.tapeEntities()).toEqual([first.tapes[0], second.tapes[0]]);
      expect(store.songEntities()).toEqual([first.songs[0], second.songs[0]]);
      expect(await storedTapes(api)).toEqual(
        snapshotOf({tapes: [first.tapes[0], second.tapes[0]], songs: [first.songs[0], second.songs[0]]}),
      );
    });

    it('keeps creation order as insertion order', async () => {
      const {store} = setup();
      const content = library({tape: 3, song: 1}, {tape: 1, song: 2}, {tape: 2, song: 3});

      for (const [index, tape] of content.tapes.entries()) await store.create(tape, content.songs[index]);

      expect(store.tapeEntities().map((tape) => tape.name)).toEqual(['Tape 3', 'Tape 1', 'Tape 2']);
    });

    it('keeps one Song for two Tapes created from it', async () => {
      const {store} = setup();
      const content = library({tape: 1, song: 1}, {tape: 2, song: 1});

      await store.create(content.tapes[0], content.songs[0]);
      await store.create(content.tapes[1], content.songs[0]);

      expect(store.tapeEntities()).toEqual(content.tapes);
      expect(store.songEntities()).toEqual(content.songs);
    });

    it('stores two Tapes with the same name', async () => {
      const {api, store} = setup();
      const parsed = parseTapeLibrarySnapshot({
        version: 1,
        songs: [songSnapshot(songId(1))],
        tapes: [
          tapeSnapshot(tapeId(1), songId(1), ORGAN_A, 'Same name'),
          tapeSnapshot(tapeId(2), songId(1), ORGAN_A, 'Same name'),
        ],
      });
      if (!parsed.ok) throw new Error(`invalid test library: ${parsed.error}`);
      const {tapes, songs} = parsed.value;

      expect(await store.create(tapes[0], songs[0])).toBe(true);
      expect(await store.create(tapes[1], songs[0])).toBe(true);

      expect(store.tapeEntities().map((tape) => tape.name)).toEqual(['Same name', 'Same name']);
      expect(store.tapeEntities().map((tape) => tape.id)).toEqual(tapes.map((tape) => tape.id));
      expect((await storedTapes(api))?.tapes).toHaveLength(2);
    });

    it('resolves false, reports the problem and keeps the Tape in memory when writing failed', async () => {
      const {store} = setup(apiSaving({status: 'failed', reason: 'disk full'}));
      const content = library({tape: 1, song: 1});

      expect(await store.create(content.tapes[0], content.songs[0])).toBe(false);

      expect(store.tapeEntities()).toEqual(content.tapes);
      expect(store.saveProblem()).toEqual({reason: 'disk full'});
    });

    it('resolves false and reports the problem when the snapshot was rejected', async () => {
      const {store} = setup(apiSaving({status: 'rejected', reason: 'invalid snapshot'}));
      const content = library({tape: 1, song: 1});

      expect(await store.create(content.tapes[0], content.songs[0])).toBe(false);

      expect(store.tapeEntities()).toEqual(content.tapes);
      expect(store.saveProblem()).toEqual({reason: 'invalid snapshot'});
    });

    it('clears the problem with the next successful save', async () => {
      const inMemory = createInMemoryCranculaApi();
      let next: TapeLibrarySaveResult = {status: 'failed', reason: 'disk full'};
      const {store} = setup({
        organs: inMemory.organs,
        tapes: {
          load: () => inMemory.tapes.load(),
          save: (snapshot) => (next.status === 'saved' ? inMemory.tapes.save(snapshot) : Promise.resolve(next)),
        },
        plotters: inMemory.plotters,
        plotter: inMemory.plotter,
        recording: inMemory.recording,
        app: inMemory.app,
        edit: inMemory.edit,
      });
      const content = library({tape: 1, song: 1}, {tape: 2, song: 2});

      await store.create(content.tapes[0], content.songs[0]);
      expect(store.saveProblem()).toEqual({reason: 'disk full'});

      next = {status: 'saved'};
      await store.create(content.tapes[1], content.songs[1]);
      expect(store.saveProblem()).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes the Tape and drops its Song when no other Tape references it', async () => {
      const stored = library({tape: 1, song: 1}, {tape: 2, song: 2});
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(await store.remove(stored.tapes[0].id)).toBe(true);

      expect(store.tapeEntities()).toEqual([stored.tapes[1]]);
      expect(store.songEntities()).toEqual([stored.songs[1]]);
      expect(await storedTapes(api)).toEqual(snapshotOf({tapes: [stored.tapes[1]], songs: [stored.songs[1]]}));
    });

    it('keeps the Song while another Tape references it', async () => {
      const stored = library({tape: 1, song: 1}, {tape: 2, song: 1});
      const {store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      await store.remove(stored.tapes[0].id);

      expect(store.tapeEntities()).toEqual([stored.tapes[1]]);
      expect(store.songEntities()).toEqual(stored.songs);
    });
  });

  describe('rename', () => {
    it('renames the Tape in memory, saves the library and leaves the Song and the other Tapes alone', async () => {
      const stored = library({tape: 1, song: 1}, {tape: 2, song: 1});
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(await store.rename(stored.tapes[0].id, '  Kirmes-Walzer ')).toBe(true);

      const renamed = {...stored.tapes[0], name: 'Kirmes-Walzer'};
      expect(store.tapeEntities()).toEqual([renamed, stored.tapes[1]]);
      expect(store.songEntities()).toEqual(stored.songs);
      expect(await storedTapes(api)).toEqual(snapshotOf({tapes: [renamed, stored.tapes[1]], songs: stored.songs}));
    });

    it('resolves false and changes nothing for a blank name', async () => {
      const stored = library({tape: 1, song: 1});
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(await store.rename(stored.tapes[0].id, '   ')).toBe(false);

      expect(store.tapeEntities()).toEqual(stored.tapes);
      expect(await storedTapes(api)).toEqual(snapshotOf(stored));
    });

    it('resolves false and changes nothing for an unknown id', async () => {
      const stored = library({tape: 1, song: 1});
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();
      const unknown = library({tape: 9, song: 9}).tapes[0].id;

      expect(await store.rename(unknown, 'Kirmes-Walzer')).toBe(false);

      expect(store.tapeEntities()).toEqual(stored.tapes);
      expect(await storedTapes(api)).toEqual(snapshotOf(stored));
    });

    it('resolves false and never writes while the stored Tapes could not be read', async () => {
      const inMemory = createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}});
      let saves = 0;
      const {store} = setup({
        organs: inMemory.organs,
        tapes: {
          load: () => inMemory.tapes.load(),
          save: (snapshot) => {
            saves += 1;
            return inMemory.tapes.save(snapshot);
          },
        },
        plotters: inMemory.plotters,
        plotter: inMemory.plotter,
        recording: inMemory.recording,
        app: inMemory.app,
        edit: inMemory.edit,
      });
      await store.load();
      const content = library({tape: 1, song: 1});

      expect(await store.rename(content.tapes[0].id, 'Kirmes-Walzer')).toBe(false);

      expect(saves).toBe(0);
    });
  });

  describe('update', () => {
    function countingApi(inMemory: CranculaApi, results: () => TapeLibrarySaveResult | undefined): {api: CranculaApi; saves: () => number} {
      let saves = 0;
      return {
        saves: () => saves,
        api: {
          organs: inMemory.organs,
          tapes: {
            load: () => inMemory.tapes.load(),
            save: (snapshot) => {
              saves += 1;
              const forced = results();
              return forced === undefined ? inMemory.tapes.save(snapshot) : Promise.resolve(forced);
            },
          },
          plotters: inMemory.plotters,
          plotter: inMemory.plotter,
          recording: inMemory.recording,
          app: inMemory.app,
          edit: inMemory.edit,
        },
      };
    }

    it('replaces the Tape in memory, keeps the others and saves the whole library once', async () => {
      const stored = library({tape: 1, song: 1}, {tape: 2, song: 1});
      const counting = countingApi(createInMemoryCranculaApi(undefined, snapshotOf(stored)), () => undefined);
      const {store} = setup(counting.api);
      await store.load();
      const edited: Tape = {...stored.tapes[0], holes: stored.tapes[0].holes.slice(1)};

      expect(await store.update(edited)).toBe(true);

      expect(store.tapeEntities()).toEqual([edited, stored.tapes[1]]);
      expect(store.songEntities()).toEqual(stored.songs);
      expect(counting.saves()).toBe(1);
      expect(await storedTapes(counting.api)).toEqual(snapshotOf({tapes: [edited, stored.tapes[1]], songs: stored.songs}));
    });

    it('resolves false and writes nothing for an unknown id', async () => {
      const stored = library({tape: 1, song: 1});
      const counting = countingApi(createInMemoryCranculaApi(undefined, snapshotOf(stored)), () => undefined);
      const {store} = setup(counting.api);
      await store.load();
      const unknown = library({tape: 9, song: 9}).tapes[0];

      expect(await store.update(unknown)).toBe(false);

      expect(store.tapeEntities()).toEqual(stored.tapes);
      expect(counting.saves()).toBe(0);
    });

    it('resolves false and never writes while the stored Tapes could not be read', async () => {
      const counting = countingApi(createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}}), () => undefined);
      const {store} = setup(counting.api);
      await store.load();
      const content = library({tape: 1, song: 1});

      expect(await store.update(content.tapes[0])).toBe(false);

      expect(counting.saves()).toBe(0);
    });

    it('keeps the new Tape in memory and reports the problem when writing failed, until the next save works', async () => {
      const stored = library({tape: 1, song: 1});
      let next: TapeLibrarySaveResult | undefined = {status: 'failed', reason: 'disk full'};
      const counting = countingApi(createInMemoryCranculaApi(undefined, snapshotOf(stored)), () => next);
      const {store} = setup(counting.api);
      await store.load();
      const edited: Tape = {...stored.tapes[0], holes: stored.tapes[0].holes.slice(1)};
      const again: Tape = {...stored.tapes[0], holes: stored.tapes[0].holes.slice(2)};

      expect(await store.update(edited)).toBe(false);
      expect(store.tapeEntities()).toEqual([edited]);
      expect(store.saveProblem()).toEqual({reason: 'disk full'});

      next = undefined;
      expect(await store.update(again)).toBe(true);
      expect(store.saveProblem()).toBeNull();
    });
  });

  describe('Tapes of an Organ', () => {
    it('tapesOf lists only the Tapes of that Organ, in order', async () => {
      const stored = library(
        {tape: 1, song: 1, organId: ORGAN_A},
        {tape: 2, song: 2, organId: ORGAN_B},
        {tape: 3, song: 3, organId: ORGAN_A},
      );
      const {store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(store.tapesOf(ORGAN_A as Tape['organId'])).toEqual([stored.tapes[0], stored.tapes[2]]);
    });

    it('removeTapesOf removes those Tapes and their unreferenced Songs and saves', async () => {
      const stored = library(
        {tape: 1, song: 1, organId: ORGAN_A},
        {tape: 2, song: 2, organId: ORGAN_B},
        {tape: 3, song: 2, organId: ORGAN_A},
      );
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(await store.removeTapesOf(ORGAN_A as Tape['organId'])).toBe(true);

      expect(store.tapeEntities()).toEqual([stored.tapes[1]]);
      expect(store.songEntities()).toEqual([stored.songs[1]]);
      expect(await storedTapes(api)).toEqual(snapshotOf({tapes: [stored.tapes[1]], songs: [stored.songs[1]]}));
    });

    it('removeTapesOf resolves false when writing failed', async () => {
      const stored = library({tape: 1, song: 1});
      const {store} = setup(apiSaving({status: 'failed', reason: 'disk full'}, snapshotOf(stored)));
      await store.load();

      expect(await store.removeTapesOf(ORGAN_A as Tape['organId'])).toBe(false);
    });
  });

  describe('removing Pipes from an Organ', () => {
    it('affectedByRemovingPipes counts the Tapes and Holes of those Pipes for that Organ only', async () => {
      const stored = library(
        {tape: 1, song: 1, organId: ORGAN_A},
        {tape: 2, song: 2, organId: ORGAN_A},
        {tape: 3, song: 3, organId: ORGAN_B},
      );
      const {store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      // Each Tape has two Holes on Pipe 60 and one on Pipe 62.
      expect(store.affectedByRemovingPipes(ORGAN_A as Tape['organId'], pipes(60))).toEqual({tapes: 2, holes: 4});
      expect(store.affectedByRemovingPipes(ORGAN_A as Tape['organId'], pipes(60, 62))).toEqual({tapes: 2, holes: 6});
    });

    it('affectedByRemovingPipes does not count Tapes without a Hole on those Pipes', async () => {
      const stored = library({tape: 1, song: 1});
      const {store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(store.affectedByRemovingPipes(ORGAN_A as Tape['organId'], pipes(70))).toEqual({tapes: 0, holes: 0});
    });

    it('removeHolesOfPipes removes those Holes, keeps each Tape length, and saves', async () => {
      const stored = library({tape: 1, song: 1, organId: ORGAN_A}, {tape: 2, song: 2, organId: ORGAN_B});
      const {api, store} = setup(createInMemoryCranculaApi(undefined, snapshotOf(stored)));
      await store.load();

      expect(await store.removeHolesOfPipes(ORGAN_A as Tape['organId'], pipes(60))).toBe(true);

      const [changed, untouched] = store.tapeEntities();
      expect(changed.holes.map((hole) => hole.pipe)).toEqual([62]);
      expect(changed.length).toBe(stored.tapes[0].length);
      expect(untouched).toEqual(stored.tapes[1]);
      expect(await storedTapes(api)).toEqual(snapshotOf({tapes: [changed, untouched], songs: stored.songs}));
    });
  });

  describe('while the stored Tapes could not be read', () => {
    it('never writes: create resolves false and tapes.json stays untouched', async () => {
      const inMemory = createInMemoryCranculaApi(undefined, undefined, {tapes: {load: 'unreadable'}});
      let saves = 0;
      const {store} = setup({
        organs: inMemory.organs,
        tapes: {
          load: () => inMemory.tapes.load(),
          save: (snapshot) => {
            saves += 1;
            return inMemory.tapes.save(snapshot);
          },
        },
        plotters: inMemory.plotters,
        plotter: inMemory.plotter,
        recording: inMemory.recording,
        app: inMemory.app,
        edit: inMemory.edit,
      });
      await store.load();
      const content = library({tape: 1, song: 1});

      expect(await store.create(content.tapes[0], content.songs[0])).toBe(false);

      expect(saves).toBe(0);
    });
  });
});

describe('provideTapeLibrary', () => {
  it('loads the Tape library while the app starts', async () => {
    const stored = library({tape: 1, song: 1});
    TestBed.configureTestingModule({
      providers: [
        {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, snapshotOf(stored))},
        provideTapeLibrary(),
      ],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(TapeLibrary).tapeEntities()).toEqual(stored.tapes);
  });
});
