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
  type Fifths,
  type Key,
  type Note,
  type Part,
  type Tick,
  type TimeSignature,
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

function timeSignatureAt(start: number, beats: number, beatType: TimeSignature['beatType'] = 4): TimeSignature {
  return {start: defined(tick(start), 'start'), beats, beatType};
}

/** The rejection cases pass fifths outside −7…7 on purpose; the runtime rule must reject them too. */
function keyAt(start: number, fifths: number, mode: Key['mode'] = 'major'): Key {
  return {start: defined(tick(start), 'start'), fifths: fifths as Fifths, mode};
}

const QUARTER_TICKS = 480;
/** The Bar of 3/4 at 480 Ticks per quarter: 3 × 480 × 4 / 4. */
const BAR_3_4 = 1440;
const BEAT_TYPES: readonly TimeSignature['beatType'][] = [1, 2, 4, 8, 16, 32, 64];

function aSongWith(fields: {
  readonly timeSignatures?: readonly TimeSignature[];
  readonly upbeat?: Tick;
  readonly keys?: readonly Key[];
}) {
  return song({
    id: defined(songId(UUID), 'id'),
    name: 'Fugue',
    ticksPerQuarter: defined(ticksPerQuarter(QUARTER_TICKS), 'tpq'),
    parts: [aPart(false)],
    ...fields,
  });
}

describe('song, Time signatures, upbeat and Keys', () => {
  it('keeps the Time signatures, upbeat and Keys it is given', () => {
    const result = aSongWith({
      timeSignatures: [timeSignatureAt(0, 3), timeSignatureAt(11520, 2)],
      upbeat: defined(tick(QUARTER_TICKS), 'upbeat'),
      keys: [keyAt(0, 1)],
    });

    expect(result?.timeSignatures).toEqual([timeSignatureAt(0, 3), timeSignatureAt(11520, 2)]);
    expect(result?.upbeat).toBe(QUARTER_TICKS);
    expect(result?.keys).toEqual([keyAt(0, 1)]);
  });

  it('gives a Song without them no Time signatures, no upbeat and no Keys', () => {
    const result = song({
      id: defined(songId(UUID), 'id'),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER_TICKS), 'tpq'),
      parts: [aPart(false)],
    });

    expect(result?.timeSignatures).toEqual([]);
    expect(result?.upbeat).toBeUndefined();
    expect(result?.keys).toEqual([]);
  });

  it('rejects Time signatures not sorted by start', () => {
    expect(aSongWith({timeSignatures: [timeSignatureAt(BAR_3_4, 2), timeSignatureAt(0, 3)]})).toBeUndefined();
  });

  it('rejects two Time signatures with the same start', () => {
    expect(aSongWith({timeSignatures: [timeSignatureAt(0, 3), timeSignatureAt(0, 2)]})).toBeUndefined();
  });

  it.each([0, 100, 1.5])('rejects a Time signature of %d beats', (beats) => {
    expect(aSongWith({timeSignatures: [timeSignatureAt(0, beats)]})).toBeUndefined();
  });

  it.each([1, 99])('accepts a Time signature of %d beats', (beats) => {
    expect(aSongWith({timeSignatures: [timeSignatureAt(0, beats)]})).toBeDefined();
  });

  it.each(BEAT_TYPES)('accepts a beat type of %d', (beatType) => {
    expect(aSongWith({timeSignatures: [timeSignatureAt(0, 3, beatType)]})).toBeDefined();
  });

  it('rejects a beat type that is no power of two from 1 to 64', () => {
    // @ts-expect-error a beat type of 3 is outside the type, the rule must reject it at runtime too
    expect(aSongWith({timeSignatures: [timeSignatureAt(0, 3, 3)]})).toBeUndefined();
  });

  it('rejects Keys not sorted by start', () => {
    expect(aSongWith({keys: [keyAt(BAR_3_4, 1), keyAt(0, 0)]})).toBeUndefined();
  });

  it('rejects two Keys with the same start', () => {
    expect(aSongWith({keys: [keyAt(0, 1), keyAt(0, 2)]})).toBeUndefined();
  });

  it.each([-8, 8, 1.5])('rejects a Key with %d fifths', (fifths) => {
    expect(aSongWith({keys: [keyAt(0, fifths)]})).toBeUndefined();
  });

  it.each([-7, 0, 7])('accepts a Key with %d fifths', (fifths) => {
    expect(aSongWith({keys: [keyAt(0, fifths)]})).toBeDefined();
  });

  it('types a Key with 8 fifths as an error, since no key has that many', () => {
    // @ts-expect-error: a Key has −7…7 fifths, so 8 does not type
    const eightSharps: Key = {start: defined(tick(0), 'start'), fifths: 8, mode: 'major'};
    expect(eightSharps.fifths).toBe(8);
  });

  it('rejects a mode that is neither major nor minor', () => {
    // @ts-expect-error a mode of 'dorian' is outside the type, the rule must reject it at runtime too
    expect(aSongWith({keys: [keyAt(0, 0, 'dorian')]})).toBeUndefined();
  });

  it('rejects an upbeat of 0 Ticks', () => {
    expect(
      aSongWith({timeSignatures: [timeSignatureAt(0, 3)], upbeat: defined(tick(0), 'upbeat')}),
    ).toBeUndefined();
  });

  it.each([
    [3, 4],
    [6, 8],
  ] as const)('rejects an upbeat as long as the first Bar of %d/%d', (beats, beatType) => {
    // Bar = beats × ticksPerQuarter × 4 / beatType: 1440 Ticks for both 3/4 and 6/8 at 480.
    expect(
      aSongWith({
        timeSignatures: [timeSignatureAt(0, beats, beatType)],
        upbeat: defined(tick(BAR_3_4), 'upbeat'),
      }),
    ).toBeUndefined();
  });

  it('keeps an upbeat shorter than the first Bar', () => {
    const result = aSongWith({
      timeSignatures: [timeSignatureAt(0, 3)],
      upbeat: defined(tick(QUARTER_TICKS), 'upbeat'),
    });
    expect(result?.upbeat).toBe(QUARTER_TICKS);
  });

  it('rejects an upbeat without a Time signature at Tick 0', () => {
    const upbeat = defined(tick(QUARTER_TICKS), 'upbeat');
    expect(aSongWith({timeSignatures: [timeSignatureAt(BAR_3_4, 3)], upbeat})).toBeUndefined();
    expect(aSongWith({timeSignatures: [], upbeat})).toBeUndefined();
  });
});
