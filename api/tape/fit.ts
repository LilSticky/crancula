import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import type {PartIndex, Song, Tick} from '../song/song';
import type {NoteMovedByOctaves, UnplayableNote} from './import-summary';
import {octaveMoveTable} from './octave-moves';
import {columnOfTick, quantiseNote} from './quantisation';
import {column, type Column, type ColumnCount, type Transposition} from './tape';

const OCTAVE = 12;

/** How the selected Notes meet the Organ's Pipes. The three counts add up to the Notes. */
export interface Fit {
  readonly matchingAPipe: number;
  readonly movedByOctaves: number;
  readonly unplayable: number;
}

/** A selected Note after Quantisation, Transposition and octave moves; `pipe` is undefined when unplayable. */
export interface PlacedNote {
  readonly part: PartIndex;
  readonly noteNumber: MidiNoteNumber;
  readonly pipe: MidiNoteNumber | undefined;
  readonly start: Column;
  readonly length: ColumnCount;
}

function valid<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid ${what}`);
  return value;
}

/**
 * Places every Note of the selected Parts, Columns counted from the first selected Note.
 * The one rule for octave moves and unplayable Notes; createTape and fitNotesOf both use it.
 */
export function placedNotesOf(
  song: Song,
  selectedParts: ReadonlySet<PartIndex>,
  organ: Organ,
  transposition: Transposition,
): readonly PlacedNote[] {
  const selected = song.parts.flatMap((each, index) =>
    selectedParts.has(index as PartIndex) ? [{part: index as PartIndex, notes: each.notes}] : [],
  );
  const starts = selected.flatMap(({notes}) => notes.map((note) => note.start));
  if (starts.length === 0) return [];
  const perQuarter = song.ticksPerQuarter;
  const origin = columnOfTick(Math.min(...starts) as Tick, perQuarter);
  const table = octaveMoveTable(organ);
  return selected.flatMap(({part, notes}) =>
    notes.map((each) => {
      const quantised = quantiseNote(each, perQuarter);
      return {
        part,
        // outside 0..127 the Note has no Pipe (unplayable) and keeps its own number
        noteNumber: midiNoteNumber(each.noteNumber + transposition) ?? each.noteNumber,
        pipe: table[each.noteNumber + transposition],
        start: valid(column(quantised.start - origin), 'Column'),
        length: quantised.length,
      };
    }),
  );
}

/** The Notes of the selected Parts the Import Summary reports: moved by octaves or unplayable. */
export function fitNotesOf(
  song: Song,
  selectedParts: ReadonlySet<PartIndex>,
  organ: Organ,
  transposition: Transposition,
): {readonly movedByOctaves: readonly NoteMovedByOctaves[]; readonly unplayableNotes: readonly UnplayableNote[]} {
  const movedByOctaves: NoteMovedByOctaves[] = [];
  const unplayableNotes: UnplayableNote[] = [];
  for (const {part, noteNumber, pipe, start} of placedNotesOf(song, selectedParts, organ, transposition)) {
    if (pipe === undefined) unplayableNotes.push({part, noteNumber, column: start});
    else if (pipe !== noteNumber) {
      movedByOctaves.push({part, noteNumber, pipe, octaves: (pipe - noteNumber) / OCTAVE, column: start});
    }
  }
  return {movedByOctaves, unplayableNotes};
}

export function fitOf(
  song: Song,
  selectedParts: ReadonlySet<PartIndex>,
  organ: Organ,
  transposition: Transposition,
): Fit {
  const table = octaveMoveTable(organ);
  let matchingAPipe = 0;
  let movedByOctaves = 0;
  let unplayable = 0;
  song.parts.forEach((each, index) => {
    if (!selectedParts.has(index as PartIndex)) return;
    for (const note of each.notes) {
      const shifted = note.noteNumber + transposition;
      const pipe = table[shifted];
      if (pipe === undefined) unplayable++;
      else if (pipe === shifted) matchingAPipe++;
      else movedByOctaves++;
    }
  });
  return {matchingAPipe, movedByOctaves, unplayable};
}
