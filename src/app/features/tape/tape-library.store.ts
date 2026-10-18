import {type EnvironmentProviders, inject, provideAppInitializer} from '@angular/core';
import {patchState, signalStore, withMethods, withState} from '@ngrx/signals';
import {addEntity, entityConfig, removeEntities, setAllEntities, setEntities, upsertEntity, withEntities} from '@ngrx/signals/entities';
import {
  type MidiNoteNumber,
  type OrganId,
  parseTapeLibrarySnapshot,
  removeHolesOfPipes,
  renameTape,
  type Song,
  type Tape,
  type TapeId,
  toTapeLibrarySnapshot,
} from '@api/index';
import {CRANCULA_API} from '../../core/crancula-api.token';

interface TapeLibraryState {
  /** Set once `load()` has finished, whatever it found. */
  readonly loaded: boolean;
  /** Set when the stored Tapes couldn't be read on startup; the file was moved to `backupPath`. */
  readonly loadProblem: {readonly backupPath: string; readonly reason: string} | null;
  /** Set when the last write to disk failed; cleared by the next successful one. */
  readonly saveProblem: {readonly reason: string} | null;
}

const tapeConfig = entityConfig({entity: {} as Tape, collection: 'tape'});
const songConfig = entityConfig({entity: {} as Song, collection: 'song'});

/** The in-memory Tapes and the Songs they reference: the source of truth while the app runs (ADR 3). */
export const TapeLibrary = signalStore(
  {providedIn: 'root'},
  withEntities(tapeConfig),
  withEntities(songConfig),
  withState<TapeLibraryState>({loaded: false, loadProblem: null, saveProblem: null}),
  withMethods((store, api = inject(CRANCULA_API)) => {
    /** Writes all Tapes and their Songs to disk; resolves `true` when that worked. */
    async function save(): Promise<boolean> {
      const result = await api.tapes.save(toTapeLibrarySnapshot(store.tapeEntities(), store.songEntities()));
      patchState(store, {saveProblem: result.status === 'saved' ? null : {reason: result.reason}});
      return result.status === 'saved';
    }

    /** Removes the given Tapes and every Song no remaining Tape references, then saves. */
    function removeTapes(removed: readonly Tape[]): Promise<boolean> {
      const removedIds = new Set(removed.map((tape) => tape.id));
      const remaining = store.tapeEntities().filter((tape) => !removedIds.has(tape.id));
      const referenced = new Set(remaining.map((tape) => tape.songId));
      const orphans = store.songEntities().filter((song) => !referenced.has(song.id));
      patchState(
        store,
        removeEntities([...removedIds], tapeConfig),
        removeEntities(orphans.map((song) => song.id), songConfig),
      );
      return save();
    }

    function tapesOf(organId: OrganId): Tape[] {
      return store.tapeEntities().filter((tape) => tape.organId === organId);
    }

    function empty(loadProblem: TapeLibraryState['loadProblem']): void {
      patchState(store, setAllEntities([] as Tape[], tapeConfig), setAllEntities([] as Song[], songConfig), {loadProblem, loaded: true});
    }

    return {
      async load(): Promise<void> {
        const result = await api.tapes.load();
        if (result.status === 'unreadable') {
          empty({backupPath: result.backupPath, reason: result.reason});
          return;
        }
        if (result.status === 'empty') {
          empty(null);
          return;
        }
        const library = parseTapeLibrarySnapshot(result.snapshot);
        if (library.ok) {
          patchState(
            store,
            setAllEntities(library.value.tapes, tapeConfig),
            setAllEntities(library.value.songs, songConfig),
            {loadProblem: null, loaded: true},
          );
        } else {
          empty({backupPath: '', reason: library.error});
        }
      },

      /**
       * Adds a valid Tape and its Song, and writes everything to disk. Resolves `false` when writing failed,
       * or without writing when the stored Tapes could not be read (they would be overwritten).
       */
      async create(tape: Tape, song: Song): Promise<boolean> {
        if (store.loadProblem() !== null) return false;
        patchState(store, addEntity(tape, tapeConfig), upsertEntity(song, songConfig));
        return save();
      },

      async remove(id: TapeId): Promise<boolean> {
        if (store.loadProblem() !== null) return false;
        return removeTapes(store.tapeEntities().filter((tape) => tape.id === id));
      },

      /** Renames the Tape and saves. Resolves `false` without change for a blank name or unknown id. */
      async rename(id: TapeId, name: string): Promise<boolean> {
        if (store.loadProblem() !== null) return false;
        const tape = store.tapeEntities().find((candidate) => candidate.id === id);
        if (tape === undefined) return false;
        const renamed = renameTape(tape, name);
        if (!renamed.ok) return false;
        patchState(store, upsertEntity(renamed.value, tapeConfig));
        return save();
      },

      tapesOf,

      async removeTapesOf(organId: OrganId): Promise<boolean> {
        if (store.loadProblem() !== null) return false;
        return removeTapes(tapesOf(organId));
      },

      /** How many Tapes of the Organ have Holes on those Pipes, and how many Holes that is. */
      affectedByRemovingPipes(organId: OrganId, pipes: ReadonlySet<MidiNoteNumber>): {tapes: number; holes: number} {
        let tapes = 0;
        let holes = 0;
        for (const tape of tapesOf(organId)) {
          const count = tape.holes.filter((hole) => pipes.has(hole.pipe)).length;
          if (count > 0) tapes += 1;
          holes += count;
        }
        return {tapes, holes};
      },

      /** Removes the Holes on those Pipes from the Organ's Tapes (each keeps its length) and saves. */
      async removeHolesOfPipes(organId: OrganId, pipes: ReadonlySet<MidiNoteNumber>): Promise<boolean> {
        if (store.loadProblem() !== null) return false;
        patchState(store, setEntities(tapesOf(organId).map((tape) => removeHolesOfPipes(tape, pipes)), tapeConfig));
        return save();
      },
    };
  }),
);

/** Loads the Tape library while the app starts. */
export function provideTapeLibrary(): EnvironmentProviders {
  return provideAppInitializer(() => inject(TapeLibrary).load());
}
