import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {
  createTape,
  noteName,
  defaultSelectedParts,
  proposeTransposition,
  readMidiSong,
  type Organ,
  type Tape,
  toTapeLibrarySnapshot,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {asValidTape, type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {pixelsPerMillimetre} from './pixels-per-millimetre';
import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';
import {tapeGeometry} from './tape-geometry';
import {TapeViewComponent} from './tape-view.component';

/** The scale the Tape opens at: 1:1, true size on screen. */
const SCALE = pixelsPerMillimetre('1:1', 0, 0);

@Component({template: 'Tapes'})
class TapeListStubComponent {}

const TICKS_PER_QUARTER = 480;

interface RenderOptions {
  readonly deferLoad?: boolean;
  /** The Organ library holds no Organ for the Tape. */
  readonly organUnknown?: boolean;
  /** The Organ library holds this Organ (same id as the Tape's Organ) instead of the one the Tape was made for. */
  readonly organNow?: (original: Organ) => Organ;
  /** The Lead-in of the Organ in mm; the test Organ's default when not given. */
  readonly leadIn?: number;
  /** A Tape of 12000 Columns (5 minutes) with 9000 Holes instead of the short one. */
  readonly longTape?: boolean;
}

async function render(options: RenderOptions = {}) {
  const inMemory = createInMemoryCranculaApi();
  let finishLoad: () => void = () => undefined;
  let deferredSnapshot: ReturnType<typeof toTapeLibrarySnapshot> | null = null;
  const api = options.deferLoad
    ? {
        ...inMemory,
        tapes: {
          ...inMemory.tapes,
          load: () =>
            new Promise<Awaited<ReturnType<typeof inMemory.tapes.load>>>((resolve) => {
              finishLoad = () =>
                resolve(deferredSnapshot ? {status: 'loaded', snapshot: deferredSnapshot} : {status: 'empty'});
            }),
        },
      }
    : inMemory;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {path: 'tapes', component: TapeListStubComponent},
        {path: 'tapes/:id', component: TapeViewComponent},
      ]),
      provideTestTranslations(),
      {provide: CRANCULA_API, useValue: api},
    ],
  });
  const organ = testOrgan('Street organ', 3, options.leadIn === undefined ? {} : {leadIn: options.leadIn});
  const organs = TestBed.inject(OrganLibrary);
  await organs.put(organ);

  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {name: 'Lead', channel: 0},
      {name: 'Bass', channel: 1},
    ].map(({name, channel}) => ({
      events: [
        {delta: 0, event: {type: 'trackName' as const, text: name}},
        ...[61, 63, 65].flatMap((note) => [
          {delta: 0, event: {type: 'noteOn' as const, channel, note, velocity: 80}},
          {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel, note, velocity: 0}},
        ]),
      ],
    })),
  });
  const read = readMidiSong(bytes, 'melody.mid');
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const song = read.value;
  const selectedParts = new Set([...defaultSelectedParts(song)].slice(0, 1)); // The Bass is left off the Tape.
  const created = createTape({
    song,
    selectedParts,
    organ,
    transposition: proposeTransposition(song, selectedParts, organ),
    name: song.name,
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  const shortTape: Tape = created.value.tape;
  const tape: Tape = options.longTape
    ? asValidTape({
        ...shortTape,
        length: 12000 as ColumnCount,
        holes: Array.from({length: 3000}, (_, index) => index * 4).flatMap((start) =>
          organ.pipes.map(({note}) => ({pipe: note, start: start as Column, length: 2 as ColumnCount})),
        ),
      })
    : shortTape;
  const library = TestBed.inject(TapeLibrary);
  let loading: Promise<void> = Promise.resolve();
  if (options.deferLoad) {
    deferredSnapshot = toTapeLibrarySnapshot([tape], [song]);
    loading = library.load();
  } else {
    await library.load();
    await library.create(tape, song);
  }

  if (options.organUnknown) await organs.remove(organ.id);
  else if (options.organNow) await organs.put(options.organNow(organ));

  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const open = async (url: string, importSummary?: unknown) => {
    await router.navigateByUrl(url, importSummary ? {state: {importSummary}} : {});
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  const summaryShown = () => harness.routeNativeElement?.querySelector('[data-testid="import-summary"]') ?? null;
  const finish = async () => {
    finishLoad();
    await loading;
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  const view = () => harness.routeNativeElement;
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  return {tape, organ, importSummary: created.value.importSummary, open, summaryShown, router, finish, view, settle};
}

describe('TapeViewComponent', () => {
  it('titles the page with the Tape name in a page head', async () => {
    const {tape, open, view} = await render();

    await open(`/tapes/${tape.id}`);

    expect(view()?.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe(tape.name);
  });

  it('shows the Import Summary given as navigation state', async () => {
    const {tape, importSummary, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`, importSummary);

    expect(summaryShown()).not.toBeNull();
  });

  it('shows no Import Summary when opened without one', async () => {
    const {tape, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`);

    expect(summaryShown()).toBeNull();
  });

  it('redirects an unknown id to the Tape list', async () => {
    const {open, router} = await render();

    await open('/tapes/00000000-0000-0000-0000-000000000000');

    expect(router.url).toBe('/tapes');
  });

  it('does not redirect an existing Tape while the Tape library is still loading', async () => {
    const {tape, open, router, finish} = await render({deferLoad: true});

    await open(`/tapes/${tape.id}`);

    expect(router.url).toBe(`/tapes/${tape.id}`);
    await finish();
    expect(router.url).toBe(`/tapes/${tape.id}`);
  });

  it('redirects an unknown id to the Tape list only after loading', async () => {
    const {open, router, finish} = await render({deferLoad: true});

    await open('/tapes/00000000-0000-0000-0000-000000000000');
    expect(router.url).toBe('/tapes/00000000-0000-0000-0000-000000000000');

    await finish();
    expect(router.url).toBe('/tapes');
  });

  it('ignores an importSummary in the navigation state that has no Import Summary shape', async () => {
    const {tape, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`, {foo: 1});

    expect(summaryShown()).toBeNull();
  });

  describe('drawing the Tape (FR-018)', () => {
    const texts = (view: HTMLElement | null, testId: string) =>
      Array.from(view?.querySelectorAll(`[data-testid="${testId}"]`) ?? [], (element) => element.textContent?.trim());
    const numberAttribute = (element: Element, name: string) => Number(element.getAttribute(name));
    const all = (view: HTMLElement | null, selector: string) => Array.from(view?.querySelectorAll(selector) ?? []);
    const holeRects = (view: HTMLElement | null) => all(view, 'svg rect[data-testid="hole"]');

    it('labels one row per Pipe with its note name, in the Organ row order', async () => {
      const {tape, organ, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(texts(view(), 'row-label')).toEqual(organ.pipes.map(({note}) => noteName(note)));
    });

    it('draws the Tape body at true millimetres: Tape length wide, tape width high at 1:1 (no Lead-in)', async () => {
      const {tape, organ, open, view} = await render({leadIn: 0});

      await open(`/tapes/${tape.id}`);

      const body = view()?.querySelector('svg .tape');
      expect(body).not.toBeNull();
      expect(numberAttribute(body as Element, 'width')).toBeCloseTo(tape.length * tape.columnLength * SCALE, 1);
      expect(numberAttribute(body as Element, 'height')).toBeCloseTo(organ.tapeBed.tapeWidth * SCALE, 1);
    });

    it('draws each Hole as the slot of the geometry, scaled to pixels, with rounded ends', async () => {
      const {tape, organ, open, view} = await render({leadIn: 0});
      const {slots} = tapeGeometry(tape, organ);
      expect(slots.length).toBeGreaterThan(0);

      await open(`/tapes/${tape.id}`);

      const rects = holeRects(view());
      expect(rects).toHaveLength(slots.length);
      slots.forEach((slot, index) => {
        const rect = rects[index];
        expect(numberAttribute(rect, 'x')).toBeCloseTo(slot.x * SCALE, 1);
        expect(numberAttribute(rect, 'y')).toBeCloseTo(slot.y * SCALE, 1);
        expect(numberAttribute(rect, 'width')).toBeCloseTo(slot.width * SCALE, 1);
        expect(numberAttribute(rect, 'height')).toBeCloseTo(slot.height * SCALE, 1);
        expect(numberAttribute(rect, 'rx')).toBeCloseTo((slot.height * SCALE) / 2, 1);
        expect(numberAttribute(rect, 'ry')).toBeCloseTo((slot.height * SCALE) / 2, 1);
        expect(numberAttribute(rect, 'data-row')).toBe(slot.row - 1);
        expect(numberAttribute(rect, 'data-start')).toBe(slot.start);
      });
    });

    it('draws two Border lines, at the Border from each edge of the Tape', async () => {
      const {tape, organ, open, view} = await render({leadIn: 0});
      const {border, width} = tapeGeometry(tape, organ);

      await open(`/tapes/${tape.id}`);

      const lines = all(view(), 'svg [data-testid="border-line"]');
      const heights = lines.map((line) => numberAttribute(line, 'y1')).sort((a, b) => a - b);
      expect(heights).toHaveLength(2);
      expect(heights[0]).toBeCloseTo(border * SCALE, 1);
      expect(heights[1]).toBeCloseTo((width - border) * SCALE, 1);
    });

    it('draws no Lead-in and starts the Tape square at Column 1 when the Lead-in is 0', async () => {
      const {tape, open, view} = await render({leadIn: 0});

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('[data-testid="lead-in"]')).toBeNull();
      expect(numberAttribute(view()?.querySelector('svg .tape') as Element, 'x')).toBe(0);
    });

    it('draws the Lead-in as blank Tape before Column 1 with an angled start', async () => {
      const {tape, open, view} = await render({leadIn: 30});

      await open(`/tapes/${tape.id}`);

      const leadIn = view()?.querySelector('[data-testid="lead-in"]');
      expect(leadIn?.tagName.toLowerCase()).toBe('path');
      // `M slant,0 H end V height H 0 Z`: the top edge runs slant..end, the bottom edge 0..end.
      const [slant, , end, , start] = (leadIn?.getAttribute('d')?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(end).toBeCloseTo(30 * SCALE, 0);
      expect(start).toBe(0);
      expect(slant).toBeGreaterThan(0);
      expect((end ?? 0) - (slant ?? 0)).toBeLessThan((end ?? 0) - (start ?? 0));
      expect(leadIn?.querySelector('[data-testid="hole"]')).toBeNull();
    });

    it('moves every Hole and Column line right by the Lead-in, none lie in it', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const {slots} = tapeGeometry(tape, organ);

      await open(`/tapes/${tape.id}`);

      const rects = holeRects(view());
      expect(rects).toHaveLength(slots.length);
      slots.forEach((slot, index) => {
        expect(numberAttribute(rects[index], 'x')).toBeCloseTo((30 + slot.x) * SCALE, 1);
      });
      const marks = all(view(), 'svg [data-testid="column-mark"]').map((mark) => numberAttribute(mark, 'x1'));
      expect(marks.length).toBeGreaterThan(0);
      expect(Math.min(...marks)).toBeCloseTo(30 * SCALE, 1);
    });

    it('does not draw Holes of Pipes that are not on the Organ', async () => {
      const {tape, organ, open, view} = await render({
        organNow: (original) => ({...testOrgan(original.name, 2), id: original.id}),
      });
      const remaining = new Set(organ.pipes.slice(0, 2).map(({note}) => note));
      const kept = tape.holes.filter((hole) => remaining.has(hole.pipe));
      expect(kept.length).toBeLessThan(tape.holes.length);

      await open(`/tapes/${tape.id}`);

      expect(holeRects(view())).toHaveLength(kept.length);
    });

    it('marks every 8th Column with a line, strong at every 32nd', async () => {
      const {tape, open, view} = await render({leadIn: 0});
      expect(tape.length).toBeGreaterThan(16);

      await open(`/tapes/${tape.id}`);

      const marks = all(view(), 'svg [data-testid="column-mark"]');
      const expected = columnLines(tape.length);
      expect(marks).toHaveLength(expected.length);
      expected.forEach((line, index) => {
        const mark = marks[index];
        expect(numberAttribute(mark, 'x1')).toBeCloseTo(line.column * tape.columnLength * SCALE, 1);
        expect(mark.classList.contains('strong')).toBe(line.strong);
      });
    });

    it('numbers the Columns under the Tape: 1, 9, 17, …', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const expected = columnNumbers(tape.length, tape.columnLength * SCALE).map(({number}) => String(number));
      expect(expected.slice(0, 3)).toEqual(['1', '9', '17']);
      expect(texts(view(), 'column-number')).toEqual(expected);
    });

    it('puts a ruler on top of the Tape with a number every 10 mm from Column 1, 0 at its start', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const lengthMm = tapeGeometry(tape, organ).length;

      await open(`/tapes/${tape.id}`);

      const numbers = all(view(), 'svg [data-testid="ruler-number"]');
      const expected = rulerNumbers(lengthMm);
      expect(numbers.map((number) => number.textContent?.trim())).toEqual(expected.map(String));
      expected.forEach((mm, index) => {
        expect(numberAttribute(numbers[index], 'x')).toBeCloseTo((30 + mm) * SCALE, 0);
      });
    });

    it('lets the scroll container cover the whole Tape length, Lead-in included', async () => {
      const {tape, open, view} = await render({leadIn: 30});

      await open(`/tapes/${tape.id}`);

      const drawing = view()?.querySelector('[data-testid="tape-scroll"] svg');
      expect(drawing).not.toBeNull();
      expect(numberAttribute(drawing as Element, 'width')).toBeGreaterThanOrEqual(
        (30 + tape.length * tape.columnLength) * SCALE - 1,
      );
    });

    describe('with a 5-minute Tape, rendering only the visible Columns (V6b)', () => {
      const starts = (view: HTMLElement | null) => holeRects(view).map((rect) => numberAttribute(rect, 'data-start'));

      it('renders the Holes, marks and numbers near the start only, in a drawing of the full width', async () => {
        const {tape, open, view} = await render({longTape: true});

        await open(`/tapes/${tape.id}`);

        const rendered = starts(view());
        expect(rendered).toContain(0);
        expect(Math.max(...rendered)).toBeLessThan(2000);
        expect(rendered.length).toBeLessThan(tape.holes.length / 5);
        expect(all(view(), 'svg [data-testid="column-mark"]').length).toBeLessThan(500);
        expect(all(view(), 'svg [data-testid="column-number"]').length).toBeLessThan(500);
        expect(all(view(), 'svg [data-testid="ruler-number"]').length).toBeLessThan(500);
        const drawing = view()?.querySelector('[data-testid="tape-scroll"] svg') as Element;
        expect(numberAttribute(drawing, 'width')).toBeGreaterThanOrEqual(tape.length * tape.columnLength * SCALE);
      });

      it('renders the last Holes after scrolling to the end, and no longer the first', async () => {
        const {tape, open, view, settle} = await render({longTape: true});
        await open(`/tapes/${tape.id}`);
        const scroll = view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;

        const clientWidth = 1000;
        const total = (20 + tape.length * tape.columnLength) * SCALE;
        Object.defineProperty(scroll, 'clientWidth', {value: clientWidth, configurable: true});
        Object.defineProperty(scroll, 'scrollLeft', {value: total - clientWidth, configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await settle();

        const rendered = starts(view());
        expect(rendered).toContain(11996);
        expect(rendered).not.toContain(0);
      });
    });

    it('shows the names of the selected Parts only', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(texts(view(), 'selected-part')).toEqual(['Lead']);
    });

    it('offers no control that changes the Tape', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelectorAll('button, input, select, textarea, [contenteditable]')).toHaveLength(0);
    });

    it('cannot be opened when its Organ is unknown', async () => {
      const {tape, open, router} = await render({organUnknown: true});

      await open(`/tapes/${tape.id}`);

      expect(router.url).toBe('/tapes');
    });
  });
});
