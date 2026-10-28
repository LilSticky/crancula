import {describe, expect, it} from 'vitest';
import {emptyOrganDraft, type OrganDraft} from './organ-draft';
import {borders, organId} from './organ';
import {type OrganViolation, validateOrgan} from './validate-organ';

/** "Street organ" from the quickstart: 31 Pipes from note 53, has a Row Span of 107.5 mm on 120 mm. */
function validDraft(overrides: Partial<OrganDraft> = {}): OrganDraft {
  return {
    ...emptyOrganDraft(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null},
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
        tapeBed: {tapeWidth: 3.1, holeDiameter: 3.1, rowSpacing: 3.1, guideMargin: null},
        pipes: [{note: 60}],
      });
      expect(violationsOf(draft)).toEqual([]);
    });

    it('accepts Pipes whose Row Span equals the tape width exactly (Border 0)', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 107.5, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null}}))).toEqual([]);
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

  describe('the Crank speed range', () => {
    it('gives the Organ the slowest and fastest Crank speed of the draft', () => {
      const result = validateOrgan(validDraft({slowestCrankSpeed: 40, fastestCrankSpeed: 90}));

      expect(result.ok && result.value.crankSpeedRange).toEqual({slowest: 40, fastest: 90});
    });

    it('gives a new Organ the default range of 30 to 120 when the draft has it', () => {
      const result = validateOrgan(validDraft());

      expect(result.ok && result.value.crankSpeedRange).toEqual({slowest: 30, fastest: 120});
    });

    it('requires the slowest Crank speed', () => {
      expect(violationsOf(validDraft({slowestCrankSpeed: null}))).toEqual([
        {code: 'value-required', path: 'slowestCrankSpeed'},
      ]);
    });

    it('requires the fastest Crank speed', () => {
      expect(violationsOf(validDraft({fastestCrankSpeed: null}))).toEqual([
        {code: 'value-required', path: 'fastestCrankSpeed'},
      ]);
    });

    it.each([0, 301, Number.NaN])('rejects the slowest Crank speed %d as outside 1 to 300', (slowestCrankSpeed) => {
      expect(violationsOf(validDraft({slowestCrankSpeed, fastestCrankSpeed: 120}))).toEqual([
        {code: 'crank-speed-out-of-range', path: 'slowestCrankSpeed', params: {min: 1, max: 300}},
      ]);
    });

    it.each([0, 301, Number.POSITIVE_INFINITY])('rejects the fastest Crank speed %d as outside 1 to 300', (fastestCrankSpeed) => {
      expect(violationsOf(validDraft({slowestCrankSpeed: 30, fastestCrankSpeed}))).toEqual([
        {code: 'crank-speed-out-of-range', path: 'fastestCrankSpeed', params: {min: 1, max: 300}},
      ]);
    });

    it.each([
      [1, 2],
      [299, 300],
    ])('accepts the Crank speed range %d–%d at a bound', (slowestCrankSpeed, fastestCrankSpeed) => {
      const result = validateOrgan(validDraft({slowestCrankSpeed, fastestCrankSpeed}));

      expect(result.ok).toBe(true);
    });

    it.each([
      [90, 40],
      [60, 60],
    ])('rejects a slowest Crank speed %d that is not below the fastest %d', (slowestCrankSpeed, fastestCrankSpeed) => {
      expect(violationsOf(validDraft({slowestCrankSpeed, fastestCrankSpeed}))).toEqual([
        {code: 'slowest-not-below-fastest', path: 'fastestCrankSpeed'},
      ]);
    });
  });

  describe('the Guide margin', () => {
    /** The 20er reference: 110 mm tape, 3 mm holes, 3.85 mm rows, 20 Pipes; row span 76.15 mm. */
    function guidedDraft(guideMargin: number | null): OrganDraft {
      return {
        ...validDraft(),
        tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.85, guideMargin},
        pipes: Array.from({length: 20}, (_, row) => ({note: 60 + row})),
      };
    }

    it('is absent from a centred Organ', () => {
      const result = validateOrgan(guidedDraft(null));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.tapeBed).not.toHaveProperty('guideMargin');
    });

    it('keeps a given Guide margin', () => {
      const result = validateOrgan(guidedDraft(10));

      expect(result.ok && result.value.tapeBed.guideMargin).toBe(10);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the Guide margin %d as not positive', (guideMargin) => {
      expect(violationsOf(guidedDraft(guideMargin))).toEqual([{code: 'must-be-positive', path: 'tapeBed.guideMargin'}]);
    });

    it('rejects a Guide margin below half a Hole', () => {
      expect(violationsOf(guidedDraft(1.4))).toEqual([
        {code: 'guide-margin-below-half-hole', path: 'tapeBed.guideMargin', params: {min: 1.5}},
      ]);
    });

    it('accepts a Guide margin of half a Hole, which leaves the guide side Border at 0', () => {
      const result = validateOrgan(guidedDraft(1.5));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(borders(result.value).guide).toBe(0);
    });

    it('rejects a Guide margin that runs the last row off the far side', () => {
      expect(violationsOf(guidedDraft(35.36))).toEqual([
        {code: 'guide-margin-too-large', path: 'tapeBed.guideMargin', params: {max: 35.35}},
      ]);
    });

    it('accepts the largest Guide margin, which leaves the far side Border at 0', () => {
      expect(violationsOf(guidedDraft(35.35))).toEqual([]);
    });

    it('reports only the Pipes that exceed the tape width when the rows do not fit at all', () => {
      const draft: OrganDraft = {...guidedDraft(10), tapeBed: {tapeWidth: 70, holeDiameter: 3, rowSpacing: 3.85, guideMargin: 10}};

      expect(violationsOf(draft)).toEqual([
        {code: 'pipes-exceed-tape-width', path: 'tapeBed.tapeWidth', params: {requiredWidth: 76.15, availableWidth: 70}},
      ]);
    });

    it('can report guide-margin-too-large after a Pipe is added to a valid guided Organ', () => {
      const draft = guidedDraft(35.35);
      expect(violationsOf(draft)).toEqual([]);

      const withPipe: OrganDraft = {...draft, pipes: [...draft.pipes, {note: 80}]};

      expect(violationsOf(withPipe)).toEqual([
        {code: 'guide-margin-too-large', path: 'tapeBed.guideMargin', params: {max: 31.5}},
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
        tapeBed: {tapeWidth: null, holeDiameter: null, rowSpacing: null, guideMargin: null},
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
        tapeBed: {tapeWidth: 0, holeDiameter: -1, rowSpacing: 0, guideMargin: null},
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
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 120, holeDiameter: 3, rowSpacing: 2.5, guideMargin: null}}))).toEqual([
        {code: 'row-spacing-below-hole-diameter', path: 'tapeBed.rowSpacing', params: {holeDiameter: 3}},
      ]);
    });

    it('rejects Pipes whose Row Span is just above the tape width', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 107.4, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null}}))).toEqual([
        {code: 'pipes-exceed-tape-width', path: 'tapeBed.tapeWidth', params: {requiredWidth: 107.5, availableWidth: 107.4}},
      ]);
    });

    it('rejects Pipes that do not fit across the tape width', () => {
      expect(violationsOf(validDraft({tapeBed: {tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null}}))).toEqual([
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
