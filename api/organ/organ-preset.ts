import {DEFAULT_CRANK_SPEED_RANGE} from './crank-speed-range';
import type {OrganDraft} from './organ-draft';

/** A ready-made Organ (German: Vorlage) the user starts from; a starting point, not an Organ of the library. */
export interface OrganPreset {
  readonly id: string;
  /** A proper name, the same in every language. */
  readonly name: string;
  /** Without an id: the Organ gets one when it is stored. */
  readonly draft: OrganDraft;
}

/**
 * The 20er-Drehorgel (Carl Frei scale): F3 to D6 on a 110 mm Tape. The Tape width, the 3 mm holes, the 3.86 mm row
 * spacing and the 70 mm/s Tape speed come from builders' reports; the note list, Lead-in and Minimum Gap are
 * plausible guesses (issue #162), to be corrected by measuring a real Tape.
 */
const DREHORGEL_20ER: OrganPreset = {
  id: 'drehorgel-20er',
  name: '20er-Drehorgel',
  draft: {
    name: '20er-Drehorgel',
    tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.86},
    minimumGap: 3,
    leadIn: 30,
    slowestCrankSpeed: 40,
    fastestCrankSpeed: 90,
    tapePerCrankTurn: 70,
    pipes: [53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 83, 84, 86].map((note) => ({note})),
  },
};

/**
 * The 31er-Drehorgel (Raffin scale) on a 140 mm Tape. Only the Tape width and the number of Pipes are researched;
 * the notes (31 steps of the C major scale from C2) and the other measures are guesses (issue #162).
 */
const DREHORGEL_31ER: OrganPreset = {
  id: 'drehorgel-31er',
  name: '31er-Drehorgel',
  draft: {
    name: '31er-Drehorgel',
    tapeBed: {tapeWidth: 140, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 3,
    leadIn: 30,
    slowestCrankSpeed: DEFAULT_CRANK_SPEED_RANGE.slowest,
    fastestCrankSpeed: DEFAULT_CRANK_SPEED_RANGE.fastest,
    tapePerCrankTurn: 70,
    pipes: Array.from({length: 31}, (_, step) => ({note: 36 + 12 * Math.floor(step / 7) + [0, 2, 4, 5, 7, 9, 11][step % 7]})),
  },
};

export const ORGAN_PRESETS: readonly OrganPreset[] = [DREHORGEL_20ER, DREHORGEL_31ER];

export function organPreset(id: string): OrganPreset | undefined {
  return ORGAN_PRESETS.find((preset) => preset.id === id);
}
