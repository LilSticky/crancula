import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, organId, type Organ} from '../organ/organ';
import {
  newSongId,
  note,
  part,
  partIndex,
  song,
  tick,
  ticksPerQuarter,
  type Part,
  type PartIndex,
  type Song,
} from '../song/song';
import {createTape, type CreatedTape} from './create-tape';
import {fitNotesOf, fitOf} from './fit';
import {column, transposition, type Column, type Transposition} from './tape';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function aPart(noteNumbers: readonly number[]): Part {
  const notes = noteNumbers
    .map((noteNumber, index) =>
      defined(
        note({
          noteNumber: defined(midiNoteNumber(noteNumber), 'note number'),
          start: defined(tick(index * 480), 'start'),
          duration: defined(tick(480), 'duration'),
        }),
        'note',
      ),
    )
    .sort((a, b) => a.start - b.start || a.noteNumber - b.noteNumber);
  return defined(part({name: undefined, percussion: false, notes}), 'part');
}

function aSong(...parts: readonly Part[]): Song {
  return defined(
    song({
      id: newSongId(),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(480), 'ticks per quarter'),
      parts,
    }),
    'song',
  );
}

function anOrgan(pipeNotes: readonly number[]): Organ {
  const one = defined(millimetres(1), 'millimetres');
  return asValidOrgan({
    id: defined(organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: one, holeDiameter: one, rowSpacing: one},
    minimumGap: one,
    leadIn: one,
    pipes: pipeNotes.map((each) => ({
      note: defined(midiNoteNumber(each), 'pipe'),
    })),
  });
}

function range(from: number, to: number): number[] {
  return Array.from({length: to - from + 1}, (_, index) => from + index);
}

function parts(...indexes: readonly number[]): ReadonlySet<PartIndex> {
  return new Set(indexes.map((index) => defined(partIndex(index, 10), 'part index')));
}

const noShift = defined(transposition(0), 'transposition');

describe('fitOf', () => {
  const organ = anOrgan(range(60, 84).filter((pipe) => pipe % 12 !== 6));

  it('counts Notes that match a Pipe, Notes moved by octaves and Unplayable Notes', () => {
    // C4 is a Pipe, B6 (95) moves to B5, F#4 (66) has no Pipe of its pitch class
    const fit = fitOf(aSong(aPart([60, 95, 66])), parts(0), organ, noShift);
    expect(fit).toEqual({matchingAPipe: 1, movedByOctaves: 1, unplayable: 1});
  });

  it('applies the Transposition before matching', () => {
    // C3 (48) shifted by +12 is C4 (60), a Pipe
    const shift = defined(transposition(12), 'transposition');
    expect(fitOf(aSong(aPart([48])), parts(0), organ, shift)).toEqual({
      matchingAPipe: 1,
      movedByOctaves: 0,
      unplayable: 0,
    });
  });

  it('adds up to the number of selected Notes', () => {
    const fit = fitOf(aSong(aPart([60, 95, 66, 66, 62])), parts(0), organ, noShift);
    expect(fit.matchingAPipe + fit.movedByOctaves + fit.unplayable).toBe(5);
  });

  it('counts a Note shifted outside 0 to 127 as unplayable', () => {
    const up = defined(transposition(20), 'transposition');
    const down = defined(transposition(-10), 'transposition');
    const expected = {matchingAPipe: 0, movedByOctaves: 0, unplayable: 1};
    expect(fitOf(aSong(aPart([120])), parts(0), organ, up)).toEqual(expected);
    expect(fitOf(aSong(aPart([5])), parts(0), organ, down)).toEqual(expected);
  });

  it('ignores Notes of unselected Parts', () => {
    const fit = fitOf(aSong(aPart([60]), aPart([66, 95])), parts(0), organ, noShift);
    expect(fit).toEqual({matchingAPipe: 1, movedByOctaves: 0, unplayable: 0});
  });
});

function aPartStartingAt(notes: readonly (readonly [noteNumber: number, start: number])[]): Part {
  return defined(
    part({
      name: undefined,
      percussion: false,
      notes: [...notes]
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([noteNumber, start]) =>
          defined(
            note({
              noteNumber: defined(midiNoteNumber(noteNumber), 'note number'),
              start: defined(tick(start), 'start'),
              duration: defined(tick(480), 'duration'),
            }),
            'note',
          ),
        ),
    }),
    'part',
  );
}

function aPartIndex(value: number): PartIndex {
  return defined(partIndex(value, 10), 'part index');
}

function aNoteNumber(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), 'note number');
}

