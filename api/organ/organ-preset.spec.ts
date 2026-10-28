import {describe, expect, it} from 'vitest';
import type {OrganDraft} from './organ-draft';
import {borders} from './organ';
import {ORGAN_PRESETS, organPreset} from './organ-preset';
import {validateOrgan} from './validate-organ';

/** Measures from Wally Venable's MIDIBoek gamma files (issue #162), Annotated-20-Raffin.gam; Guide margin 10 mm (#163). */
const DREHORGEL_20ER_DRAFT: OrganDraft = {
  name: '20er-Drehorgel',
  tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.85, guideMargin: 10},
  minimumGap: 3,
  leadIn: 30,
  slowestCrankSpeed: 40,
  fastestCrankSpeed: 90,
  tapePerCrankTurn: 70,
  pipes: [53, 58, 60, 62, 63, 64, 65, 67, 69, 70, 72, 74, 75, 76, 77, 79, 81, 82, 84, 86].map((note) => ({note})),
};

/** Measures from Wally Venable's MIDIBoek gamma files (issue #162), 31-raffin-wsv-arranging.gam; Guide margin 11 mm (#163). */
const DREHORGEL_31ER_DRAFT: OrganDraft = {
  name: '31er-Drehorgel',
  tapeBed: {tapeWidth: 140, holeDiameter: 2.5, rowSpacing: 3.86, guideMargin: 11},
  minimumGap: 3,
  leadIn: 30,
  slowestCrankSpeed: 40,
  fastestCrankSpeed: 90,
  tapePerCrankTurn: 70,
  pipes: [
    48, 50, 53, 55, 58, 60, 62, 63, 64, 65, 66, 67, 69, 70, 71, 72, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 86, 87,
    88, 89,
  ].map((note) => ({note})),
};

describe('ORGAN_PRESETS', () => {
  it('offers the 20er-Drehorgel and the 31er-Drehorgel', () => {
    expect(ORGAN_PRESETS.map((preset) => preset.name)).toEqual(['20er-Drehorgel', '31er-Drehorgel']);
  });

  it.each(ORGAN_PRESETS)('$name describes a valid Organ', (preset) => {
    expect(validateOrgan(preset.draft).ok).toBe(true);
  });

  it.each([
    ['drehorgel-20er', 20, 110],
    ['drehorgel-31er', 31, 140],
  ] as const)('%s has %i Pipes on a %i mm Tape, lowest note first', (id, pipes, tapeWidth) => {
    const draft = organPreset(id)?.draft;
    if (!draft) throw new Error(`no preset ${id}`);
    const notes = draft.pipes.map((pipe) => pipe.note ?? 0);
    expect(notes).toHaveLength(pipes);
    expect(draft.tapeBed.tapeWidth).toBe(tapeWidth);
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
  });

  it('gives the 20er-Drehorgel the notes F3 to D6 (MIDI 53 to 86)', () => {
    const notes = organPreset('drehorgel-20er')?.draft.pipes.map((pipe) => pipe.note);
    expect([notes?.[0], notes?.at(-1)]).toEqual([53, 86]);
  });

  it.each([
    ['drehorgel-20er', 10, 8.5, 25.35],
    ['drehorgel-31er', 11, 9.75, 11.95],
  ] as const)('%s starts with a Guide margin of %d mm: guide side %d mm, far side %d mm', (id, guideMargin, guide, far) => {
    const draft = organPreset(id)?.draft;
    if (!draft) throw new Error(`no preset ${id}`);
    const organ = validateOrgan(draft);
    if (!organ.ok) throw new Error(`invalid preset ${id}`);

    expect(draft.tapeBed.guideMargin).toBe(guideMargin);
    expect(borders(organ.value).guide).toBeCloseTo(guide, 9);
    expect(borders(organ.value).far).toBeCloseTo(far, 9);
  });

  it.each([
    ['drehorgel-20er', DREHORGEL_20ER_DRAFT],
    ['drehorgel-31er', DREHORGEL_31ER_DRAFT],
  ] as const)('%s draft matches the MIDIBoek gamma file measures', (id, expected) => {
    expect(organPreset(id)?.draft).toEqual(expected);
  });
});

describe('organPreset', () => {
  it('finds a preset by its id', () => {
    const [first] = ORGAN_PRESETS;
    expect(organPreset(first.id)).toBe(first);
  });

  it('is undefined for an unknown id', () => {
    expect(organPreset('nope')).toBeUndefined();
  });
});
