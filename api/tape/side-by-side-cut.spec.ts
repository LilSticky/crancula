import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import type {RollPlotter} from '../plotter/plotter';
import {plotterOf, referenceOrgan, referenceTape, tapeOf} from './tape-fixture';
import {type Column, type ColumnCount, type Hole, type Tape} from './tape';
import {laneGeometry, laneRoom, sideBySideCut, type Lane, type LaneTape} from './side-by-side-cut';
import {tapeGeometry} from './tape-geometry';

/** The Vinyl cutter of spec 013: a roll Plotter with working width 300 mm and Tape spacing 3 mm unless given. */
function rollPlotterOf(tapeSpacing = 3, workingWidth = 300): RollPlotter {
  const plotter = plotterOf({
    name: 'Vinyl cutter',
    workingWidth,
    roll: true,
    workingLength: null,
    overlap: null,
    tapeSpacing,
  });
  if (!plotter.roll) throw new Error('expected a roll Plotter');
  return plotter;
}

function organOf(name: string, tapeWidth: number, notes: readonly number[], leadIn: number): Organ {
  const result = validateOrgan({
    name,
    tapeBed: {tapeWidth, holeDiameter: 3, rowSpacing: 4, guideMargin: null},
    minimumGap: 2,
    leadIn,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: notes.map((note) => ({note})),
  });
  if (!result.ok) throw new Error(`invalid Organ ${name}`);
  return result.value;
}

function holeOf(note: number, start: number, length: number): Hole {
  const pipe = midiNoteNumber(note);
  if (pipe === undefined) throw new Error('not a note');
  return {pipe, start: start as Column, length: length as ColumnCount};
}

function tapeOn(
  id: string,
  name: string,
  organ: Organ,
  columnLength: number,
  length: number,
  holes: readonly Hole[],
): Tape {
  return tapeOf({
    id: id as Tape['id'],
    name,
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: columnLength as Millimetres,
    length: length as ColumnCount,
    holes,
  });
}

/** Organ A and the reference Tape: 100 mm wide, 652 mm long. */
function reference(): LaneTape {
  const organ = referenceOrgan();
  return {tape: referenceTape(organ), organ};
}

/** Organ B and "Waltz": 60 mm wide, 400 mm long (Lead-in 20 mm, 126 Columns of 3 mm, end gap 2 mm). */
function waltz(): LaneTape {
  const organ = organOf('Organ B', 60, [60, 62], 20);
  const tape = tapeOn('00000000-0000-4000-8000-0000000000b1', 'Waltz', organ, 3, 126, [
    holeOf(60, 10, 2),
    holeOf(62, 0, 3),
  ]);
  return {tape, organ};
}

/** A 320 mm wide Organ and its Tape, for a Tape wider than the Vinyl cutter's working width. */
function wideTape(): LaneTape {
  const organ = organOf('Organ wide', 320, [60], 50);
  return {tape: tapeOn('00000000-0000-4000-8000-0000000000c1', 'Wide', organ, 3, 10, []), organ};
}

/** A 94 mm wide Organ and its Tape: with the reference Tape twice and 3 mm spacings it makes exactly 300 mm. */
function narrowTape(): LaneTape {
  const organ = organOf('Organ narrow', 94, [60], 50);
  return {tape: tapeOn('00000000-0000-4000-8000-0000000000d1', 'Narrow', organ, 3, 10, []), organ};
}

/** Checks that a Lane's cut geometry is its Tape's own geometry moved down by the Lane's top edge (FR-010, SC-002). */
function expectCutAsOwnGeometryMovedBy(lane: Lane): void {
  const own = tapeGeometry(lane.tape, lane.organ);
  const cut = laneGeometry(lane);

  expect(cut.totalLength).toBe(own.totalLength);
  expect(cut.width).toBe(own.width);
  expect(cut.slots).toHaveLength(own.slots.length);
  own.slots.forEach((slot, index) => {
    const moved = cut.slots.at(index);
    expect(moved?.row).toBe(slot.row);
    expect(moved?.start).toBe(slot.start);
    expect(moved?.x).toBeCloseTo(slot.x, 9);
    expect(moved?.y).toBeCloseTo(slot.y + lane.top, 9);
    expect(moved?.width).toBe(slot.width);
    expect(moved?.height).toBe(slot.height);
    expect(moved?.radius).toBe(slot.radius);
  });
  expect(cut.outline.tip.x).toBe(0);
  expect(cut.outline.tip.y).toBeCloseTo(own.outline.tip.y + lane.top, 9);
  expect(cut.outline.topEnd.x).toBeCloseTo(own.outline.topEnd.x, 9);
  expect(cut.outline.topEnd.y).toBeCloseTo(own.outline.topEnd.y + lane.top, 9);
  expect(cut.outline.bottomEnd.x).toBeCloseTo(own.outline.bottomEnd.x, 9);
  expect(cut.outline.bottomEnd.y).toBeCloseTo(own.outline.bottomEnd.y + lane.top, 9);
  expect(cut.outline.columnOneBottom.x).toBeCloseTo(own.outline.columnOneBottom.x, 9);
  expect(cut.outline.columnOneBottom.y).toBeCloseTo(own.outline.columnOneBottom.y + lane.top, 9);
}

