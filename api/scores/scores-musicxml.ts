import type {Organ} from '../organ/organ';
import type {Fifths, Song} from '../song/song';
import {columnCount, type ColumnCount, type Tape} from '../tape/tape';
import type {ScoresNote} from './close-gaps';
import type {ScoresChoices} from './scores-choices';
import {scoresBars, type Bar} from './scores-bars';
import {noteValues, type NoteValue} from './note-values';
import {spell, type Spelling} from './spell';
import {scoresStaves, type Clef} from './scores-staves';
import {scoresTempo} from './scores-tempo';

/** What the Scores are written from: the Tape, its Organ, its Song (if any) and the export choices (FR-017). */
export interface ScoresInput {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly choices: ScoresChoices;
}

type Lines = readonly string[];

interface MeasureContext {
  readonly notes: readonly ScoresNote[];
  readonly clef: Clef;
  readonly tempo: number | undefined;
}

const DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';
/** One Column is one division, so a quarter note is 8 divisions (research R1). */
const DIVISIONS = 8;
const INDENT = '  ';
/** The only voice written so far (see {@link scoresMusicXml}). */
const VOICE = 1;

/**
 * The MusicXML 4.0 document of a Tape (research R1, R3, R4; contracts/musicxml-output.md). Pure and
 * deterministic. So far it writes one staff and one voice: each Hole is one note, the Bars come from
 * {@link scoresBars}, and gaps are filled with rests. Chords, voices, the staves of split notes, gap closing
 * and ties across Bar lines are not written yet.
 */
export function scoresMusicXml(input: ScoresInput): string {
  const {tape, organ, song, choices} = input;
  const bars = scoresBars(tape, song, choices);
  const notes: readonly ScoresNote[] = tape.holes.map((hole) => ({
    pitch: hole.pipe,
    start: hole.start,
    length: hole.length,
  }));
  const clef = scoresStaves([], organ, notes)[0].clef;
  const tempo = scoresTempo(tape, organ);

  const measures = bars.flatMap((bar, index) => measureXml(bar, index === 0, {notes, clef, tempo}));
  const lines: Lines = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    DOCTYPE,
    ...element(
      'score-partwise',
      [
        ...element('work', [`<work-title>${escapeText(tape.name)}</work-title>`]),
        ...element('identification', element('encoding', ['<software>Crancula</software>'])),
        ...element('part-list', ['<score-part id="P1"><part-name/></score-part>']),
        ...element('part', measures, ' id="P1"'),
      ],
      ' version="4.0"',
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function element(name: string, children: Lines, attributes = ''): Lines {
  return [`<${name}${attributes}>`, ...children.map((line) => INDENT + line), `</${name}>`];
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function columnsOf(value: number): ColumnCount {
  const checked = columnCount(value);
  if (checked === undefined) throw new Error(`no Column count ${value}`);
  return checked;
}

function measureXml(bar: Bar, first: boolean, context: MeasureContext): Lines {
  const body: Lines = [
    ...attributesXml(bar, first, context.clef),
    ...(first ? directionXml(context.tempo) : []),
    ...notesXml(bar, context.notes),
  ];
  const implicit = bar.number === 0 ? ' implicit="yes"' : '';
  return element('measure', body, ` number="${bar.number}"${implicit}`);
}

/** The attributes a Bar starts with: the first Bar has all of them, later ones only what changes. */
function attributesXml(bar: Bar, first: boolean, clef: Clef): Lines {
  const items: string[] = [];
  if (first) items.push(`<divisions>${DIVISIONS}</divisions>`);
  if (bar.showsKey) items.push(keyXml(bar.key.fifths, bar.key.mode));
  if (bar.showsTimeSignature) {
    items.push(`<time><beats>${bar.timeSignature.beats}</beats><beat-type>${bar.timeSignature.beatType}</beat-type></time>`);
  }
  if (first) items.push(clefXml(clef));
  return items.length === 0 ? [] : element('attributes', items);
}

function keyXml(fifths: Fifths, mode: string): string {
  return `<key><fifths>${fifths}</fifths><mode>${mode}</mode></key>`;
}

function clefXml(clef: Clef): string {
  switch (clef) {
    case 'treble':
      return '<clef number="1"><sign>G</sign><line>2</line></clef>';
    case 'treble-8va':
      return '<clef number="1"><sign>G</sign><line>2</line><clef-octave-change>1</clef-octave-change></clef>';
    case 'bass':
      return '<clef number="1"><sign>F</sign><line>4</line></clef>';
    case 'bass-8vb':
      return '<clef number="1"><sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef>';
  }
}

/** The tempo mark of the first Bar, when the Organ gives a Tape per Crank turn (FR-013). */
function directionXml(tempo: number | undefined): Lines {
  if (tempo === undefined) return [];
  const metronome = element('direction-type', [
    `<metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome>`,
  ]);
  return element('direction', [...metronome, '<staff>1</staff>', `<sound tempo="${tempo}"/>`], ' placement="above"');
}

/** The notes that start in the Bar, in time order, with rests for the gaps and up to the end of the Bar. */
function notesXml(bar: Bar, notes: readonly ScoresNote[]): Lines {
  const end = bar.start + bar.length;
  const inBar = notes.filter((note) => note.start >= bar.start && note.start < end).sort((a, b) => a.start - b.start);
  if (inBar.length === 0) return wholeBarRestXml(bar.length);

  const lines: string[] = [];
  let position: number = bar.start;
  for (const note of inBar) {
    if (note.start > position) lines.push(...restsXml(columnsOf(note.start - position)));
    lines.push(...pitchedNotesXml(note, bar.key.fifths));
    position = note.start + note.length;
  }
  if (position < end) lines.push(...restsXml(columnsOf(end - position)));
  return lines;
}

function wholeBarRestXml(length: ColumnCount): Lines {
  return element('note', ['<rest measure="yes"/>', `<duration>${length}</duration>`, `<voice>${VOICE}</voice>`]);
}

function restsXml(length: ColumnCount): Lines {
  return noteValues(length).flatMap((value) => element('note', ['<rest/>', ...durationAndType(value), `<voice>${VOICE}</voice>`]));
}

/** The notes of one pitch: one written note per value, tied together when the length needs several. */
function pitchedNotesXml(note: ScoresNote, fifths: Fifths): Lines {
  const values = noteValues(note.length);
  const pitch = pitchXml(spell(note.pitch, fifths));
  return values.flatMap((value, index) => {
    const tieStop = index > 0;
    const tieStart = index < values.length - 1;
    const ties = [...(tieStop ? ['<tie type="stop"/>'] : []), ...(tieStart ? ['<tie type="start"/>'] : [])];
    const notations = tieStop || tieStart ? element('notations', tiedXml(tieStop, tieStart)) : [];
    return element('note', [pitch, ...durationAndType(value), ...ties, `<voice>${VOICE}</voice>`, ...notations]);
  });
}

function tiedXml(stop: boolean, start: boolean): string[] {
  return [...(stop ? ['<tied type="stop"/>'] : []), ...(start ? ['<tied type="start"/>'] : [])];
}

function pitchXml(spelling: Spelling): string {
  const alter = spelling.alter === 0 ? '' : `<alter>${spelling.alter}</alter>`;
  return `<pitch><step>${spelling.step}</step>${alter}<octave>${spelling.octave}</octave></pitch>`;
}

/** The duration in divisions, the note type and its dot, of one note value. */
function durationAndType(value: NoteValue): string[] {
  return [`<duration>${value.columns}</duration>`, `<type>${value.type}</type>`, ...(value.dotted ? ['<dot/>'] : [])];
}
