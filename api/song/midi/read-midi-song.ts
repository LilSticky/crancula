import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {err, ok, type Result} from '../../result';
import {
  beatTypeOf,
  newSongId,
  note,
  type Key,
  type Note,
  part,
  type Part,
  song,
  type Song,
  tick,
  type Tick,
  ticksPerQuarter,
  type TimeSignature,
} from '../song';

export type MidiRejection = 'not-a-midi-file' | 'format-2' | 'not-timed-in-beats' | 'no-notes';

/** Larger files are rejected as not readable before any byte is read. */
export const MAXIMUM_MIDI_FILE_SIZE = 16 * 1024 * 1024;

const PERCUSSION_CHANNEL = 9;
const MAXIMUM_VARIABLE_LENGTH_BYTES = 4;
const META_TIME_SIGNATURE = 0x58;
const META_KEY_SIGNATURE = 0x59;
/** The most beats a Bar of a Song may have (song.ts). */
const MAXIMUM_BEATS = 99;
/** The most fifths a Key of a Song may have (song.ts). */
const MAXIMUM_FIFTHS = 7;
/** Above this, a signed byte is negative. */
const SIGNED_BYTE_LIMIT = 0x80;
const SIGNED_BYTE_RANGE = 0x100;

/** Thrown inside the reader for any malformed byte; never leaves {@link readMidiSong}. */
class MalformedMidiFile extends Error {}

function malformed(): never {
  throw new MalformedMidiFile();
}

/** A bounds-checked cursor over the bytes of one chunk or file. */
class ByteReader {
  private position = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get atEnd(): boolean {
    return this.position >= this.bytes.length;
  }

  get remaining(): number {
    return this.bytes.length - this.position;
  }

  byte(): number {
    const value = this.bytes[this.position];
    if (value === undefined) return malformed();
    this.position++;
    return value;
  }

  dataByte(): number {
    const value = this.byte();
    return value < 0x80 ? value : malformed();
  }

  uint16(): number {
    return this.byte() * 0x100 + this.byte();
  }

  uint32(): number {
    return this.uint16() * 0x10000 + this.uint16();
  }

  skip(length: number): void {
    if (length > this.remaining) malformed();
    this.position += length;
  }

  slice(length: number): Uint8Array {
    if (length > this.remaining) return malformed();
    const part = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return part;
  }

  variableLength(): number {
    let value = 0;
    for (let count = 0; count < MAXIMUM_VARIABLE_LENGTH_BYTES; count++) {
      const current = this.byte();
      value = value * 0x80 + (current & 0x7f);
      if (current < 0x80) return value;
    }
    return malformed();
  }
}

interface RawNote {
  readonly channel: number;
  readonly noteNumber: MidiNoteNumber;
  readonly start: Tick;
  readonly end: Tick;
}

function asTick(value: number): Tick {
  return tick(value) ?? malformed();
}

interface RawTrack {
  readonly name: string | undefined;
  readonly notes: readonly RawNote[];
  readonly timeSignatures: readonly TimeSignature[];
  readonly keys: readonly Key[];
}

/**
 * A time signature meta event: its beats, then its denominator as a power of two (2 is 4). Ignored when the Song
 * could not keep it.
 */
function timeSignatureEvent(text: Uint8Array, start: Tick): TimeSignature | undefined {
  if (text.length < 2) return undefined;
  const [beats = 0, power = 0] = text;
  const beatType = beatTypeOf(2 ** power);
  return beats >= 1 && beats <= MAXIMUM_BEATS && beatType !== undefined ? {start, beats, beatType} : undefined;
}

/**
 * A key signature meta event: its fifths as a signed byte, then its mode (1 is minor, 0 major). Ignored when the
 * Song could not keep it.
 */
function keyEvent(text: Uint8Array, start: Tick): Key | undefined {
  if (text.length < 2) return undefined;
  const [sharpsOrFlats = 0, mode = 0] = text;
  const fifths = sharpsOrFlats < SIGNED_BYTE_LIMIT ? sharpsOrFlats : sharpsOrFlats - SIGNED_BYTE_RANGE;
  return Math.abs(fifths) <= MAXIMUM_FIFTHS ? {start, fifths, mode: mode === 1 ? 'minor' : 'major'} : undefined;
}

