import {type Organ, type OrganDraft, validateOrgan} from '@api/index';

/** A valid Organ for tests: 2.5 mm holes, 3.5 mm rows, notes 60, 62, … */
export function testOrgan(name: string, pipeCount = 2, overrides: Partial<OrganDraft> = {}): Organ {
  const result = validateOrgan({
    name,
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    leadIn: 20,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: Array.from({length: pipeCount}, (_, row) => ({note: 60 + 2 * row})),
    ...overrides,
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}
