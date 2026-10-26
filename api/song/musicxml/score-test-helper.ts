/**
 * Writes MusicXML Scores from a compact description, for the tests of the MusicXML reader. The fixtures
 * are built in code, so no third-party Score enters the repository (ADR 27). Not used by the app.
 */

export type Ornament = 'trill-mark' | 'mordent' | 'inverted-mordent' | 'turn' | 'tremolo';

export interface PitchSpec {
  readonly step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  readonly octave: number;
  readonly alter?: number;
}

interface NoteCommon {
  readonly kind: 'note';
  readonly pitch: PitchSpec | 'unpitched';
  /** Only for an unpitched Note: where its notehead is shown, written as the display pitch. */
  readonly displayPitch?: PitchSpec;
  readonly staff?: number;
  readonly voice?: number;
  readonly chord?: true;
  readonly tie?: readonly ('start' | 'stop')[];
  readonly ornaments?: readonly Ornament[];
  readonly arpeggiate?: true;
}

/** A Note with a duration, or a grace Note, which has none. */
export type NoteSpec = NoteCommon &
  ({readonly duration: number; readonly grace?: false} | {readonly grace: true});

export interface RestSpec {
  readonly kind: 'rest';
  readonly duration: number;
  readonly staff?: number;
  readonly voice?: number;
}

export interface BackupSpec {
  readonly kind: 'backup';
  readonly duration: number;
}

export interface ForwardSpec {
  readonly kind: 'forward';
  readonly duration: number;
  readonly staff?: number;
  readonly voice?: number;
}

export interface AttributesSpec {
  readonly kind: 'attributes';
  readonly divisions?: number;
  readonly time?: {readonly beats: number; readonly beatType: number};
  readonly key?: {readonly fifths: number; readonly mode?: 'major' | 'minor'};
  readonly transpose?: {readonly chromatic: number; readonly octaveChange?: number};
  readonly clef?: {
    readonly sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB' | 'none';
    readonly line?: number;
    readonly staff?: number;
  };
}

export interface SoundSpec {
  readonly segno?: string;
  readonly coda?: string;
  readonly tocoda?: string;
  readonly dalsegno?: string;
  readonly fine?: string;
  readonly dacapo?: boolean;
}

export interface DirectionSpec {
  readonly kind: 'direction';
  readonly words?: string;
  readonly sound?: SoundSpec;
  readonly staff?: number;
}

export interface BarlineSpec {
  readonly kind: 'barline';
  readonly location?: 'left' | 'right';
  readonly repeat?: 'forward' | 'backward';
  readonly times?: number;
  readonly ending?: {readonly number: string; readonly type: 'start' | 'stop' | 'discontinue'};
}

export type MeasureEntry =
  | NoteSpec
  | RestSpec
  | BackupSpec
  | ForwardSpec
  | AttributesSpec
  | DirectionSpec
  | BarlineSpec;

export interface MeasureSpec {
  /** Default: 1, 2, … by index. */
  readonly number?: number;
  readonly implicit?: boolean;
  readonly entries: readonly MeasureEntry[];
}

export interface PartSpec {
  /** Default: P1, P2, … by index. */
  readonly id?: string;
  /** Without a name the part-name is empty. */
  readonly name?: string;
  /** Written into the attributes of the part's first measure; default 1. */
  readonly staves?: number;
  readonly measures: readonly MeasureSpec[];
}

export interface ScoreSpec {
  /** Default: partwise. */
  readonly form?: 'partwise' | 'timewise';
  readonly workTitle?: string;
  readonly movementTitle?: string;
  readonly parts: readonly PartSpec[];
}

type Attributes = Readonly<Record<string, string | undefined>>;

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&apos;'],
]);

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES.get(character) ?? character);
}

function tag(name: string, attributes: Attributes = {}, content?: string): string {
  const attributeText = Object.entries(attributes)
    .map(([key, value]) => (value === undefined ? '' : ` ${key}="${escapeXml(value)}"`))
    .join('');
  return content === undefined ? `<${name}${attributeText}/>` : `<${name}${attributeText}>${content}</${name}>`;
}

function leaf(name: string, value: string | number): string {
  return tag(name, {}, escapeXml(String(value)));
}

/** An element with a value, or nothing when the value is not given. */
function optionalLeaf(name: string, value: string | number | undefined): string {
  return value === undefined ? '' : leaf(name, value);
}

