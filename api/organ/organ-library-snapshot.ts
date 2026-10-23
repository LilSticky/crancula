import {err, ok, type Result} from '../result';
import {type Organ, organId} from './organ';
import {validateOrgan} from './validate-organ';

/** One Organ in the snapshot file. Array order of `pipes` is the row order. */
export interface OrganSnapshot {
  readonly id: string;
  readonly name: string;
  readonly tapeBed: {
    readonly tapeWidth: number;
    readonly holeDiameter: number;
    readonly rowSpacing: number;
  };
  readonly minimumGap: number;
  readonly leadIn: number;
  /** Version 4 onwards; absent when the Organ has none. */
  readonly tapePerCrankTurn?: number;
  readonly pipes: readonly {readonly note: number}[];
}

/** Snapshot file format, version 4, stored at `<userData>/snapshots/organs.json` (ADR 8, ADR 20). */
export interface OrganLibrarySnapshot {
  readonly version: 4;
  readonly organs: readonly OrganSnapshot[];
}

export function toSnapshot(organs: readonly Organ[]): OrganLibrarySnapshot {
  return {
    version: 4,
    organs: organs.map((organ) => ({
      id: organ.id,
      name: organ.name,
      tapeBed: {...organ.tapeBed},
      minimumGap: organ.minimumGap,
      leadIn: organ.leadIn,
      ...(organ.tapePerCrankTurn === undefined ? {} : {tapePerCrankTurn: organ.tapePerCrankTurn}),
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
  // Version 1 stored a Border, which is derived now; its value is ignored (ADR 20).
  // Versions 1 and 2 stored no Lead-in; they read with a Lead-in of 0 (ADR 20).
  // Versions 1 to 3 stored no Tape per Crank turn (ADR 20).
  const version = input['version'];
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
    return err(`unsupported snapshot version ${String(version)}`);
  }
  const organs = input['organs'];
  if (!Array.isArray(organs)) return err('organs is not a list');

  const parsed: Organ[] = [];
  for (const [index, entry] of organs.entries()) {
    const organ = parseOrgan(entry, version);
    if (!organ.ok) return err(`Organ ${index}: ${organ.error}`);
    if (parsed.some((other) => other.id === organ.value.id)) return err(`Organ ${index}: duplicate id ${organ.value.id}`);
    parsed.push(organ.value);
  }
  return ok(parsed);
}

function parseOrgan(input: unknown, version: 1 | 2 | 3 | 4): Result<Organ, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, tapeBed, minimumGap, pipes} = input;
  const leadIn = version >= 3 ? input['leadIn'] : 0;
  const perCrankTurn = version === 4 ? input['tapePerCrankTurn'] : undefined;
  if (perCrankTurn !== undefined && !isNumber(perCrankTurn)) return err('tapePerCrankTurn is not a number');
  if (typeof id !== 'string' || organId(id) === undefined) return err('id is not a UUID');
  if (typeof name !== 'string') return err('name is not a string');
  if (!isRecord(tapeBed)) return err('tapeBed is not an object');
  const {tapeWidth, holeDiameter, rowSpacing} = tapeBed;
  if (!isNumber(tapeWidth) || !isNumber(holeDiameter) || !isNumber(rowSpacing) || !isNumber(minimumGap) || !isNumber(leadIn)) {
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
    tapeBed: {tapeWidth, holeDiameter, rowSpacing},
    minimumGap,
    leadIn,
    tapePerCrankTurn: perCrankTurn ?? null,
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
