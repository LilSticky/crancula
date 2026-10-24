import {describe, expect, it} from 'vitest';
import {ORGAN_PRESETS, organPreset} from './organ-preset';
import {validateOrgan} from './validate-organ';

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
