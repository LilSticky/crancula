import {DEFAULT_CRANK_SPEED_RANGE} from './crank-speed-range';
import type {Organ, OrganId} from './organ';

/** A Pipe as entered in the editor; the note may still be missing or out of range. */
export interface PipeDraft {
  readonly note: number | null;
}

/** An Organ as entered in the editor. It may be invalid; see `validateOrgan`. */
export interface OrganDraft {
  /** Absent until the Organ is stored for the first time. */
  readonly id?: OrganId;
  readonly name: string;
  readonly tapeBed: {
    readonly tapeWidth: number | null;
    readonly holeDiameter: number | null;
    readonly rowSpacing: number | null;
  };
  readonly minimumGap: number | null;
  readonly leadIn: number | null;
  /** Turns per minute; the slowest and fastest Crank speed of the Organ's range. */
  readonly slowestCrankSpeed: number | null;
  readonly fastestCrankSpeed: number | null;
  /** `null` when the Organ has none. */
  readonly tapePerCrankTurn: number | null;
  readonly pipes: readonly PipeDraft[];
}

export function emptyOrganDraft(): OrganDraft {
  return {
    name: '',
    tapeBed: {tapeWidth: null, holeDiameter: null, rowSpacing: null},
    minimumGap: null,
    leadIn: null,
    slowestCrankSpeed: DEFAULT_CRANK_SPEED_RANGE.slowest,
    fastestCrankSpeed: DEFAULT_CRANK_SPEED_RANGE.fastest,
    tapePerCrankTurn: null,
    pipes: [],
  };
}

export function toDraft(organ: Organ): OrganDraft {
  return {
    id: organ.id,
    name: organ.name,
    tapeBed: {...organ.tapeBed},
    minimumGap: organ.minimumGap,
    leadIn: organ.leadIn,
    slowestCrankSpeed: organ.crankSpeedRange.slowest,
    fastestCrankSpeed: organ.crankSpeedRange.fastest,
    tapePerCrankTurn: organ.tapePerCrankTurn ?? null,
    pipes: organ.pipes.map((pipe) => ({note: pipe.note})),
  };
}

/** Appends an empty Pipe as the last row. */
export function addPipe(draft: OrganDraft): OrganDraft {
  return {...draft, pipes: [...draft.pipes, {note: null}]};
}

export function removePipe(draft: OrganDraft, row: number): OrganDraft {
  assertRow(draft, row);
  return {...draft, pipes: draft.pipes.filter((_, index) => index !== row)};
}

/** Moves the Pipe in `fromRow` to `toRow`; the Pipes in between shift by one row. */
export function movePipe(draft: OrganDraft, fromRow: number, toRow: number): OrganDraft {
  assertRow(draft, fromRow);
  assertRow(draft, toRow);
  const pipes = [...draft.pipes];
  const [moved] = pipes.splice(fromRow, 1);
  pipes.splice(toRow, 0, moved);
  return {...draft, pipes};
}

function assertRow(draft: OrganDraft, row: number): void {
  if (!Number.isInteger(row) || row < 0 || row >= draft.pipes.length) {
    throw new RangeError(`Row ${row} does not exist; the Organ has ${draft.pipes.length} Pipes.`);
  }
}
