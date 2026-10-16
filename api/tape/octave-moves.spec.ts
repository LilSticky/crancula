import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, organId, type Organ} from '../organ/organ';
import {octaveMoveTable} from './octave-moves';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function anOrgan(pipeNotes: readonly number[]): Organ {
  const one = defined(millimetres(1), 'millimetres');
  return asValidOrgan({
    id: defined(organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: one, holeDiameter: one, rowSpacing: one},
    minimumGap: one,
    leadIn: one,
    pipes: pipeNotes.map((each) => ({note: defined(midiNoteNumber(each), 'pipe')})),
  });
}

function range(from: number, to: number): number[] {
  return Array.from({length: to - from + 1}, (_, index) => from + index);
}

describe('octaveMoveTable', () => {
  it('has one entry for each of the 128 note numbers', () => {
    expect(octaveMoveTable(anOrgan(range(60, 84)))).toHaveLength(128);
  });

  it('maps a Pipe to itself', () => {
    const table = octaveMoveTable(anOrgan(range(60, 84)));
    for (const pipe of range(60, 84)) expect(table[pipe]).toBe(pipe);
  });

  it('moves B6 down one octave to B5 for Pipes C4 to C6', () => {
    expect(octaveMoveTable(anOrgan(range(60, 84)))[95]).toBe(83);
  });

  it('moves C5 upward to C6 when C4 and C6 are equally near', () => {
    expect(octaveMoveTable(anOrgan([60, 84]))[72]).toBe(84);
  });

  it('leaves F#4 unplayable when no Pipe is an F#', () => {
    const withoutFSharp = range(60, 84).filter((pipe) => pipe % 12 !== 6);
    expect(octaveMoveTable(anOrgan(withoutFSharp))[66]).toBeUndefined();
  });
});
