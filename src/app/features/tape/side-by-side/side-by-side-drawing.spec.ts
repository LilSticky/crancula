import {describe, expect, it} from 'vitest';
import {
  laneGeometry,
  sideBySideCut,
  type Lane,
  type LaneTape,
  type RollPlotter,
  type SideBySideCut,
} from '@api/index';
import {plotterOf, referenceOrgan, referenceTape} from '../../../../../api/tape/tape-fixture';
import {pixelsPerMillimetre} from '../tape-view/pixels-per-millimetre';
import {rollDrawing} from './side-by-side-drawing';

/** The scale of a drawing at 1:1: true size on screen. */
const ONE_TO_ONE = pixelsPerMillimetre('1:1', 0, 0);
/** A small scale, as the Whole Tape zoom gives a long roll in a narrow window: 0.3 px per mm. */
const SMALL_SCALE = 0.3;
/** The smallest size on screen of a Lane number, in px. */
const READABLE_TEXT_PX = 12;

/** The Vinyl cutter of spec 013: a roll Plotter with working width 300 mm and Tape spacing 3 mm unless given. */
function rollPlotterOf(workingWidth = 300, tapeSpacing = 3): RollPlotter {
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

/** The reference Tape (100 mm wide) once per Lane: Lane 1 at 0 mm, Lane 2 at 103 mm, Lane 3 at 206 mm. */
function cutOf(count: number, plotter: RollPlotter = rollPlotterOf()): SideBySideCut {
  const organ = referenceOrgan();
  const tapes: LaneTape[] = Array.from({length: count}, () => ({tape: referenceTape(organ), organ}));
  return sideBySideCut(tapes, plotter);
}

function laneAt(cut: SideBySideCut, index: number): Lane {
  const lane = cut.lanes.at(index);
  if (lane === undefined) throw new Error(`no Lane at index ${index}`);
  return lane;
}

/** Every x,y pair written in an SVG path, in order. */
function pointsOf(path: string): [number, number][] {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [Number(x), Number(y)]);
}

describe('rollDrawing', () => {
  it('spans the Tape length and the working width in mm when the Lanes fit', () => {
    const cut = cutOf(2);

    expect(rollDrawing(cut, ONE_TO_ONE).viewBox).toBe(`0 0 ${cut.length} 300`);
  });

  it('grows the height to the used width when the Lanes pass the working width', () => {
    const cut = cutOf(3);

    expect(rollDrawing(cut, ONE_TO_ONE).viewBox).toBe(`0 0 ${cut.length} ${cut.usedWidth}`);
  });

  it('has one Lane drawing per Lane, in the order of the Lanes, with its number', () => {
    const drawing = rollDrawing(cutOf(3), ONE_TO_ONE);

    expect(drawing.lanes.map((lane) => lane.number)).toEqual([1, 2, 3]);
  });

  it('draws the Outline of each Lane through its moved corners', () => {
    const cut = cutOf(2);
    const second = laneAt(cut, 1);
    const corners = laneGeometry(second).outline;

    const outline = rollDrawing(cut, ONE_TO_ONE).lanes.at(1)?.outline ?? '';

    for (const corner of [corners.tip, corners.topEnd, corners.bottomEnd, corners.columnOneBottom]) {
      expect(pointsOf(outline)).toContainEqual([corner.x, corner.y]);
    }
  });

  it('draws the Holes of each Lane as one path of its moved Holes', () => {
    const cut = cutOf(2);
    const second = laneAt(cut, 1);
    const expected = laneGeometry(second)
      .slots.map((slot) => `M${slot.x},${slot.y}h${slot.width}v${slot.height}h${-slot.width}z`)
      .join('');

    expect(rollDrawing(cut, ONE_TO_ONE).lanes.at(1)?.holes).toBe(expected);
  });

  it('shows the free band from the used width to the working width', () => {
    const cut = cutOf(2);

    expect(rollDrawing(cut, ONE_TO_ONE).freeBand).toEqual({top: cut.usedWidth, bottom: 300});
  });

  it('has no free band when the Lanes fill the working width', () => {
    // Two Lanes of 100 mm with 3 mm spacing use 203 mm: a working width of exactly 203 mm leaves no free band.
    const cut = cutOf(2, rollPlotterOf(203));

    expect(rollDrawing(cut, ONE_TO_ONE).freeBand).toBeUndefined();
  });

  it('has no free band when the Lanes pass the working width', () => {
    expect(rollDrawing(cutOf(3), ONE_TO_ONE).freeBand).toBeUndefined();
  });

  it('shows the part past the working width from the working width to the used width when the Lanes pass it', () => {
    const cut = cutOf(3);

    expect(rollDrawing(cut, ONE_TO_ONE).overflowBand).toEqual({top: 300, bottom: cut.usedWidth});
  });

  it('has no part past the working width when the Lanes fit', () => {
    expect(rollDrawing(cutOf(2), ONE_TO_ONE).overflowBand).toBeUndefined();
  });

  it('places the working-width line at the working width', () => {
    expect(rollDrawing(cutOf(2), ONE_TO_ONE).workingWidthY).toBe(300);
  });

  it('keeps the Lane numbers at a readable size on screen when the drawing is small', () => {
    const drawing = rollDrawing(cutOf(2), SMALL_SCALE);

    expect(drawing.labelSize * SMALL_SCALE).toBeGreaterThanOrEqual(READABLE_TEXT_PX);
  });

  it('draws the overflow hatch at true size while the scale is not known yet, before the stage has a width', () => {
    const hatch = rollDrawing(cutOf(3), 0).hatchSize;

    expect(hatch).toBeGreaterThan(0);
    expect(hatch).toBe(rollDrawing(cutOf(3), ONE_TO_ONE).hatchSize);
  });

  it('flags the Lanes whose far edge passes the working width as overflow', () => {
    const drawing = rollDrawing(cutOf(3), ONE_TO_ONE);

    expect(drawing.lanes.map((lane) => lane.overflow)).toEqual([false, false, true]);
  });
});
