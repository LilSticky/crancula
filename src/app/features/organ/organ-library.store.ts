import {type EnvironmentProviders, inject, provideAppInitializer} from '@angular/core';
import {patchState, signalStore, withMethods, withState} from '@ngrx/signals';
import {removeEntity, setAllEntities, setEntity, withEntities} from '@ngrx/signals/entities';
import {type Organ, type OrganId, parseOrganLibrarySnapshot, toSnapshot} from '@api/index';
import {CRANCULA_API} from '../../core/crancula-api.token';

interface OrganLibraryState {
  /** Set when the stored Organs couldn't be read on startup; the file was moved to `backupPath`. */
  readonly loadProblem: {readonly backupPath: string; readonly reason: string} | null;
  /** Set when the last write to disk failed; cleared by the next successful one. */
  readonly saveProblem: {readonly reason: string} | null;
}

/** The in-memory Organs: the source of truth while the app runs (ADR 3). Holds only valid Organs. */
export const OrganLibrary = signalStore(
  {providedIn: 'root'},
  withEntities<Organ>(),
  withState<OrganLibraryState>({loadProblem: null, saveProblem: null}),
  withMethods((store, api = inject(CRANCULA_API)) => {
    async function save(): Promise<void> {
      const result = await api.organs.save(toSnapshot(store.entities()));
      patchState(store, {saveProblem: result.status === 'saved' ? null : {reason: result.reason}});
    }

    return {
      async load(): Promise<void> {
        const result = await api.organs.load();
        if (result.status === 'unreadable') {
          patchState(store, setAllEntities([] as Organ[]), {loadProblem: {backupPath: result.backupPath, reason: result.reason}});
          return;
        }
        const organs = result.status === 'loaded' ? parseOrganLibrarySnapshot(result.snapshot) : {ok: true as const, value: []};
        if (organs.ok) {
          patchState(store, setAllEntities(organs.value), {loadProblem: null});
        } else {
          patchState(store, setAllEntities([] as Organ[]), {loadProblem: {backupPath: '', reason: organs.error}});
        }
      },

      /** Adds or replaces a valid Organ and writes all Organs to disk. */
      put(organ: Organ): Promise<void> {
        patchState(store, setEntity(organ));
        return save();
      },

      remove(id: OrganId): Promise<void> {
        patchState(store, removeEntity(id));
        return save();
      },
    };
  }),
);

/** Loads the Organ library while the app starts. */
export function provideOrganLibrary(): EnvironmentProviders {
  return provideAppInitializer(() => inject(OrganLibrary).load());
}
