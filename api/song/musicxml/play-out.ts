import type {MeasureMarks} from './score-measures';

/**
 * The most times each measure of a Score is played out. The played order has at most this many measures per
 * measure of the Score, so that marks the rules below do not foresee still end (research R7).
 */
const MAXIMUM_PLAYS_PER_MEASURE = 64;

/**
 * The measures of a Score in the order they are played, as indexes into the marks given (research R7).
 *
 * A backward repeat jumps back to the latest forward repeat, or to the start, until its measure has been played
 * `times` times in all. An ending is played on the passes its numbers name. After a D.C. or D.S. jump, which is
 * taken once, backward repeats are not taken again, of a group of endings only the last is played, and To Coda
 * jumps to the Coda; Fine and the Coda end the Song. A D.S. with no segno, or a To Coda with no Coda, is ignored.
 * Never throws.
 */
export function playOut(marks: readonly MeasureMarks[]): number[] {
  const count = marks.length;
  const segno = marks.findIndex((measure) => measure.segno);
  const coda = marks.findIndex((measure) => measure.coda);
  const played: number[] = [];
  const repeatsTaken = new Map<number, number>();
  const budget = MAXIMUM_PLAYS_PER_MEASURE * count;
  let next = 0;
  let viaJump = false;
  let anchor = 0;
  let jumps = 0;
  let jumped = false;
  let toCodaTaken = false;

  while (next < count && played.length < budget) {
    const index = next;
    const measure = marks[index];
    if (measure === undefined) break;
    next = index + 1;
    if (measure.repeatForward && !viaJump) {
      anchor = index;
      jumps = 0;
    }
    viaJump = false;
    if (!endingPlays(marks, index, jumps + 1, jumped)) continue;

    played.push(index);
    if (toCodaTaken && index === coda) break;
    if (jumped && measure.fine) break;

    const backward = measure.repeatBackward;
    if (backward !== undefined && !jumped) {
      const taken = repeatsTaken.get(index) ?? 0;
      if (taken + 1 < backward.times) {
        repeatsTaken.set(index, taken + 1);
        jumps += 1;
        next = anchor;
        viaJump = true;
        continue;
      }
    }
    if (!jumped && (measure.daCapo || measure.dalSegno)) {
      const target = measure.daCapo ? 0 : segno;
      if (target >= 0) {
        jumped = true;
        next = target;
        viaJump = true;
        continue;
      }
    }
    if (measure.toCoda && jumped && coda >= 0) {
      toCodaTaken = true;
      next = coda;
      viaJump = true;
    }
  }
  return played;
}

/**
 * Whether the measure at `index` is played: on the pass its ending numbers name, or after a D.C. or D.S. jump, when
 * it is the last of its group of endings. A measure in no ending is always played.
 */
function endingPlays(marks: readonly MeasureMarks[], index: number, pass: number, jumped: boolean): boolean {
  const measure = marks[index];
  if (measure === undefined || measure.endings.length === 0) return true;
  if (!jumped) return measure.endings.includes(pass);
  const following = marks[index + 1];
  return following === undefined || following.endings.length === 0;
}
