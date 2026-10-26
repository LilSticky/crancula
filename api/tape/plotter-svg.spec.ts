import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {plotterSvg} from './plotter-svg';
import {type Column, type ColumnCount, type Hole, type Tape} from './tape';
import {referenceOrgan, referencePlotter, referenceTape, tapeOf} from './tape-fixture';
import {tapeGeometry, type Slot, type TapeGeometry} from './tape-geometry';
import {pieceGeometry, type CutGeometry} from './tape-piece-geometry';
import {tapePieces} from './tape-pieces';

const STROKE = 'fill="none" stroke="#000000" stroke-width="0.1"/>';

function slot(overrides: Partial<Slot>): Slot {
  return {row: 1, start: 0, x: 50, y: 30.5, width: 11, height: 3, radius: 1.5, ...overrides};
}

/** Scenario 1.4: Lead-in 50 mm, 600 mm of Columns, 2 mm end gap, 100 mm wide. */
function geometryOf(slots: readonly Slot[], leadIn = 50): TapeGeometry {
  const totalLength = leadIn + 600 + 2;
  return {
    leadIn,
    columnLength: 2.5,
    length: 600,
    endGap: 2,
    totalLength,
    width: 100,
    border: 5,
    rowCentres: [],
    slots,
    outline: {
      tip: {x: 0, y: 0},
      topEnd: {x: totalLength, y: 0},
      bottomEnd: {x: totalLength, y: 100},
      columnOneBottom: {x: leadIn, y: 100},
    },
  };
}

function lines(svg: string): readonly string[] {
  return svg.split('\n').filter((line) => line !== '');
}

function paths(svg: string): readonly string[] {
  return lines(svg).filter((line) => line.trim().startsWith('<path'));
}

