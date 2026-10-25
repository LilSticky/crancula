import {err, ok, type Result} from '../result';
import {crankSpeed, DEFAULT_CRANK_SPEED, type CrankSpeed} from './crank-speed';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId} from '../organ/organ';
import {
  beatTypeOf,
  fifthsOf,
  type Key,
  type Mode,
  modeOf,
  type Part,
  type PartIndex,
  type Song,
  type TimeSignature,
  note,
  part,
  partIndex,
  song,
  songId,
  tick,
  ticksPerQuarter,
  type Tick,
} from '../song/song';
import {
  type Hole,
  type Tape,
  column,
  columnCount,
  tapeId,
  transposition,
  validTape,
  type TapeRuleViolation,
} from './tape';

/** One Song in the snapshot file. Array order of `parts` is the PartIndex. */
export interface SongSnapshot {
  readonly id: string;
  readonly name: string;
  readonly ticksPerQuarter: number;
  readonly parts: readonly PartSnapshot[];
  /** `[start, beats, beatType]`, starts increasing; omitted when empty (version 3). */
  readonly timeSignatures?: readonly (readonly [number, number, number])[];
  /** Integer Tick > 0, shorter than the first Bar; omitted when none (version 3). */
  readonly upbeat?: number;
  /** `[start, fifths, mode]`, starts increasing; omitted when empty (version 3). */
  readonly keys?: readonly (readonly [number, number, Mode])[];
}

export interface PartSnapshot {
  readonly name?: string;
  readonly percussion: boolean;
  /** `[noteNumber, start, duration]`, sorted by start, then note number. */
  readonly notes: readonly (readonly [number, number, number])[];
}

export interface TapeSnapshot {
  readonly id: string;
  readonly name: string;
  readonly organId: string;
  readonly songId?: string;
  readonly selectedParts?: readonly number[];
  readonly transposition: number;
  readonly columnLength: number;
  readonly crankSpeed: number;
  readonly length: number;
  /** `[pipe, start, length]`, sorted by pipe, then start. */
  readonly holes: readonly (readonly [number, number, number])[];
}

/** Snapshot file format, version 3, stored at `<userData>/snapshots/tapes.json` (ADR 8, ADR 20). */
export interface TapeLibrarySnapshot {
  readonly version: 3;
  readonly songs: readonly SongSnapshot[];
  readonly tapes: readonly TapeSnapshot[];
}

/** The Tapes in their order, and the Songs they reference. */
export interface TapeLibrary {
  readonly songs: Song[];
  readonly tapes: Tape[];
}

/** Writes the Tapes in their order, only the Songs they reference, and Holes sorted. */
export function toTapeLibrarySnapshot(tapes: readonly Tape[], songs: readonly Song[]): TapeLibrarySnapshot {
  const referenced = new Set(tapes.map((tape) => tape.songId));
  return {
    version: 3,
    songs: songs.filter((candidate) => referenced.has(candidate.id)).map(toSongSnapshot),
    tapes: tapes.map(toTapeSnapshot),
  };
}

function toSongSnapshot(source: Song): SongSnapshot {
  return {
    id: source.id,
    name: source.name,
    ticksPerQuarter: source.ticksPerQuarter,
    parts: source.parts.map((entry) => ({
      ...(entry.name === undefined ? {} : {name: entry.name}),
      percussion: entry.percussion,
      notes: entry.notes.map((n) => [n.noteNumber, n.start, n.duration] as const),
    })),
    ...(source.timeSignatures.length === 0
      ? {}
      : {timeSignatures: source.timeSignatures.map((each) => [each.start, each.beats, each.beatType] as const)}),
    ...(source.upbeat === undefined ? {} : {upbeat: source.upbeat}),
    ...(source.keys.length === 0 ? {} : {keys: source.keys.map((each) => [each.start, each.fifths, each.mode] as const)}),
  };
}

