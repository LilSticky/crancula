import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {column, columnCount} from './tape';
import {cuttingProblems} from './cutting-problems';
import {exportRefusals} from './export-refusals';
import {plotterOf, referenceOrgan, referencePlotter, referenceTape, tapeOf} from './tape-fixture';

function note(value: number): MidiNoteNumber {
  const result = midiNoteNumber(value);
  if (result === undefined) throw new Error(`invalid test note ${value}`);
  return result;
}

/** The reference Tape with one extra Hole on a note that has no Pipe on the reference Organ: one Cutting Problem. */
function tapeWithoutPipe() {
  const organ = referenceOrgan();
  const tape = referenceTape(organ);
  const start = column(0);
  const length = columnCount(3);
  if (start === undefined || length === undefined) throw new Error('invalid test Hole');
  return tapeOf({...tape, holes: [...tape.holes, {pipe: note(70), start, length}]});
}

/** The reference Plotter, narrower than the 100 mm Tape of the reference Organ. */
const NARROW_PLOTTER = plotterOf({name: 'Narrow mat', workingWidth: 90, roll: false, workingLength: 300, overlap: 20, tapeSpacing: 3});

describe('exportRefusals', () => {
  it('is empty for a Tape that can be cut on the Plotter', () => {
    const organ = referenceOrgan();
    const tape = tapeOf({...referenceTape(organ), holes: []});
    expect(exportRefusals(tape, organ, referencePlotter())).toEqual([]);
  });

  it('lists the Cutting Problems alone when there is no Plotter', () => {
    const organ = referenceOrgan();
    const tape = tapeWithoutPipe();
    const problems = cuttingProblems(tape, organ);

    expect(problems.length).toBeGreaterThan(0);
    expect(exportRefusals(tape, organ, undefined)).toEqual(problems);
  });

  it('lists too wide first, then the Cutting Problems of the Plotter', () => {
    const organ = referenceOrgan();
    const tape = tapeWithoutPipe();
    const problems = cuttingProblems(tape, organ, NARROW_PLOTTER);

    expect(problems.length).toBeGreaterThan(0);
    expect(exportRefusals(tape, organ, NARROW_PLOTTER)).toEqual([{code: 'too-wide'}, ...problems]);
  });

  it('lists only too wide for a Tape that is too wide and has no Cutting Problem', () => {
    const organ = referenceOrgan();
    expect(exportRefusals(referenceTape(organ), organ, NARROW_PLOTTER)).toEqual([{code: 'too-wide'}]);
  });
});
