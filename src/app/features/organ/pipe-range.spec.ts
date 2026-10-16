import {describe, expect, it} from 'vitest';
import {emptyOrganDraft, type Organ, type OrganDraft, validateOrgan} from '@api/index';
import {pipeRange} from './pipe-range';

function organWithNotes(notes: readonly number[]): Organ {
  const draft: OrganDraft = {
    ...emptyOrganDraft(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    leadIn: 20,
    pipes: notes.map((note) => ({note})),
  };
  const result = validateOrgan(draft);
  if (!result.ok) throw new Error('The test Organ is not valid.');
  return result.value;
}

describe('pipeRange', () => {
  it('gives the count and the lowest and highest note name of the Street organ', () => {
    const streetOrgan = organWithNotes(Array.from({length: 31}, (_, row) => 53 + row));

    expect(pipeRange(streetOrgan)).toEqual({count: 31, lowest: 'F3', highest: 'B5'});
  });

  it('gives the same note as lowest and highest for one Pipe', () => {
    expect(pipeRange(organWithNotes([60]))).toEqual({count: 1, lowest: 'C4', highest: 'C4'});
  });

  it('orders by MIDI note, not by row', () => {
    expect(pipeRange(organWithNotes([72, 55, 60]))).toEqual({count: 3, lowest: 'G3', highest: 'C5'});
  });
});
