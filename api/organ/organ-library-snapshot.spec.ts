import {describe, expect, it} from 'vitest';
import {parseOrganLibrarySnapshot, toSnapshot} from './organ-library-snapshot';
import {validateOrgan} from './validate-organ';
import {borders, type Organ} from './organ';

const ID_A = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ID_B = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

/** An Organ as stored in version 3, with a Lead-in. */
function organSnapshot(id: string, name = 'Street organ') {
  return {...organSnapshotV2(id, name), leadIn: 20};
}

/** An Organ as stored in version 5, with its Crank speed range. */
function organSnapshotV5(id: string, slowest: number, fastest: number) {
  return {...organSnapshot(id), crankSpeedRange: {slowest, fastest}};
}

/**
 * The 20er reference Organ as stored in version 6: 110 mm tape, 3 mm holes, 3.85 mm rows, 20 Pipes.
 * The Guide margin is left out when undefined; it is untyped because the parser takes untyped input.
 */
function organSnapshotV6(id: string, guideMargin?: unknown) {
  return {
    id,
    name: 'Street organ',
    tapeBed: {
      tapeWidth: 110,
      holeDiameter: 3,
      rowSpacing: 3.85,
      ...(guideMargin === undefined ? {} : {guideMargin}),
    },
    minimumGap: 3,
    leadIn: 30,
    crankSpeedRange: {slowest: 30, fastest: 120},
    pipes: Array.from({length: 20}, (_, row) => ({note: 60 + row})),
  };
}

/** An Organ as stored in versions 1 and 2, without a Lead-in. */
function organSnapshotV2(id: string, name = 'Street organ') {
  return {
    id,
    name,
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    pipes: [{note: 64}, {note: 60}, {note: 62}],
  };
}

