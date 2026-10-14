import {InjectionToken} from '@angular/core';
import {
  parseTapeLibrarySnapshot,
  type CranculaApi,
  type OrganLibrarySnapshot,
  type TapeLibraryLoadResult,
  type TapeLibrarySaveResult,
  type TapeLibrarySnapshot,
} from '@api/index';

/** The main-process API (ADR 4); an in-memory stand-in in the browser dev server and in tests. */
export const CRANCULA_API = new InjectionToken<CranculaApi>('CranculaApi', {
  providedIn: 'root',
  factory: () => window.crancula ?? createInMemoryCranculaApi(),
});

/** Failures the in-memory API answers on request, so tests can reach the error paths. */
export interface InMemoryCranculaApiFailures {
  readonly tapes?: {
    readonly load?: 'unreadable';
    readonly save?: 'failed';
  };
}

/** Keeps the snapshots in memory; nothing survives a reload. */
export function createInMemoryCranculaApi(
  initial?: OrganLibrarySnapshot,
  initialTapes?: TapeLibrarySnapshot,
  failures: InMemoryCranculaApiFailures = {},
): CranculaApi {
  let stored = initial;
  let storedTapes = initialTapes;
  return {
    organs: {
      load: () => Promise.resolve(stored ? {status: 'loaded', snapshot: stored} : {status: 'empty'}),
      save: (snapshot) => {
        stored = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    tapes: {
      load: (): Promise<TapeLibraryLoadResult> => {
        if (failures.tapes?.load === 'unreadable') {
          return Promise.resolve({
            status: 'unreadable',
            backupPath: 'tapes.json.bak',
            reason: 'the Tape library could not be read',
          });
        }
        return Promise.resolve(storedTapes ? {status: 'loaded', snapshot: storedTapes} : {status: 'empty'});
      },
      save: (snapshot): Promise<TapeLibrarySaveResult> => {
        if (failures.tapes?.save === 'failed') {
          return Promise.resolve({status: 'failed', reason: 'the Tape library could not be written'});
        }
        const parsed = parseTapeLibrarySnapshot(snapshot);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        storedTapes = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    app: {
      setLanguage: () => Promise.resolve({status: 'set'}),
    },
  };
}
