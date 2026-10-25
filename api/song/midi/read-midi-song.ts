import {midiNoteNumber, type MidiNoteNumber} from '../../organ/midi-note-number';
import {err, ok, type Result} from '../../result';
import {newSongId, note, type Note, part, type Part, song, type Song, tick, type Tick, ticksPerQuarter} from '../song';

export type MidiRejection = 'not-a-midi-file' | 'format-2' | 'not-timed-in-beats' | 'no-notes';

/** Larger files are rejected as not readable before any byte is read. */
export const MAXIMUM_MIDI_FILE_SIZE = 16 * 1024 * 1024;

const PERCUSSION_CHANNEL = 9;
const MAXIMUM_VARIABLE_LENGTH_BYTES = 4;

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
  return {name, notes: finished};
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
  }

  const built = song({id: newSongId(), name: songName ?? nameWithoutExtension(fileName), ticksPerQuarter: resolution, parts});
  return built === undefined ? err('no-notes') : ok(built);
}

/**
 * Reads a Standard MIDI File into a Song. Never throws, for any bytes.
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
