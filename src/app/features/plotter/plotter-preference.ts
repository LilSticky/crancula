import {computed, inject, Injectable, signal} from '@angular/core';
import {type Plotter, type PlotterId, plotterId} from '@api/index';
import {PlotterLibrary} from './plotter-library.store';

const PLOTTER_KEY = 'crancula.plotter';

/** The Plotter the user picked, remembered in `localStorage`; reads as no Plotter when it is no longer in the library. */
@Injectable({providedIn: 'root'})
export class PlotterPreference {
  private readonly library = inject(PlotterLibrary);
  private readonly current = signal<PlotterId | undefined>(this.stored());

  readonly picked = computed<Plotter | undefined>(() => {
    const id = this.current();
    return id === undefined ? undefined : this.library.entities().find((plotter) => plotter.id === id);
  });

  pick(id: PlotterId | undefined): void {
    if (id === undefined) {
      localStorage.removeItem(PLOTTER_KEY);
    } else {
      localStorage.setItem(PLOTTER_KEY, id);
    }
    this.current.set(id);
  }

  private stored(): PlotterId | undefined {
    const value = localStorage.getItem(PLOTTER_KEY);
    return value === null ? undefined : plotterId(value);
  }
}
