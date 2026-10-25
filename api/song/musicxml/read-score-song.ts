import {err, ok, type Result} from '../../result';
import {note, newSongId, part, partIndex, song, type Note, type Part, type PartIndex, type Song} from '../song';
import type {LeftOut, SongReading, SongRejection} from '../read-song-source';
import {layOut, type LaidOutStaff} from './lay-out';
import {playOut} from './play-out';
import {scoreMeasures, type ScorePart} from './score-measures';
import {parseXml, type XmlElement} from './xml';

/** A part of the part-list: its id, and its name when it has one. */
interface ListedPart {
  readonly id: string;
  readonly name: string | undefined;
}

function childNamed(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  return parent?.children.find((child) => child.name === name);
}

/** The trimmed text of the child `name`, or `undefined` when there is no such child or it is empty. */
function textOfChild(parent: XmlElement | undefined, name: string): string | undefined {
  const text = childNamed(parent, name)?.text.trim();
  return text === undefined || text === '' ? undefined : text;
}

/** The score-part elements of the part-list, in the order the list gives them. */
function partListOf(root: XmlElement): readonly ListedPart[] {
  const partList = childNamed(root, 'part-list');
  return (partList?.children ?? [])
    .filter((child) => child.name === 'score-part')
    .map((scorePart) => ({id: scorePart.attributes.get('id') ?? '', name: textOfChild(scorePart, 'part-name')}));
}

/** The Song name (FR-013): the work title, else the movement title, else the file name without its extension. */
function songNameOf(root: XmlElement, fileName: string): string {
  const title = textOfChild(childNamed(root, 'work'), 'work-title') ?? textOfChild(root, 'movement-title');
  return title ?? fileName.replace(/\.[^.]*$/, '');
}

/** The number of staves of a part in force; a part that writes none has one. */
function staffCountOf(part: ScorePart): number {
  return part.measures.reduce((most, measure) => Math.max(most, measure.staves), 1);
}

/** The part name, with the staff number when the part has several staves; `undefined` for an unnamed part. */
function staffNameOf(partName: string | undefined, staves: number, staff: number): string | undefined {
  if (partName === undefined) return undefined;
  return staves > 1 ? `${partName} ${staff}` : partName;
}

/** The Notes of one staff as Notes of a Part; `undefined` when a Note is longer than a Song can hold. */
function notesOf(staff: LaidOutStaff): readonly Note[] | undefined {
  const notes: Note[] = [];
  for (const laidOut of staff.notes) {
    // An unpitched Note without a display pitch has no MIDI note number and is not kept yet.
    if (laidOut.noteNumber === 'unpitched') continue;
    const built = note({noteNumber: laidOut.noteNumber, start: laidOut.start, duration: laidOut.duration});
    if (built === undefined) return undefined;
    notes.push(built);
  }
  return notes;
}

/** The left-out counts of the Parts of a Song, in the order of their PartIndex. */
function leftOutByPart(counts: readonly LeftOut[]): ReadonlyMap<PartIndex, LeftOut> {
  const byPart = new Map<PartIndex, LeftOut>();
  counts.forEach((count, index) => {
    const key = partIndex(index, counts.length);
    if (key !== undefined) byPart.set(key, count);
  });
  return byPart;
}

/**
 * Reads an uncompressed MusicXML Score (score-partwise or score-timewise) as a Song: one Part per staff with
 * Notes, in part-list then staff order (FR-004, FR-005). Never throws.
 */
export function readScoreSong(bytes: Uint8Array, fileName: string): Result<SongReading, SongRejection> {
  const root = parseXml(bytes);
  if (root === undefined) return err('not-a-score');
  const measured = scoreMeasures(root);
  if (!measured.ok) return err(measured.error);

  const parts = measured.value;
  const listed = partListOf(root);
  const positionOf = (id: string): number => {
    const position = listed.findIndex((candidate) => candidate.id === id);
    return position < 0 ? listed.length : position;
  };
  const byPartList = parts
    .map((scorePart, index) => ({scorePart, index}))
    .sort((a, b) => positionOf(a.scorePart.id) - positionOf(b.scorePart.id) || a.index - b.index);
  // The first part's marks give the played order, and every staff is laid out in it (research R7).
  const leadMeasures = byPartList[0]?.scorePart.measures ?? [];
  const laidOut = layOut(parts, playOut(leadMeasures.map((measure) => measure.marks)));

  const songParts: Part[] = [];
  // A staff of only grace notes has no Notes, so part() gives it no Part and its counts are left out with it.
  const leftOuts: LeftOut[] = [];
  for (const {scorePart, index} of byPartList) {
    const partName = listed.find((candidate) => candidate.id === scorePart.id)?.name;
    const staves = staffCountOf(scorePart);
    for (const staff of laidOut.staves.filter((candidate) => candidate.part === index)) {
      const notes = notesOf(staff);
      if (notes === undefined) return err('too-large');
      const built = part({
        name: staffNameOf(partName, staves, staff.staff),
        percussion: scorePart.percussionStaves.has(staff.staff),
        notes,
      });
      if (built !== undefined) {
        songParts.push(built);
        leftOuts.push(staff.leftOut);
      }
    }
  }
  if (songParts.length === 0) return err('no-notes');

  const built: Song | undefined = song({
    id: newSongId(),
    name: songNameOf(root, fileName),
    ticksPerQuarter: laidOut.ticksPerQuarter,
    parts: songParts,
    timeSignatures: laidOut.timeSignatures,
    upbeat: laidOut.upbeat,
    keys: laidOut.keys,
  });
  return built === undefined ? err('not-a-score') : ok({song: built, leftOut: leftOutByPart(leftOuts)});
}
