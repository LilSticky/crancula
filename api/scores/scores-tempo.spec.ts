/*
 * Expected API of api/scores/scores-tempo.ts (T011, data-model.md "Tempo and file name"):
 *
 *   scoresTempo(tape: Tape, organ: Organ): number | undefined
 *     Quarter notes per minute: round(crankSpeed × tapePerCrankTurn ÷ (8 × columnLength)), at least 1;
 *     undefined when the Organ has no Tape per Crank turn (FR-013).
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {crankSpeed} from '../tape/crank-speed';
import {referenceOrgan, tapeOf} from '../tape/tape-fixture';
import {columnCount, tapeId, transposition, type Tape} from '../tape/tape';
import {scoresTempo} from './scores-tempo';

const ORGAN_ID = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** An Organ with the given Tape per Crank turn, in millimetres; a Pipe on 60 is enough. */
function organWithTapePerCrankTurn(tapePerCrankTurn: number | null): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Tempo organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 1,
    fastestCrankSpeed: 300,
    tapePerCrankTurn,
    pipes: [{note: defined(midiNoteNumber(60), 'note')}],
  });
  if (!result.ok) throw new Error(`invalid Organ fixture: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A Tape on the Organ at the given Crank speed (turns per minute) and Column length in millimetres. */
function tapeOn(organ: Organ, crankSpeedValue: number, columnLength: number): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-0000000000cc'), 'tape id'),
    name: 'Waltz',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    crankSpeed: defined(crankSpeed(crankSpeedValue), 'crank speed'),
    length: defined(columnCount(32), 'length'),
    holes: [],
  });
}

describe('scoresTempo gives the quarter notes per minute of the Tape on its Organ (FR-013, Story 1.5)', () => {
  it('is 150 for a Crank speed of 60 with 100 mm per Crank turn and 5 mm Columns', () => {
    const organ = organWithTapePerCrankTurn(100);

    expect(scoresTempo(tapeOn(organ, 60, 5), organ)).toBe(150);
  });

  it('rounds to the nearest whole number (61 × 100 ÷ 24 is 254.17)', () => {
    const organ = organWithTapePerCrankTurn(100);

    expect(scoresTempo(tapeOn(organ, 61, 3), organ)).toBe(254);
  });

  it('is at least 1 when the rounded value would be 0', () => {
    const organ = organWithTapePerCrankTurn(1);

    expect(scoresTempo(tapeOn(organ, 1, 100), organ)).toBe(1);
  });

  it('is undefined for an Organ without a Tape per Crank turn', () => {
    const organ = referenceOrgan();

    expect(scoresTempo(tapeOn(organ, 60, 3), organ)).toBeUndefined();
  });
});
