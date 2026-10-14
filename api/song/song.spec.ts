import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {
  defaultSelectedParts,
  note,
  part,
  partIndex,
  song,
  songId,
  tick,
  ticksPerQuarter,
  type Note,
  type Part,
} from './song';

const MAX_TICK = 2 ** 31 - 1;
const UUID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function aNote(noteNumber: number, start: number, duration = 10): Note {
  return defined(
    note({
      noteNumber: defined(midiNoteNumber(noteNumber), 'note number'),
      start: defined(tick(start), 'start'),
      duration: defined(tick(duration), 'duration'),
    }),
    'note',
  );
}

function aPart(percussion: boolean, name?: string): Part {
  return defined(part({name, percussion, notes: [aNote(60, 0)]}), 'part');
}

function aSong(parts: readonly Part[]) {
  return defined(
    song({id: defined(songId(UUID), 'id'), name: 'Fugue', ticksPerQuarter: defined(ticksPerQuarter(480), 'tpq'), parts}),
    'song',
  );
}

describe('songId', () => {
  it('accepts a UUID', () => {
    expect(songId(UUID)).toBe(UUID);
  });

  it.each(['', 'song-1'])('rejects "%s"', (value) => {
    expect(songId(value)).toBeUndefined();
  });
});

describe('tick', () => {
  it.each([0, 1, MAX_TICK])('accepts %d', (value) => {
    expect(tick(value)).toBe(value);
  });

  it.each([-1, 0.5, MAX_TICK + 1, Number.NaN])('rejects %d', (value) => {
    expect(tick(value)).toBeUndefined();
  });
});

describe('ticksPerQuarter', () => {
  it.each([1, 480, 32767])('accepts %d', (value) => {
    expect(ticksPerQuarter(value)).toBe(value);
  });

  it.each([0, 32768, 1.5, -1, Number.NaN])('rejects %d', (value) => {
    expect(ticksPerQuarter(value)).toBeUndefined();
  });
});

describe('partIndex', () => {
  it.each([0, 2])('accepts %d for a Song with 3 Parts', (value) => {
    expect(partIndex(value, 3)).toBe(value);
  });

  it.each([-1, 3, 0.5, Number.NaN])('rejects %d for a Song with 3 Parts', (value) => {
    expect(partIndex(value, 3)).toBeUndefined();
  });
});

describe('note', () => {
  const noteNumber = defined(midiNoteNumber(60), 'note number');

  it('allows a duration of 0', () => {
    expect(note({noteNumber, start: defined(tick(5), 'start'), duration: defined(tick(0), 'duration')})).toBeDefined();
  });

  it('rejects a Note whose start + duration reaches 2^31', () => {
    const start = defined(tick(MAX_TICK), 'start');
    expect(note({noteNumber, start, duration: defined(tick(1), 'duration')})).toBeUndefined();
  });

  it('accepts a Note whose start + duration is 2^31 - 1', () => {
    const start = defined(tick(MAX_TICK - 1), 'start');
    expect(note({noteNumber, start, duration: defined(tick(1), 'duration')})).toBeDefined();
  });
});

describe('part', () => {
  it('accepts a Part without a name', () => {
    expect(part({name: undefined, percussion: false, notes: [aNote(60, 0)]})).toBeDefined();
  });

  it.each(['', '   '])('rejects the name "%s"', (name) => {
    expect(part({name, percussion: false, notes: [aNote(60, 0)]})).toBeUndefined();
  });

  it('trims the name', () => {
    expect(part({name: '  Flute ', percussion: false, notes: [aNote(60, 0)]})?.name).toBe('Flute');
  });

  it('rejects a Part without Notes', () => {
    expect(part({name: undefined, percussion: false, notes: []})).toBeUndefined();
  });

  it('accepts Notes sorted by start, then note number', () => {
    expect(
      part({name: undefined, percussion: false, notes: [aNote(60, 0), aNote(64, 0), aNote(50, 10)]}),
    ).toBeDefined();
  });

  it('rejects Notes not sorted by start', () => {
    expect(part({name: undefined, percussion: false, notes: [aNote(60, 10), aNote(60, 0)]})).toBeUndefined();
  });

  it('rejects Notes at the same start not sorted by note number', () => {
    expect(part({name: undefined, percussion: false, notes: [aNote(64, 0), aNote(60, 0)]})).toBeUndefined();
  });
});

describe('song', () => {
  const id = defined(songId(UUID), 'id');
  const quarter = defined(ticksPerQuarter(480), 'tpq');

  it('trims the name', () => {
    expect(song({id, name: '  Fugue ', ticksPerQuarter: quarter, parts: [aPart(false)]})?.name).toBe('Fugue');
  });

  it.each(['', '  '])('rejects the name "%s"', (name) => {
    expect(song({id, name, ticksPerQuarter: quarter, parts: [aPart(false)]})).toBeUndefined();
  });

  it('rejects a Song without Parts', () => {
    expect(song({id, name: 'Fugue', ticksPerQuarter: quarter, parts: []})).toBeUndefined();
  });
});

describe('defaultSelectedParts', () => {
  it('selects every non-percussion Part and no percussion Part', () => {
    const selected = defaultSelectedParts(aSong([aPart(false), aPart(true), aPart(false)]));
    expect([...selected]).toEqual([0, 2]);
  });

  it('is empty for a Song with only percussion Parts', () => {
    expect(defaultSelectedParts(aSong([aPart(true), aPart(true)])).size).toBe(0);
  });
});
