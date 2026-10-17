import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, type Millimetres, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {encodeSmf} from '../song/midi/smf-test-helper';
import {readMidiSong} from '../song/midi/read-midi-song';
import {defaultSelectedParts} from '../song/song';
import {createTape} from './create-tape';
import {proposeTransposition} from './transposition';
import {exportProblems} from './export-problems';
import {asValidTape, column, columnCount, type Hole, type Tape, type TapeId} from './tape';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function mm(value: number): Millimetres {
  return defined(millimetres(value), 'millimetres');
}

/** An Organ with the Pipes 60 and 62 (in this row order). */
function organWith(holeDiameter: number, minimumGap: number): Organ {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter, rowSpacing: holeDiameter + 1},
    minimumGap,
    leadIn: 20,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

const first: MidiNoteNumber = defined(midiNoteNumber(60), 'first Pipe');
const second: MidiNoteNumber = defined(midiNoteNumber(62), 'second Pipe');
const unknown: MidiNoteNumber = defined(midiNoteNumber(70), 'note without a Pipe');

/** A Hole as [start, end) in Columns. */
function hole(pipe: MidiNoteNumber, start: number, end: number): Hole {
  return {pipe, start: defined(column(start), 'start'), length: defined(columnCount(end - start), 'length')};
}

function tapeOf(organ: Organ, columnLength: number, holes: readonly Hole[]): Tape {
  return asValidTape({
    id: '00000000-0000-4000-8000-000000000001' as TapeId,
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: mm(columnLength),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

describe('exportProblems', () => {
  it('is empty for a Tape without Holes', () => {
    const organ = organWith(2.5, 1.5);

    expect(exportProblems(tapeOf(organ, 2.5, []), organ)).toEqual([]);
  });

  it('is empty for a Tape just made by createTape', () => {
    const organ = organWith(2.5, 1.5);
    const ticks = 480;
    const bytes = encodeSmf({
      format: 1,
      division: {ticksPerQuarterNote: ticks},
      tracks: [
        {
          events: [
            {delta: 0, event: {type: 'trackName' as const, text: 'Lead'}},
            ...[60, 62, 60].flatMap((note) => [
              {delta: 0, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
              {delta: ticks, event: {type: 'noteOff' as const, channel: 0, note, velocity: 0}},
            ]),
          ],
        },
      ],
    });
    const read = readMidiSong(bytes, 'melody.mid');
    if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
    const selectedParts = defaultSelectedParts(read.value);
    const created = createTape({
      song: read.value,
      selectedParts,
      organ,
      transposition: proposeTransposition(read.value, selectedParts, organ),
      name: 'Melody',
      columnLength: 2.5,
    });
    if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
    expect(created.value.tape.holes.length).toBeGreaterThan(0);

    expect(exportProblems(created.value.tape, organ)).toEqual([]);
  });

  it('reports a Hole whose Pipe the Organ does not have as no-pipe, and nothing else for it', () => {
    const organ = organWith(2.5, 1.5);
    const tape = tapeOf(organ, 2.5, [hole(unknown, 4, 5)]); // 1 Column is also too short for nothing: it has no row

    expect(exportProblems(tape, organ)).toEqual([{code: 'no-pipe', pipe: unknown, start: 4}]);
  });

  it('reports a Hole below the Minimum Hole Length as too-short with both lengths in mm', () => {
    const organ = organWith(5, 1.5); // 5 mm = 2 Columns of 2.5 mm
    const tape = tapeOf(organ, 2.5, [hole(first, 10, 11)]);

    expect(exportProblems(tape, organ)).toEqual([
      {code: 'too-short', pipe: first, start: 10, lengthMm: 2.5, minimumHoleLengthMm: 5},
    ]);
  });

  it('does not refuse a Hole of 3 Columns of 1.1 mm against a Minimum Hole Length of 3.3 mm', () => {
    const organ = organWith(3.3, 1.1);
    const tape = tapeOf(organ, 1.1, [hole(first, 10, 13)]);

    expect(exportProblems(tape, organ)).toEqual([]);
  });

  it('does not refuse a Hole of exactly the Minimum Hole Length in Columns', () => {
    const organ = organWith(5, 1.5);
    const tape = tapeOf(organ, 2.5, [hole(first, 10, 12)]);

    expect(exportProblems(tape, organ)).toEqual([]);
  });

  it('reports a gap below the Minimum Gap once, on the earlier Hole, naming the next start', () => {
    const organ = organWith(2.5, 5); // 5 mm = 2 Columns of 2.5 mm
    const tape = tapeOf(organ, 2.5, [hole(first, 0, 3), hole(first, 4, 7)]); // 1 Column apart

    expect(exportProblems(tape, organ)).toEqual([
      {code: 'too-close', pipe: first, start: 0, nextStart: 4, gapMm: 2.5, minimumGapMm: 5},
    ]);
  });

  it('gives a negative gap when the two Holes of a Pipe overlap', () => {
    const organ = organWith(2.5, 5);
    const tape = tapeOf(organ, 2.5, [hole(first, 0, 3), hole(first, 2, 6)]);

    expect(exportProblems(tape, organ)).toEqual([
      {code: 'too-close', pipe: first, start: 0, nextStart: 2, gapMm: -2.5, minimumGapMm: 5},
    ]);
  });

  it('does not refuse a gap of exactly the Minimum Gap in Columns, nor Holes of different Pipes side by side', () => {
    const organ = organWith(2.5, 5);
    const tape = tapeOf(organ, 2.5, [hole(first, 0, 3), hole(first, 5, 8), hole(second, 3, 5)]);

    expect(exportProblems(tape, organ)).toEqual([]);
  });

  it('lists every problem of every Hole: a Hole can be too-short and too-close', () => {
    const organ = organWith(5, 5);
    const tape = tapeOf(organ, 2.5, [hole(first, 0, 1), hole(first, 2, 6), hole(second, 20, 21)]);

    expect(exportProblems(tape, organ)).toEqual([
      {code: 'too-short', pipe: first, start: 0, lengthMm: 2.5, minimumHoleLengthMm: 5},
      {code: 'too-close', pipe: first, start: 0, nextStart: 2, gapMm: 2.5, minimumGapMm: 5},
      {code: 'too-short', pipe: second, start: 20, lengthMm: 2.5, minimumHoleLengthMm: 5},
    ]);
  });

  it('orders by start, then by row with Holes without a Pipe last, then by code', () => {
    const organ = organWith(5, 5);
    const tape = tapeOf(organ, 2.5, [
      hole(unknown, 0, 1),
      hole(second, 0, 1),
      hole(first, 8, 9),
      hole(first, 0, 1),
      hole(first, 2, 6),
    ]);

    expect(exportProblems(tape, organ).map(({code, pipe, start}) => [code, pipe, start])).toEqual([
      ['too-short', first, 0],
      ['too-close', first, 0],
      ['too-short', second, 0],
      ['no-pipe', unknown, 0],
      ['too-short', first, 8],
    ]);
  });
});
