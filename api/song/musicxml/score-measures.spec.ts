/*
 * Expected API of api/song/musicxml/score-measures.ts (T018), as these tests use it:
 *
 *   type ScoreRejection = 'not-a-score';
 *   scoreMeasures(root: XmlElement): Result<readonly ScorePart[], ScoreRejection>
 *     root: the document element from parseXml (xml.ts). score-partwise gives its parts in document order;
 *     score-timewise is turned into the same parts (research R5). Any other root gives
 *     { ok: false, error: 'not-a-score' }.
 *
 *   ScorePart { id: string; measures: readonly ScoreMeasure[] }          // id: the part's id attribute
 *   ScoreMeasure {
 *     number: string;                                                    // the number attribute, as written
 *     divisions: number;                                                 // divisions in force
 *     transpose: { chromatic: number; octaveChange: number };            // in force; 0 and 0 when none
 *     time: { beats: number; beatType: number } | undefined;             // Time signature in force
 *     key: { fifths: number; mode: Mode } | undefined;                   // Key in force; Mode from api/song/song.ts
 *     staves: number;                                                    // staves in force; 1 when none is written
 *     length: number;                                                    // furthest position any voice reached
 *     notes: readonly ScoreNote[];
 *   }
 *   ScoreNote { staff: number; start: number; length: number; pitch: MidiNoteNumber | 'unpitched' }
 *     All positions and lengths are in divisions. staff: the written <staff>, 1 when absent. start: the
 *     written position from the start of the measure (backup, forward and chord handled). pitch: the
 *     written pitch, before transpose, as a MIDI note number (C4 = 60; alter rounded to the nearest
 *     semitone, half way up). Rests are no Notes.
 *
 *   ScoreMeasure also has (T028, the marks of the measure, from its own barlines, sounds and words; R7):
 *     marks: MeasureMarks
 *   The MeasureMarks type is exported from score-measures.ts (the type of ScoreMeasure.marks):
 *     repeatForward: a forward repeat barline on the measure.
 *     repeatBackward: { times } for a backward repeat barline, times as written, 2 when none is written
 *       (the MusicXML default); undefined when there is none.
 *     endings: the ending numbers of the measure, "1, 2" giving [1, 2]; [] when there is none.
 *     segno, coda, toCoda, fine, daCapo, dalSegno: from the attributes of <sound> (segno, coda, tocoda, fine,
 *       dacapo="yes", dalsegno), or from the words of a <direction>: "D.C." and "Da Capo" give daCapo,
 *       "D.S." and "Dal Segno" give dalSegno, "Fine" gives fine, "To Coda" gives toCoda, case-insensitive.
 *       Other words give no mark.
 *
 * Out of this cycle: ties, grace notes, ornaments and arpeggiate flags (later tasks).
 */
import {describe, expect, it} from 'vitest';
import {parseXml, type XmlElement} from './xml';
import {scoreXml, type MeasureEntry, type ScoreSpec, type SoundSpec} from './score-test-helper';
import {
  scoreMeasures,
  type MeasureMarks,
  type ScoreMeasure,
  type ScoreNote,
  type ScorePart,
} from './score-measures';

function elementOf(text: string): XmlElement {
  const root = parseXml(new TextEncoder().encode(text));
  if (!root) throw new Error('the document cannot be read');
  return root;
}

function rootOf(spec: ScoreSpec): XmlElement {
  return elementOf(scoreXml(spec));
}

function partsOf(spec: ScoreSpec): readonly ScorePart[] {
  const result = scoreMeasures(rootOf(spec));
  if (!result.ok) throw new Error(`expected the measures of a score, got ${result.error}`);
  return result.value;
}

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

/** The measure at `index` of the first part, the part most tests write. */
function measureAt(parts: readonly ScorePart[], index: number): ScoreMeasure {
  return nth(nth(parts, 0).measures, index);
}

/** The Notes of the first measure of the first part. */
function firstNotes(spec: ScoreSpec): readonly ScoreNote[] {
  return measureAt(partsOf(spec), 0).notes;
}

