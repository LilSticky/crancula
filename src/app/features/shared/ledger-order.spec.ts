import {describe, expect, it} from 'vitest';
import {byName, tapesByOrgan} from './ledger-order';

function named(...names: string[]): {readonly name: string}[] {
  return names.map((name) => ({name}));
}

describe('byName', () => {
  it('sorts "Ärger" with "Anton" before "Bach" in German', () => {
    expect(byName(named('Bach', 'Ärger', 'Anton'), 'de').map((item) => item.name)).toEqual(['Anton', 'Ärger', 'Bach']);
  });

  it('ignores case', () => {
    expect(byName(named('B', 'a'), 'en').map((item) => item.name)).toEqual(['a', 'B']);
  });

  it('keeps a stable order for equal names', () => {
    const first = {name: 'Same', tag: 1};
    const second = {name: 'Same', tag: 2};

    expect(byName([first, second], 'en')).toEqual([first, second]);
    expect(byName([second, first], 'en')).toEqual([second, first]);
  });

  it('does not change the given list', () => {
    const items = named('b', 'a');

    byName(items, 'en');

    expect(items.map((item) => item.name)).toEqual(['b', 'a']);
  });
});

describe('tapesByOrgan', () => {
  it('groups by Organ name, then sorts by Tape name', () => {
    const rows = [
      {name: 'B', organ: {name: 'Street organ'}},
      {name: 'x', organ: {name: 'Barrel'}},
      {name: 'a', organ: {name: 'Street organ'}},
    ];

    expect(tapesByOrgan(rows, 'en').map((row) => `${row.organ?.name}/${row.name}`)).toEqual(['Barrel/x', 'Street organ/a', 'Street organ/B']);
  });

  it('puts Tapes whose Organ is not available last', () => {
    const rows = [
      {name: 'a', organ: undefined},
      {name: 'b', organ: {name: 'Street organ'}},
    ];

    expect(tapesByOrgan(rows, 'en').map((row) => row.name)).toEqual(['b', 'a']);
  });
});