describe('parseOrganLibrarySnapshot', () => {
  it('reads version 3 and keeps the Pipe order', () => {
    const result = parseOrganLibrarySnapshot({version: 3, organs: [organSnapshot(ID_A), organSnapshot(ID_B, 'Second')]});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((organ) => organ.name)).toEqual(['Street organ', 'Second']);
    expect(result.value[0].id).toBe(ID_A);
    expect(result.value[0].leadIn).toBe(20);
    expect(result.value[0].pipes.map((pipe) => pipe.note)).toEqual([64, 60, 62]);
  });

  it('reads an empty library', () => {
    expect(parseOrganLibrarySnapshot({version: 4, organs: []})).toEqual({ok: true, value: []});
  });

  it('reads version 4 and keeps the Tape per Crank turn', () => {
    const result = parseOrganLibrarySnapshot({version: 4, organs: [{...organSnapshot(ID_A), tapePerCrankTurn: 100}]});

    expect(result.ok && result.value[0].tapePerCrankTurn).toBe(100);
  });

  it('reads version 4 without a Tape per Crank turn', () => {
    const result = parseOrganLibrarySnapshot({version: 4, organs: [organSnapshot(ID_A)]});

    expect(result.ok).toBe(true);
    expect(result.ok && result.value[0].tapePerCrankTurn).toBeUndefined();
  });

  it.each([0, -1])('rejects a version 4 Tape per Crank turn of %d', (tapePerCrankTurn) => {
    const result = parseOrganLibrarySnapshot({version: 4, organs: [{...organSnapshot(ID_A), tapePerCrankTurn}]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('tape-per-crank-turn-not-positive');
  });

  it('rejects a version 4 Tape per Crank turn that is not a number', () => {
    const result = parseOrganLibrarySnapshot({version: 4, organs: [{...organSnapshot(ID_A), tapePerCrankTurn: '100'}]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('tapePerCrankTurn');
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['a missing version', {organs: []}],
    ['an unknown version', {version: 7, organs: []}],
    ['version 0', {version: 0, organs: []}],
    ['organs that are not a list', {version: 3, organs: {}}],
    ['an Organ that is not an object', {version: 3, organs: [42]}],
    ['an invalid id', {version: 3, organs: [organSnapshot('organ-1')]}],
    ['a duplicate id', {version: 3, organs: [organSnapshot(ID_A), organSnapshot(ID_A)]}],
    ['a wrongly typed field', {version: 3, organs: [{...organSnapshot(ID_A), minimumGap: '1.5'}]}],
    ['a missing Tape Bed', {version: 3, organs: [{...organSnapshot(ID_A), tapeBed: undefined}]}],
    ['Pipes that are not a list', {version: 3, organs: [{...organSnapshot(ID_A), pipes: 'C4'}]}],
    ['a version 3 Organ without a Lead-in', {version: 3, organs: [organSnapshotV2(ID_A)]}],
    ['a wrongly typed Lead-in', {version: 3, organs: [{...organSnapshot(ID_A), leadIn: '20'}]}],
    ['a negative Lead-in', {version: 3, organs: [{...organSnapshot(ID_A), leadIn: -1}]}],
    ['an Organ that breaks a rule', {version: 3, organs: [{...organSnapshot(ID_A), pipes: [{note: 60}, {note: 60}]}]}],
  ])('rejects %s', (_, input) => {
    const result = parseOrganLibrarySnapshot(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).not.toBe('');
  });
});

describe('version 1 migration', () => {
  it.each([[6], [0], [9]])('reads a version 1 snapshot with a stored border of %s and drops it', (border) => {
    const v1 = organSnapshotV2(ID_A);
    const result = parseOrganLibrarySnapshot({version: 1, organs: [{...v1, tapeBed: {...v1.tapeBed, border}}]});
    const expected = parseOrganLibrarySnapshot({version: 3, organs: [{...v1, leadIn: 0}]});

    expect(result.ok).toBe(true);
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain('border');
  });

  it('reads a version 1 snapshot without a border', () => {
    expect(parseOrganLibrarySnapshot({version: 1, organs: [organSnapshotV2(ID_A)]}).ok).toBe(true);
  });

  it('reads a version 2 snapshot that carries no border', () => {
    expect(parseOrganLibrarySnapshot({version: 2, organs: [organSnapshotV2(ID_A)]}).ok).toBe(true);
  });

  it.each([1, 2])('reads a version %i snapshot with a Lead-in of 0', (version) => {
    const result = parseOrganLibrarySnapshot({version, organs: [organSnapshotV2(ID_A)]});

    expect(result.ok).toBe(true);
    expect(result.ok && result.value[0].leadIn).toBe(0);
  });
});

describe('version 5 Crank speed range', () => {
  it('reads version 5 and keeps the Crank speed range', () => {
    const result = parseOrganLibrarySnapshot({version: 5, organs: [organSnapshotV5(ID_A, 40, 90)]});

    expect(result.ok && result.value[0].crankSpeedRange).toEqual({slowest: 40, fastest: 90});
  });

  it.each([1, 2, 3, 4])('reads a version %i Organ with the default Crank speed range of 30 to 120', (version) => {
    const organs = version === 1 || version === 2 ? [organSnapshotV2(ID_A)] : [organSnapshot(ID_A)];
    const result = parseOrganLibrarySnapshot({version, organs});

    expect(result.ok && result.value[0].crankSpeedRange).toEqual({slowest: 30, fastest: 120});
  });

  it('refuses a version 5 Crank speed range whose slowest is not below its fastest', () => {
    const result = parseOrganLibrarySnapshot({version: 5, organs: [organSnapshotV5(ID_A, 90, 40)]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('slowest-not-below-fastest');
  });

  it('refuses a version 5 Crank speed range outside 1 to 300', () => {
    const result = parseOrganLibrarySnapshot({version: 5, organs: [organSnapshotV5(ID_A, 0, 120)]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('crank-speed-out-of-range');
  });
});

describe('version 6 Guide margin', () => {
  it('reads version 6 and keeps the Guide margin of the Tape Bed', () => {
    const parsed = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A, 10)]});

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].tapeBed.guideMargin).toBe(10);
  });

  it('reads a version 6 Organ without a Guide margin as centred', () => {
    const parsed = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A)]});

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].tapeBed).not.toHaveProperty('guideMargin');
  });

  it('ignores a stray Guide margin in a version 5 Tape Bed and reads the Organ as centred', () => {
    const v5 = organSnapshotV5(ID_A, 30, 120);
    const parsed = parseOrganLibrarySnapshot({version: 5, organs: [{...v5, tapeBed: {...v5.tapeBed, guideMargin: 10}}]});

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value[0].tapeBed).not.toHaveProperty('guideMargin');
  });

  it('refuses a version 6 Guide margin that is not a number', () => {
    const result = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A, '10')]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('guideMargin');
  });

  it('refuses a version 6 Guide margin that the Tape Bed does not allow', () => {
    const result = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A, 35.36)]});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('guide-margin-too-large');
  });

  it('writes the Guide margin of the Tape Bed', () => {
    const parsed = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A, 10)]});
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(toSnapshot(parsed.value)).toEqual({version: 6, organs: [organSnapshotV6(ID_A, 10)]});
  });

  it('leaves the Guide margin out of the Tape Bed when the rows are centred', () => {
    const parsed = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A)]});
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(toSnapshot(parsed.value).organs[0].tapeBed).not.toHaveProperty('guideMargin');
  });

  it('round-trips a guided Organ through the parser', () => {
    const parsed = parseOrganLibrarySnapshot({version: 6, organs: [organSnapshotV6(ID_A, 10)]});
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const json: unknown = JSON.parse(JSON.stringify(toSnapshot(parsed.value)));

    expect(parseOrganLibrarySnapshot(json)).toEqual(parsed);
  });
});

