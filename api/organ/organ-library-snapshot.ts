import {err, ok, type Result} from '../result';
import {type Organ, organId} from './organ';
import {validateOrgan} from './validate-organ';

/** One Organ in the snapshot file. Array order of `pipes` is the row order. */
export interface OrganSnapshot {
  readonly id: string;
  readonly name: string;
  readonly tapeBed: {
    readonly tapeWidth: number;
    readonly border: number;
    readonly holeDiameter: number;
    readonly rowSpacing: number;
  };
  readonly minimumGap: number;
  readonly pipes: readonly {readonly note: number}[];
}

/** Snapshot file format, version 1, stored at `<userData>/snapshots/organs.json` (ADR 8). */
export interface OrganLibrarySnapshot {
  readonly version: 1;
  readonly organs: readonly OrganSnapshot[];
}

export function toSnapshot(organs: readonly Organ[]): OrganLibrarySnapshot {
  return {
    version: 1,
    organs: organs.map((organ) => ({
      id: organ.id,
      name: organ.name,
      tapeBed: {...organ.tapeBed},
      minimumGap: organ.minimumGap,
      pipes: organ.pipes.map((pipe) => ({note: pipe.note})),
    })),
  };
}

/**
 * Reads untrusted snapshot data (from disk or IPC).
 * @returns the valid Organs, or a reason why the data can't be used
 */
export function parseOrganLibrarySnapshot(input: unknown): Result<Organ[], string> {
  if (!isRecord(input)) return err('snapshot is not an object');
  if (input['version'] !== 1) return err(`unsupported snapshot version ${String(input['version'])}`);
  const organs = input['organs'];
  if (!Array.isArray(organs)) return err('organs is not a list');

  const parsed: Organ[] = [];
  for (const [index, entry] of organs.entries()) {
    const organ = parseOrgan(entry);
    if (!organ.ok) return err(`Organ ${index}: ${organ.error}`);
    if (parsed.some((other) => other.id === organ.value.id)) return err(`Organ ${index}: duplicate id ${organ.value.id}`);
    parsed.push(organ.value);
  }
  return ok(parsed);
}

function parseOrgan(input: unknown): Result<Organ, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, tapeBed, minimumGap, pipes} = input;
  if (typeof id !== 'string' || organId(id) === undefined) return err('id is not a UUID');
  if (typeof name !== 'string') return err('name is not a string');
  if (!isRecord(tapeBed)) return err('tapeBed is not an object');
  const {tapeWidth, border, holeDiameter, rowSpacing} = tapeBed;
  if (!isNumber(tapeWidth) || !isNumber(border) || !isNumber(holeDiameter) || !isNumber(rowSpacing) || !isNumber(minimumGap)) {
    return err('a measurement is not a number');
  }
  if (!Array.isArray(pipes)) return err('pipes is not a list');
  const notes: number[] = [];
  for (const pipe of pipes as unknown[]) {
    if (!isRecord(pipe) || !isNumber(pipe['note'])) return err('a Pipe has no numeric note');
    notes.push(pipe['note']);
  }

  const result = validateOrgan({
    id: organId(id),
    name,
    tapeBed: {tapeWidth, border, holeDiameter, rowSpacing},
    minimumGap,
    pipes: notes.map((note) => ({note})),
  });
  return result.ok ? result : err(result.error.map((violation) => `${violation.path}: ${violation.code}`).join(', '));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}
