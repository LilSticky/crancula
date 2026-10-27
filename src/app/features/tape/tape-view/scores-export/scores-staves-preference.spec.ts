import {TestBed} from '@angular/core/testing';
import {midiNoteNumber, organId, type MidiNoteNumber, type OrganId} from '@api/index';
import {vi} from 'vitest';
import {ScoresStavesPreference} from './scores-staves-preference';

const KEY = 'crancula.scoresSplitNotes';
const FIRST_ORGAN = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';
const SECOND_ORGAN = '1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function midi(values: readonly number[]): MidiNoteNumber[] {
  return values.map((value) => defined(midiNoteNumber(value), `note ${value}`));
}

function organOf(id: string): OrganId {
  return defined(organId(id), `organ id ${id}`);
}

/** The stored JSON `{[organ]: value}` under the split notes key, as the preference keeps it (research R12). */
function storedFor(organ: string, value: unknown): string {
  return JSON.stringify({[organ]: value});
}

// jsdom's localStorage is unavailable here, so the preference reads and writes an in-memory stand-in.
function stubLocalStorage(initial?: string): void {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(KEY, initial);
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
}

/** Storage that refuses every access, as blocked storage does. */
function stubBlockedLocalStorage(): void {
  const blocked = (): never => {
    throw new Error('storage is blocked');
  };
  vi.stubGlobal('localStorage', {getItem: blocked, setItem: blocked, removeItem: blocked});
}

function preference(): ScoresStavesPreference {
  TestBed.resetTestingModule();
  return TestBed.inject(ScoresStavesPreference);
}

describe('ScoresStavesPreference remembers the split notes per Organ (FR-005, research R12)', () => {
  beforeEach(() => stubLocalStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('has no split notes for an Organ when nothing is stored', () => {
    expect(preference().splitNotesFor(organOf(FIRST_ORGAN))).toBeUndefined();
  });

  it('gives the split notes stored for the Organ', () => {
    stubLocalStorage(storedFor(FIRST_ORGAN, [48, 60]));

    expect(preference().splitNotesFor(organOf(FIRST_ORGAN))).toEqual(midi([48, 60]));
  });

  it('gives no split notes for another Organ than the one stored', () => {
    stubLocalStorage(storedFor(FIRST_ORGAN, [48, 60]));

    expect(preference().splitNotesFor(organOf(SECOND_ORGAN))).toBeUndefined();
  });

  it.each([
    ['is not JSON', '{not json'],
    ['is not sorted', storedFor(FIRST_ORGAN, [72, 60])],
    ['repeats a split note', storedFor(FIRST_ORGAN, [60, 60])],
    ['has a split note above 127', storedFor(FIRST_ORGAN, [128])],
    ['has a split note below 0', storedFor(FIRST_ORGAN, [-1])],
    ['has a split note that is not a whole number', storedFor(FIRST_ORGAN, [60.5])],
    ['is not a list', storedFor(FIRST_ORGAN, '60')],
  ])('gives no split notes when the stored value %s', (_, stored) => {
    stubLocalStorage(stored);

    expect(preference().splitNotesFor(organOf(FIRST_ORGAN))).toBeUndefined();
  });

  it('gives no split notes, rather than an error, when storage is blocked', () => {
    stubBlockedLocalStorage();

    expect(preference().splitNotesFor(organOf(FIRST_ORGAN))).toBeUndefined();
  });

  it('does not throw when storage is blocked while the split notes are remembered', () => {
    stubBlockedLocalStorage();

    expect(() => preference().remember(organOf(FIRST_ORGAN), midi([60]))).not.toThrow();
  });

  it('remembers the split notes under the key crancula.scoresSplitNotes, and keeps the notes of other Organs', () => {
    stubLocalStorage(storedFor(FIRST_ORGAN, [60]));
    const stavesPreference = preference();

    stavesPreference.remember(organOf(SECOND_ORGAN), midi([48, 72]));

    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(stavesPreference.splitNotesFor(organOf(FIRST_ORGAN))).toEqual(midi([60]));
    expect(stavesPreference.splitNotesFor(organOf(SECOND_ORGAN))).toEqual(midi([48, 72]));
  });
});