function toTapeSnapshot(tape: Tape): TapeSnapshot {
  return {
    id: tape.id,
    name: tape.name,
    organId: tape.organId,
    ...(tape.songId === undefined ? {} : {songId: tape.songId}),
    ...(tape.selectedParts === undefined ? {} : {selectedParts: [...tape.selectedParts]}),
    transposition: tape.transposition,
    columnLength: tape.columnLength,
    crankSpeed: tape.crankSpeed,
    length: tape.length,
    holes: [...tape.holes]
      .sort((a, b) => a.pipe - b.pipe || a.start - b.start)
      .map((hole) => [hole.pipe, hole.start, hole.length] as const),
  };
}

/**
 * Reads untrusted snapshot data (from disk or IPC). Rules that depend on the Organ are not checked.
 * @returns the Songs and Tapes, or a reason why the data can't be used
 */
export function parseTapeLibrarySnapshot(input: unknown): Result<TapeLibrary, string> {
  if (!isRecord(input)) return err('snapshot is not an object');
  const version = input['version'];
  if (version !== 1 && version !== 2 && version !== 3) return err(`unsupported snapshot version ${String(version)}`);
  const {songs, tapes} = input;
  if (!Array.isArray(songs)) return err('songs is not a list');
  if (!Array.isArray(tapes)) return err('tapes is not a list');

  const parsedSongs: Song[] = [];
  for (const [index, entry] of (songs as unknown[]).entries()) {
    // Versions 1 and 2 stored no Time signatures, upbeat or Keys (ADR 20).
    const parsed = parseSong(entry, version === 3);
    if (!parsed.ok) return err(`Song ${index}: ${parsed.error}`);
    if (parsedSongs.some((other) => other.id === parsed.value.id)) {
      return err(`Song ${index}: duplicate id ${parsed.value.id}`);
    }
    parsedSongs.push(parsed.value);
  }

  const parsedTapes: Tape[] = [];
  for (const [index, entry] of (tapes as unknown[]).entries()) {
    // Version 1 stored no Crank speed; its Tapes read at the default (ADR 20).
    const parsed = parseTape(entry, parsedSongs, version !== 1);
    if (!parsed.ok) return err(`Tape ${index}: ${parsed.error}`);
    if (parsedTapes.some((other) => other.id === parsed.value.id)) {
      return err(`Tape ${index}: duplicate id ${parsed.value.id}`);
    }
    parsedTapes.push(parsed.value);
  }

  const unreferenced = parsedSongs.find((candidate) => !parsedTapes.some((tape) => tape.songId === candidate.id));
  if (unreferenced) return err(`Song ${unreferenced.id} is not referenced by a Tape`);
  return ok({songs: parsedSongs, tapes: parsedTapes});
}

function parseSong(input: unknown, hasMetre: boolean): Result<Song, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, parts} = input;
  const brandedId = typeof id === 'string' ? songId(id) : undefined;
  if (brandedId === undefined) return err('id is not a UUID');
  if (typeof name !== 'string') return err('name is not a string');
  const ticks = typeof input['ticksPerQuarter'] === 'number' ? ticksPerQuarter(input['ticksPerQuarter']) : undefined;
  if (ticks === undefined) return err('ticksPerQuarter is not an integer 1-32767');
  if (!Array.isArray(parts)) return err('parts is not a list');

  const parsedParts: Part[] = [];
  for (const [index, entry] of (parts as unknown[]).entries()) {
    const parsed = parsePart(entry);
    if (!parsed.ok) return err(`Part ${index}: ${parsed.error}`);
    parsedParts.push(parsed.value);
  }

  const metre = hasMetre ? parseMetre(input) : ok(NO_METRE);
  if (!metre.ok) return metre;
  const result = song({id: brandedId, name, ticksPerQuarter: ticks, parts: parsedParts, ...metre.value});
  return result ? ok(result) : err('name is blank, there is no Part, or the metre breaks a rule');
}

/** The Time signatures, upbeat and Keys of a Song; a Song that keeps none has these. */
interface Metre {
  readonly timeSignatures: readonly TimeSignature[];
  readonly upbeat: Tick | undefined;
  readonly keys: readonly Key[];
}

const NO_METRE: Metre = {timeSignatures: [], upbeat: undefined, keys: []};

