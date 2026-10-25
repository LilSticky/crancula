import {err, ok, type Result} from '../result';
import {MAXIMUM_MIDI_FILE_SIZE, readMidiSong, type MidiRejection} from './midi/read-midi-song';
import type {PartIndex, Song} from './song';

/** Every Song Source is read only up to this size: MIDI, zipped Score and XML alike. */
const MAXIMUM_SONG_SOURCE_SIZE = MAXIMUM_MIDI_FILE_SIZE;

/** The first bytes of the kinds of file a Song can come from, and of the files that are none of them. */
const MIDI_MAGIC = [0x4d, 0x54, 0x68, 0x64]; // "MThd"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK" 03 04
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

/** Only the start of a file is decoded to tell XML from the rest. */
const HEAD_BYTES = 1024;

/** Grace notes and ornaments a Score's Part lost, counted in played-out order (research R8). */
export interface LeftOut {
  readonly graceNotes: number;
  readonly ornaments: number;
}

export interface SongReading {
  readonly song: Song;
  /** Only for a Song from a Score: one entry per Part. */
  readonly leftOut?: ReadonlyMap<PartIndex, LeftOut>;
}

export type SongRejection =
  | MidiRejection
  | 'too-large'
  | 'not-a-song-source'
  | 'pdf'
  | 'not-a-score'
  | 'damaged-archive'
  | 'no-score-in-archive';

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

/** XML may start with a byte order mark and whitespace; the decoder drops the mark. */
function looksLikeXml(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, HEAD_BYTES));
  return head.trimStart().startsWith('<');
}

/**
 * Reads a file the user chose as a Song Source, by its first bytes (not its name). Never throws.
 * The file name is only the Song name fallback of a MIDI file.
 */
export function readSongSource(bytes: Uint8Array, fileName: string): Result<SongReading, SongRejection> {
  if (bytes.length > MAXIMUM_SONG_SOURCE_SIZE) return err('too-large');
  if (startsWith(bytes, MIDI_MAGIC)) {
    const midi = readMidiSong(bytes, fileName);
    return midi.ok ? ok({song: midi.value}) : midi;
  }
  // Until US1: the archive and the MusicXML reader are not written yet.
  if (startsWith(bytes, ZIP_MAGIC)) return err('damaged-archive');
  if (startsWith(bytes, PDF_MAGIC)) return err('pdf');
  if (looksLikeXml(bytes)) return err('not-a-score');
  return err('not-a-song-source');
}
