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
 * The 20er-Drehorgel (Carl Frei scale, F-based): F3 to D6 on a 110 mm Tape. Notes, Tape width, 3 mm holes, 3.85 mm
 * row spacing and the 70 mm/s roll speed come from Wally Venable's MIDIBoek gamma file Annotated-20-Raffin.gam. That
 * file puts the rows off-centre (10 mm guide side, 26.9 mm off-side margin to the row centres), so the Guide margin is
 * 10 mm (#163). Minimum Gap 3 mm is a forum rule of thumb, Lead-in and
 * the Crank values are guesses, and Tape per Crank turn 70 mm assumes 60 turns/min at 70 mm/s (issue #162).
 */
const DREHORGEL_20ER: OrganPreset = {
  id: 'drehorgel-20er',
  name: '20er-Drehorgel',
  draft: {
    name: '20er-Drehorgel',
    tapeBed: {tapeWidth: 110, holeDiameter: 3, rowSpacing: 3.85, guideMargin: 10},
    minimumGap: 3,
    leadIn: 30,
    slowestCrankSpeed: 40,
    fastestCrankSpeed: 90,
    tapePerCrankTurn: 70,
    pipes: [53, 58, 60, 62, 63, 64, 65, 67, 69, 70, 72, 74, 75, 76, 77, 79, 81, 82, 84, 86].map((note) => ({note})),
  },
};

/**
 * The 31er-Drehorgel (Raffin scale) on a 140 mm Tape, bass rows first (operator side). Notes, Tape width, 2.5 mm holes
 * and 3.86 mm row spacing come from 31-raffin-wsv-arranging.gam in Wally Venable's MIDIBoek gamma files. The other
 * measures are guesses, as for the 20er (issue #162).
 */
const DREHORGEL_31ER: OrganPreset = {
  id: 'drehorgel-31er',
  name: '31er-Drehorgel',
  draft: {
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
  },
};

export const ORGAN_PRESETS: readonly OrganPreset[] = [DREHORGEL_20ER, DREHORGEL_31ER];

export function organPreset(id: string): OrganPreset | undefined {
  return ORGAN_PRESETS.find((preset) => preset.id === id);
}