describe('a centred Preset Organ stored before the Presets carried a Guide margin (US4.3)', () => {
  it('reads as centred: 16.925 mm on each side of the 20er-Drehorgel, with no Guide margin', () => {
    const v5Preset = {
      ...organSnapshotV5(ID_A, 40, 90),
      name: '20er-Drehorgel',
      tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.85},
      minimumGap: 3,
      leadIn: 30,
      pipes: Array.from({length: 20}, (_, row) => ({note: 53 + row})),
    };
    const parsed = parseOrganLibrarySnapshot({version: 5, organs: [v5Preset]});

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [organ] = parsed.value;
    expect(organ.tapeBed).not.toHaveProperty('guideMargin');
    expect(borders(organ).guide).toBeCloseTo(16.925);
    expect(borders(organ).far).toBeCloseTo(16.925);
  });
});

describe('versions 1 to 3 without a Tape per Crank turn', () => {
  it.each([1, 2, 3])('reads a version %i Organ with no Tape per Crank turn', (version) => {
    const organs = version === 3 ? [organSnapshot(ID_A)] : [organSnapshotV2(ID_A)];
    const result = parseOrganLibrarySnapshot({version, organs});

    expect(result.ok).toBe(true);
    expect(result.ok && result.value[0].tapePerCrankTurn).toBeUndefined();
  });
});

describe('toSnapshot', () => {
  it('writes version 6 and no border', () => {
    const parsed = parseOrganLibrarySnapshot({version: 1, organs: [{...organSnapshot(ID_A), tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5, border: 6}}]});
    const snapshot = toSnapshot(parsed.ok ? parsed.value : []);

    expect(snapshot.version).toBe(6);
    expect(JSON.stringify(snapshot)).not.toContain('border');
  });

  it('round-trips through the parser', () => {
    const parsed = parseOrganLibrarySnapshot({version: 5, organs: [organSnapshotV5(ID_A, 30, 120)]});
    const organs: readonly Organ[] = parsed.ok ? parsed.value : [];

    const snapshot = toSnapshot(organs);

    expect(snapshot).toEqual({version: 6, organs: [organSnapshotV5(ID_A, 30, 120)]});
    expect(parseOrganLibrarySnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(parsed);
  });

  it('writes the Tape per Crank turn when the Organ has one', () => {
    const parsed = parseOrganLibrarySnapshot({version: 5, organs: [{...organSnapshotV5(ID_A, 30, 120), tapePerCrankTurn: 100}]});
    const snapshot = toSnapshot(parsed.ok ? parsed.value : []);

    expect(snapshot).toEqual({version: 6, organs: [{...organSnapshotV5(ID_A, 30, 120), tapePerCrankTurn: 100}]});
  });

  it('leaves the Tape per Crank turn out when the Organ has none', () => {
    const parsed = parseOrganLibrarySnapshot({version: 3, organs: [organSnapshot(ID_A)]});
    const snapshot = toSnapshot(parsed.ok ? parsed.value : []);

    expect(snapshot.version).toBe(6);
    expect('tapePerCrankTurn' in snapshot.organs[0]).toBe(false);
  });

  it('writes Organs created by validateOrgan', () => {
    const result = validateOrgan({
      name: 'New',
      tapeBed: {tapeWidth: 50, holeDiameter: 2, rowSpacing: 3, guideMargin: null},
      minimumGap: 1,
      leadIn: 15,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes: [{note: 60}],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toSnapshot([result.value]).organs[0]).toEqual({
      id: result.value.id,
      name: 'New',
      tapeBed: {tapeWidth: 50, holeDiameter: 2, rowSpacing: 3},
      minimumGap: 1,
      leadIn: 15,
      crankSpeedRange: {slowest: 30, fastest: 120},
      pipes: [{note: 60}],
    });
  });
});
