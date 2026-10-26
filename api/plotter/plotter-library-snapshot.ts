import {err, ok, type Result} from '../result';
import {type Plotter, plotterId} from './plotter';
import {validatePlotter} from './validate-plotter';

/** One Plotter in the snapshot file. A roll Plotter has no `workingLength` and no `overlap`. */
export interface PlotterSnapshot {
  readonly id: string;
  readonly name: string;
  readonly format: 'svg';
  readonly workingWidth: number;
  readonly roll: boolean;
  readonly workingLength?: number;
  readonly overlap?: number;
}

/** Snapshot file format, version 1, stored at `<userData>/snapshots/plotters.json` (ADR 8, ADR 28). */
export interface PlotterLibrarySnapshot {
  readonly version: 1;
  readonly plotters: readonly PlotterSnapshot[];
}

export function toPlotterSnapshot(plotters: readonly Plotter[]): PlotterLibrarySnapshot {
  return {version: 1, plotters: plotters.map(toPlotterEntry)};
}

function toPlotterEntry(plotter: Plotter): PlotterSnapshot {
  const fields = {
    id: plotter.id,
    name: plotter.name,
    format: plotter.format,
    workingWidth: plotter.workingWidth,
    roll: plotter.roll,
  };
  return plotter.roll ? fields : {...fields, workingLength: plotter.workingLength, overlap: plotter.overlap};
}

/**
 * Reads untrusted snapshot data (from disk or IPC).
 * @returns the valid Plotters, or a reason why the data can't be used
 */
export function parsePlotterLibrarySnapshot(input: unknown): Result<Plotter[], string> {
  if (!isRecord(input)) return err('snapshot is not an object');
  const version = input['version'];
  if (version !== 1) return err(`unsupported snapshot version ${String(version)}`);
  const plotters = input['plotters'];
  if (!isList(plotters)) return err('plotters is not a list');

  const parsed: Plotter[] = [];
  for (const [index, entry] of plotters.entries()) {
    const plotter = parsePlotter(entry);
    if (!plotter.ok) return err(`Plotter ${index}: ${plotter.error}`);
    if (parsed.some((other) => other.id === plotter.value.id)) {
      return err(`Plotter ${index}: duplicate id ${plotter.value.id}`);
    }
    parsed.push(plotter.value);
  }
  return ok(parsed);
}

function parsePlotter(input: unknown): Result<Plotter, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, format, workingWidth, roll, workingLength, overlap} = input;

  const validId = typeof id === 'string' ? plotterId(id) : undefined;
  if (validId === undefined) return err('id is not a UUID');
  if (typeof name !== 'string') return err('name is not a string');
  if (format !== 'svg') return err('format is not svg');
  if (typeof roll !== 'boolean') return err('roll is not a boolean');
  if (roll && (workingLength !== undefined || overlap !== undefined)) {
    return err('a roll Plotter has no working length and no Overlap');
  }

  const result = validatePlotter({
    id: validId,
    name,
    workingWidth: numberOrNull(workingWidth),
    roll,
    workingLength: numberOrNull(workingLength),
    overlap: numberOrNull(overlap),
  });
  return result.ok ? result : err(result.error.map((violation) => `${violation.path}: ${violation.code}`).join(', '));
}

/** A value that is not a number is missing, which the validator reports as a required value. */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
