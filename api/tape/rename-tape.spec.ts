import {describe, expect, it} from 'vitest';
import {parseTapeLibrarySnapshot} from './tape-library-snapshot';
import type {Tape} from './tape';
import {renameTape} from './rename-tape';

function aTape(name: string): Tape {
  const parsed = parseTapeLibrarySnapshot({
    version: 1,
    songs: [
      {
        id: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e01',
        name: 'Fur Elise',
        ticksPerQuarter: 480,
        parts: [{percussion: false, notes: [[60, 0, 240], [62, 240, 240]]}],
      },
    ],
    tapes: [
      {
        id: '11111111-2222-4333-8444-555555555551',
        name,
        organId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
        songId: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e01',
        selectedParts: [0],
        transposition: 0,
        columnLength: 2.5,
        length: 10,
        holes: [[60, 0, 2], [62, 4, 3]],
      },
    ],
  });
  const tape = parsed.ok ? parsed.value.tapes[0] : undefined;
  if (tape === undefined) throw new Error('invalid test Tape');
  return tape;
}

describe('renameTape', () => {
  it('gives the Tape the new name and leaves everything else unchanged', () => {
    const tape = aTape('Old name');

    const result = renameTape(tape, 'Kirmes-Walzer');

    expect(result).toEqual({ok: true, value: {...tape, name: 'Kirmes-Walzer'}});
  });

  it('trims the name', () => {
    const result = renameTape(aTape('Old name'), '  Kirmes-Walzer \t');

    expect(result.ok && result.value.name).toBe('Kirmes-Walzer');
  });

  it.each(['', '   ', '\t\n'])('refuses the blank name %j with name-required', (name) => {
    expect(renameTape(aTape('Old name'), name)).toEqual({ok: false, error: 'name-required'});
  });
});
