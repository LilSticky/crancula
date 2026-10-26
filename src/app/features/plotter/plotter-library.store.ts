import {type EnvironmentProviders, inject, provideAppInitializer} from '@angular/core';
import {patchState, signalStore, withMethods, withState} from '@ngrx/signals';
import {removeEntity, setAllEntities, setEntity, withEntities} from '@ngrx/signals/entities';
import {parsePlotterLibrarySnapshot, type Plotter, type PlotterId, toPlotterSnapshot} from '@api/index';
import {CRANCULA_API} from '../../core/crancula-api.token';

interface PlotterLibraryState {
  /** Set when the stored Plotters couldn't be read on startup; the file was moved to `backupPath`. */
  readonly loadProblem: {readonly backupPath: string; readonly reason: string} | null;
  /** Set when the last write to disk failed; cleared by the next successful one. */
  readonly saveProblem: {readonly reason: string} | null;
}

/** The in-memory Plotters: the source of truth while the app runs (ADR 3). Holds only valid Plotters. */
export const PlotterLibrary = signalStore(
  {providedIn: 'root'},
  withEntities<Plotter>(),
  withState<PlotterLibraryState>({loadProblem: null, saveProblem: null}),
  withMethods((store, api = inject(CRANCULA_API)) => {
    /** Writes all Plotters to disk; resolves `true` when that worked. */
    async function save(): Promise<boolean> {
      const result = await api.plotters.save(toPlotterSnapshot(store.entities()));
      patchState(store, {saveProblem: result.status === 'saved' ? null : {reason: result.reason}});
      return result.status === 'saved';
    }

    return {
      async load(): Promise<void> {
        const result = await api.plotters.load();
        if (result.status === 'unreadable') {
          patchState(store, setAllEntities([] as Plotter[]), {loadProblem: {backupPath: result.backupPath, reason: result.reason}});
          return;
        }
        const plotters = result.status === 'loaded' ? parsePlotterLibrarySnapshot(result.snapshot) : {ok: true as const, value: []};
        if (plotters.ok) {
          patchState(store, setAllEntities(plotters.value), {loadProblem: null});
        } else {
          patchState(store, setAllEntities([] as Plotter[]), {loadProblem: {backupPath: '', reason: plotters.error}});
        }
      },

      /** Adds or replaces a valid Plotter and writes all Plotters to disk; resolves `false` when writing failed. */
      put(plotter: Plotter): Promise<boolean> {
        patchState(store, setEntity(plotter));
        return save();
      },

      async remove(id: PlotterId): Promise<void> {
        patchState(store, removeEntity(id));
        await save();
      },
    };
  }),
);

/** Loads the Plotter library while the app starts. */
export function providePlotterLibrary(): EnvironmentProviders {
  return provideAppInitializer(() => inject(PlotterLibrary).load());
}
