/*
 * The description API of score-test-helper.ts (T014), as these tests use it:
 *
 *   scoreXml(spec: ScoreSpec): string
 *     writes a score-partwise (or score-timewise) document with a DOCTYPE, as MuseScore does.
 *
 *   ScoreSpec { form?: 'partwise' | 'timewise' (default partwise); workTitle?; movementTitle?; parts: PartSpec[] }
 *   PartSpec  { id? (default P1, P2, … by index); name? (no name: an empty part-name); staves? (default 1,
 *               written into the first measure's attributes); measures: MeasureSpec[] }
 *   MeasureSpec { number? (default 1, 2, … by index); implicit?: boolean; entries: MeasureEntry[] }
 *
 *   MeasureEntry, one of:
 *     NoteSpec    { kind: 'note'; pitch: PitchSpec | 'unpitched'; duration: number; grace?: false;
 *                   staff?; voice?; chord?: true; tie?: ('start' | 'stop')[]; ornaments?: Ornament[];
 *                   arpeggiate?: true }
 *                 or { kind: 'note'; pitch; grace: true } (a grace note has no duration)
 *     RestSpec    { kind: 'rest'; duration; staff?; voice? }
 *     BackupSpec  { kind: 'backup'; duration }
 *     ForwardSpec { kind: 'forward'; duration; staff?; voice? }
 *     AttributesSpec { kind: 'attributes'; divisions?; time?: {beats, beatType}; key?: {fifths, mode?};
 *                      transpose?: {chromatic, octaveChange?}; clef?: {sign, line?, staff?} }
 *     DirectionSpec  { kind: 'direction'; words?; sound?: {segno?, coda?, tocoda?, dalsegno?, fine?, dacapo?};
 *                      staff? }
 *     BarlineSpec    { kind: 'barline'; location?: 'left' | 'right'; repeat?: 'forward' | 'backward';
 *                      times?; ending?: {number, type: 'start' | 'stop' | 'discontinue'} }
 *   PitchSpec { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; alter?: number }
 *   Ornament: 'trill-mark' | 'mordent' | 'inverted-mordent' | 'turn' | 'tremolo'
 *
 * Within a measure the entries are written in order; a chord note is written as it is given, so the
 * caller places the backup or forward itself. Text is XML-escaped.
 */
import {describe, expect, it} from 'vitest';
import {parseXml, type XmlElement} from './xml';
import {scoreXml, type ScoreSpec} from './score-test-helper';

function rootOf(spec: ScoreSpec): XmlElement {
  const root = parseXml(new TextEncoder().encode(scoreXml(spec)));
  if (!root) throw new Error('the helper wrote a document that xml.ts cannot read');
  return root;
}

function childrenNamed(element: XmlElement, name: string): readonly XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

function nthOf(elements: readonly XmlElement[], index: number): XmlElement {
  const element = elements[index];
  if (!element) throw new Error(`no element at ${index}`);
  return element;
}

/** Walks down the first child with each name in turn. */
function at(element: XmlElement, ...path: readonly string[]): XmlElement {
  let current = element;
  for (const name of path) {
    current = nthOf(childrenNamed(current, name), 0);
  }
  return current;
}

describe('scoreXml names the parts in a part-list, in order', () => {
  it('writes a score-part for each part, with its id and part name', () => {
    const root = rootOf({
      parts: [
        { name: 'Flute', measures: [{ entries: [] }] },
        { name: 'Piano', measures: [{ entries: [] }] },
      ],
    });

    const scoreParts = childrenNamed(at(root, 'part-list'), 'score-part');
    expect(scoreParts.map((part) => part.attributes.get('id'))).toEqual(['P1', 'P2']);
    expect(scoreParts.map((part) => at(part, 'part-name').text)).toEqual(['Flute', 'Piano']);
  });

  it('writes an empty part-name for a part without a name', () => {
    const root = rootOf({ parts: [{ measures: [{ entries: [] }] }] });

    expect(at(root, 'part-list', 'score-part', 'part-name').text).toBe('');
  });

  it('escapes the text of names, so that it reads back unchanged', () => {
    const root = rootOf({
      workTitle: 'Bach & <Sons>',
      parts: [{ name: 'Flute "1" & 2', measures: [{ entries: [] }] }],
    });

    expect(at(root, 'work', 'work-title').text).toBe('Bach & <Sons>');
    expect(at(root, 'part-list', 'score-part', 'part-name').text).toBe('Flute "1" & 2');
  });
});

