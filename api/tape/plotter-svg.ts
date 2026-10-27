import {laneGeometry, type SideBySideCut} from './side-by-side-cut';
import type {Slot, TapeOutline} from './tape-geometry';
import type {CutGeometry} from './tape-piece-geometry';

const STROKE = 'fill="none" stroke="#000000" stroke-width="0.1"/>';

/** A plain decimal rounded to 0.001 without trailing zeros. */
function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return (rounded === 0 ? 0 : rounded).toFixed(3).replace(/\.?0+$/, '');
}

function holePath(slot: Slot): string {
  const r = Math.min(slot.radius, slot.width / 2);
  const left = num(slot.x + r);
  const right = num(slot.x + slot.width - r);
  const top = num(slot.y);
  const bottom = num(slot.y + slot.height);
  const arc = `A${num(r)},${num(r)} 0 0 1`;
  return `  <path d="M${left},${top} H${right} ${arc} ${right},${bottom} H${left} ${arc} ${left},${top} Z" ${STROKE}`;
}

function outlinePath(outline: TapeOutline): string {
  return (
    `  <path d="M${num(outline.tip.x)},${num(outline.tip.y)} H${num(outline.topEnd.x)} ` +
    `V${num(outline.bottomEnd.y)} H${num(outline.columnOneBottom.x)} Z" ${STROKE}`
  );
}

/** The cut lines of one Tape: its Holes in `slots` order, then its Tape Outline. */
function cutLines(geometry: CutGeometry): readonly string[] {
  return [...geometry.slots.map(holePath), outlinePath(geometry.outline)];
}

/** An SVG document in mm of `length` × `width`, with the given cut lines between its root and its end. */
function svgDocument(length: number, width: number, lines: readonly string[]): string {
  const w = num(length);
  const h = num(width);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`,
    ...lines,
    '</svg>',
    '',
  ].join('\n');
}

/** The cut lines of a Tape as an SVG in millimetres: Holes in `slots` order, the Tape Outline last. */
export function plotterSvg(geometry: CutGeometry): string {
  return svgDocument(geometry.totalLength, geometry.width, cutLines(geometry));
}

/** The cut lines of several Lanes as one SVG: Lane by Lane, each Lane's Holes then its Tape Outline (FR-011). */
export function sideBySideSvg(cut: SideBySideCut): string {
  return svgDocument(
    cut.length,
    cut.usedWidth,
    cut.lanes.flatMap((lane) => cutLines(laneGeometry(lane))),
  );
}
