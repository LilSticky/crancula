import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Fifths} from '../song/song';
import {columnCount, type ColumnCount} from '../tape/tape';
import {noteValues, type NoteValue} from './note-values';
import type {Bar} from './scores-bars';
import {element, type Lines} from './scores-xml';
import type {Piece} from './scores-pieces';
import {spell, type Spelling} from './spell';

/** Where the notes of one voice of one staff in one Bar go in the document. */
export interface StreamContext {
  readonly fifths: Fifths;
  /** The voice number MusicXML uses: (staff − 1) × 4 + voice (research R8). */
  readonly voice: number;
  /** The staff number, given only when the Scores have more than one staff. */
  readonly staff: number | undefined;
  /** Stems in a Bar where the staff has several voices with notes; otherwise the program decides (research R8). */
  readonly stem: 'up' | 'down' | undefined;
}

/**
 * One voice of one staff in one Bar: its pieces in time order, with rests where it is silent. A voice with no
 * piece in the Bar is one whole-Bar rest (FR-010).
 */
export function streamXml(bar: Bar, pieces: readonly Piece[], context: StreamContext): Lines {
  if (pieces.length === 0) return wholeBarRestXml(bar.length, context);

  const lines: string[] = [];
  let position: number = bar.start;
  for (const piece of pieces) {
    if (piece.start > position) lines.push(...restsXml(piece.start - position, context));
    lines.push(...pieceXml(piece, context));
    position = piece.start + piece.length;
  }
  const barEnd = bar.start + bar.length;
  if (position < barEnd) lines.push(...restsXml(barEnd - position, context));
  return lines;
}

function wholeBarRestXml(length: ColumnCount, context: StreamContext): Lines {
  return element('note', ['<rest measure="yes"/>', `<duration>${length}</duration>`, ...voiceAndStaff(context)]);
}

/** The rests that fill `columns` Columns: the fewest values, longest first, none tied. */
function restsXml(columns: number, context: StreamContext): Lines {
  return noteValues(columnsOf(columns)).flatMap((value) =>
    element('note', ['<rest/>', `<duration>${value.columns}</duration>`, `<voice>${context.voice}</voice>`, ...typeXml(value), ...staffLines(context)]),
  );
}

/**
 * The notes of a piece: each pitch of the chord at each value the piece is written as. The first pitch of a value
 * is the note, every further pitch is a `<chord/>` note after it. Values are tied to each other and, at the ends
 * of the piece, to the Bars before and after.
 */
function pieceXml(piece: Piece, context: StreamContext): Lines {
  const values = noteValues(piece.length);
  return values.flatMap((value, index) => {
    const tieStop = index > 0 || piece.tiedFromBefore;
    const tieStart = index < values.length - 1 || piece.tiedToAfter;
    return piece.pitches.flatMap((pitch, pitchIndex) =>
      pitchedNoteXml(pitch, value, {stop: tieStop, start: tieStart}, pitchIndex > 0, context),
    );
  });
}

interface Ties {
  readonly stop: boolean;
  readonly start: boolean;
}

function pitchedNoteXml(
  pitch: MidiNoteNumber,
  value: NoteValue,
  ties: Ties,
  chord: boolean,
  context: StreamContext,
): Lines {
  const tieLines = [...(ties.stop ? ['<tie type="stop"/>'] : []), ...(ties.start ? ['<tie type="start"/>'] : [])];
  const tiedLines = [...(ties.stop ? ['<tied type="stop"/>'] : []), ...(ties.start ? ['<tied type="start"/>'] : [])];
  const notations = tiedLines.length > 0 ? element('notations', tiedLines) : [];
  return element('note', [
    ...(chord ? ['<chord/>'] : []),
    pitchXml(spell(pitch, context.fifths)),
    `<duration>${value.columns}</duration>`,
    ...tieLines,
    `<voice>${context.voice}</voice>`,
    ...typeXml(value),
    ...(context.stem === undefined ? [] : [`<stem>${context.stem}</stem>`]),
    ...staffLines(context),
    ...notations,
  ]);
}

function pitchXml(spelling: Spelling): string {
  const alter = spelling.alter === 0 ? '' : `<alter>${spelling.alter}</alter>`;
  return `<pitch><step>${spelling.step}</step>${alter}<octave>${spelling.octave}</octave></pitch>`;
}

/** The note type and its dot, in the order MusicXML takes them after the voice. */
function typeXml(value: NoteValue): string[] {
  return [`<type>${value.type}</type>`, ...(value.dotted ? ['<dot/>'] : [])];
}

function voiceAndStaff(context: StreamContext): string[] {
  return [`<voice>${context.voice}</voice>`, ...staffLines(context)];
}

function staffLines(context: StreamContext): string[] {
  return context.staff === undefined ? [] : [`<staff>${context.staff}</staff>`];
}

function columnsOf(value: number): ColumnCount {
  const checked = columnCount(value);
  if (checked === undefined) throw new Error(`no Column count ${value}`);
  return checked;
}
