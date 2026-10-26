import type {Slot} from './tape-geometry';
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

/** The cut lines of a Tape as an SVG in millimetres: Holes in `slots` order, the Tape Outline last. */
export function plotterSvg(geometry: CutGeometry): string {
  const {outline} = geometry;
  const width = num(geometry.totalLength);
  const height = num(geometry.width);
  const outlinePath =
    `  <path d="M${num(outline.tip.x)},${num(outline.tip.y)} H${num(outline.topEnd.x)} ` +
    `V${num(outline.bottomEnd.y)} H${num(outline.columnOneBottom.x)} Z" ${STROKE}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    ...geometry.slots.map(holePath),
    outlinePath,
    '</svg>',
    '',
  ].join('\n');
}
