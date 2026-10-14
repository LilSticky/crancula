import {type OrganLibrarySnapshot, parseOrganLibrarySnapshot, toSnapshot} from '../api';
import {createSnapshotFile, type FileSystem, type SnapshotFile, type SnapshotFileOptions} from './snapshot-file';

export type {FileSystem};
export type OrganLibraryFileOptions = SnapshotFileOptions;
export type OrganLibraryFile = SnapshotFile<OrganLibrarySnapshot>;

/** The Organ library snapshot `<dir>/organs.json` (ADR 3, ADR 8). */
export function createOrganLibraryFile(dir: string, options: OrganLibraryFileOptions = {}): OrganLibraryFile {
  return createSnapshotFile(
    dir,
    {fileName: 'organs.json', parse: parseOrganLibrarySnapshot, normalise: toSnapshot},
    options,
  );
}
