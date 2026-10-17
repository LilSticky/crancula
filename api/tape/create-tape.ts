import {minimumHoleLength, millimetres, type Millimetres, type Organ} from '../organ/organ';
import {err, ok, type Result} from '../result';
import type {PartIndex, Song} from '../song/song';
import type {ImportSummary} from './import-summary';
import {fixHoles, holeLimitsOf, mergeOverlaps} from './hole-fixes';
import {fitNotesOf, fitOf, placedNotesOf} from './fit';
import {allowedTranspositions} from './transposition';
import {
  asValidTape,
  columnCount,
  newTapeId,
  type Hole,
  type Tape,
  type Transposition,
} from './tape';

export interface CreateTapeInput {
  readonly song: Song;
  readonly selectedParts: ReadonlySet<PartIndex>;
  readonly organ: Organ;
  readonly transposition: Transposition;
  readonly name: string;
  /** In millimetres; checked here. */
  readonly columnLength: number;
}

export type TapeViolationCode =
  | 'name-required'
  | 'column-length-must-be-positive'
  | 'no-part-selected'
  | 'transposition-out-of-range'
  | 'no-note-on-a-pipe';

export interface TapeViolation {
  readonly code: TapeViolationCode;
}

export interface CreatedTape {
  readonly tape: Tape;
  readonly importSummary: ImportSummary;
}

function valid<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid ${what}`);
  return value;
}

function validPartIndices(song: Song, selectedParts: ReadonlySet<PartIndex>): ReadonlySet<PartIndex> {
  return new Set([...selectedParts].filter((index) => index < song.parts.length));
}

function violationsOf(input: CreateTapeInput, selectedParts: ReadonlySet<PartIndex>): TapeViolation[] {
  const codes: TapeViolationCode[] = [];
  if (input.name.trim() === '') codes.push('name-required');
  if (!(Number.isFinite(input.columnLength) && input.columnLength > 0)) {
    codes.push('column-length-must-be-positive');
  }
  if (selectedParts.size === 0) {
    codes.push('no-part-selected');
  } else {
    const {lowest, highest} = allowedTranspositions(input.song, selectedParts);
    if (input.transposition < lowest || input.transposition > highest) {
      codes.push('transposition-out-of-range');
    } else {
      const {matchingAPipe, movedByOctaves} = fitOf(input.song, selectedParts, input.organ, input.transposition);
      if (matchingAPipe + movedByOctaves === 0) codes.push('no-note-on-a-pipe');
    }
  }
  return codes.map((code) => ({code}));
}

/**
 * Brings the selected Parts of a Song onto a new Tape: Quantisation, Transposition, octave moves,
 * overlap merge, then the Minimum Hole Length and Minimum Gap fixes (FR-012).
 */
export function createTape(input: CreateTapeInput): Result<CreatedTape, readonly TapeViolation[]> {
  const selectedParts = validPartIndices(input.song, input.selectedParts);
  const violations = violationsOf(input, selectedParts);
  if (violations.length > 0) return err(violations);

  const {song, organ, transposition} = input;
  const holes: Hole[] = placedNotesOf(song, selectedParts, organ, transposition).flatMap(
    ({pipe, start, length}) => (pipe === undefined ? [] : [{pipe, start, length}]),
  );
  const {movedByOctaves, unplayableNotes} = fitNotesOf(song, selectedParts, organ, transposition);

  const columnLength = valid(millimetres(input.columnLength), 'Column length');
  const merged = mergeOverlaps(holes);
  const fixed = fixHoles(merged.holes, holeLimitsOf(organ, columnLength));
  const length = valid(
    columnCount(Math.max(...fixed.holes.map((hole) => hole.start + hole.length))),
    'Tape length',
  );

  return ok({
    tape: asValidTape({
      id: newTapeId(),
      name: input.name.trim(),
      organId: organ.id,
      songId: song.id,
      selectedParts: [...selectedParts].sort((a, b) => a - b),
      transposition,
      columnLength,
      length,
      holes: fixed.holes,
    }),
    importSummary: {
      transposition,
      notesOnTape: holes.length,
      movedByOctaves,
      unplayableNotes,
      holesFixed: [...merged.changes, ...fixed.changes],
    },
  });
}

/** The Column length of the last Tape created for the Organ, else its Minimum Hole Length (FR-010). */
export function prefilledColumnLength(organ: Organ, tapes: readonly Tape[]): Millimetres {
  const ofOrgan = tapes.filter((each) => each.organId === organ.id);
  return ofOrgan[ofOrgan.length - 1]?.columnLength ?? minimumHoleLength(organ.tapeBed);
}
