/*
 * Expected API of api/song/musicxml/play-out.ts (T031), as these tests use it:
 *
 *   playOut(marks: readonly MeasureMarks[]): number[]
 *     marks: the marks of the measures of the first part, one entry per measure, in written order.
 *     Gives the indexes of the measures in played order (research R7). Pure: no XML, no Angular, no Node.
 *     Never throws. A guard of 64 passes per measure stops any loop the rules do not foresee.
 *
 *   MeasureMarks is the type of ScoreMeasure.marks in score-measures.ts (T029), defined here as the expected API:
 *     interface MeasureMarks {
 *       readonly repeatForward: boolean;                 // a forward repeat barline on the measure
 *       readonly repeatBackward: {readonly times: number} | undefined; // a backward repeat barline; times as written, 2 when none
 *       readonly endings: readonly number[];             // the ending numbers of the measure, [] when none
 *       readonly segno: boolean;
 *       readonly coda: boolean;
 *       readonly toCoda: boolean;
 *       readonly fine: boolean;
 *       readonly daCapo: boolean;
 *       readonly dalSegno: boolean;
 *     }
 *
 *   The rules (R7, User Story 2, Clarification Q1 A):
 *     - A backward repeat jumps to the latest forward repeat (or the start) until its measure has been played
 *       `times` times in all. An ending is played on the passes its numbers name (pass 1 is the first).
 *     - A D.C. (daCapo) or D.S. (dalSegno) jump goes to the start or the segno and is taken once.
 *     - After such a jump, backward repeats are not taken again, and of a group of endings only the last is played.
 *     - Fine ends the Song only when it is reached after a jump. To Coda jumps to the Coda only after a jump,
 *       and the Song ends at the Coda.
 *     - D.C. or D.S. without Fine plays to the end of the Score. To Coda without a Coda is ignored.
 */
import {describe, expect, it} from 'vitest';
import {playOut} from './play-out';
import type {MeasureMarks} from './score-measures';

const PLAIN: MeasureMarks = {
  repeatForward: false,
  repeatBackward: undefined,
  endings: [],
  segno: false,
  coda: false,
  toCoda: false,
  fine: false,
  daCapo: false,
  dalSegno: false,
};

/** The marks of a measure with the given marks; every other mark is absent. */
function marks(changes: Partial<MeasureMarks> = {}): MeasureMarks {
  return {...PLAIN, ...changes};
}

describe('playOut plays repeats out', () => {
  it('plays a repeated pair twice and then the measure after it', () => {
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 2}}),
      marks(),
    ]);

    expect(played).toEqual([0, 1, 0, 1, 2]);
  });

  it('plays the first ending on the first pass and the second ending on the second', () => {
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 2}, endings: [1]}),
      marks({endings: [2]}),
      marks(),
    ]);

    expect(played).toEqual([0, 1, 0, 2, 3]);
  });

  it('plays a repeat as many times as it is marked to be played', () => {
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 3}}),
      marks(),
    ]);

    expect(played).toEqual([0, 1, 0, 1, 0, 1, 2]);
  });

  it('repeats from the start when a backward repeat has no forward repeat before it', () => {
    const played = playOut([marks(), marks({repeatBackward: {times: 2}}), marks()]);

    expect(played).toEqual([0, 1, 0, 1, 2]);
  });
});

describe('playOut jumps for D.C. and D.S.', () => {
  it('continues from the start after D.C. and ends at Fine', () => {
    const played = playOut([marks(), marks({fine: true}), marks({daCapo: true})]);

    expect(played).toEqual([0, 1, 2, 0, 1]);
  });

  it('continues from the segno after D.S. and ends at Fine', () => {
    const played = playOut([
      marks(),
      marks({segno: true}),
      marks({fine: true}),
      marks({dalSegno: true}),
    ]);

    expect(played).toEqual([0, 1, 2, 3, 1, 2]);
  });

  it('jumps from To Coda to the Coda after D.C. and ends with the Coda', () => {
    const played = playOut([
      marks(),
      marks({toCoda: true}),
      marks({daCapo: true}),
      marks({coda: true}),
    ]);

    expect(played).toEqual([0, 1, 2, 0, 1, 3]);
  });

  it('jumps from To Coda to the Coda after D.S. and ends with the Coda', () => {
    const played = playOut([
      marks({segno: true}),
      marks({toCoda: true}),
      marks({dalSegno: true}),
      marks({coda: true}),
    ]);

    expect(played).toEqual([0, 1, 2, 0, 1, 3]);
  });

  it('takes no backward repeat after a D.C. jump', () => {
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 2}}),
      marks({daCapo: true}),
    ]);

    expect(played).toEqual([0, 1, 0, 1, 2, 0, 1, 2]);
  });

  it('plays only the last ending of a group after a D.C. jump', () => {
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 2}, endings: [1]}),
      marks({endings: [2], daCapo: true}),
    ]);

    expect(played).toEqual([0, 1, 0, 2, 0, 2]);
  });

  it('plays a D.C. without Fine to the end of the Score', () => {
    const played = playOut([marks(), marks({daCapo: true}), marks()]);

    expect(played).toEqual([0, 1, 0, 1, 2]);
  });

  it('ignores To Coda when the Score has no Coda', () => {
    const played = playOut([
      marks(),
      marks({toCoda: true}),
      marks({daCapo: true}),
      marks(),
    ]);

    expect(played).toEqual([0, 1, 2, 0, 1, 2, 3]);
  });
});

describe('playOut ends inconsistent marks in bounded passes', () => {
  it('ends nested repeats with a D.S. that has no segno in a bounded number of passes', () => {
    const measureCount = 4;
    const played = playOut([
      marks({repeatForward: true}),
      marks({repeatForward: true}),
      marks({repeatBackward: {times: 3}}),
      marks({repeatBackward: {times: 3}, dalSegno: true}),
    ]);

    expect(played.length).toBeLessThanOrEqual(64 * measureCount);
    expect(played.every((index: number) => Number.isInteger(index) && index >= 0 && index < measureCount)).toBe(true);
  });
});