function unpitchedXml(displayPitch: PitchSpec | undefined): string {
  if (displayPitch === undefined) return tag('unpitched');
  return tag('unpitched', {}, leaf('display-step', displayPitch.step) + leaf('display-octave', displayPitch.octave));
}

function pitchXml(pitch: PitchSpec): string {
  return tag('pitch', {}, leaf('step', pitch.step) + optionalLeaf('alter', pitch.alter) + leaf('octave', pitch.octave));
}

function voiceAndStaff(entry: {readonly voice?: number; readonly staff?: number}): string {
  return optionalLeaf('voice', entry.voice) + optionalLeaf('staff', entry.staff);
}

function notationsXml(note: NoteSpec): string {
  const tied = (note.tie ?? []).map((type) => tag('tied', {type}));
  const ornaments = note.ornaments ?? [];
  const ornamentsXml = ornaments.length === 0 ? '' : tag('ornaments', {}, ornaments.map((name) => tag(name)).join(''));
  const arpeggiate = note.arpeggiate === true ? tag('arpeggiate') : '';
  const notations = [...tied, ornamentsXml, arpeggiate].join('');
  return notations === '' ? '' : tag('notations', {}, notations);
}

function noteXml(note: NoteSpec): string {
  const head = (note.chord ? tag('chord') : '') + (note.grace === true ? tag('grace') : '');
  const sounding = note.pitch === 'unpitched' ? unpitchedXml(note.displayPitch) : pitchXml(note.pitch);
  const duration = note.grace === true ? '' : leaf('duration', note.duration);
  const ties = (note.tie ?? []).map((type) => tag('tie', {type})).join('');
  return tag('note', {}, head + sounding + duration + ties + voiceAndStaff(note) + notationsXml(note));
}

function keyXml(key: NonNullable<AttributesSpec['key']>): string {
  return tag('key', {}, leaf('fifths', key.fifths) + optionalLeaf('mode', key.mode));
}

function timeXml(time: NonNullable<AttributesSpec['time']>): string {
  return tag('time', {}, leaf('beats', time.beats) + leaf('beat-type', time.beatType));
}

function clefXml(clef: NonNullable<AttributesSpec['clef']>): string {
  const number = clef.staff === undefined ? undefined : String(clef.staff);
  return tag('clef', {number}, leaf('sign', clef.sign) + optionalLeaf('line', clef.line));
}

function transposeXml(transpose: NonNullable<AttributesSpec['transpose']>): string {
  return tag(
    'transpose',
    {},
    leaf('chromatic', transpose.chromatic) + optionalLeaf('octave-change', transpose.octaveChange),
  );
}

/** The attributes of a measure, in the order MusicXML gives them; `staves` is written after the time. */
function attributesXml(spec: AttributesSpec, staves?: number): string {
  return tag(
    'attributes',
    {},
    optionalLeaf('divisions', spec.divisions) +
      (spec.key === undefined ? '' : keyXml(spec.key)) +
      (spec.time === undefined ? '' : timeXml(spec.time)) +
      optionalLeaf('staves', staves) +
      (spec.clef === undefined ? '' : clefXml(spec.clef)) +
      (spec.transpose === undefined ? '' : transposeXml(spec.transpose)),
  );
}

function directionXml(spec: DirectionSpec): string {
  const words = spec.words === undefined ? '' : tag('direction-type', {}, leaf('words', spec.words));
  const sound = spec.sound;
  const soundXml =
    sound === undefined
      ? ''
      : tag('sound', {
          segno: sound.segno,
          coda: sound.coda,
          tocoda: sound.tocoda,
          dalsegno: sound.dalsegno,
          dacapo: sound.dacapo === undefined ? undefined : sound.dacapo ? 'yes' : 'no',
          fine: sound.fine,
        });
  return tag('direction', {}, words + optionalLeaf('staff', spec.staff) + soundXml);
}

function barlineXml(spec: BarlineSpec): string {
  const ending =
    spec.ending === undefined ? undefined : tag('ending', {number: spec.ending.number, type: spec.ending.type});
  const repeat =
    spec.repeat === undefined ? undefined : tag('repeat', {direction: spec.repeat, times: spec.times?.toString()});
  return tag('barline', {location: spec.location}, (ending ?? '') + (repeat ?? ''));
}