describe('scoreXml writes the measures of a part with their Notes', () => {
  it('writes a measure with its number and a note with its pitch and duration', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'attributes', divisions: 1 },
                { kind: 'note', pitch: { step: 'C', octave: 4 }, duration: 2 },
              ],
            },
          ],
        },
      ],
    });

    const measure = at(root, 'part', 'measure');
    expect(measure.attributes.get('number')).toBe('1');
    const note = at(measure, 'note');
    expect(at(note, 'pitch', 'step').text).toBe('C');
    expect(at(note, 'pitch', 'octave').text).toBe('4');
    expect(at(note, 'duration').text).toBe('2');
  });

  it('writes the alter of a pitch as a number of semitones', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [{ kind: 'note', pitch: { step: 'B', octave: 3, alter: -1 }, duration: 1 }],
            },
          ],
        },
      ],
    });

    expect(at(root, 'part', 'measure', 'note', 'pitch', 'alter').text).toBe('-1');
  });

  it('writes a chord note with a chord element, and backup and forward with their durations', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'note', pitch: { step: 'C', octave: 4 }, duration: 4 },
                { kind: 'note', pitch: { step: 'E', octave: 4 }, duration: 4, chord: true },
                { kind: 'backup', duration: 4 },
                { kind: 'forward', duration: 2, staff: 2, voice: 2 },
              ],
            },
          ],
        },
      ],
    });

    const measure = at(root, 'part', 'measure');
    expect(childrenNamed(nthOf(childrenNamed(measure, 'note'), 1), 'chord')).toHaveLength(1);
    expect(at(measure, 'backup', 'duration').text).toBe('4');
    expect(at(measure, 'forward', 'duration').text).toBe('2');
  });
});

describe('scoreXml writes the staves, staff, voice and rests of a part', () => {
  it('writes the staves count in the attributes of the first measure', () => {
    const root = rootOf({
      parts: [{ name: 'Piano', staves: 2, measures: [{ entries: [] }, { entries: [] }] }],
    });

    expect(at(root, 'part', 'measure', 'attributes', 'staves').text).toBe('2');
  });

  it('writes the staff and voice of a note', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [{ kind: 'note', pitch: { step: 'G', octave: 2 }, duration: 1, staff: 2, voice: 3 }],
            },
          ],
        },
      ],
    });

    const note = at(root, 'part', 'measure', 'note');
    expect(at(note, 'staff').text).toBe('2');
    expect(at(note, 'voice').text).toBe('3');
  });

  it('writes a rest as a note with a rest element and no pitch', () => {
    const root = rootOf({
      parts: [{ measures: [{ entries: [{ kind: 'rest', duration: 1 }] }] }],
    });

    const note = at(root, 'part', 'measure', 'note');
    expect(childrenNamed(note, 'rest')).toHaveLength(1);
    expect(childrenNamed(note, 'pitch')).toEqual([]);
    expect(at(note, 'duration').text).toBe('1');
  });
});

