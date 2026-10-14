import {err, ok, type Result} from '../result';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId} from '../organ/organ';
import {
  type Part,
  type PartIndex,
  type Song,
  note,
  part,
  partIndex,
  song,
  songId,
  tick,
  ticksPerQuarter,
} from '../song/song';
import {
  type Hole,
  type Tape,
  asValidTape,
  column,
  columnCount,
  tapeId,
  transposition,
} from './tape';

/** One Song in the snapshot file. Array order of `parts` is the PartIndex. */
export interface SongSnapshot {
  readonly id: string;
  readonly name: string;
  readonly ticksPerQuarter: number;
  readonly parts: readonly PartSnapshot[];
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
  readonly length: number;
  /** `[pipe, start, length]`, sorted by pipe, then start. */
  readonly holes: readonly (readonly [number, number, number])[];
}

/** Snapshot file format, version 1, stored at `<userData>/snapshots/tapes.json` (ADR 8). */
export interface TapeLibrarySnapshot {
  readonly version: 1;
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
    version: 1,
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
  if (input['version'] !== 1) return err(`unsupported snapshot version ${String(input['version'])}`);
  const {songs, tapes} = input;
  if (!Array.isArray(songs)) return err('songs is not a list');
  if (!Array.isArray(tapes)) return err('tapes is not a list');

  const parsedSongs: Song[] = [];
  for (const [index, entry] of (songs as unknown[]).entries()) {
    const parsed = parseSong(entry);
    if (!parsed.ok) return err(`Song ${index}: ${parsed.error}`);
    if (parsedSongs.some((other) => other.id === parsed.value.id)) {
      return err(`Song ${index}: duplicate id ${parsed.value.id}`);
    }
    parsedSongs.push(parsed.value);
  }

  const parsedTapes: Tape[] = [];
  for (const [index, entry] of (tapes as unknown[]).entries()) {
    const parsed = parseTape(entry, parsedSongs);
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

function parseSong(input: unknown): Result<Song, string> {
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

  const result = song({id: brandedId, name, ticksPerQuarter: ticks, parts: parsedParts});
  return result ? ok(result) : err('name is blank or there is no Part');
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

function parseTape(input: unknown, songs: readonly Song[]): Result<Tape, string> {
  if (!isRecord(input)) return err('not an object');
  const {id, name, songId: songIdInput, selectedParts, holes} = input;
  const brandedId = typeof id === 'string' ? tapeId(id) : undefined;
  if (brandedId === undefined) return err('id is not a UUID');
  if (typeof name !== 'string' || name.trim() === '') return err('name is blank');
  const organ = typeof input['organId'] === 'string' ? organId(input['organId']) : undefined;
  if (organ === undefined) return err('organId is not a UUID');

  const source = parseSongReference(songIdInput, selectedParts, songs);
  if (!source.ok) return source;

  const shift = typeof input['transposition'] === 'number' ? transposition(input['transposition']) : undefined;
  if (shift === undefined) return err('transposition is not an integer from -127 to 127');
  const columnLength = typeof input['columnLength'] === 'number' ? millimetres(input['columnLength']) : undefined;
  if (columnLength === undefined || columnLength <= 0) return err('columnLength is not a number > 0');
  const length = typeof input['length'] === 'number' ? columnCount(input['length']) : undefined;
  if (length === undefined) return err('length is not an integer >= 1');

  const parsedHoles = parseHoles(holes, length);
  if (!parsedHoles.ok) return parsedHoles;

  return ok(
    asValidTape({
      id: brandedId,
      name: name.trim(),
      organId: organ,
      songId: source.value.songId,
      selectedParts: source.value.selectedParts,
      transposition: shift,
      columnLength,
      length,
      holes: parsedHoles.value,
    }),
  );
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

function parseHoles(input: unknown, tapeLength: number): Result<Hole[], string> {
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
    if (start + length > tapeLength) return err('a Hole ends beyond the end of the Tape');

    const previous = holes[holes.length - 1];
    if (previous && (pipe < previous.pipe || (pipe === previous.pipe && start < previous.start + previous.length))) {
      return err('Holes are not sorted by pipe then start, or overlap within a row');
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
