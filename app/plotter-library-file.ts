import {parsePlotterLibrarySnapshot, toPlotterSnapshot, type PlotterLibrarySnapshot} from '../api';
import {createSnapshotFile, type FileSystem, type SnapshotFile, type SnapshotFileOptions} from './snapshot-file';

export type {FileSystem};
export type PlotterLibraryFileOptions = SnapshotFileOptions;
export type PlotterLibraryFile = SnapshotFile<PlotterLibrarySnapshot>;

/** The Plotter library snapshot `<dir>/plotters.json` (ADR 3, ADR 8). */
export function createPlotterLibraryFile(dir: string, options: PlotterLibraryFileOptions = {}): PlotterLibraryFile {
  return createSnapshotFile(
    dir,
    {fileName: 'plotters.json', parse: parsePlotterLibrarySnapshot, normalise: toPlotterSnapshot},
    options,
  );
}