describe('scoreXml writes attributes, directions and barlines', () => {
  it('writes divisions, time, key with its mode, clef and transpose', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [
                {
                  kind: 'attributes',
                  divisions: 480,
                  key: { fifths: -2, mode: 'minor' },
                  time: { beats: 3, beatType: 4 },
                  clef: { sign: 'F', line: 4 },
                  transpose: { chromatic: -2, octaveChange: -1 },
                },
              ],
            },
          ],
        },
      ],
    });

    const attributes = at(root, 'part', 'measure', 'attributes');
    expect(at(attributes, 'divisions').text).toBe('480');
    expect(at(attributes, 'key', 'fifths').text).toBe('-2');
    expect(at(attributes, 'key', 'mode').text).toBe('minor');
    expect(at(attributes, 'time', 'beats').text).toBe('3');
    expect(at(attributes, 'time', 'beat-type').text).toBe('4');
    expect(at(attributes, 'clef', 'sign').text).toBe('F');
    expect(at(attributes, 'transpose', 'chromatic').text).toBe('-2');
    expect(at(attributes, 'transpose', 'octave-change').text).toBe('-1');
  });

  it('writes a direction with its words and its sound', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [{ kind: 'direction', words: 'Da Capo al Fine', sound: { dacapo: true, fine: 'fine1' } }],
            },
          ],
        },
      ],
    });

    const direction = at(root, 'part', 'measure', 'direction');
    expect(at(direction, 'direction-type', 'words').text).toBe('Da Capo al Fine');
    expect(at(direction, 'sound').attributes.get('dacapo')).toBe('yes');
    expect(at(direction, 'sound').attributes.get('fine')).toBe('fine1');
  });

  it('writes a barline with a forward repeat, one with a backward repeat, and one with an ending', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'barline', location: 'left', repeat: 'forward' },
                { kind: 'barline', location: 'right', repeat: 'backward', times: 2 },
                { kind: 'barline', location: 'left', ending: { number: '1', type: 'start' } },
              ],
            },
          ],
        },
      ],
    });

    const [forward, backward, ending] = childrenNamed(at(root, 'part', 'measure'), 'barline');
    if (!forward || !backward || !ending) throw new Error('expected three barlines');
    expect(at(forward, 'repeat').attributes.get('direction')).toBe('forward');
    expect(at(backward, 'repeat').attributes.get('direction')).toBe('backward');
    expect(at(backward, 'repeat').attributes.get('times')).toBe('2');
    expect(at(ending, 'ending').attributes.get('type')).toBe('start');
  });
});

describe('scoreXml writes ties, grace notes and ornaments', () => {
  it('writes a tie both as a tie of the note and as tied in its notations', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [{ kind: 'note', pitch: { step: 'A', octave: 4 }, duration: 1, tie: ['start'] }],
            },
          ],
        },
      ],
    });

    const note = at(root, 'part', 'measure', 'note');
    expect(at(note, 'tie').attributes.get('type')).toBe('start');
    expect(at(note, 'notations', 'tied').attributes.get('type')).toBe('start');
  });

  it('writes a grace note without a duration, and an ornament in the notations of its note', () => {
    const root = rootOf({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'note', pitch: { step: 'D', octave: 5 }, grace: true },
                { kind: 'note', pitch: { step: 'E', octave: 5 }, duration: 1, ornaments: ['trill-mark'] },
              ],
            },
          ],
        },
      ],
    });

    const [graceNote, mainNote] = childrenNamed(at(root, 'part', 'measure'), 'note');
    if (!graceNote || !mainNote) throw new Error('expected a grace note and a note');
    expect(childrenNamed(graceNote, 'grace')).toHaveLength(1);
    expect(childrenNamed(graceNote, 'duration')).toEqual([]);
    expect(at(mainNote, 'notations', 'ornaments', 'trill-mark')).toBeDefined();
  });
});

describe('scoreXml writes partwise or timewise', () => {
  it('writes a timewise score with each measure first and its parts inside it', () => {
    const root = rootOf({
      form: 'timewise',
      parts: [
        { name: 'Flute', measures: [{ entries: [] }, { entries: [] }] },
        { name: 'Piano', measures: [{ entries: [] }, { entries: [] }] },
      ],
    });

    expect(root.name).toBe('score-timewise');
    const measures = childrenNamed(root, 'measure');
    expect(measures).toHaveLength(2);
    expect(childrenNamed(nthOf(measures, 0), 'part').map((part) => part.attributes.get('id'))).toEqual([
      'P1',
      'P2',
    ]);
    expect(childrenNamed(root, 'part')).toEqual([]);
  });

  it('writes a partwise score by default, with each part first and its measures inside it', () => {
    const root = rootOf({ parts: [{ measures: [{ entries: [] }, { entries: [] }] }] });

    expect(root.name).toBe('score-partwise');
    expect(childrenNamed(at(root, 'part'), 'measure')).toHaveLength(2);
  });
});
