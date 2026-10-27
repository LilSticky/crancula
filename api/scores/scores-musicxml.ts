import type {Organ} from '../organ/organ';
import type {Fifths, Song} from '../song/song';
import type {Tape} from '../tape/tape';
import {closeGaps, minimumGapColumns} from './close-gaps';
import {streamXml} from './scores-notes-xml';
import {scoresBars, type Bar} from './scores-bars';
import type {ScoresChoices} from './scores-choices';
import {piecesIn} from './scores-pieces';
import {scoresStaves, staffOf, type Staff} from './scores-staves';
import {scoresTempo} from './scores-tempo';
import type {Piece} from './scores-pieces';
import {element, type Lines} from './scores-xml';
import {VOICES, assignVoices, type StaffVoices, type VoiceNumber} from './voices';

/** What the Scores are written from: the Tape, its Organ, its Song (if any) and the export choices (FR-017). */
export interface ScoresInput {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly choices: ScoresChoices;
}

const DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';
/** One Column is one division, so a quarter note is 8 divisions (research R1). */
const DIVISIONS = 8;
/** Voices per staff in the MusicXML numbering: staff 2 starts at voice 5 (research R8). */
const VOICES_PER_STAFF = 4;

/**
 * The MusicXML 4.0 document of a Tape (research R1, R3, R4, R7–R9; contracts/musicxml-output.md). Pure and
 * deterministic. Each Hole is a note on the staff of its pitch, gaps are closed (FR-008) and then filled with
 * rests, chords and voices are written as research R8 says, and notes are cut and tied at the Bar lines.
 */
export function scoresMusicXml(input: ScoresInput): string {
  const {tape, organ, song, choices} = input;
  const bars = scoresBars(tape, song, choices);
  const notes = closeGaps(tape.holes, minimumGapColumns(organ, tape.columnLength));
  const staves = scoresStaves(choices.splitNotes, organ, notes);
  const layout: readonly StaffVoices[] = staves.map((staff) =>
    assignVoices(
      staff,
      notes.filter((note) => staffOf(note.pitch, staves) === staff),
    ),
  );
  const tempo = scoresTempo(tape, organ);

  const measures = bars.flatMap((bar, index) => measureXml(bar, index === 0, layout, tempo));
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

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function measureXml(bar: Bar, first: boolean, layout: readonly StaffVoices[], tempo: number | undefined): Lines {
  const body: Lines = [
    ...attributesXml(bar, first, layout.map((staffVoices) => staffVoices.staff)),
    ...(first ? directionXml(tempo) : []),
    ...notesXml(bar, layout),
  ];
  const implicit = bar.number === 0 ? ' implicit="yes"' : '';
  return element('measure', body, ` number="${bar.number}"${implicit}`);
}

/** The attributes a Bar starts with: the first Bar has all of them, later ones only what changes. */
function attributesXml(bar: Bar, first: boolean, staves: readonly Staff[]): Lines {
  const items: string[] = [];
  if (first) items.push(`<divisions>${DIVISIONS}</divisions>`);
  if (bar.showsKey) items.push(keyXml(bar.key.fifths, bar.key.mode));
  if (bar.showsTimeSignature) {
    items.push(`<time><beats>${bar.timeSignature.beats}</beats><beat-type>${bar.timeSignature.beatType}</beat-type></time>`);
  }
  if (first && staves.length > 1) items.push(`<staves>${staves.length}</staves>`);
  if (first) items.push(...staves.map(clefXml));
  return items.length === 0 ? [] : element('attributes', items);
}

function keyXml(fifths: Fifths, mode: string): string {
  return `<key><fifths>${fifths}</fifths><mode>${mode}</mode></key>`;
}

function clefXml(staff: Staff): string {
  const open = `<clef number="${staff.number}">`;
  switch (staff.clef) {
    case 'treble':
      return `${open}<sign>G</sign><line>2</line></clef>`;
    case 'treble-8va':
      return `${open}<sign>G</sign><line>2</line><clef-octave-change>1</clef-octave-change></clef>`;
    case 'bass':
      return `${open}<sign>F</sign><line>4</line></clef>`;
    case 'bass-8vb':
      return `${open}<sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef>`;
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

/**
 * The notes of a Bar: for each staff from the top, for each voice written in it (voice 1 always, voices 2 to 4
 * only with a note in the Bar). Each stream is followed by a backup to the start of the Bar, except the last.
 */
function notesXml(bar: Bar, layout: readonly StaffVoices[]): Lines {
  const multiStaff = layout.length > 1;
  const streams = layout.flatMap((staffVoices) => staffStreamsXml(bar, staffVoices, multiStaff));
  const backup = element('backup', [`<duration>${bar.length}</duration>`]);
  return streams.flatMap((stream, index) => (index < streams.length - 1 ? [...stream, ...backup] : stream));
}

/** The streams of one staff in one Bar: voice 1, and each voice 2 to 4 that has a piece in the Bar. */
function staffStreamsXml(bar: Bar, staffVoices: StaffVoices, multiStaff: boolean): Lines[] {
  const staff = staffVoices.staff;
  const pieces = new Map<VoiceNumber, readonly Piece[]>(
    VOICES.map((voice) => [voice, piecesIn(bar, staffVoices.voices.get(voice) ?? [])]),
  );
  const sounding = VOICES.filter((voice) => (pieces.get(voice) ?? []).length > 0).length;
  return VOICES.flatMap((voice) => {
    const voicePieces = pieces.get(voice) ?? [];
    if (voice !== 1 && voicePieces.length === 0) return [];
    return [
      streamXml(bar, voicePieces, {
        fifths: bar.key.fifths,
        voice: (staff.number - 1) * VOICES_PER_STAFF + voice,
        staff: multiStaff ? staff.number : undefined,
        stem: sounding > 1 ? stemOf(voice) : undefined,
      }),
    ];
  });
}

/** Voices 1 and 3 have stems up, voices 2 and 4 stems down (research R8). */
function stemOf(voice: VoiceNumber): 'up' | 'down' {
  return voice % 2 === 1 ? 'up' : 'down';
}
