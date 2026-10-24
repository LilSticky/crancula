import {describe, expect, it} from 'vitest';
import {emptyOrganDraft, type OrganDraft} from './organ-draft';
import {organId} from './organ';
import {type OrganViolation, validateOrgan} from './validate-organ';

/** "Street organ" from the quickstart: 31 Pipes from note 53, has a Row Span of 107.5 mm on 120 mm. */
function validDraft(overrides: Partial<OrganDraft> = {}): OrganDraft {
  return {
    ...emptyOrganDraft(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    leadIn: 20,
    pipes: Array.from({length: 31}, (_, row) => ({note: 53 + row})),
    ...overrides,
  };
}

function violationsOf(draft: OrganDraft): OrganViolation[] {
  const result = validateOrgan(draft);
  return result.ok ? [] : result.error;
}

describe('validateOrgan', () => {
  describe('a valid draft', () => {
    it('becomes an Organ with the trimmed name and all values', () => {
      const result = validateOrgan(validDraft({name: '  Street organ  '}));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('Street organ');
      expect(result.value.tapeBed).toEqual({tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5});
      expect(result.value.minimumGap).toBe(1.5);
      expect(result.value.leadIn).toBe(20);
      expect(result.value.pipes.map((pipe) => pipe.note)).toEqual(Array.from({length: 31}, (_, row) => 53 + row));
    });

    it('keeps the id of a stored Organ', () => {
      const id = organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f');
      const result = validateOrgan(validDraft({id}));
      expect(result.ok && result.value.id).toBe(id);
    });

    it('assigns a new id to a new Organ', () => {
      const result = validateOrgan(validDraft());
      expect(result.ok && organId(result.value.id)).toBeTruthy();
    });

    it('accepts a single Pipe and decimals', () => {
      const draft = validDraft({
        tapeBed: {tapeWidth: 3.1, holeDiameter: 3.1, rowSpacing: 3.1},
        pipes: [{note: 60}],
      });
      expect(violationsOf(draft)).toEqual([]);
    });

    it('accepts Pipes whose Row Span equals the tape width exactly (Border 0)', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 107.5, holeDiameter: 2.5, rowSpacing: 3.5}}))).toEqual([]);
    });
  });

  describe('the Tape per Crank turn', () => {
    it('is absent on the Organ when the draft has none', () => {
      const result = validateOrgan(validDraft({tapePerCrankTurn: null}));

      expect(result.ok).toBe(true);
      expect(result.ok && result.value.tapePerCrankTurn).toBeUndefined();
    });

    it('keeps a given Tape per Crank turn', () => {
      const result = validateOrgan(validDraft({tapePerCrankTurn: 120.5}));

      expect(result.ok && result.value.tapePerCrankTurn).toBe(120.5);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the Tape per Crank turn %d', (tapePerCrankTurn) => {
      expect(violationsOf(validDraft({tapePerCrankTurn}))).toEqual([
        {code: 'tape-per-crank-turn-not-positive', path: 'tapePerCrankTurn'},
      ]);
    });
  });

  describe('rule violations', () => {
    it('requires a name', () => {
      expect(violationsOf(validDraft({name: '   '}))).toEqual([{code: 'name-required', path: 'name'}]);
    });

    it('requires at least one Pipe', () => {
      expect(violationsOf(validDraft({pipes: []}))).toEqual([{code: 'pipes-required', path: 'pipes'}]);
    });

    it('requires a note for every Pipe', () => {
      expect(violationsOf(validDraft({pipes: [{note: 60}, {note: null}]}))).toEqual([
        {code: 'pipe-note-required', path: 'pipes.1.note'},
      ]);
    });

    it.each([-1, 128, 60.5])('rejects the note %d', (note) => {
      expect(violationsOf(validDraft({pipes: [{note}]}))).toEqual([
        {code: 'pipe-note-out-of-range', path: 'pipes.0.note', params: {note}},
      ]);
    });

    it('marks every Pipe of a duplicate note', () => {
      expect(violationsOf(validDraft({pipes: [{note: 60}, {note: 62}, {note: 60}]}))).toEqual([
        {code: 'duplicate-pipe', path: 'pipes.0.note', params: {noteName: 'C4'}},
        {code: 'duplicate-pipe', path: 'pipes.2.note', params: {noteName: 'C4'}},
      ]);
    });

    it('requires every measurement', () => {
      const draft = validDraft({
        tapeBed: {tapeWidth: null, holeDiameter: null, rowSpacing: null},
        minimumGap: null,
        leadIn: null,
      });
      expect(violationsOf(draft)).toEqual([
        {code: 'value-required', path: 'tapeBed.tapeWidth'},
        {code: 'value-required', path: 'tapeBed.holeDiameter'},
        {code: 'value-required', path: 'tapeBed.rowSpacing'},
        {code: 'value-required', path: 'minimumGap'},
        {code: 'value-required', path: 'leadIn'},
      ]);
    });

    it('requires a Lead-in', () => {
      expect(violationsOf(validDraft({leadIn: null}))).toEqual([{code: 'value-required', path: 'leadIn'}]);
    });

    it('rejects a negative Lead-in', () => {
      expect(violationsOf(validDraft({leadIn: -0.5}))).toEqual([{code: 'must-not-be-negative', path: 'leadIn'}]);
    });

    it('accepts a Lead-in of 0 (none)', () => {
      const result = validateOrgan(validDraft({leadIn: 0}));
      expect(result.ok && result.value.leadIn).toBe(0);
    });

    it('treats a number that is not finite as missing', () => {
      expect(violationsOf(validDraft({minimumGap: Number.NaN}))).toEqual([{code: 'value-required', path: 'minimumGap'}]);
    });

    it('requires positive tape width, hole diameter, row spacing and Minimum Gap', () => {
      const draft = validDraft({
        tapeBed: {tapeWidth: 0, holeDiameter: -1, rowSpacing: 0},
        minimumGap: 0,
      });
      expect(violationsOf(draft)).toEqual([
        {code: 'must-be-positive', path: 'tapeBed.tapeWidth'},
        {code: 'must-be-positive', path: 'tapeBed.holeDiameter'},
        {code: 'must-be-positive', path: 'tapeBed.rowSpacing'},
        {code: 'must-be-positive', path: 'minimumGap'},
      ]);
    });

    it('rejects a row spacing smaller than the hole diameter', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 120, holeDiameter: 3, rowSpacing: 2.5}}))).toEqual([
        {code: 'row-spacing-below-hole-diameter', path: 'tapeBed.rowSpacing', params: {holeDiameter: 3}},
      ]);
    });

    it('rejects Pipes whose Row Span is just above the tape width', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 107.4, holeDiameter: 2.5, rowSpacing: 3.5}}))).toEqual([
        {code: 'pipes-exceed-tape-width', path: 'tapeBed.tapeWidth', params: {requiredWidth: 107.5, availableWidth: 107.4}},
      ]);
    });

    it('rejects Pipes that do not fit across the tape width', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5}}))).toEqual([
        {code: 'pipes-exceed-tape-width', path: 'tapeBed.tapeWidth', params: {requiredWidth: 107.5, availableWidth: 100}},
      ]);
    });

    it('reports all violations at once', () => {
      const codes = violationsOf({...emptyOrganDraft(), pipes: [{note: null}]}).map((violation) => violation.code);
      expect(codes).toEqual([
        'name-required',
        'pipe-note-required',
        'value-required',
        'value-required',
        'value-required',
        'value-required',
        'value-required',
      ]);
    });
  });
});
