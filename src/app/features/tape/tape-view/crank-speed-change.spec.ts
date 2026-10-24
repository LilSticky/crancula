import {describe, expect, it} from 'vitest';
import {changeCrankSpeed, columnCount, millimetres, organId, tapeId, transposition, type Tape} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {crankSpeedChange, crankSpeedChangeTo} from './crank-speed-change';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** A Tape of 100 Columns of 5 mm at the default Crank speed of 60 turns per minute. */
function aTape(): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'), 'organ id'),
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes: [],
  });
}

describe('crankSpeedChange', () => {
  it('is unchanged for an empty field', () => {
    const change = crankSpeedChange(aTape(), '');

    expect(change).toEqual({state: 'unchanged'});
  });

  it.each(['60', '60,0', ' 60 '])('is unchanged when the typed text "%s" is the current Crank speed of 60', (typed) => {
    const change = crankSpeedChange(aTape(), typed);

    expect(change).toEqual({state: 'unchanged'});
  });

  it.each(['abc', '0', '0,5', '301', '-1', '60 rpm'])('is invalid for the typed text "%s"', (typed) => {
    const change = crankSpeedChange(aTape(), typed);

    expect(change.state).toBe('invalid');
  });

  it('is ready with the changed Tape for a valid different value', () => {
    const change = crankSpeedChange(aTape(), '120');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.crankSpeed).toBe(120);
  });

  it('reads a decimal comma as the decimal separator', () => {
    const change = crankSpeedChange(aTape(), '90,5');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.crankSpeed).toBe(90.5);
  });

  it('keeps the Columns and the Column length of the Tape when the Crank speed changes', () => {
    const change = crankSpeedChange(aTape(), '120');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.length).toBe(100);
    expect(change.tape.columnLength).toBe(5);
  });

  it('is ready with a changed Tape from a number too, and unchanged for null', () => {
    expect(crankSpeedChangeTo(aTape(), null)).toEqual({state: 'unchanged'});

    const change = crankSpeedChangeTo(aTape(), 120);
    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.crankSpeed).toBe(120);
  });

  it('agrees with changeCrankSpeed on the Tape it makes', () => {
    const expected = changeCrankSpeed(aTape(), 120);
    const change = crankSpeedChange(aTape(), '120');

    expect(expected.ok).toBe(true);
    if (!expected.ok || change.state !== 'ready') return;
    expect(change.tape).toEqual(expected.value);
  });
});