describe('sideBySideCut', () => {
  it('places the reference Tape at the top edge and Waltz at 103 mm, 1 and 2 numbered (Story 1 scenario 1)', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf());

    expect(cut.lanes.map((lane) => lane.number)).toEqual([1, 2]);
    expect(cut.lanes.map((lane) => lane.top)).toEqual([0, 103]);
    expect(cut.usedWidth).toBe(163);
    expect(cut.freeWidth).toBe(137);
    expect(cut.length).toBe(652);
  });

  it('has no Lanes, no used width and no length without Tapes', () => {
    const cut = sideBySideCut([], rollPlotterOf());

    expect(cut.lanes).toEqual([]);
    expect(cut.usedWidth).toBe(0);
    expect(cut.freeWidth).toBe(300);
    expect(cut.length).toBe(0);
  });

  it('places Lanes 5 mm apart with a Tape spacing of 5: Waltz from 105 to 165 mm', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf(5));
    const second = cut.lanes[1];

    expect(second?.top).toBe(105);
    expect(second ? second.top + second.geometry.width : undefined).toBe(165);
    expect(cut.usedWidth).toBe(165);
  });

  it('lets Lanes touch with a Tape spacing of 0', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf(0));

    expect(cut.lanes.map((lane) => lane.top)).toEqual([0, 100]);
  });

  it('cuts the same Tape twice as two Lanes (Story 2 scenario 3)', () => {
    const ref = reference();
    const cut = sideBySideCut([ref, ref], rollPlotterOf());

    expect(cut.lanes).toHaveLength(2);
    expect(cut.lanes.map((lane) => lane.tape.id)).toEqual([ref.tape.id, ref.tape.id]);
    expect(cut.lanes.map((lane) => lane.top)).toEqual([0, 103]);
  });
});

describe('laneGeometry', () => {
  it('is the Tape geometry moved down by the top edge of its Lane, the Lead-in tip at x 0 (FR-010, SC-002)', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf());

    cut.lanes.forEach(expectCutAsOwnGeometryMovedBy);
  });

  it('keeps the Lane 1 geometry at the top edge of the file', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf());
    const first = cut.lanes[0];
    if (first === undefined) throw new Error('expected Lane 1');

    expect(first.top).toBe(0);
    expect(laneGeometry(first)).toEqual(
      expect.objectContaining({totalLength: 652, width: 100, outline: expect.objectContaining({tip: {x: 0, y: 0}})}),
    );
  });

  it('puts neighbouring Outlines exactly one Tape spacing apart (SC-003)', () => {
    const cut = sideBySideCut([reference(), waltz(), reference()], rollPlotterOf(3));
    const [one, two, three] = cut.lanes.map((lane) => laneGeometry(lane).outline);
    if (one === undefined || two === undefined || three === undefined) throw new Error('expected three Lanes');

    expect(two.tip.y - one.bottomEnd.y).toBeCloseTo(3, 9);
    expect(three.tip.y - two.bottomEnd.y).toBeCloseTo(3, 9);
  });
});

describe('laneRoom', () => {
  it('leaves the whole working width free without Lanes: a Tape needs its own width', () => {
    const cut = sideBySideCut([], rollPlotterOf());

    expect(laneRoom(cut, 100 as Millimetres)).toEqual({fits: true, needed: 100, free: 300});
  });

  it('has 200 mm free after the reference Tape alone (Story 2 scenario 1)', () => {
    const cut = sideBySideCut([reference()], rollPlotterOf());

    expect(cut.freeWidth).toBe(200);
  });

  it('has 137 mm free after Waltz, and room for the reference Tape needing 103 mm (Story 2 scenario 2)', () => {
    const cut = sideBySideCut([reference(), waltz()], rollPlotterOf());

    expect(cut.freeWidth).toBe(137);
    expect(laneRoom(cut, 100 as Millimetres)).toEqual({fits: true, needed: 103, free: 137});
  });

  it('refuses a fourth Lane once only 34 mm are free (Story 2 scenario 2)', () => {
    const cut = sideBySideCut([reference(), waltz(), reference()], rollPlotterOf());

    expect(cut.freeWidth).toBe(34);
    expect(laneRoom(cut, 100 as Millimetres)).toEqual({fits: false, needed: 103, free: 34});
  });

  it('fits Lanes and spacings that add up to exactly the working width (edge case)', () => {
    const cut = sideBySideCut([reference(), reference(), narrowTape()], rollPlotterOf(3, 300));

    expect(cut.usedWidth).toBeCloseTo(300, 9);
    expect(Math.abs(cut.freeWidth)).toBeLessThan(1e-9);
    expect(cut.lanes.every((lane) => lane.fits)).toBe(true);
  });

  it('marks a 320 mm Tape as not fitting a 300 mm working width (Story 3 scenario 4)', () => {
    const cut = sideBySideCut([wideTape()], rollPlotterOf());

    expect(cut.lanes[0]?.fits).toBe(false);
    expect(laneRoom(sideBySideCut([], rollPlotterOf()), 320 as Millimetres)).toEqual({fits: false, needed: 320, free: 300});
  });

  it('on a 150 mm roll plotter fits the reference Tape, but not Waltz nor the Lanes after it (research R2)', () => {
    const cut = sideBySideCut([reference(), waltz(), reference()], rollPlotterOf(3, 150));

    expect(cut.lanes.map((lane) => lane.fits)).toEqual([true, false, false]);
    expect(cut.usedWidth).toBe(266);
    expect(cut.freeWidth).toBe(-116);
  });

  it('moves Waltz to Lane 1 and the reference Tape to 63 mm when Waltz is listed first (quickstart 7)', () => {
    const cut = sideBySideCut([waltz(), reference()], rollPlotterOf());

    expect(cut.lanes.map((lane) => lane.top)).toEqual([0, 63]);
    expect(cut.freeWidth).toBe(137);
  });
});
