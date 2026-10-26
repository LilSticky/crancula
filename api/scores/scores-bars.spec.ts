import {describe, expect, it} from 'vitest';
import {millimetres} from '../organ/organ';
import {referenceOrgan, tapeOf} from '../tape/tape-fixture';
import {columnCount, tapeId, transposition, type Tape} from '../tape/tape';
import {scoresBars} from './scores-bars';
import type {ScoresChoices} from './scores-choices';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** A Tape of the given length with no Holes, on the reference Organ, with no Song. */
function tapeOfLength(length: number): Tape {
  const organ = referenceOrgan();
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-0000000000bb'), 'tape id'),
    name: 'Bars',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(3), 'column length'),
    length: defined(columnCount(length), `length ${length}`),
    holes: [],
  });
}

describe('scoresBars with one chosen Time signature', () => {
  it('lays 4/4 Bars of 32 Columns from Column 0 over 70 Columns, the last one full', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 4, beatType: 4}, upbeat: 0, splitNotes: []};

    const bars = scoresBars(tapeOfLength(70), undefined, choices).map(({start, length}) => ({start, length}));

    expect(bars).toEqual([
      {start: 0, length: 32},
      {start: 32, length: 32},
      {start: 64, length: 32},
    ]);
  });

  it('starts with an upbeat of 4 Columns in 6/8, then Bars of 24 Columns numbered 0, 1, 2 and 3', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 6, beatType: 8}, upbeat: 4, splitNotes: []};

    const bars = scoresBars(tapeOfLength(60), undefined, choices).map(({number, start, length}) => ({number, start, length}));

    expect(bars).toEqual([
      {number: 0, start: 0, length: 4},
      {number: 1, start: 4, length: 24},
      {number: 2, start: 28, length: 24},
      {number: 3, start: 52, length: 24},
    ]);
  });
});
