import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, minimumHoleLength, organId, type Organ} from '../organ/organ';
import {encodeSmf, type SmfTimedEvent, type SmfTrack} from '../song/midi/smf-test-helper';
import {readMidiSong} from '../song/midi/read-midi-song';
import {partIndex, type PartIndex, type Song} from '../song/song';
import {createTape, prefilledColumnLength, type CreateTapeInput} from './create-tape';
import {asValidTape, columnCount, tapeId, transposition, type Tape} from './tape';

const ORGAN_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const OTHER_ORGAN_ID = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const TICKS_PER_QUARTER = 96;
const TICKS_PER_COLUMN = TICKS_PER_QUARTER / 8;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function range(from: number, to: number): number[] {
  return Array.from({length: to - from + 1}, (_, index) => from + index);
}

/** Pipes C4 to C6 without F#. */
const PIPES_WITHOUT_F_SHARP = range(60, 84).filter((pipe) => pipe % 12 !== 6);

function anOrgan(
  options: {pipes?: readonly number[]; holeDiameter?: number; minimumGap?: number; id?: string} = {},
): Organ {
  const mm = (value: number) => defined(millimetres(value), 'millimetres');
  return asValidOrgan({
    id: defined(organId(options.id ?? ORGAN_ID), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: mm(100), border: mm(1), holeDiameter: mm(options.holeDiameter ?? 1), rowSpacing: mm(2)},
    minimumGap: mm(options.minimumGap ?? 1),
    pipes: (options.pipes ?? PIPES_WITHOUT_F_SHARP).map((each) => ({note: defined(midiNoteNumber(each), 'pipe')})),
  });
}

interface NoteSpec {
  readonly note: number;
  readonly startTick: number;
  readonly ticks: number;
}

/** One track per list of Notes; Notes of a track must be sorted and must not overlap. */
function songOf(...tracks: readonly (readonly NoteSpec[])[]): Song {
  const smfTracks: SmfTrack[] = tracks.map((notes) => {
    const events: SmfTimedEvent[] = [];
    let clock = 0;
    for (const {note, startTick, ticks} of notes) {
      events.push({delta: startTick - clock, event: {type: 'noteOn', channel: 0, note, velocity: 64}});
      events.push({delta: ticks, event: {type: 'noteOff', channel: 0, note, velocity: 0}});
      clock = startTick + ticks;
    }
    return {events};
  });
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: smfTracks});
  const result = readMidiSong(bytes, 'tune.mid');
  if (!result.ok) throw new Error(`test Song rejected: ${result.error}`);
  return result.value;
}

function quarters(...notes: readonly number[]): NoteSpec[] {
  return notes.map((note, index) => ({note, startTick: index * TICKS_PER_QUARTER, ticks: TICKS_PER_QUARTER}));
}

function parts(...indexes: readonly number[]): ReadonlySet<PartIndex> {
  return new Set(indexes.map((index) => defined(partIndex(index, 100), 'part index')));
}

function inputOf(song: Song, overrides: Partial<CreateTapeInput> = {}): CreateTapeInput {
  return {
    song,
    selectedParts: parts(0),
    organ: anOrgan(),
    transposition: defined(transposition(0), 'transposition'),
    name: 'Fugue',
    columnLength: 1,
    ...overrides,
  };
}