describe('plotterSvg', () => {
  it('starts with the XML declaration and a root in mm that matches the viewBox', () => {
    const svg = plotterSvg(geometryOf([]));
    const [declaration, root] = lines(svg);

    expect(declaration).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    expect(root).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="652mm" height="100mm" viewBox="0 0 652 100">',
    );
    expect(lines(svg).at(-1)).toBe('</svg>');
  });

  it('writes a Hole as a closed stroke-only path with half-circle ends', () => {
    const svg = plotterSvg(geometryOf([slot({})]));

    expect(paths(svg)[0]?.trim()).toBe(
      `<path d="M51.5,30.5 H59.5 A1.5,1.5 0 0 1 59.5,33.5 H51.5 A1.5,1.5 0 0 1 51.5,30.5 Z" ${STROKE}`,
    );
  });

  it('writes the Tape Outline last, closing along the Lead-in diagonal', () => {
    const svg = plotterSvg(geometryOf([slot({})]));

    expect(paths(svg).at(-1)?.trim()).toBe(`<path d="M0,0 H652 V100 H50 Z" ${STROKE}`);
    expect(lines(svg).at(-2)?.trim()).toBe(paths(svg).at(-1)?.trim());
  });

  it('writes a square outline for a Lead-in of 0', () => {
    const svg = plotterSvg(geometryOf([], 0));

    expect(paths(svg).at(-1)?.trim()).toBe(`<path d="M0,0 H602 V100 H0 Z" ${STROKE}`);
  });

  it('writes a Hole exactly one hole diameter long as two arcs', () => {
    const svg = plotterSvg(geometryOf([slot({width: 3})]));

    expect(paths(svg)[0]?.trim()).toBe(
      `<path d="M51.5,30.5 H51.5 A1.5,1.5 0 0 1 51.5,33.5 H51.5 A1.5,1.5 0 0 1 51.5,30.5 Z" ${STROKE}`,
    );
  });

  it('clamps the radius to half the Hole length so a short Hole stays total', () => {
    const svg = plotterSvg(geometryOf([slot({width: 2})]));

    expect(paths(svg)[0]?.trim()).toBe(
      `<path d="M51,30.5 H51 A1,1 0 0 1 51,33.5 H51 A1,1 0 0 1 51,30.5 Z" ${STROKE}`,
    );
  });

  it('prints numbers as plain decimals rounded to 0.001 without trailing zeros', () => {
    const svg = plotterSvg(
      geometryOf([slot({x: 10 / 3, y: 0.0004, width: 12, height: 3, radius: 1.5})]),
    );

    const d = paths(svg)[0] ?? '';
    expect(d).toContain('M4.833,0 H');
    expect(d).not.toMatch(/e[+-]?\d/i);
    expect(d).not.toMatch(/\d\.\d*0[ ,"]/);
  });

  it('writes one path per Slot in slots order, then the Outline', () => {
    const slots = [slot({x: 50, y: 10}), slot({x: 80, y: 20}), slot({x: 65, y: 5})];
    const svg = plotterSvg(geometryOf(slots));

    const starts = paths(svg).map((line) => /d="M([^ ]+)/.exec(line)?.[1]);
    expect(starts).toEqual(['51.5,10', '81.5,20', '66.5,5', '0,0']);
  });

  it('cuts the Holes of a Tape by start from the Lead-in, row 1 first at the same start, then the Outline', () => {
    const organ = validateOrgan({
      name: 'Street organ',
      tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      leadIn: 20,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes: [{note: 60}, {note: 62}, {note: 64}],
    });
    if (!organ.ok) throw new Error('invalid test Organ');
    const hole = (pipe: number, start: number): Hole => {
      const note = midiNoteNumber(pipe);
      if (note === undefined) throw new Error('not a note');
      return {pipe: note, start: start as Column, length: 3 as ColumnCount};
    };
    // Stored by Pipe (row 1, 2, 3), then start.
    const tape = tapeOf({
      id: '00000000-0000-4000-8000-000000000003' as Tape['id'],
      name: 'Rows',
      organId: organ.value.id,
      songId: undefined,
      selectedParts: undefined,
      transposition: 0 as Tape['transposition'],
      columnLength: 2.5 as Millimetres,
      length: 100 as ColumnCount,
      holes: [hole(60, 10), hole(62, 0), hole(62, 10), hole(64, 5)],
    });

    const svg = plotterSvg(tapeGeometry(tape, organ.value));

    // x = 20 + start × 2.5, + 1.25 radius; y = 6.25-ish border + (row − 1) × 3.5.
    const starts = paths(svg).map((line) => /d="M([\d.]+),([\d.]+)/.exec(line)?.slice(1, 3).map(Number));
    expect(starts.map((point) => point?.[0])).toEqual([21.25, 33.75, 46.25, 46.25, 0]);
    const rowOneY = starts[2]?.[1] ?? 0;
    const rowTwoY = starts[3]?.[1] ?? 0;
    expect(rowOneY).toBeLessThan(rowTwoY);
  });

  it('writes only the Outline for a Tape without Holes', () => {
    const svg = plotterSvg(geometryOf([]));

    expect(paths(svg)).toHaveLength(1);
  });

  it('writes only cuts: no rect, text, group, id, metadata, title, style or transform', () => {
    const svg = plotterSvg(geometryOf([slot({}), slot({x: 80})]));
    const body = lines(svg).slice(2, -1);

    expect(body.every((line) => line.trim().startsWith('<path '))).toBe(true);
    expect(body.every((line) => line.includes('fill="none"'))).toBe(true);
    for (const forbidden of ['<rect', '<text', '<g', 'id=', '<metadata', '<title', 'style', 'transform']) {
      expect(svg).not.toContain(forbidden);
    }
  });

  it('is UTF-8 text without BOM, with \\n line endings, one element per line', () => {
    const svg = plotterSvg(geometryOf([slot({})]));

    expect(svg.charCodeAt(0)).toBe('<'.charCodeAt(0));
    expect(svg).not.toContain('\r');
    expect(lines(svg)).toHaveLength(2 + 1 + 1 + 1);
  });

  it('never writes the name of the Tape', () => {
    const organ = validateOrgan({
      name: 'Street organ',
      tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      leadIn: 20,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes: [{note: 60}, {note: 62}],
    });
    if (!organ.ok) throw new Error('invalid test Organ');
    const note = midiNoteNumber(60);
    if (note === undefined) throw new Error('not a note');
    const tape = tapeOf({
      id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
      name: 'Secret Waltz',
      organId: organ.value.id,
      songId: undefined,
      selectedParts: undefined,
      transposition: 0 as Tape['transposition'],
      columnLength: 2.5 as Millimetres,
      length: 100 as ColumnCount,
      holes: [{pipe: note, start: 0 as Column, length: 3 as ColumnCount}],
    });

    const svg = plotterSvg(tapeGeometry(tape, organ.value));

    expect(svg).not.toContain('Secret');
    expect(paths(svg)).toHaveLength(2);
  });

  it('writes a CutGeometry built by hand as the same SVG, without a Tape', () => {
    const geometry: CutGeometry = {
      totalLength: 60,
      width: 20,
      slots: [slot({x: 10, y: 5, width: 6, height: 3, radius: 1.5})],
      outline: {
        tip: {x: 0, y: 0},
        topEnd: {x: 60, y: 0},
        bottomEnd: {x: 60, y: 20},
        columnOneBottom: {x: 0, y: 20},
      },
    };

    expect(plotterSvg(geometry)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="60mm" height="20mm" viewBox="0 0 60 20">',
        `  <path d="M11.5,5 H14.5 A1.5,1.5 0 0 1 14.5,8 H11.5 A1.5,1.5 0 0 1 11.5,5 Z" ${STROKE}`,
        `  <path d="M0,0 H60 V20 H0 Z" ${STROKE}`,
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('writes only cuts for every Tape piece of a cut Tape, as for the whole Tape (FR-023)', () => {
    const organ = referenceOrgan();
    const rowOne = midiNoteNumber(60);
    const rowThree = midiNoteNumber(62);
    if (rowOne === undefined || rowThree === undefined) throw new Error('not a note');
    const tape = tapeOf({
      id: '00000000-0000-4000-8000-0000000000ee' as Tape['id'],
      name: 'Waltz',
      organId: organ.id,
      songId: undefined,
      selectedParts: undefined,
      transposition: 0 as Tape['transposition'],
      columnLength: 3 as Millimetres,
      length: 200 as ColumnCount,
      holes: [
        {pipe: rowOne, start: 80 as Column, length: 2 as ColumnCount},
        {pipe: rowThree, start: 150 as Column, length: 2 as ColumnCount},
      ],
    });
    const geometry = tapeGeometry(tape, organ);
    const cut = tapePieces(geometry, referencePlotter());
    if (cut.kind !== 'pieces') throw new Error(`expected Tape pieces, got ${cut.kind}`);
    expect(cut.pieces.length).toBeGreaterThan(1);

    for (const piece of cut.pieces) {
      const svg = plotterSvg(pieceGeometry(geometry, piece));
      const body = lines(svg).slice(2, -1);

      expect(body.length).toBeGreaterThan(0);
      expect(body.every((line) => line.trim().startsWith('<path ') && line.includes('fill="none"'))).toBe(true);
      for (const forbidden of ['<rect', '<text', '<g', 'id=', '<metadata', '<title', 'style', 'transform']) {
        expect(svg).not.toContain(forbidden);
      }
    }
  });

  it('writes a Tape piece at its length in mm, its Holes first and then its own outline (scenarios 3, 7)', () => {
    const organ = referenceOrgan();
    const note = midiNoteNumber(60);
    if (note === undefined) throw new Error('not a note');
    // Row 1 at x 290 mm: inside the Overlap of the first Tape piece, which ends at 298 mm.
    const tape = tapeOf({
      id: '00000000-0000-4000-8000-0000000000dd' as Tape['id'],
      name: 'Waltz',
      organId: organ.id,
      songId: undefined,
      selectedParts: undefined,
      transposition: 0 as Tape['transposition'],
      columnLength: 3 as Millimetres,
      length: 200 as ColumnCount,
      holes: [{pipe: note, start: 80 as Column, length: 2 as ColumnCount}],
    });
    const geometry = tapeGeometry(tape, organ);
    const cut = tapePieces(geometry, referencePlotter());
    if (cut.kind !== 'pieces') throw new Error('expected Tape pieces');
    const first = cut.pieces[0];
    if (first === undefined) throw new Error('expected a first Tape piece');

    const svg = plotterSvg(pieceGeometry(geometry, first));

    expect(lines(svg)[1]).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="298mm" height="100mm" viewBox="0 0 298 100">',
    );
    expect(paths(svg)).toHaveLength(2);
    expect(paths(svg)[0]?.trim()).toMatch(/^<path d="M291\.5,/);
    expect(paths(svg).at(-1)?.trim()).toBe(`<path d="M0,0 H298 V100 H50 Z" ${STROKE}`);
  });

  it('writes the reference Tape byte-identical to the fixture recorded from today writer (SC-007)', () => {
    const fixture = readFileSync(new URL('./plotter-svg.reference.svg', import.meta.url), 'utf8');
    const organ = referenceOrgan();

    expect(plotterSvg(tapeGeometry(referenceTape(organ), organ))).toBe(fixture);
  });

  it('writes a generated 10-minute Tape in under 5 s as one string (SC-005)', () => {
    const pipes = Array.from({length: 31}, (_, row) => ({note: 40 + row}));
    const organ = validateOrgan({
      name: 'Big',
      tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
      minimumGap: 1.5,
      leadIn: 20,
      slowestCrankSpeed: 30,
      fastestCrankSpeed: 120,
      tapePerCrankTurn: null,
      pipes,
    });
    if (!organ.ok) throw new Error('invalid test Organ');
    const holes: Hole[] = [];
    for (let start = 0; start + 3 <= 20000; start += 5) {
      const note = midiNoteNumber(40 + (start / 5) % 31);
      if (note === undefined) throw new Error('not a note');
      holes.push({pipe: note, start: start as Column, length: 3 as ColumnCount});
    }
    holes.sort((a, b) => a.pipe - b.pipe || a.start - b.start);
    const tape = tapeOf({
      id: '00000000-0000-4000-8000-000000000002' as Tape['id'],
      name: 'Long',
      organId: organ.value.id,
      songId: undefined,
      selectedParts: undefined,
      transposition: 0 as Tape['transposition'],
      columnLength: 2.5 as Millimetres,
      length: 20000 as ColumnCount,
      holes,
    });

    const began = performance.now();
    const svg = plotterSvg(tapeGeometry(tape, organ.value));
    const elapsed = performance.now() - began;

    expect(typeof svg).toBe('string');
    expect(paths(svg)).toHaveLength(holes.length + 1);
    expect(elapsed).toBeLessThan(5000);
  });
});
