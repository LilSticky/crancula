import {describe, expect, it} from 'vitest';
import {plotterId, type PlotterId} from './plotter';
import {emptyPlotterDraft, type PlotterDraft} from './plotter-draft';
import {type PlotterViolation, validatePlotter} from './validate-plotter';

/** "Cutting mat" from the quickstart: a sheet Plotter with a Working area of 300 × 120 mm and the default Overlap. */
function validDraft(overrides: Partial<PlotterDraft> = {}): PlotterDraft {
  return {
    ...emptyPlotterDraft(),
    name: 'Cutting mat',
    workingWidth: 120,
    workingLength: 300,
    overlap: 20,
    ...overrides,
  };
}

function rollDraft(overrides: Partial<PlotterDraft> = {}): PlotterDraft {
  return validDraft({roll: true, workingLength: null, overlap: null, ...overrides});
}

function violationsOf(draft: PlotterDraft): PlotterViolation[] {
  const result = validatePlotter(draft);
  return result.ok ? [] : result.error;
}

describe('validatePlotter', () => {
  describe('a valid draft', () => {
    it('becomes a sheet Plotter with the trimmed name and all values', () => {
      const result = validatePlotter(validDraft({name: '  Cutting mat  '}));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('Cutting mat');
      expect(result.value).toMatchObject({format: 'svg', roll: false, workingWidth: 120, workingLength: 300, overlap: 20});
    });

    it('keeps the id of a stored Plotter', () => {
      const id = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
      const result = validatePlotter(validDraft({id: idOf(id)}));

      expect(result.ok && result.value.id).toBe(id);
    });

    it('assigns a new id to a new Plotter', () => {
      const result = validatePlotter(validDraft());

      expect(result.ok && plotterId(result.value.id)).toBeTruthy();
    });

    it('becomes a roll Plotter with a working width and a Tape spacing, and no working length or Overlap', () => {
      const result = validatePlotter(rollDraft({workingWidth: 120, tapeSpacing: 3}));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toMatchObject({format: 'svg', roll: true, workingWidth: 120, tapeSpacing: 3});
      expect(result.value).not.toHaveProperty('workingLength');
      expect(result.value).not.toHaveProperty('overlap');
    });

    it('becomes a sheet Plotter without a Tape spacing', () => {
      const result = validatePlotter(validDraft({tapeSpacing: 5}));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).not.toHaveProperty('tapeSpacing');
    });

    it('accepts decimals', () => {
      expect(violationsOf(validDraft({workingWidth: 120.5, workingLength: 300.25, overlap: 0.5}))).toEqual([]);
    });
  });

  describe('rule violations', () => {
    it('requires a name', () => {
      expect(violationsOf(validDraft({name: '   '}))).toEqual([{code: 'name-required', path: 'name'}]);
    });

    it.each([null, Number.NaN, Number.POSITIVE_INFINITY])('requires a working width, given %s', (workingWidth) => {
      expect(violationsOf(validDraft({workingWidth}))).toEqual([{code: 'value-required', path: 'workingWidth'}]);
    });

    it.each([null, Number.NaN, Number.POSITIVE_INFINITY])('requires a working length, given %s', (workingLength) => {
      expect(violationsOf(validDraft({workingLength}))).toEqual([{code: 'value-required', path: 'workingLength'}]);
    });

    it.each([null, Number.NaN, Number.POSITIVE_INFINITY])('requires an Overlap, given %s', (overlap) => {
      expect(violationsOf(validDraft({overlap}))).toEqual([{code: 'value-required', path: 'overlap'}]);
    });

    it.each([0, -1])('rejects a working width of %d as not positive', (workingWidth) => {
      expect(violationsOf(validDraft({workingWidth}))).toEqual([{code: 'must-be-positive', path: 'workingWidth'}]);
    });

    it.each([0, -1])('rejects a working length of %d as not positive', (workingLength) => {
      expect(violationsOf(validDraft({workingLength, overlap: 20}))).toEqual([
        {code: 'must-be-positive', path: 'workingLength'},
      ]);
    });

    it.each([0, -1])('rejects an Overlap of %d as not positive', (overlap) => {
      expect(violationsOf(validDraft({overlap}))).toEqual([{code: 'must-be-positive', path: 'overlap'}]);
    });

    it.each([300, 320])('rejects an Overlap of %d that is not below the working length 300', (overlap) => {
      expect(violationsOf(validDraft({overlap}))).toEqual([
        {code: 'overlap-not-below-working-length', path: 'overlap', params: {workingLength: 300}},
      ]);
    });

    it('does not check the Overlap against a working length that is itself invalid', () => {
      expect(violationsOf(validDraft({workingLength: 0, overlap: 20}))).toEqual([
        {code: 'must-be-positive', path: 'workingLength'},
      ]);
    });

    it('reports every violation at once', () => {
      const violations = violationsOf(validDraft({name: '', workingWidth: null, overlap: null}));

      expect(violations).toHaveLength(3);
      expect(violations).toEqual(
        expect.arrayContaining([
          {code: 'name-required', path: 'name'},
          {code: 'value-required', path: 'workingWidth'},
          {code: 'value-required', path: 'overlap'},
        ]),
      );
    });
  });

  describe('a roll Plotter', () => {
    it('requires a working width', () => {
      expect(violationsOf(rollDraft({workingWidth: null}))).toEqual([{code: 'value-required', path: 'workingWidth'}]);
    });

    it('does not check a working length or Overlap it does not have', () => {
      expect(violationsOf(rollDraft({workingLength: -5, overlap: 0}))).toEqual([]);
    });

    it('still requires a name', () => {
      expect(violationsOf(rollDraft({name: ''}))).toEqual([{code: 'name-required', path: 'name'}]);
    });

    it.each([null, Number.NaN, Number.POSITIVE_INFINITY])('requires a Tape spacing, given %s', (tapeSpacing) => {
      expect(violationsOf(rollDraft({tapeSpacing}))).toEqual([{code: 'value-required', path: 'tapeSpacing'}]);
    });

    it.each([-1, -0.5])('rejects a Tape spacing of %d as negative', (tapeSpacing) => {
      expect(violationsOf(rollDraft({tapeSpacing}))).toEqual([{code: 'must-not-be-negative', path: 'tapeSpacing'}]);
    });

    it('accepts a Tape spacing of 0, so that Tapes touch', () => {
      expect(violationsOf(rollDraft({tapeSpacing: 0}))).toEqual([]);
    });

    it('accepts decimals as a Tape spacing', () => {
      expect(violationsOf(rollDraft({tapeSpacing: 2.5}))).toEqual([]);
    });
  });

  describe('a sheet Plotter', () => {
    it.each([null, Number.NaN, -1])('does not check its Tape spacing, given %s', (tapeSpacing) => {
      expect(violationsOf(validDraft({tapeSpacing}))).toEqual([]);
    });
  });
});

/** The id as the draft carries it: a valid PlotterId, or the test is wrong. */
function idOf(value: string): PlotterId {
  const id = plotterId(value);
  if (id === undefined) throw new Error(`invalid test id ${value}`);
  return id;
}
