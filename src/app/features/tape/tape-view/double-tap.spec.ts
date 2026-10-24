import {nextTap} from './double-tap';
import type {SelectableHole} from './hole-selection';

const hole: SelectableHole = {row: 24, start: 10};
const otherHole: SelectableHole = {row: 24, start: 30};

/** A tap on `target` at `at` ms; not adding a Hole and without a modifier key unless said so. */
function tap(at: number, target: SelectableHole = hole, flags: {readonly added?: boolean; readonly modifier?: boolean} = {}) {
  return {hole: target, at, added: flags.added ?? false, modifier: flags.modifier ?? false};
}

describe('nextTap', () => {
  it('reports a second tap on the same Hole within 400 ms as a double', () => {
    const first = nextTap(undefined, tap(1000));

    expect(nextTap(first.memory, tap(1400)).double).toBe(true);
  });

  it('does not report a second tap 401 ms after the first as a double', () => {
    const first = nextTap(undefined, tap(1000));

    expect(nextTap(first.memory, tap(1401)).double).toBe(false);
  });

  it('does not report a tap on another Hole as a double', () => {
    const first = nextTap(undefined, tap(1000));

    expect(nextTap(first.memory, tap(1100, otherHole)).double).toBe(false);
  });

  it('does not report a double when the first tap carried a modifier key', () => {
    const first = nextTap(undefined, tap(1000, hole, {modifier: true}));

    expect(nextTap(first.memory, tap(1200)).double).toBe(false);
  });

  it('does not report a double when the first tap added that Hole', () => {
    const first = nextTap(undefined, tap(1000, hole, {added: true}));

    expect(nextTap(first.memory, tap(1200)).double).toBe(false);
  });
});
