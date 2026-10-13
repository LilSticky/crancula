import type {OrganLibrarySnapshot} from './organ-library-snapshot';

export type OrganLibraryLoadResult =
  /** The snapshot file was read and is valid. */
  | {readonly status: 'loaded'; readonly snapshot: OrganLibrarySnapshot}
  /** There is no snapshot file yet. */
  | {readonly status: 'empty'}
  /** The snapshot file couldn't be used; it was moved to `backupPath` and the library starts empty. */
  | {readonly status: 'unreadable'; readonly backupPath: string; readonly reason: string};

export type OrganLibrarySaveResult =
  | {readonly status: 'saved'}
  /** The payload failed validation; nothing was written. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the previous file is left intact. */
  | {readonly status: 'failed'; readonly reason: string};

/** What the preload script exposes as `window.crancula` (ADR 4). */
export interface CranculaApi {
  readonly organs: {
    load(): Promise<OrganLibraryLoadResult>;
    save(snapshot: OrganLibrarySnapshot): Promise<OrganLibrarySaveResult>;
  };
}