function parseMetre(input: Record<string, unknown>): Result<Metre, string> {
  const timeSignatures = parseTimeSignatures(input['timeSignatures']);
  if (!timeSignatures.ok) return timeSignatures;
  const upbeat = parseUpbeat(input['upbeat']);
  if (!upbeat.ok) return upbeat;
  const keys = parseKeys(input['keys']);
  if (!keys.ok) return keys;
  return ok({timeSignatures: timeSignatures.value, upbeat: upbeat.value, keys: keys.value});
}

function parseTimeSignatures(input: unknown): Result<TimeSignature[], string> {
  if (input === undefined) return ok([]);
  if (!Array.isArray(input)) return err('timeSignatures is not a list');
  const parsed: TimeSignature[] = [];
  for (const entry of input as unknown[]) {
    const triple = numberTriple(entry);
    const start = triple ? tick(triple[0]) : undefined;
    const beatType = triple ? beatTypeOf(triple[2]) : undefined;
    if (triple === undefined || start === undefined || beatType === undefined) {
      return err('a Time signature is not [start, beats, beatType] with a beat type of 1, 2, 4, 8, 16, 32 or 64');
    }
    parsed.push({start, beats: triple[1], beatType});
  }
  return ok(parsed);
}

function parseUpbeat(input: unknown): Result<Tick | undefined, string> {
  if (input === undefined) return ok(undefined);
  const upbeat = typeof input === 'number' ? tick(input) : undefined;
  return upbeat === undefined ? err('upbeat is not an integer Tick') : ok(upbeat);
}

function parseKeys(input: unknown): Result<Key[], string> {
  if (input === undefined) return ok([]);
  if (!Array.isArray(input)) return err('keys is not a list');
  const parsed: Key[] = [];
  for (const entry of input as unknown[]) {
    const fields = Array.isArray(entry) && entry.length === 3 ? (entry as unknown[]) : undefined;
    const start = typeof fields?.[0] === 'number' ? tick(fields[0]) : undefined;
    const fifths = typeof fields?.[1] === 'number' ? fifthsOf(fields[1]) : undefined;
    const mode = modeOf(fields?.[2]);
    if (start === undefined || fifths === undefined || mode === undefined) {
      return err('a Key is not [start, fifths, "major" or "minor"]');
    }
    parsed.push({start, fifths, mode});
  }
  return ok(parsed);
}

function parsePart(input: unknown): Result<Part, string> {
  if (!isRecord(input)) return err('not an object');
  const {name, percussion, notes} = input;
  if (name !== undefined && typeof name !== 'string') return err('name is not a string');
  if (typeof percussion !== 'boolean') return err('percussion is not a boolean');
  if (!Array.isArray(notes)) return err('notes is not a list');

  const parsedNotes = [];
  for (const entry of notes as unknown[]) {
    const triple = numberTriple(entry);
    const noteNumber = triple ? midiNoteNumber(triple[0]) : undefined;
    const start = triple ? tick(triple[1]) : undefined;
    const duration = triple ? tick(triple[2]) : undefined;
    if (noteNumber === undefined || start === undefined || duration === undefined) {
      return err('a Note is not [noteNumber 0-127, start, duration] within the Tick range');
    }
    const parsed = note({noteNumber, start, duration});
    if (!parsed) return err('a Note ends beyond the Tick range');
    parsedNotes.push(parsed);
  }

  const result = part({name, percussion, notes: parsedNotes});
  return result ? ok(result) : err('name is blank, there are no Notes, or the Notes are not sorted');
}

