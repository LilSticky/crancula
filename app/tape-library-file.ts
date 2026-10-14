import {parseTapeLibrarySnapshot, type TapeLibrarySnapshot, toTapeLibrarySnapshot} from '../api';
import {createSnapshotFile, type SnapshotFile, type SnapshotFileOptions} from './snapshot-file';

export type TapeLibraryFileOptions = SnapshotFileOptions;
export type TapeLibraryFile = SnapshotFile<TapeLibrarySnapshot>;

/** The Tape library snapshot `<dir>/tapes.json`, holding the Tapes and the Songs they came from (ADR 3, ADR 8). */
export function createTapeLibraryFile(dir: string, options: TapeLibraryFileOptions = {}): TapeLibraryFile {
  return createSnapshotFile(
    dir,
    {
      fileName: 'tapes.json',
      parse: parseTapeLibrarySnapshot,
      normalise: ({tapes, songs}) => toTapeLibrarySnapshot(tapes, songs),
    },
    options,
  );
}
