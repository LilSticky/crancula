import {describe, expect, it} from 'vitest';
import {parseOrganLibrarySnapshot, toSnapshot} from './organ-library-snapshot';
import {validateOrgan} from './validate-organ';
import type {Organ} from './organ';

const ID_A = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ID_B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

function organSnapshot(id: string, name = 'Street organ') {
  return {
    id,
    name,
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    pipes: [{note: 64}, {note: 60}, {note: 62}],
  };
}

describe('parseOrganLibrarySnapshot', () => {
  it('reads version 2 and keeps the Pipe order', () => {
    const result = parseOrganLibrarySnapshot({version: 2, organs: [organSnapshot(ID_A), organSnapshot(ID_B, 'Second')]});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((organ) => organ.name)).toEqual(['Street organ', 'Second']);
    expect(result.value[0].id).toBe(ID_A);
    expect(result.value[0].pipes.map((pipe) => pipe.note)).toEqual([64, 60, 62]);
  });

  it('reads an empty library', () => {
    expect(parseOrganLibrarySnapshot({version: 2, organs: []})).toEqual({ok: true, value: []});
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['a missing version', {organs: []}],
    ['an unknown version', {version: 3, organs: []}],
    ['organs that are not a list', {version: 2, organs: {}}],
    ['an Organ that is not an object', {version: 2, organs: [42]}],
    ['an invalid id', {version: 2, organs: [organSnapshot('organ-1')]}],
    ['a duplicate id', {version: 2, organs: [organSnapshot(ID_A), organSnapshot(ID_A)]}],
    ['a wrongly typed field', {version: 2, organs: [{...organSnapshot(ID_A), minimumGap: '1.5'}]}],
    ['a missing Tape Bed', {version: 2, organs: [{...organSnapshot(ID_A), tapeBed: undefined}]}],
    ['Pipes that are not a list', {version: 2, organs: [{...organSnapshot(ID_A), pipes: 'C4'}]}],
    ['an Organ that breaks a rule', {version: 2, organs: [{...organSnapshot(ID_A), pipes: [{note: 60}, {note: 60}]}]}],
  ])('rejects %s', (_, input) => {
    const result = parseOrganLibrarySnapshot(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).not.toBe('');
  });
});

describe('version 1 migration', () => {
  it.each([[6], [0], [9]])('reads a version 1 snapshot with a stored border of %s and drops it', (border) => {
    const v1 = organSnapshot(ID_A);
    const result = parseOrganLibrarySnapshot({version: 1, organs: [{...v1, tapeBed: {...v1.tapeBed, border}}]});
    const expected = parseOrganLibrarySnapshot({version: 2, organs: [v1]});

    expect(result.ok).toBe(true);
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain('border');
  });

  it('reads a version 1 snapshot without a border', () => {
    expect(parseOrganLibrarySnapshot({version: 1, organs: [organSnapshot(ID_A)]}).ok).toBe(true);
  });

  it('reads a version 2 snapshot that carries no border', () => {
    expect(parseOrganLibrarySnapshot({version: 2, organs: [organSnapshot(ID_A)]}).ok).toBe(true);
  });
});

describe('toSnapshot', () => {
  it('writes version 2 and no border', () => {
    const parsed = parseOrganLibrarySnapshot({version: 1, organs: [{...organSnapshot(ID_A), tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5, border: 6}}]});
    const snapshot = toSnapshot(parsed.ok ? parsed.value : []);

    expect(snapshot.version).toBe(2);
    expect(JSON.stringify(snapshot)).not.toContain('border');
  });

  it('round-trips through the parser', () => {
    const parsed = parseOrganLibrarySnapshot({version: 2, organs: [organSnapshot(ID_A)]});
    const organs: readonly Organ[] = parsed.ok ? parsed.value : [];

    const snapshot = toSnapshot(organs);

    expect(snapshot).toEqual({version: 2, organs: [organSnapshot(ID_A)]});
    expect(parseOrganLibrarySnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(parsed);
  });

  it('writes Organs created by validateOrgan', () => {
    const result = validateOrgan({
      name: 'New',
      tapeBed: {tapeWidth: 50, holeDiameter: 2, rowSpacing: 3},
      minimumGap: 1,
      pipes: [{note: 60}],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toSnapshot([result.value]).organs[0]).toEqual({
      id: result.value.id,
      name: 'New',
      tapeBed: {tapeWidth: 50, holeDiameter: 2, rowSpacing: 3},
      minimumGap: 1,
      pipes: [{note: 60}],
    });
  });
});