function tapeFor(song: Song, shift: Transposition, columnLength: number): CreatedTape {
  const created = createTape({
    song,
    selectedParts: parts(0, 1),
    organ: anOrgan(range(60, 84).filter((pipe) => pipe % 12 !== 6)),
    transposition: shift,
    name: 'Tape',
    columnLength,
  });
  if (!created.ok) throw new Error('invalid test value: Tape');
  return created.value;
}

function columnAt(value: number): Column {
  return defined(column(value), 'column');
}

describe('fitNotesOf', () => {
  const organ = anOrgan(range(60, 84).filter((pipe) => pipe % 12 !== 6));

  it('gives a Note moved up an octave with its Part, transposed note number, Pipe, octaves and Column', () => {
    // C3 (48) has no Pipe, C4 (60) is an octave up; it starts one quarter note (8 Columns) after the first Note
    const song = aSong(
      aPartStartingAt([
        [60, 0],
        [48, 480],
      ]),
    );
    const {movedByOctaves, unplayableNotes} = fitNotesOf(song, parts(0), organ, noShift);
    expect(movedByOctaves).toEqual([
      {
        part: aPartIndex(0),
        noteNumber: aNoteNumber(48),
        pipe: aNoteNumber(60),
        octaves: 1,
        column: columnAt(8),
      },
    ]);
    expect(unplayableNotes).toEqual([]);
  });

  it('gives an Unplayable Note with its Part, transposed note number and Column', () => {
    const song = aSong(
      aPartStartingAt([
        [60, 0],
        [65, 960],
      ]),
    );
    const shift = defined(transposition(1), 'transposition');
    const {movedByOctaves, unplayableNotes} = fitNotesOf(song, parts(0), organ, shift);
    expect(movedByOctaves).toEqual([]);
    expect(unplayableNotes).toEqual([
      {
        part: aPartIndex(0),
        noteNumber: aNoteNumber(66),
        column: columnAt(16),
      },
    ]);
  });

  it('counts Columns from the first selected Note, not from the Song start', () => {
    // the unselected Part 0 starts earlier; Part 1's first Note is Column 0
    const song = aSong(
      aPartStartingAt([[60, 0]]),
      aPartStartingAt([
        [66, 1920],
        [95, 2400],
      ]),
    );
    const {movedByOctaves, unplayableNotes} = fitNotesOf(song, parts(1), organ, noShift);
    expect(unplayableNotes.map((each) => each.column)).toEqual([columnAt(0)]);
    expect(movedByOctaves.map((each) => each.column)).toEqual([columnAt(8)]);
  });

  it('gives the Columns createTape gives, whatever the Column length', () => {
    const song = aSong(
      aPartStartingAt([
        [60, 0],
        [95, 480],
        [66, 960],
      ]),
      aPartStartingAt([[60, 0]]),
    );
    const notes = fitNotesOf(song, parts(0), organ, noShift);
    for (const columnLength of [1, 3, 7]) {
      const {importSummary} = tapeFor(song, noShift, columnLength);
      expect(notes.movedByOctaves).toEqual(importSummary.movedByOctaves);
      expect(notes.unplayableNotes).toEqual(importSummary.unplayableNotes);
    }
  });

  it('gives nothing for unselected Parts', () => {
    const song = aSong(
      aPartStartingAt([[60, 0]]),
      aPartStartingAt([
        [66, 0],
        [95, 480],
      ]),
    );
    expect(fitNotesOf(song, parts(0), organ, noShift)).toEqual({
      movedByOctaves: [],
      unplayableNotes: [],
    });
  });

  describe('against fitOf and createTape', () => {
    const song = aSong(
      aPartStartingAt([
        [60, 100],
        [48, 580],
        [66, 1000],
        [95, 1500],
        [64, 1500],
      ]),
      aPartStartingAt([
        [30, 240],
        [66, 700],
        [101, 2000],
        [72, 2000],
      ]),
    );

    it.each([-7, -1, 0, 1, 5, 12])('has the counts of fitOf at Transposition %i', (value) => {
      const shift = defined(transposition(value), 'transposition');
      const fit = fitOf(song, parts(0, 1), organ, shift);
      const notes = fitNotesOf(song, parts(0, 1), organ, shift);
      expect(notes.movedByOctaves).toHaveLength(fit.movedByOctaves);
      expect(notes.unplayableNotes).toHaveLength(fit.unplayable);
    });

    it.each([-7, -1, 0, 1, 5, 12])(
      'leaves off exactly the Notes createTape leaves off at Transposition %i',
      (value) => {
        const shift = defined(transposition(value), 'transposition');
        const {importSummary} = tapeFor(song, shift, 3);
        const notes = fitNotesOf(song, parts(0, 1), organ, shift);
        expect(notes.unplayableNotes).toEqual(importSummary.unplayableNotes);
        expect(notes.movedByOctaves).toEqual(importSummary.movedByOctaves);
      },
    );
  });
});
