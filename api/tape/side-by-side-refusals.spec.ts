import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import type {RollPlotter} from '../plotter/plotter';
import {sideBySideRefusals} from './side-by-side-refusals';
import {column, columnCount, type Tape, type TapeId} from './tape';
import {plotterOf, referenceOrgan, referenceTape, tapeOf} from './tape-fixture';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

/** The roll Plotter of the spec, a Vinyl cutter with 3 mm Tape spacing. */
function rollPlotter(workingWidth: number): RollPlotter {
  const plotter = plotterOf({
    name: 'Vinyl cutter',
    workingWidth,
    roll: true,
    workingLength: null,
    overlap: null,
    tapeSpacing: 3,
  });
  if (plotter.roll !== true) throw new Error('invalid test Plotter: not a roll Plotter');
  return plotter;
}

/** The Organ of the Waltz: 60 mm tape width, with the Pipes of the reference Organ. */
function barrelOrgan(): Organ {
  const result = validateOrgan({
    name: 'Barrel piano',
    tapeBed: {tapeWidth: 60, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: Array.from({length: 10}, (_, row) => ({note: 60 + row})),
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

const street = referenceOrgan();
const barrel = barrelOrgan();

/** The reference Tape, 100 mm Organ, 652 mm long. */
const reference = referenceTape(street);

/** A 60 mm Tape named Waltz, with the Holes of the reference Tape and no Cutting Problem. */
const waltz: Tape = tapeOf({
  ...referenceTape(barrel),
  id: '00000000-0000-4000-8000-0000000000bb' as TapeId,
  name: 'Waltz',
});

/** The Waltz with one Hole on a note the Organ has no Pipe for: one Cutting Problem. */
const waltzWithoutPipe: Tape = tapeOf({
  ...waltz,
  holes: [
    ...waltz.holes,
    {pipe: note(70), start: defined(column(0), 'start'), length: defined(columnCount(3), 'length')},
  ],
});

/** The Cutting Problem of the Hole on note 70 at Column 0, counted from 0. */
const noPipeOfWaltz = [{code: 'no-pipe', pipe: note(70), start: 0}];

describe('sideBySideRefusals', () => {
  it('is empty for a cut that can be saved: Lanes with Organs, within the working width, no Cutting Problem', () => {
    const lanes = [
      {tape: reference, organ: street},
      {tape: waltz, organ: barrel},
    ];

    expect(sideBySideRefusals(lanes, rollPlotter(300))).toEqual([]);
  });

  it('adds no no-join stretch on a roll Plotter, though the Tape is 652 mm long and the working width is 300 mm', () => {
    expect(sideBySideRefusals([{tape: reference, organ: street}], rollPlotter(300))).toEqual([]);
  });

  it('accepts Lanes that end exactly at the working width', () => {
    const lanes = [
      {tape: reference, organ: street},
      {tape: reference, organ: street},
    ];

    expect(sideBySideRefusals(lanes, rollPlotter(203))).toEqual([]);
  });

  it('refuses without a roll Plotter', () => {
    const lanes = [
      {tape: reference, organ: street},
      {tape: waltz, organ: barrel},
    ];

    expect(sideBySideRefusals(lanes, undefined)).toEqual([{code: 'no-plotter'}]);
  });

  it('refuses without Lanes', () => {
    expect(sideBySideRefusals([], rollPlotter(300))).toEqual([{code: 'no-lane'}]);
  });

  it('names the Lane and its Tape when the Organ of the Tape is missing', () => {
    expect(sideBySideRefusals([{tape: reference, organ: undefined}], rollPlotter(300))).toEqual([
      {code: 'no-organ', lane: 1, tapeName: 'Reference'},
    ]);
  });

  it('names the Lane past the working width with the width it needs and the width free before it', () => {
    const lanes = [
      {tape: reference, organ: street},
      {tape: waltz, organ: barrel},
    ];

    expect(sideBySideRefusals(lanes, rollPlotter(150))).toEqual([
      {code: 'lane-does-not-fit', lane: 2, tapeName: 'Waltz', needed: 63, free: 50},
    ]);
  });

  it('names the Tape with its Cutting Problems once, even when the Tape is in several Lanes', () => {
    const lanes = [
      {tape: waltzWithoutPipe, organ: barrel},
      {tape: waltzWithoutPipe, organ: barrel},
    ];

    expect(sideBySideRefusals(lanes, rollPlotter(300))).toEqual([
      {code: 'cutting-problems', tapeName: 'Waltz', problems: noPipeOfWaltz},
    ]);
  });

  it('lists no-organ by Lane before the Cutting Problems, although the Tape with the problem is the first Lane', () => {
    const lanes = [
      {tape: waltzWithoutPipe, organ: barrel},
      {tape: reference, organ: undefined},
    ];

    expect(sideBySideRefusals(lanes, rollPlotter(300))).toEqual([
      {code: 'no-organ', lane: 2, tapeName: 'Reference'},
      {code: 'cutting-problems', tapeName: 'Waltz', problems: noPipeOfWaltz},
    ]);
  });

  it('lists no-plotter first, then the other reasons', () => {
    const lanes = [
      {tape: waltzWithoutPipe, organ: barrel},
      {tape: reference, organ: undefined},
    ];

    expect(sideBySideRefusals(lanes, undefined)).toEqual([
      {code: 'no-plotter'},
      {code: 'no-organ', lane: 2, tapeName: 'Reference'},
      {code: 'cutting-problems', tapeName: 'Waltz', problems: noPipeOfWaltz},
    ]);
  });
});