/** One entry of a measure. `staves` is passed only to the first attributes entry of the part's first measure. */
function entryXml(entry: MeasureEntry, staves?: number): string {
  switch (entry.kind) {
    case 'note':
      return noteXml(entry);
    case 'rest':
      return tag('note', {}, tag('rest') + leaf('duration', entry.duration) + voiceAndStaff(entry));
    case 'backup':
      return tag('backup', {}, leaf('duration', entry.duration));
    case 'forward':
      return tag('forward', {}, leaf('duration', entry.duration) + voiceAndStaff(entry));
    case 'attributes':
      return attributesXml(entry, staves);
    case 'direction':
      return directionXml(entry);
    case 'barline':
      return barlineXml(entry);
  }
}

/** The content of a measure: its entries in order, with the staves of the part first if it is the first measure. */
function measureContentXml(measure: MeasureSpec, staves?: number): string {
  const firstAttributes = measure.entries.findIndex((entry) => entry.kind === 'attributes');
  const leading = staves !== undefined && firstAttributes < 0 ? attributesXml({kind: 'attributes'}, staves) : '';
  const entries = measure.entries.map((entry, index) =>
    entryXml(entry, index === firstAttributes ? staves : undefined),
  );
  return leading + entries.join('');
}

function yesNo(value: boolean | undefined): string | undefined {
  return value === undefined ? undefined : value ? 'yes' : 'no';
}

function measureTag(measure: MeasureSpec, index: number, content: string): string {
  return tag(
    'measure',
    {number: String(measure.number ?? index + 1), implicit: yesNo(measure.implicit)},
    content,
  );
}

/** The staves of a part are written into its first measure only. */
function stavesAt(part: PartSpec, index: number): number | undefined {
  return index === 0 ? (part.staves ?? 1) : undefined;
}

function partIdOf(part: PartSpec, index: number): string {
  return part.id ?? `P${index + 1}`;
}

function partListXml(parts: readonly PartSpec[]): string {
  const scoreParts = parts.map((part, index) =>
    tag('score-part', {id: partIdOf(part, index)}, leaf('part-name', part.name ?? '')),
  );
  return tag('part-list', {}, scoreParts.join(''));
}

function headingXml(spec: ScoreSpec): string {
  const work = spec.workTitle === undefined ? '' : tag('work', {}, leaf('work-title', spec.workTitle));
  return work + optionalLeaf('movement-title', spec.movementTitle);
}

function partwiseBody(spec: ScoreSpec): string {
  const parts = spec.parts.map((part, index) => {
    const measures = part.measures.map((measure, measureIndex) =>
      measureTag(measure, measureIndex, measureContentXml(measure, stavesAt(part, measureIndex))),
    );
    return tag('part', {id: partIdOf(part, index)}, measures.join(''));
  });
  return headingXml(spec) + partListXml(spec.parts) + parts.join('');
}

function timewiseBody(spec: ScoreSpec): string {
  const measureCount = Math.max(0, ...spec.parts.map((part) => part.measures.length));
  const measures = Array.from({length: measureCount}, (_, measureIndex) => {
    const firstPart = spec.parts.find((part) => part.measures[measureIndex] !== undefined);
    const firstMeasure = firstPart?.measures[measureIndex];
    if (firstMeasure === undefined) return '';
    const parts = spec.parts.flatMap((part, index) => {
      const measure = part.measures[measureIndex];
      if (measure === undefined) return [];
      return [tag('part', {id: partIdOf(part, index)}, measureContentXml(measure, stavesAt(part, measureIndex)))];
    });
    return measureTag(firstMeasure, measureIndex, parts.join(''));
  });
  return headingXml(spec) + partListXml(spec.parts) + measures.join('');
}

const DOCTYPES = {
  partwise:
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
  timewise:
    '<!DOCTYPE score-timewise PUBLIC "-//Recordare//DTD MusicXML 4.0 Timewise//EN" "http://www.musicxml.org/dtds/timewise.dtd">',
} as const;

/** Writes a score-partwise (or score-timewise) document with a DOCTYPE, as MuseScore does. */
export function scoreXml(spec: ScoreSpec): string {
  const form = spec.form ?? 'partwise';
  const body = form === 'partwise' ? partwiseBody(spec) : timewiseBody(spec);
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
  return `${declaration}\n${DOCTYPES[form]}\n<score-${form} version="4.0">${body}</score-${form}>`;
}