const C4 = { step: 'C', octave: 4 } as const;

describe('scoreMeasures gives the parts of a score-partwise, each with its measures', () => {
  it('gives one part per part element, in document order, with its id and its measures', () => {
    const parts = partsOf({
      parts: [
        { measures: [{ entries: [] }, { entries: [] }] },
        { measures: [{ entries: [] }, { entries: [] }] },
      ],
    });

    expect(parts.map((part) => part.id)).toEqual(['P1', 'P2']);
    expect(parts.map((part) => part.measures.length)).toEqual([2, 2]);
  });
});

describe('scoreMeasures gives the Notes of a measure with their written position and length', () => {
  it('gives a Note its written pitch as a MIDI note number and its length in divisions', () => {
    const notes = firstNotes({
      parts: [
        { measures: [{ entries: [{ kind: 'attributes', divisions: 4 }, { kind: 'note', pitch: C4, duration: 4 }] }] },
      ],
    });

    expect(notes).toMatchObject([{ staff: 1, start: 0, length: 4, pitch: 60 }]);
  });

  it('places each Note after the one before it, by the length of the one before', () => {
    const notes = firstNotes({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'note', pitch: C4, duration: 2 },
                { kind: 'note', pitch: { step: 'D', octave: 4 }, duration: 3 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([
      { start: 0, length: 2, pitch: 60 },
      { start: 2, length: 3, pitch: 62 },
    ]);
  });

  it('gives a rest no Note and starts the next Note after the rest', () => {
    const notes = firstNotes({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'rest', duration: 2 },
                { kind: 'note', pitch: C4, duration: 1 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([{ start: 2, length: 1, pitch: 60 }]);
  });

  it('starts the notes of a chord together and does not advance the position for them', () => {
    const notes = firstNotes({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'note', pitch: C4, duration: 4 },
                { kind: 'note', pitch: { step: 'E', octave: 4 }, duration: 4, chord: true },
                { kind: 'note', pitch: { step: 'G', octave: 4 }, duration: 4, chord: true },
                { kind: 'note', pitch: { step: 'D', octave: 4 }, duration: 4 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([
      { start: 0, pitch: 60 },
      { start: 0, pitch: 64 },
      { start: 0, pitch: 67 },
      { start: 4, pitch: 62 },
    ]);
  });

  it('moves the position back by a backup', () => {
    const notes = firstNotes({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'note', pitch: C4, duration: 4 },
                { kind: 'backup', duration: 4 },
                { kind: 'note', pitch: { step: 'D', octave: 4 }, duration: 2 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([
      { start: 0, pitch: 60 },
      { start: 0, pitch: 62 },
    ]);
  });

  it('moves the position on by a forward', () => {
    const notes = firstNotes({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'forward', duration: 2 },
                { kind: 'note', pitch: C4, duration: 1 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([{ start: 2, pitch: 60 }]);
  });

  it('gives a Note without a staff the staff 1', () => {
    const notes = firstNotes({
      parts: [{ measures: [{ entries: [{ kind: 'note', pitch: C4, duration: 1 }] }] }],
    });

    expect(notes).toMatchObject([{ staff: 1 }]);
  });

  it('keeps a Note on the staff it is written on, even after a backup into another staff', () => {
    const notes = firstNotes({
      parts: [
        {
          staves: 2,
          measures: [
            {
              entries: [
                { kind: 'note', pitch: C4, duration: 4, staff: 1 },
                { kind: 'backup', duration: 4 },
                { kind: 'note', pitch: { step: 'E', octave: 3 }, duration: 4, staff: 2, voice: 2 },
              ],
            },
          ],
        },
      ],
    });

    expect(notes).toMatchObject([
      { staff: 1, start: 0, pitch: 60 },
      { staff: 2, start: 0, pitch: 52 },
    ]);
  });

  it('gives an unpitched Note as unpitched', () => {
    const notes = firstNotes({
      parts: [{ measures: [{ entries: [{ kind: 'note', pitch: 'unpitched', duration: 1 }] }] }],
    });

    expect(notes).toMatchObject([{ pitch: 'unpitched' }]);
  });

  it.each([
    ['F4 with alter 1 is 66, a sharp', { step: 'F', octave: 4, alter: 1 }, 66],
    ['C4 with a quarter-tone alter 0.25 is 60, rounded down', { step: 'C', octave: 4, alter: 0.25 }, 60],
    ['C4 with a quarter-tone alter 0.5 is 61, half way up', { step: 'C', octave: 4, alter: 0.5 }, 61],
    ['C4 with a quarter-tone alter -0.5 is 60, half way up', { step: 'C', octave: 4, alter: -0.5 }, 60],
  ] as const)('gives the MIDI note number of %s', (_, pitch, noteNumber) => {
    const notes = firstNotes({
      parts: [{ measures: [{ entries: [{ kind: 'note', pitch, duration: 1 }] }] }],
    });

    expect(notes).toMatchObject([{ pitch: noteNumber }]);
  });
});

describe('scoreMeasures carries the attributes in force into each measure', () => {
  it('gives the divisions in force, from the measure that gives them on', () => {
    const parts = partsOf({
      parts: [
        {
          measures: [
            { entries: [{ kind: 'attributes', divisions: 4 }] },
            { entries: [] },
            { entries: [{ kind: 'attributes', divisions: 2 }] },
          ],
        },
      ],
    });

    expect(parts[0]?.measures.map((measure) => measure.divisions)).toEqual([4, 4, 2]);
  });

  it('gives the Time signature in force, and none before the first one is written', () => {
    const parts = partsOf({
      parts: [
        {
          measures: [
            { entries: [] },
            { entries: [{ kind: 'attributes', divisions: 1, time: { beats: 3, beatType: 4 } }] },
            { entries: [] },
            { entries: [{ kind: 'attributes', time: { beats: 2, beatType: 4 } }] },
          ],
        },
      ],
    });

    expect(nth(parts, 0).measures.map((measure) => measure.time)).toEqual([
      undefined,
      { beats: 3, beatType: 4 },
      { beats: 3, beatType: 4 },
      { beats: 2, beatType: 4 },
    ]);
  });

  it('gives the Key in force, from the measure that gives it on', () => {
    const parts = partsOf({
      parts: [
        {
          measures: [
            { entries: [{ kind: 'attributes', divisions: 1, key: { fifths: -2, mode: 'minor' } }] },
            { entries: [] },
          ],
        },
      ],
    });

    expect(nth(parts, 0).measures.map((measure) => measure.key)).toEqual([
      { fifths: -2, mode: 'minor' },
      { fifths: -2, mode: 'minor' },
    ]);
  });

  it('gives the transposition in force, from the measure that gives it on', () => {
    const parts = partsOf({
      parts: [
        {
          measures: [
            {
              entries: [
                { kind: 'attributes', divisions: 1, transpose: { chromatic: -2, octaveChange: -1 } },
              ],
            },
            { entries: [] },
          ],
        },
      ],
    });

    expect(nth(parts, 0).measures.map((measure) => measure.transpose)).toEqual([
      { chromatic: -2, octaveChange: -1 },
      { chromatic: -2, octaveChange: -1 },
    ]);
  });

  it('gives no transposition as chromatic 0 and octave change 0', () => {
    const transpose = measureAt(partsOf({ parts: [{ measures: [{ entries: [] }] }] }), 0).transpose;

    expect(transpose).toEqual({ chromatic: 0, octaveChange: 0 });
  });

  it('gives the staves of each part in force, and 1 for a part that writes none', () => {
    const parts = partsOf({
      parts: [
        { name: 'Piano', staves: 2, measures: [{ entries: [] }, { entries: [] }] },
        { name: 'Flute', measures: [{ entries: [] }, { entries: [] }] },
      ],
    });

    expect(nth(parts, 0).measures.map((measure) => measure.staves)).toEqual([2, 2]);
    expect(nth(parts, 1).measures.map((measure) => measure.staves)).toEqual([1, 1]);
  });
});

describe('scoreMeasures gives the length of a measure as the furthest position reached', () => {
  it('counts a forward past the last Note toward the length of the measure', () => {
    const measure = measureAt(
      partsOf({
        parts: [
          {
            measures: [
              {
                entries: [
                  { kind: 'attributes', divisions: 4 },
                  { kind: 'note', pitch: C4, duration: 2 },
                  { kind: 'backup', duration: 2 },
                  { kind: 'note', pitch: { step: 'D', octave: 4 }, duration: 1 },
                  { kind: 'forward', duration: 3 },
                ],
              },
            ],
          },
        ],
      }),
      0,
    );

    expect(measure.length).toBe(4);
  });

  it('gives a measure of rests the length of its rests', () => {
    const measure = measureAt(
      partsOf({
        parts: [{ measures: [{ entries: [{ kind: 'attributes', divisions: 4 }, { kind: 'rest', duration: 6 }] }] }],
      }),
      0,
    );

    expect(measure).toMatchObject({ length: 6, notes: [] });
  });
});

describe('scoreMeasures reads a score-timewise as the same parts as its score-partwise', () => {
  it('gives the same parts and measures for a score-timewise as for the equivalent score-partwise', () => {
    const spec: ScoreSpec = {
      workTitle: 'Two parts',
      parts: [
        {
          name: 'Piano',
          staves: 2,
          measures: [
            {
              entries: [
                {
                  kind: 'attributes',
                  divisions: 2,
                  key: { fifths: -1, mode: 'minor' },
                  time: { beats: 3, beatType: 4 },
                  transpose: { chromatic: -2, octaveChange: -1 },
                },
                { kind: 'note', pitch: C4, duration: 2 },
                { kind: 'note', pitch: { step: 'E', octave: 4 }, duration: 2, chord: true },
                { kind: 'backup', duration: 2 },
                { kind: 'note', pitch: { step: 'E', octave: 3 }, duration: 2, staff: 2, voice: 2 },
                { kind: 'rest', duration: 2 },
              ],
            },
            {
              entries: [
                { kind: 'note', pitch: { step: 'G', octave: 4, alter: -1 }, duration: 3 },
                { kind: 'forward', duration: 1 },
              ],
            },
          ],
        },
        {
          name: 'Flute',
          measures: [
            { entries: [{ kind: 'note', pitch: { step: 'D', octave: 5 }, duration: 4 }] },
            { entries: [{ kind: 'rest', duration: 4 }] },
          ],
        },
      ],
    };

    const partwise = scoreMeasures(rootOf({ ...spec, form: 'partwise' }));
    const timewise = scoreMeasures(rootOf({ ...spec, form: 'timewise' }));

    expect(partwise).toMatchObject({ ok: true });
    expect(timewise).toEqual(partwise);
  });
});

describe('scoreMeasures gives the percussion staves of a part', () => {
  it('gives a staff with a percussion clef in force as percussion, and no other staff', () => {
    const parts = partsOf({
      parts: [
        {
          staves: 2,
          measures: [
            {
              entries: [
                { kind: 'attributes', clef: { sign: 'percussion', staff: 2 } },
                { kind: 'note', pitch: C4, duration: 1, staff: 1 },
                { kind: 'note', pitch: C4, duration: 1, staff: 2 },
              ],
            },
          ],
        },
      ],
    });

    expect([...nth(parts, 0).percussionStaves]).toEqual([2]);
  });

  it('gives a staff of only unpitched Notes as percussion, and a staff with a pitched Note as not', () => {
    const parts = partsOf({
      parts: [
        {
          staves: 2,
          measures: [
            {
              entries: [
                { kind: 'note', pitch: 'unpitched', duration: 1, staff: 1 },
                { kind: 'note', pitch: C4, duration: 1, staff: 2 },
                { kind: 'note', pitch: 'unpitched', duration: 1, staff: 2 },
              ],
            },
          ],
        },
      ],
    });

    expect([...nth(parts, 0).percussionStaves]).toEqual([1]);
  });

  it('gives an unpitched Note its display pitch when it has one, and its staff stays percussion', () => {
    const root = elementOf(
      '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Drums</part-name></score-part></part-list>' +
        '<part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>' +
        '<note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>' +
        '</measure></part></score-partwise>',
    );
    const result = scoreMeasures(root);
    if (!result.ok) throw new Error(`expected the measures of a score, got ${result.error}`);

    expect(measureAt(result.value, 0).notes).toMatchObject([{ pitch: 64 }]);
    expect([...nth(result.value, 0).percussionStaves]).toEqual([1]);
  });
});

describe('scoreMeasures gives an unpitched Note the MIDI note number of its instrument', () => {
  /** A drum Part whose one instrument is `midi-unpitched` 39: MusicXML counts MIDI note numbers from 1, so 38. */
  function drumsXml(noteXml: string): string {
    return (
      '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Drums</part-name>' +
      '<score-instrument id="P1-I1"><instrument-name>Snare drum</instrument-name></score-instrument>' +
      '<midi-instrument id="P1-I1"><midi-unpitched>39</midi-unpitched></midi-instrument>' +
      '</score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes>' +
      noteXml +
      '</measure></part></score-partwise>'
    );
  }

  it('gives an unpitched Note with a display pitch the midi-unpitched of its instrument, not the display pitch', () => {
    const result = scoreMeasures(
      elementOf(
        drumsXml(
          '<note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched>' +
            '<duration>1</duration><instrument id="P1-I1"/></note>',
        ),
      ),
    );
    if (!result.ok) throw new Error(`expected the measures of a score, got ${result.error}`);

    expect(measureAt(result.value, 0).notes).toMatchObject([{ pitch: 38 }]);
  });

  it('gives an unpitched Note without a display pitch the midi-unpitched of its instrument', () => {
    const result = scoreMeasures(
      elementOf(drumsXml('<note><unpitched/><duration>1</duration><instrument id="P1-I1"/></note>')),
    );
    if (!result.ok) throw new Error(`expected the measures of a score, got ${result.error}`);

    expect(measureAt(result.value, 0).notes).toMatchObject([{ pitch: 38 }]);
  });
});

describe('scoreMeasures rejects a root that is not a score-partwise or score-timewise', () => {
  it.each([
    ['an opus', '<opus xmlns="http://www.musicxml.org/ns"/>'],
    ['a document that is not MusicXML', '<html><body/></html>'],
  ])('gives not-a-score for %s', (_, text) => {
    expect(scoreMeasures(elementOf(text))).toEqual({ ok: false, error: 'not-a-score' });
  });
});

/** The marks of the one measure of a one-part Score with the given entries. */
function marksOf(...entries: MeasureEntry[]): MeasureMarks {
  return measureAt(partsOf({ parts: [{ measures: [{ entries }] }] }), 0).marks;
}

const NO_MARKS: MeasureMarks = {
  repeatForward: false,
  repeatBackward: undefined,
  endings: [],
  segno: false,
  coda: false,
  toCoda: false,
  fine: false,
  daCapo: false,
  dalSegno: false,
};

type SoundMark = 'segno' | 'coda' | 'toCoda' | 'fine' | 'daCapo' | 'dalSegno';

describe('scoreMeasures gives the repeat and ending marks of a measure', () => {
  it('gives a forward repeat barline as repeatForward on its measure', () => {
    expect(marksOf({ kind: 'barline', location: 'left', repeat: 'forward' })).toMatchObject({ repeatForward: true });
  });

  it('gives a backward repeat barline as repeatBackward with the times written', () => {
    expect(marksOf({ kind: 'barline', location: 'right', repeat: 'backward', times: 3 })).toMatchObject({
      repeatBackward: { times: 3 },
    });
  });

  it('gives a backward repeat barline without times written two times, the MusicXML default', () => {
    expect(marksOf({ kind: 'barline', location: 'right', repeat: 'backward' })).toMatchObject({
      repeatBackward: { times: 2 },
    });
  });

  it('gives a measure with no backward repeat barline no repeatBackward', () => {
    expect(marksOf({ kind: 'barline', location: 'left', repeat: 'forward' })).toMatchObject({
      repeatBackward: undefined,
    });
  });

  it('gives the ending numbers of a measure, a list such as "1, 2" giving both', () => {
    expect(marksOf({ kind: 'barline', location: 'left', ending: { number: '1, 2', type: 'start' } })).toMatchObject({
      endings: [1, 2],
    });
  });

  it('gives the marks of each measure from that measure alone', () => {
    const parts = partsOf({
      parts: [
        {
          measures: [
            { entries: [{ kind: 'barline', location: 'left', repeat: 'forward' }] },
            { entries: [{ kind: 'note', pitch: { step: 'C', octave: 4 }, duration: 1 }] },
          ],
        },
      ],
    });

    expect(nth(parts, 0).measures.map((measure) => measure.marks)).toEqual([
      { ...NO_MARKS, repeatForward: true },
      NO_MARKS,
    ]);
  });
});

describe('scoreMeasures gives the sound marks of a measure', () => {
  const SOUND_MARKS: readonly { readonly mark: SoundMark; readonly sound: SoundSpec }[] = [
    { mark: 'segno', sound: { segno: 'segno1' } },
    { mark: 'coda', sound: { coda: 'coda1' } },
    { mark: 'toCoda', sound: { tocoda: 'coda1' } },
    { mark: 'fine', sound: { fine: 'yes' } },
    { mark: 'daCapo', sound: { dacapo: true } },
    { mark: 'dalSegno', sound: { dalsegno: 'segno1' } },
  ];

  it.each(SOUND_MARKS)('gives the $mark mark from the sound of a direction', ({ mark, sound }) => {
    expect(marksOf({ kind: 'direction', sound })).toMatchObject({ [mark]: true });
  });

  it('gives no sound mark when the sound of a direction says no da capo', () => {
    expect(marksOf({ kind: 'direction', sound: { dacapo: false } })).toEqual(NO_MARKS);
  });
});

/** The marks of the first measure of a one-part Score whose only direction holds the sign element `sign`. */
function marksOfSign(sign: string): MeasureMarks {
  const root = elementOf(
    `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name></part-name></score-part></part-list>` +
      `<part id="P1"><measure number="1"><direction><direction-type><${sign}/></direction-type></direction>` +
      `</measure></part></score-partwise>`,
  );
  const result = scoreMeasures(root);
  if (!result.ok) throw new Error(`expected the measures of a score, got ${result.error}`);
  return measureAt(result.value, 0).marks;
}

describe('scoreMeasures gives the segno and coda signs of a direction-type', () => {
  it.each([
    { sign: 'segno', mark: 'segno' },
    { sign: 'coda', mark: 'coda' },
  ] as const)('gives the $mark mark from a <$sign/> sign', ({ sign, mark }) => {
    expect(marksOfSign(sign)).toMatchObject({ [mark]: true });
  });
});

describe('scoreMeasures gives the jump marks of the words of a direction', () => {
  const JUMP_WORDS: readonly { readonly words: string; readonly marks: readonly SoundMark[] }[] = [
    { words: 'D.C.', marks: ['daCapo'] },
    { words: 'Da Capo', marks: ['daCapo'] },
    { words: 'D.S.', marks: ['dalSegno'] },
    { words: 'Dal Segno', marks: ['dalSegno'] },
    { words: 'Fine', marks: ['fine'] },
    { words: 'To Coda', marks: ['toCoda'] },
    { words: 'D.C. al Fine', marks: ['daCapo', 'fine'] },
    { words: 'da capo', marks: ['daCapo'] },
    { words: 'to coda', marks: ['toCoda'] },
  ];

  it.each(JUMP_WORDS)('gives the marks of the words "$words"', ({ words, marks }) => {
    expect(marksOf({ kind: 'direction', words })).toMatchObject(
      Object.fromEntries(marks.map((mark) => [mark, true])),
    );
  });

  it('gives no mark to other words', () => {
    expect(marksOf({ kind: 'direction', words: 'Allegro, dolce' })).toEqual(NO_MARKS);
  });
});