function created(input: CreateTapeInput) {
  const result = createTape(input);
  if (!result.ok) throw new Error(`createTape failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

function violationCodes(input: CreateTapeInput): string[] {
  const result = createTape(input);
  if (result.ok) throw new Error('createTape succeeded');
  return result.error.map((violation) => violation.code);
}

function holesOf(input: CreateTapeInput) {
  return created(input).tape.holes.map(({pipe, start, length}) => ({pipe, start, length}));
}

describe('createTape violations', () => {
  const song = songOf(quarters(60));

  it('reports every violation at once', () => {
    const codes = violationCodes(inputOf(song, {name: '  ', columnLength: 0, selectedParts: parts()}));
    expect([...codes].sort()).toEqual(['column-length-must-be-positive', 'name-required', 'no-part-selected']);
  });

  it('rejects a Transposition that moves a Note out of the MIDI range', () => {
    const highSong = songOf(quarters(120));
    const codes = violationCodes(inputOf(highSong, {transposition: defined(transposition(20), 'transposition')}));
    expect(codes).toEqual(['transposition-out-of-range']);
  });

  it('rejects a Song whose selected Notes are all Unplayable Notes', () => {
    expect(violationCodes(inputOf(songOf(quarters(66))))).toEqual(['no-note-on-a-pipe']);
  });

  it('rejects a negative Column length', () => {
    expect(violationCodes(inputOf(song, {columnLength: -1}))).toEqual(['column-length-must-be-positive']);
  });
});

describe('createTape, bringing a Song onto a Tape', () => {
  it('puts every Note on the Pipe of its transposed Note with Transposition +12', () => {
    const input = inputOf(songOf(quarters(48, 62)), {transposition: defined(transposition(12), 'transposition')});
    const {tape, importSummary} = created(input);
    expect(tape.holes.map((hole) => hole.pipe)).toEqual([60, 74]);
    expect(tape.transposition).toBe(12);
    expect(importSummary.transposition).toBe(12);
  });

  it('puts Notes that match a Pipe in their own row with Transposition 0', () => {
    expect(holesOf(inputOf(songOf(quarters(60)))).map((hole) => hole.pipe)).toEqual([60]);
  });

  it('starts the second quarter Note at Column 8, 8 Columns long', () => {
    const holes = holesOf(inputOf(songOf(quarters(60, 62))));
    expect(holes).toEqual([
      {pipe: 60, start: 0, length: 8},
      {pipe: 62, start: 8, length: 8},
    ]);
  });

  it('moves start and end to the nearest Column boundary', () => {
    // the end at 31 ticks is 2.58 Columns (rounds to 3); the second Note starts at 55 ticks, 4.58 (rounds to 5)
    const song = songOf([
      {note: 60, startTick: 0, ticks: 31},
      {note: 62, startTick: 55, ticks: 24},
    ]);
    expect(holesOf(inputOf(song))).toEqual([
      {pipe: 60, start: 0, length: 3},
      {pipe: 62, start: 5, length: 2},
    ]);
  });

  it('lists a Note moved down by an octave with its octaves, Part and Column', () => {
    const {tape, importSummary} = created(inputOf(songOf(quarters(60, 95))));
    expect(tape.holes.map((hole) => hole.pipe)).toEqual([60, 83]);
    expect(importSummary.movedByOctaves).toEqual([{part: 0, noteNumber: 95, pipe: 83, octaves: -1, column: 8}]);
  });

  it('lists an Unplayable Note with its Part and Column and keeps it off the Tape', () => {
    const {tape, importSummary} = created(inputOf(songOf(quarters(60, 66))));
    expect(importSummary.unplayableNotes).toEqual([{part: 0, noteNumber: 66, column: 8}]);
    expect(tape.holes.map((hole) => hole.pipe)).toEqual([60]);
  });

  it('lengthens a Hole shorter than the Minimum Hole Length and lists the change', () => {
    const organ = anOrgan({holeDiameter: 4});
    const input = inputOf(songOf([{note: 60, startTick: 0, ticks: TICKS_PER_COLUMN}]), {organ});
    const {tape, importSummary} = created(input);
    expect(tape.holes.map((hole) => hole.length)).toEqual([4]);
    expect(importSummary.holeChanges).toEqual([{kind: 'lengthened', pipe: 60, column: 0, from: 1, to: 4}]);
  });

  it('shortens the first of two repeated Notes to keep the Minimum Gap and lists the change', () => {
    const {tape, importSummary} = created(inputOf(songOf(quarters(60, 60))));
    expect(tape.holes.map(({start, length}) => ({start, length}))).toEqual([
      {start: 0, length: 7},
      {start: 8, length: 8},
    ]);
    expect(importSummary.holeChanges).toEqual([{kind: 'shortened', pipe: 60, column: 0, from: 8, to: 7}]);
  });
});

describe('createTape, Parts sharing a Pipe row', () => {
  it('merges overlapping Holes of two selected Parts into one Hole and lists the merge', () => {
    // Part 0: Columns 0-8, Part 1: Columns 4-12 on the same Pipe
    const song = songOf([{note: 60, startTick: 0, ticks: 96}], [{note: 60, startTick: 48, ticks: 96}]);
    const {tape, importSummary} = created(inputOf(song, {selectedParts: parts(0, 1)}));
    expect(tape.holes.map(({pipe, start, length}) => ({pipe, start, length}))).toEqual([
      {pipe: 60, start: 0, length: 12},
    ]);
    expect(importSummary.holeChanges).toEqual([expect.objectContaining({kind: 'overlap-merged', pipe: 60})]);
  });
});

describe('createTape, the start of the Tape', () => {
  it('cuts the silence before the first Note', () => {
    const song = songOf([{note: 60, startTick: 4 * TICKS_PER_QUARTER, ticks: TICKS_PER_QUARTER}]);
    expect(holesOf(inputOf(song))).toEqual([{pipe: 60, start: 0, length: 8}]);
  });

  it('keeps the silence between Notes', () => {
    const song = songOf([
      {note: 60, startTick: 96, ticks: 96},
      {note: 62, startTick: 4 * 96, ticks: 96},
    ]);
    expect(holesOf(inputOf(song)).map((hole) => hole.start)).toEqual([0, 24]);
  });

  it('puts an Unplayable first Note at Column 0 and starts the first Hole after it', () => {
    const song = songOf([
      {note: 66, startTick: 96, ticks: 96},
      {note: 60, startTick: 192, ticks: 96},
    ]);
    const {tape, importSummary} = created(inputOf(song));
    expect(importSummary.unplayableNotes.map((each) => each.column)).toEqual([0]);
    expect(tape.holes.map((hole) => hole.start)).toEqual([8]);
  });

  it('takes the first Note from the selected Parts only', () => {
    const song = songOf([{note: 62, startTick: 0, ticks: 96}], [{note: 60, startTick: 96, ticks: 96}]);
    expect(holesOf(inputOf(song, {selectedParts: parts(1)}))).toEqual([{pipe: 60, start: 0, length: 8}]);
  });
});

describe('createTape, the created Tape', () => {
  const song = songOf(
    [
      {note: 64, startTick: 0, ticks: 96},
      {note: 60, startTick: 192, ticks: 96},
      {note: 64, startTick: 384, ticks: 96},
    ],
    [{note: 60, startTick: 96, ticks: 96}],
    [{note: 72, startTick: 0, ticks: 48}],
  );
  const input = inputOf(song, {selectedParts: parts(2, 0, 1), name: '  Fugue  ', columnLength: 1.5});
  const {tape} = created(input);

  it('trims the name', () => {
    expect(tape.name).toBe('Fugue');
  });

  it('refers to the Organ and the Song with the selected Parts sorted ascending', () => {
    expect(tape.organId).toBe(input.organ.id);
    expect(tape.songId).toBe(song.id);
    expect(tape.selectedParts).toEqual([0, 1, 2]);
  });

  it('keeps the Column length', () => {
    expect(tape.columnLength).toBe(1.5);
  });

  it('has a new Tape id', () => {
    expect(tapeId(tape.id)).toBe(tape.id);
    expect(created(input).tape.id).not.toBe(tape.id);
  });

  it('sorts the Holes by Pipe, then start', () => {
    const keys = tape.holes.map((hole) => [hole.pipe, hole.start]);
    expect(keys).toEqual([...keys].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0)));
  });

  it('keeps the Holes of a row apart', () => {
    const row = tape.holes.filter((hole) => hole.pipe === 60);
    expect(row.length).toBe(2);
    for (let index = 1; index < row.length; index++) {
      const previous = defined(row[index - 1], 'previous hole');
      const next = defined(row[index], 'next hole');
      expect(next.start).toBeGreaterThan(previous.start + previous.length);
    }
  });

  it('puts the Holes on Pipes of the Organ only', () => {
    const pipes = new Set<MidiNoteNumber>(input.organ.pipes.map((pipe) => pipe.note));
    expect(tape.holes.every((hole) => pipes.has(hole.pipe))).toBe(true);
  });

  it('is as long as the end of its last Hole, and has at least one Hole', () => {
    expect(tape.holes.length).toBeGreaterThan(0);
    expect(tape.length).toBe(Math.max(...tape.holes.map((hole) => hole.start + hole.length)));
  });
});

describe('createTape, the Import Summary', () => {
  it('counts the Notes on the Tape and accounts for every selected Note', () => {
    // C4 matches, B6 moves an octave, F#4 is unplayable
    const {importSummary} = created(inputOf(songOf(quarters(60, 95, 66))));
    expect(importSummary.notesOnTape).toBe(2);
    expect(importSummary.notesOnTape + importSummary.unplayableNotes.length).toBe(3);
    expect(importSummary.movedByOctaves.length).toBe(1);
  });
});

describe('prefilledColumnLength', () => {
  function aTape(organ: string, columnLength: number): Tape {
    return asValidTape({
      id: defined(tapeId(crypto.randomUUID()), 'tape id'),
      name: 'Tape',
      organId: defined(organId(organ), 'organ id'),
      songId: undefined,
      selectedParts: undefined,
      transposition: defined(transposition(0), 'transposition'),
      columnLength: defined(millimetres(columnLength), 'column length'),
      length: defined(columnCount(1), 'length'),
      holes: [],
    });
  }

  const organ = anOrgan({holeDiameter: 3});

  it('is the Minimum Hole Length of the Organ when it has no Tape yet', () => {
    expect(prefilledColumnLength(organ, [aTape(OTHER_ORGAN_ID, 7)])).toBe(minimumHoleLength(organ.tapeBed));
  });

  it('is the Column length of the last Tape created for the same Organ', () => {
    const tapes = [aTape(ORGAN_ID, 2), aTape(ORGAN_ID, 5), aTape(OTHER_ORGAN_ID, 7)];
    expect(prefilledColumnLength(organ, tapes)).toBe(5);
  });
});

describe('createTape performance (SC-006)', () => {
  it('reads and brings a 5-minute Song with 16 Parts onto a Tape well under 5 s', () => {
    const eighth = 240;
    const tracks: SmfTrack[] = Array.from({length: 16}, (_, trackIndex) => {
      const events = Array.from({length: 1200}, (_, index): SmfTimedEvent[] => {
        const note = 48 + ((index * 7 + trackIndex) % 37);
        return [
          {delta: 0, event: {type: 'noteOn', channel: 0, note, velocity: 64}},
          {delta: eighth, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
        ];
      }).flat();
      return {events};
    });
    const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: 480}, tracks});
    const started = performance.now();
    const read = readMidiSong(bytes, 'long.mid');
    if (!read.ok) throw new Error(`rejected: ${read.error}`);
    const result = createTape(
      inputOf(read.value, {selectedParts: parts(...range(0, 15)), organ: anOrgan({pipes: range(48, 84)})}),
    );
    expect(result.ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
