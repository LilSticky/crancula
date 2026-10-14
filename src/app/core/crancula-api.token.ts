import {InjectionToken} from '@angular/core';
import type {CranculaApi, OrganLibrarySnapshot} from '@api/index';

/** The main-process API (ADR 4); an in-memory stand-in in the browser dev server and in tests. */
export const CRANCULA_API = new InjectionToken<CranculaApi>('CranculaApi', {
  providedIn: 'root',
  factory: () => window.crancula ?? createInMemoryCranculaApi(),
});

/** Keeps the snapshot in memory; nothing survives a reload. */
export function createInMemoryCranculaApi(initial?: OrganLibrarySnapshot): CranculaApi {
  let stored = initial;
  return {
    organs: {
      load: () => Promise.resolve(stored ? {status: 'loaded', snapshot: stored} : {status: 'empty'}),
      save: (snapshot) => {
        stored = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    app: {
      setLanguage: () => Promise.resolve(),
    },
  };
}