/** UTF-8 when valid, otherwise Latin-1; trimmed, and empty counts as absent. */
function decodeName(bytes: Uint8Array): string | undefined {
  let text: string;
  try {
    text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    text = new TextDecoder('latin1').decode(bytes);
  }
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Reads the Notes and the first track name of one track chunk. Unreleased Notes end with the track. */
function readTrack(chunk: Uint8Array): RawTrack {
  const reader = new ByteReader(chunk);
  const finished: RawNote[] = [];
  const sounding = new Map<number, Tick>();
  const retriggered = new Map<number, Tick>();
  const timeSignatures: TimeSignature[] = [];
  const keys: Key[] = [];
  let time = 0;
  let runningStatus: number | undefined;
  let name: string | undefined;

  const release = (channel: number, key: number, end: Tick): void => {
    const id = channel * 128 + key;
    const start = sounding.get(id);
    const noteNumber = midiNoteNumber(key);
    if (start === undefined || noteNumber === undefined) return;
    sounding.delete(id);
    finished.push({channel, noteNumber, start, end});
  };

  while (!reader.atEnd) {
    time += reader.variableLength();
    const now = asTick(time);
    let status = reader.byte();
    if (status < 0x80) {
      if (runningStatus === undefined) return malformed();
      reader.skip(-1);
      status = runningStatus;
    }

    if (status === 0xff) {
      const type = reader.byte();
      const text = reader.slice(reader.variableLength());
      if (type === 0x03 && name === undefined) name = decodeName(text);
      const timeSignature = type === META_TIME_SIGNATURE ? timeSignatureEvent(text, now) : undefined;
      if (timeSignature !== undefined) timeSignatures.push(timeSignature);
      const key = type === META_KEY_SIGNATURE ? keyEvent(text, now) : undefined;
      if (key !== undefined) keys.push(key);
      if (type === 0x2f) break;
    } else if (status === 0xf0 || status === 0xf7) {
      reader.skip(reader.variableLength());
    } else if (status >= 0xf1) {
      malformed();
    } else {
      runningStatus = status;
      const channel = status & 0x0f;
      const kind = status >> 4;
      if (kind === 0xc || kind === 0xd) {
        reader.dataByte();
      } else {
        const key = reader.dataByte();
        const velocity = reader.dataByte();
        if (kind === 0x9 && velocity > 0) {
          const id = channel * 128 + key;
          if (sounding.has(id)) retriggered.set(id, now);
          release(channel, key, now);
          sounding.set(id, now);
        } else if ((kind === 0x8 || kind === 0x9) && retriggered.get(channel * 128 + key) !== now) {
          release(channel, key, now);
        }
      }
    }
  }

  const end = asTick(time);
  for (const id of [...sounding.keys()]) release(Math.floor(id / 128), id % 128, end);
  return {name, notes: finished, timeSignatures, keys};
}

/**
 * Sorted by start. Of several at one Tick the first given wins (the first track); one equal to the entry before it
 * is kept once.
 */
function keptOnce<T extends {readonly start: Tick}>(entries: readonly T[], same: (a: T, b: T) => boolean): T[] {
  const kept: T[] = [];
  for (const entry of [...entries].sort((a, b) => a.start - b.start)) {
    const previous = kept.at(-1);
    if (previous?.start === entry.start) continue;
    if (previous !== undefined && same(previous, entry)) continue;
    kept.push(entry);
  }
  return kept;
}

function sameTimeSignature(a: TimeSignature, b: TimeSignature): boolean {
  return a.beats === b.beats && a.beatType === b.beatType;
}

function sameKey(a: Key, b: Key): boolean {
  return a.fifths === b.fifths && a.mode === b.mode;
}

/** One Part per channel that has Notes, each named after the track. */
function partsOfTrack({name, notes: rawNotes}: RawTrack): Part[] {
  const channels = [...new Set(rawNotes.map((raw) => raw.channel))].sort((a, b) => a - b);
  return channels.flatMap((channel) => {
    const notes = rawNotes
      .filter((raw) => raw.channel === channel)
      .map((raw) => note({noteNumber: raw.noteNumber, start: raw.start, duration: asTick(raw.end - raw.start)}) ?? malformed())
      .sort((a, b) => a.start - b.start || a.noteNumber - b.noteNumber);
    const built = part({name, percussion: channel === PERCUSSION_CHANNEL, notes});
    return built === undefined ? [] : [built];
  });
}

function nameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.midi?$/i, '');
}

function readSong(bytes: Uint8Array, fileName: string): Result<Song, MidiRejection> {
  const reader = new ByteReader(bytes);
  if (reader.uint32() !== 0x4d546864) return malformed();
  const headerLength = reader.uint32();
  if (headerLength < 6) return malformed();
  const header = new ByteReader(reader.slice(headerLength));
  const format = header.uint16();
  header.uint16();
  const division = header.uint16();
  if (format > 2) return malformed();
  if (format === 2) return err('format-2');
  if (division >= 0x8000) return err('not-timed-in-beats');
  const resolution = ticksPerQuarter(division);
  if (resolution === undefined) return malformed();

  const parts: Part[] = [];
  const timeSignatures: TimeSignature[] = [];
  const keys: Key[] = [];
  let songName: string | undefined;
  let firstTrack = true;
  while (!reader.atEnd) {
    const type = reader.uint32();
    const chunk = reader.slice(reader.uint32());
    if (type !== 0x4d54726b) continue;
    const track = readTrack(chunk);
    if (firstTrack) songName = track.name;
    firstTrack = false;
    parts.push(...partsOfTrack(track));
    timeSignatures.push(...track.timeSignatures);
    keys.push(...track.keys);
  }

  const built = song({
    id: newSongId(),
    name: songName ?? nameWithoutExtension(fileName),
    ticksPerQuarter: resolution,
    parts,
    timeSignatures: keptOnce(timeSignatures, sameTimeSignature),
    keys: keptOnce(keys, sameKey),
  });
  return built === undefined ? err('no-notes') : ok(built);
}

/**
 * Reads a Standard MIDI File into a Song. Never throws, for any bytes.
 * Time and key signature meta events are kept at their Ticks (research R9); there is no upbeat from MIDI.
 * Tempo, controllers, programs and velocity are read past and ignored.
 */
export function readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, MidiRejection> {
  if (bytes.length > MAXIMUM_MIDI_FILE_SIZE) return err('not-a-midi-file');
  try {
    return readSong(bytes, fileName);
  } catch (error) {
    if (error instanceof MalformedMidiFile) return err('not-a-midi-file');
    throw error;
  }
}
