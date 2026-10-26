import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Column, ColumnCount} from '../tape/tape';
import type {ScoresNote} from './close-gaps';
import type {Staff} from './scores-staves';

export type VoiceNumber = 1 | 2 | 3 | 4;

const VOICES: readonly VoiceNumber[] = [1, 2, 3, 4];

/** Notes of one staff that start and end together; `pitches` ascending. */
export interface Chord {
  readonly start: Column;
  readonly length: ColumnCount;
  readonly pitches: readonly MidiNoteNumber[];
}

/** The chords of each voice of one staff; a voice without chords is absent from the map. */
export interface StaffVoices {
  readonly staff: Staff;
  readonly voices: ReadonlyMap<VoiceNumber, readonly Chord[]>;
}

/** A chord as plain numbers while voices are worked out; Columns are whole numbers by construction. */
interface Span {
  readonly start: number;
  readonly length: number;
  readonly pitches: readonly MidiNoteNumber[];
}

/** Notes with the same start and length, pitches ascending (research R8). */
function chordsOf(notes: readonly ScoresNote[]): Span[] {
  const groups = new Map<string, {start: number; length: number; pitches: MidiNoteNumber[]}>();
  for (const note of notes) {
    const key = `${note.start}:${note.length}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {start: note.start, length: note.length, pitches: [note.pitch]});
    } else {
      group.pitches.push(note.pitch);
    }
  }
  return [...groups.values()].map((group) => ({...group, pitches: [...group.pitches].sort((a, b) => a - b)}));
}

/**
 * Cuts the chords of voice 4 at every start and end, so that the pieces do not overlap; each piece holds the
 * pitches of every chord that covers it, and the pieces are tied where a chord is cut (research R8).
 */
function cutIntoPieces(chords: readonly Span[]): Span[] {
  const points = [...new Set(chords.flatMap((chord) => [chord.start, chord.start + chord.length]))].sort((a, b) => a - b);
  const pieces: Span[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    const pitches = chords
      .filter((chord) => chord.start <= from && from < chord.start + chord.length)
      .flatMap((chord) => chord.pitches)
      .sort((a, b) => a - b);
    if (pitches.length > 0) pieces.push({start: from, length: to - from, pitches});
  }
  return pieces;
}

/**
 * Puts the notes of one staff into up to four voices (FR-012, research R8). Chords are taken by start, then
 * highest pitch first; each goes into the lowest voice that is free at its start. A chord that finds no free
 * voice goes into voice 4, which is then cut into tied pieces so that no two of its chords overlap.
 */
export function assignVoices(staff: Staff, notes: readonly ScoresNote[]): StaffVoices {
  const ordered = chordsOf(notes).sort(
    (a, b) => a.start - b.start || Math.max(...b.pitches) - Math.max(...a.pitches),
  );

  const freeFrom = new Map<VoiceNumber, number>();
  const placed = new Map<VoiceNumber, Span[]>();
  const overflow: Span[] = [];
  for (const chord of ordered) {
    const voice = VOICES.find((candidate) => (freeFrom.get(candidate) ?? 0) <= chord.start);
    if (voice === undefined) {
      overflow.push(chord);
      continue;
    }
    freeFrom.set(voice, chord.start + chord.length);
    const list = placed.get(voice);
    if (list === undefined) placed.set(voice, [chord]);
    else list.push(chord);
  }

  const voice4 = cutIntoPieces([...(placed.get(4) ?? []), ...overflow]);
  placed.set(4, voice4);

  const voices = new Map<VoiceNumber, readonly Chord[]>();
  for (const voice of VOICES) {
    const spans = placed.get(voice) ?? [];
    if (spans.length > 0) voices.set(voice, spans.map(toChord));
  }
  return {staff, voices};
}

function toChord(span: Span): Chord {
  return {start: span.start as Column, length: span.length as ColumnCount, pitches: span.pitches};
}