function parseTape(input: unknown, songs: readonly Song[], hasCrankSpeed: boolean): Result<Tape, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, songId: songIdInput, selectedParts, holes} = input;
  const brandedId = typeof id === 'string' ? tapeId(id) : undefined;
  if (brandedId === undefined) return err('id is not a UUID');
  if (typeof name !== 'string') return err('name is blank');
  const organ = typeof input['organId'] === 'string' ? organId(input['organId']) : undefined;
  if (organ === undefined) return err('organId is not a UUID');

  const source = parseSongReference(songIdInput, selectedParts, songs);
  if (!source.ok) return source;

  const shift = typeof input['transposition'] === 'number' ? transposition(input['transposition']) : undefined;
  if (shift === undefined) return err('transposition is not an integer from -127 to 127');
  const columnLength = typeof input['columnLength'] === 'number' ? millimetres(input['columnLength']) : undefined;
  if (columnLength === undefined || columnLength <= 0) return err('columnLength is not a number > 0');
  const speed = hasCrankSpeed ? parseCrankSpeed(input['crankSpeed']) : DEFAULT_CRANK_SPEED;
  if (speed === undefined) return err('crankSpeed is not a finite number from 1 to 300');
  const length = typeof input['length'] === 'number' ? columnCount(input['length']) : undefined;
  if (length === undefined) return err('length is not an integer >= 1');

  const parsedHoles = parseHoles(holes);
  if (!parsedHoles.ok) return parsedHoles;

  const tape = validTape({
    id: brandedId,
    name,
    organId: organ,
    songId: source.value.songId,
    selectedParts: source.value.selectedParts,
    transposition: shift,
    columnLength,
    crankSpeed: speed,
    length,
    holes: parsedHoles.value,
  });
  return tape.ok ? tape : err(reasonOf(tape.error));
}

function parseCrankSpeed(value: unknown): CrankSpeed | undefined {
  return typeof value === 'number' ? crankSpeed(value) : undefined;
}

function reasonOf(violation: TapeRuleViolation): string {
  switch (violation.code) {
    case 'name-blank':
      return 'name is blank';
    case 'song-reference-incomplete':
      return 'songId and selectedParts must both be present or both absent';
    case 'selected-parts-invalid':
      return 'selectedParts is not sorted and unique';
    case 'column-length-not-positive':
      return 'columnLength is not a finite number above 0';
    case 'crank-speed-out-of-range':
      return 'crankSpeed is not a finite number from 1 to 300';
    case 'hole-beyond-end':
      return 'a Hole ends beyond the end of the Tape';
    case 'holes-not-sorted':
    case 'holes-overlap':
      return 'Holes are not sorted by pipe then start, or overlap within a row';
  }
}

function parseSongReference(
  songIdInput: unknown,
  selectedParts: unknown,
  songs: readonly Song[],
): Result<Pick<Tape, 'songId' | 'selectedParts'>, string> {
  if (songIdInput === undefined && selectedParts === undefined) {
    return ok({songId: undefined, selectedParts: undefined});
  }
  if (songIdInput === undefined || selectedParts === undefined) {
    return err('songId and selectedParts must both be present or both absent');
  }
  const referenced = songs.find((candidate) => candidate.id === songIdInput);
  if (!referenced) return err('songId names no Song in the file');
  if (!Array.isArray(selectedParts) || selectedParts.length === 0) return err('selectedParts is not a non-empty list');

  const parts: PartIndex[] = [];
  for (const value of selectedParts as unknown[]) {
    const index = typeof value === 'number' ? partIndex(value, referenced.parts.length) : undefined;
    if (index === undefined) return err('selectedParts has a value that is no Part of the Song');
    if (parts.length > 0 && index <= parts[parts.length - 1]) return err('selectedParts is not sorted and unique');
    parts.push(index);
  }
  return ok({songId: referenced.id, selectedParts: parts});
}

function parseHoles(input: unknown): Result<Hole[], string> {
  if (!Array.isArray(input)) return err('holes is not a list');
  const holes: Hole[] = [];
  for (const entry of input as unknown[]) {
    const triple = numberTriple(entry);
    const pipe = triple ? midiNoteNumber(triple[0]) : undefined;
    const start = triple ? column(triple[1]) : undefined;
    const length = triple ? columnCount(triple[2]) : undefined;
    if (pipe === undefined || start === undefined || length === undefined) {
      return err('a Hole is not [pipe 0-127, start >= 0, length >= 1]');
    }
    holes.push({pipe, start, length});
  }
  return ok(holes);
}

function numberTriple(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [first, second, third] = value as unknown[];
  return typeof first === 'number' && typeof second === 'number' && typeof third === 'number'
    ? [first, second, third]
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
