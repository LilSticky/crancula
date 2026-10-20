import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, organId, type Organ} from '../organ/organ';
import {transposeRange} from './transpose-holes';

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

describe('transposeRange', () => {
  it('reaches every Pipe from every other: plus and minus the span from lowest to highest Pipe note', () => {
    expect(transposeRange(anOrgan([60, 64, 76]))).toEqual({lowest: -16, highest: 16});
  });

  it('is zero for an Organ with one Pipe', () => {
    expect(transposeRange(anOrgan([60]))).toEqual({lowest: 0, highest: 0});
  });

  it('is at most plus and minus 127', () => {
    expect(transposeRange(anOrgan([0, 127]))).toEqual({lowest: -127, highest: 127});
  });
});
