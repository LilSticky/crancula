import {BreakpointObserver, type BreakpointState} from '@angular/cdk/layout';
import {Component} from '@angular/core';
import {type Observable, of} from 'rxjs';
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
import {vi} from 'vitest';
import {overviewFrame, scrollLeftFor} from './overview-frame';
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
  /** A Tape of one Column without Holes. */
  readonly oneColumn?: boolean;
  /**
   * A Tape of 100 Columns of 2.5 mm with exactly these Holes, on an Organ of 25 rows: the Pipe of row r
   * (from 1) is note 52 + r, so row 25 is F5. The Minimum Hole Length is 2.5 mm, the Minimum Gap 1.5 mm.
   */
  readonly holes?: readonly {readonly row: number; readonly start: number; readonly length: number}[];
  /** The Column length of the Tape with `holes` in mm; 2.5 when not given. */
  readonly columnLength?: number;
  /** The language of the texts; English when not given. */
  readonly language?: 'en' | 'de';
  /** Writing the Tape library fails. */
  readonly saveFails?: boolean;
  /** The window width in px the faked BreakpointObserver answers for; the real one when not given. */
  readonly windowWidth?: number;
}

/** Evaluates `min-width` and `max-width` queries against a fixed window width. */
function stubBreakpointObserver(width: number): Pick<BreakpointObserver, 'observe' | 'isMatched'> {
  const matches = (query: string): boolean => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
  };
  const queries = (value: string | readonly string[]): string[] => (typeof value === 'string' ? [value] : [...value]);
  return {
    observe: (value: string | readonly string[]): Observable<BreakpointState> =>
      of({matches: queries(value).some(matches), breakpoints: Object.fromEntries(queries(value).map((q) => [q, matches(q)]))}),
    isMatched: (value: string | readonly string[]): boolean => queries(value).some(matches),
  };
}

async function render(options: RenderOptions = {}) {
  const inMemory = createInMemoryCranculaApi(undefined, undefined, options.saveFails ? {tapes: {save: 'failed'}} : {});
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
      provideTestTranslations(options.language ?? 'en'),
      {provide: CRANCULA_API, useValue: api},
      ...(options.windowWidth === undefined
        ? []
        : [{provide: BreakpointObserver, useValue: stubBreakpointObserver(options.windowWidth)}]),
    ],
  });
  const organ = options.holes
    ? testOrgan('Street organ', 25, {
        leadIn: options.leadIn ?? 0,
        pipes: Array.from({length: 25}, (_, index) => ({note: 52 + index + 1})),
      })
    : testOrgan('Street organ', 3, options.leadIn === undefined ? {} : {leadIn: options.leadIn});
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
  const tape: Tape = options.oneColumn
    ? asValidTape({...shortTape, length: 1 as ColumnCount, holes: []})
    : options.holes
    ? asValidTape({
        ...shortTape,
        length: 100 as ColumnCount,
        columnLength: (options.columnLength ?? 2.5) as Tape['columnLength'],
        holes: options.holes.map(({row, start, length}) => ({
          pipe: (organ.pipes[row - 1]?.note ?? 0),
          start: start as Column,
          length: length as ColumnCount,
        })),
      })
    : options.longTape
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
  const all = (view: ParentNode | null, selector: string) => Array.from(view?.querySelectorAll(selector) ?? []);
  const texts = (view: HTMLElement | null, testId: string) =>
    all(view, `[data-testid="${testId}"]`).map((element) => element.textContent?.trim());

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

  describe('the page head (V11)', () => {
    it('names the Organ, the Columns and the Tape length in the subtitle', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
        `For the Street organ. ${tape.length} Columns of 2.5 mm, ${tape.length * 2.5} mm of Tape.`,
      );
    });

    it('says "1 Column" in the singular', async () => {
      const {tape, open, view} = await render({oneColumn: true});

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('cranc-page-head p')?.textContent).toContain('1 Column of 2.5 mm, 2.5 mm of Tape.');
    });

    it('writes the numbers of the subtitle with the decimal comma in German', async () => {
      const {tape, open, view} = await render({language: 'de'});

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('cranc-page-head p')?.textContent).toContain('2,5 mm');
    });

    it('puts the zoom in the page head actions', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('[data-testid="page-head-actions"] [data-testid="zoom"]')).not.toBeNull();
    });

    it('makes the zoom a Material button toggle group', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const zoom = view()?.querySelector('[data-testid="zoom"]');
      expect(zoom?.classList).toContain('mat-button-toggle-group');
      expect(zoom?.querySelectorAll('.mat-button-toggle')).toHaveLength(3);
    });

    it('styles the Organ link of the Tape section like the other in-app links, as a Material text button', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const link = view()?.querySelector('[data-testid="tape-section"] a');
      expect(link?.classList).toContain('mat-mdc-button');
    });

    it('offers Export for the Plotter as a disabled outlined button with a visible later-release note', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const exportButton = view()?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="export"]');
      expect(exportButton?.disabled).toBe(true);
      expect(exportButton?.textContent).toContain('content_cut');
      expect(exportButton?.className).toContain('mat-mdc-outlined-button');
      expect(view()?.querySelector('[data-testid="export-later"]')?.textContent?.trim()).toBe('Export comes in a later release');
    });
  });

  describe('the layout (V12)', () => {
    it('keeps the stage, the overview strip and the side panel in the page, the panel beside them', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const panel = view()?.querySelector('[data-testid="side-panel"]');
      expect(panel).not.toBeNull();
      expect(panel?.contains(view()?.querySelector('[data-testid="tape-scroll"]') ?? null)).toBe(false);
      expect(panel?.contains(view()?.querySelector('[data-testid="overview"]') ?? null)).toBe(false);
    });

    it('lists the Parts in the side panel, not in the page body', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const parts = all(view(), '[data-testid="selected-part"]');
      expect(parts).toHaveLength(1);
      expect(parts.every((part) => part.closest('[data-testid="side-panel"]') !== null)).toBe(true);
    });
  });

  describe('the Tape section (V13)', () => {
    const section = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-section"]') ?? null;
    const values = (view: HTMLElement | null) =>
      all(section(view), 'dd').map((value) => value.textContent?.trim());

    it('lists Organ, Column length, Columns, length, Lead-in and Holes as a definition list in the side panel', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});

      await open(`/tapes/${tape.id}`);

      expect(section(view())?.closest('[data-testid="side-panel"]')).not.toBeNull();
      expect(section(view())?.querySelector('dl')).not.toBeNull();
      expect(values(view()).slice(0, 6)).toEqual([
        organ.name,
        '2.5 mm',
        `${tape.length}`,
        `${tape.length * 2.5} mm`,
        '30 mm',
        `${tape.holes.length}`,
      ]);
    });

    it('links the Organ to the Organ editor', async () => {
      const {tape, organ, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(section(view())?.querySelector('a')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
    });

    it('says None for a Lead-in of 0', async () => {
      const {tape, open, view} = await render({leadIn: 0});

      await open(`/tapes/${tape.id}`);

      expect(values(view())[4]).toBe('None');
    });

    it('lists the Parts on the Tape inside the section', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(texts(section(view()) as HTMLElement | null, 'selected-part')).toEqual(['Lead']);
    });
  });

  describe('the Import Summary in the side panel (V14)', () => {
    it('is the third section of the side panel and offers a Dismiss button', async () => {
      const {tape, importSummary, open, view} = await render();

      await open(`/tapes/${tape.id}`, importSummary);

      const panel = view()?.querySelector('[data-testid="side-panel"]');
      const summary = panel?.querySelector('[data-testid="import-summary"]') ?? null;
      expect(summary).not.toBeNull();
      expect(summary?.parentElement).toBe(panel);
      expect([...(panel?.children ?? [])].indexOf(summary as Element)).toBe(2);
      expect(summary?.querySelector('button[aria-label="Dismiss"]')).not.toBeNull();
    });

    it('is removed when Dismiss is pressed', async () => {
      const {tape, importSummary, open, summaryShown, view, settle} = await render();
      await open(`/tapes/${tape.id}`, importSummary);

      view()?.querySelector<HTMLButtonElement>('[data-testid="import-summary"] button[aria-label="Dismiss"]')?.click();
      await settle();

      expect(summaryShown()).toBeNull();
    });
  });

  describe('selecting a Hole (V16)', () => {
    // Row 24 has one Hole; row 25 (F5) has two.
    const holes = [
      {row: 24, start: 10, length: 5},
      {row: 25, start: 64, length: 15},
      {row: 25, start: 83, length: 3},
    ];
    const drawn = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"]') as SVGRectElement[];
    const selected = (view: HTMLElement | null) =>
      drawn(view)
        .filter((rect) => rect.classList.contains('selected'))
        .map((rect) => `${rect.getAttribute('data-row')}:${rect.getAttribute('data-start')}`);
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const press = async (view: HTMLElement | null, key: string, settle: () => Promise<void>) => {
      tapeSvg(view).dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
      await settle();
    };
    const click = async (rect: Element, settle: () => Promise<void>) => {
      rect.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
    };

    it('selects nothing at first', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      expect(selected(view())).toEqual([]);
      expect(drawn(view()).some((rect) => rect.getAttribute('aria-selected') === 'true')).toBe(false);
    });

    it('gives a clicked Hole the class selected and aria-selected true', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await click(drawn(view())[1], settle);

      expect(selected(view())).toEqual(['24:64']);
      expect(drawn(view())[1].getAttribute('aria-selected')).toBe('true');
    });

    it('selects one Hole at a time', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await click(drawn(view())[0], settle);
      await click(drawn(view())[2], settle);

      expect(selected(view())).toEqual(['24:83']);
      expect(drawn(view()).filter((rect) => rect.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    });

    it('makes the Tape drawing focusable', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      expect(tapeSvg(view()).getAttribute('tabindex')).toBe('0');
    });

    it('selects the first Hole of the topmost row with Holes on any arrow key when nothing is selected', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await press(view(), 'ArrowRight', settle);

      expect(selected(view())).toEqual(['23:10']);
    });

    it('moves the selection with the arrow keys along the row and across rows', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      await click(drawn(view())[0], settle);

      await press(view(), 'ArrowDown', settle);
      expect(selected(view())).toEqual(['24:64']);
      await press(view(), 'ArrowRight', settle);
      expect(selected(view())).toEqual(['24:83']);
      await press(view(), 'ArrowLeft', settle);
      expect(selected(view())).toEqual(['24:64']);
      await press(view(), 'ArrowUp', settle);
      expect(selected(view())).toEqual(['23:10']);
    });

    it('keeps the selection at the end of a row', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      await click(drawn(view())[2], settle);

      await press(view(), 'ArrowRight', settle);

      expect(selected(view())).toEqual(['24:83']);
    });

    it('clears the selection on Escape', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      await click(drawn(view())[1], settle);

      await press(view(), 'Escape', settle);

      expect(selected(view())).toEqual([]);
      expect(drawn(view()).some((rect) => rect.getAttribute('aria-selected') === 'true')).toBe(false);
    });

    it('scrolls the selected Hole into view', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);

      try {
        await press(view(), 'ArrowRight', settle);

        const target = drawn(view()).find((rect) => rect.classList.contains('selected'));
        expect(target).toBeDefined();
        expect(scrollIntoView.mock.contexts).toContain(target);
      } finally {
        scrollIntoView.mockRestore();
      }
    });

    it('does not change the Tape', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await click(drawn(view())[1], settle);
      await press(view(), 'ArrowRight', settle);

      expect(drawn(view())).toHaveLength(holes.length);
      expect(TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tape.id)).toEqual(tape);
    });
  });

  describe('the Selected Hole section (V18)', () => {
    const holes = [
      {row: 25, start: 64, length: 15},
      {row: 25, start: 83, length: 3},
    ];
    const section = (view: HTMLElement | null) => view?.querySelector('[data-testid="selected-hole"]') as HTMLElement;
    const text = (view: HTMLElement | null) => section(view).textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const warnings = (view: HTMLElement | null) =>
      all(section(view), '[data-testid="hole-warning"]').map((warning) => warning.textContent?.replace(/\s+/g, ' ').trim());
    const select = async (view: HTMLElement | null, index: number, settle: () => Promise<void>) => {
      const rects = all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"]');
      rects[index].dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
    };

    it('shows the empty sentence without a selection', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      expect(text(view())).toContain('Select a Hole');
      expect(warnings(view())).toEqual([]);
    });

    it('shows row, note, Columns, length and the gap to the next Hole of the selection', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(text(view())).toContain('Row 25, F5');
      expect(text(view())).toContain('Columns 65–79');
      expect(text(view())).toContain('15 Columns, 37.5 mm');
      expect(text(view())).toContain('Gap to the next Hole: 4 Columns, 10 mm');
    });

    it('shows the space to the end of the Tape for the last Hole of its row', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await select(view(), 1, settle);

      expect(text(view())).toContain('To the end of the Tape: 14 Columns, 35 mm');
      expect(text(view())).not.toContain('Gap to the next Hole');
    });

    it('says "1 Column" in the singular', async () => {
      const {tape, open, view, settle} = await render({
        holes: [
          {row: 25, start: 10, length: 1},
          {row: 25, start: 12, length: 5},
        ],
      });
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(text(view())).toContain('1 Column, 2.5 mm');
      expect(text(view())).toContain('Gap to the next Hole: 1 Column, 2.5 mm');
    });

    it('writes the numbers with the decimal comma in German', async () => {
      const {tape, open, view, settle} = await render({holes, language: 'de'});
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(text(view())).toContain('37,5 mm');
    });

    it('warns with the numbers when the Hole is shorter than the Minimum Hole Length', async () => {
      const {tape, open, view, settle} = await render({holes: [{row: 25, start: 10, length: 1}], columnLength: 2});
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(warnings(view())).toEqual(['Shorter than the Minimum Hole Length: 2 mm of 2.5 mm']);
    });

    it('warns with the numbers when a gap is below the Minimum Gap', async () => {
      const {tape, open, view, settle} = await render({
        holes: [
          {row: 25, start: 10, length: 5},
          {row: 25, start: 16, length: 5},
        ],
        columnLength: 1,
      });
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(warnings(view())).toEqual(['Gap below the Minimum Gap: 1 mm of 1.5 mm']);
    });

    it('shows no warning for a Hole within the limits', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await select(view(), 0, settle);

      expect(warnings(view())).toEqual([]);
      expect(section(view()).querySelector('[data-testid="hole-warning"]')).toBeNull();
    });
  });

  describe('the status line (V20)', () => {
    const holes = [{row: 25, start: 71, length: 3}];
    /** The ruler above the Tape in the SVG, in px. */
    const RULER_PX = 24;
    const line = (view: HTMLElement | null) => view?.querySelector('[data-testid="status-line"]') ?? null;
    const lineText = (view: HTMLElement | null) => line(view)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    /** Moves the pointer to the given Tape position (px from the drawing's left and the Tape's top edge). */
    const pointAt = async (view: HTMLElement | null, x: number, y: number, settle: () => Promise<void>) => {
      const svg = tapeSvg(view);
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      svg.dispatchEvent(new MouseEvent('pointermove', {clientX: x, clientY: y + RULER_PX, bubbles: true}));
      await settle();
    };

    it('sits under the overview strip, 26 px high', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      const element = line(view()) as HTMLElement | null;
      expect(element).not.toBeNull();
      expect(element?.style.height).toBe('26px');
      const overview = view()?.querySelector('[data-testid="overview"]');
      expect(overview?.compareDocumentPosition(element as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('shows the Column with its mm and the row with its note name while the pointer is over the Tape', async () => {
      const {tape, organ, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      const rowCentre = (tapeGeometry(tape, organ).rowCentres[24] ?? 0) * SCALE;

      await pointAt(view(), 177.5 * SCALE + 1, rowCentre, settle);

      expect(lineText(view())).toContain('Column 72 at 177.5 mm');
      expect(lineText(view())).toContain('Row 25, F5');
    });

    it('shows no position without the pointer over the Tape, and again after it leaves', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      expect(lineText(view())).not.toMatch(/Column \d+ at/);

      await pointAt(view(), 5, 5, settle);
      expect(lineText(view())).toMatch(/Column \d+ at/);

      tapeSvg(view()).dispatchEvent(new MouseEvent('pointerleave'));
      await settle();
      expect(lineText(view())).not.toMatch(/Column \d+ at/);
      expect(lineText(view())).not.toContain('Row');
    });

    it('shows the zoom and the save state', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      expect(lineText(view())).toContain('1:1');
      expect(lineText(view())).toContain('Saved');
    });

    it('shows the save problem of the Tape library instead of Saved', async () => {
      const {tape, open, view} = await render({holes, saveFails: true});

      await open(`/tapes/${tape.id}`);

      expect(lineText(view())).toContain("Your Tapes couldn't be saved: the Tape library could not be written");
      expect(lineText(view())).not.toContain('Saved');
    });

    it('announces only the save state politely', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      await pointAt(view(), 5, 5, settle);

      const live = all(line(view()), '[aria-live]');
      expect(live).toHaveLength(1);
      expect(live[0].getAttribute('aria-live')).toBe('polite');
      expect(live[0].textContent).toContain('Saved');
      expect(line(view())?.getAttribute('aria-live')).toBeNull();
    });
  });

  describe('the text alternative (V21)', () => {
    it('labels the Tape drawing with the name, rows, Columns and Holes', async () => {
      const {tape, organ, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const svg = view()?.querySelector('[data-testid="tape-scroll"] svg');
      expect(svg?.getAttribute('aria-label')).toBe(
        `Tape ${tape.name}: ${organ.pipes.length} rows, ${tape.length} Columns, ${tape.holes.length} Holes`,
      );
    });

    it('labels it in German with "Lochband"', async () => {
      const {tape, open, view} = await render({language: 'de'});

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelector('[data-testid="tape-scroll"] svg')?.getAttribute('aria-label')).toMatch(
        new RegExp(`^Lochband ${tape.name}: `),
      );
    });

    it('hides the ruler and the Column numbers from assistive technology', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const hidden = [...all(view(), '[data-testid="ruler-number"]'), ...all(view(), '[data-testid="column-number"]')];
      expect(hidden.length).toBeGreaterThan(0);
      expect(hidden.every((element) => element.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('the compact side panel (V22)', () => {
    const toggle = (view: HTMLElement | null) =>
      view?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="side-panel-toggle"]') ?? null;
    const panel = (view: HTMLElement | null) => view?.querySelector('[data-testid="side-panel"]') ?? null;

    it('closes the side panel behind a Tape details toggle in the page head below 1180 px', async () => {
      const {tape, open, view} = await render({windowWidth: 1100});

      await open(`/tapes/${tape.id}`);

      expect(toggle(view())?.textContent?.trim()).toBe('Tape details');
      expect(toggle(view())?.getAttribute('aria-expanded')).toBe('false');
      expect(panel(view())).toBeNull();
    });

    it('opens the side panel with the toggle, and closes it again', async () => {
      const {tape, open, view, settle} = await render({windowWidth: 1100});
      await open(`/tapes/${tape.id}`);

      toggle(view())?.click();
      await settle();
      expect(toggle(view())?.getAttribute('aria-expanded')).toBe('true');
      expect(panel(view())).not.toBeNull();

      toggle(view())?.click();
      await settle();
      expect(toggle(view())?.getAttribute('aria-expanded')).toBe('false');
      expect(panel(view())).toBeNull();
    });

    it('closes the open side panel on Escape', async () => {
      const {tape, open, view, settle} = await render({windowWidth: 1100});
      await open(`/tapes/${tape.id}`);
      toggle(view())?.click();
      await settle();

      panel(view())?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      await settle();

      expect(panel(view())).toBeNull();
      expect(toggle(view())?.getAttribute('aria-expanded')).toBe('false');
    });

    it('always shows the side panel from 1180 px, without a toggle', async () => {
      const {tape, open, view} = await render({windowWidth: 1280});

      await open(`/tapes/${tape.id}`);

      expect(toggle(view())).toBeNull();
      expect(panel(view())).not.toBeNull();
    });
  });

  describe('drawing the Tape (FR-018)', () => {
    const numberAttribute = (element: Element, name: string) => Number(element.getAttribute(name));
    const holeRects = (view: HTMLElement | null) => all(view, 'svg:not([data-testid="overview"]) rect[data-testid="hole"]');

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

    describe('the note-name gutter (V7)', () => {
      it('puts each label at its row centre, a constant offset from the geometry, naturals plain and sharps marked', async () => {
        const {tape, organ, open, view} = await render({leadIn: 0});
        const {rowCentres} = tapeGeometry(tape, organ);

        await open(`/tapes/${tape.id}`);

        const labels = all(view(), '[data-testid="row-label"]') as HTMLElement[];
        const offsets = labels.map((label, index) => parseFloat(label.style.top) - (rowCentres[index] ?? 0) * SCALE);
        expect(labels).toHaveLength(organ.pipes.length);
        offsets.forEach((offset) => expect(offset).toBeCloseTo(offsets[0] ?? 0, 1));
        labels.forEach((label, index) => {
          expect(label.classList.contains('sharp')).toBe(noteName(organ.pipes[index]?.note ?? 0).includes('#'));
        });
      });

      it('stays outside the scrolling container and keeps its place when the Tape scrolls sideways', async () => {
        const {tape, open, view, settle} = await render({longTape: true});
        await open(`/tapes/${tape.id}`);
        const scroll = view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
        const before = texts(view(), 'row-label');
        const tops = (all(view(), '[data-testid="row-label"]') as HTMLElement[]).map((label) => label.style.top);

        Object.defineProperty(scroll, 'scrollLeft', {value: 3000, configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await settle();

        expect(scroll.querySelector('[data-testid="row-label"]')).toBeNull();
        expect(texts(view(), 'row-label')).toEqual(before);
        expect((all(view(), '[data-testid="row-label"]') as HTMLElement[]).map((label) => label.style.top)).toEqual(tops);
      });
    });

    describe('the zoom (V8)', () => {
      const STAGE_PX = 800;
      let observers: {callback: ResizeObserverCallback; observer: ResizeObserver}[] = [];

      beforeEach(() => {
        observers = [];
        vi.stubGlobal(
          'ResizeObserver',
          class {
            constructor(private readonly callback: ResizeObserverCallback) {
              observers.push({callback, observer: this});
            }
            observe(): void {
              /* the test drives the size */
            }
            unobserve(): void {
              /* nothing */
            }
            disconnect(): void {
              /* nothing */
            }
          },
        );
      });
      afterEach(() => vi.unstubAllGlobals());

      const resizeStage = async (settle: () => Promise<void>) => {
        const entry = {contentRect: {width: STAGE_PX}} as ResizeObserverEntry;
        observers.forEach(({callback, observer}) => callback([entry], observer));
        await settle();
      };
      const buttons = (view: HTMLElement | null) => all(view, '[data-testid="zoom"] button') as HTMLButtonElement[];
      const bodyWidth = (view: HTMLElement | null) =>
        numberAttribute(view?.querySelector('svg .tape') as Element, 'width');

      it('offers Whole Tape, 1:1 and 2:1 in a toggle group named Zoom, 1:1 pressed', async () => {
        const {tape, open, view} = await render();

        await open(`/tapes/${tape.id}`);

        const group = view()?.querySelector('[data-testid="zoom"]');
        expect(group?.getAttribute('aria-label')).toBe('Zoom');
        expect(buttons(view()).map((button) => button.textContent?.trim())).toEqual(['Whole Tape', '1:1', '2:1']);
        expect(buttons(view()).map((button) => button.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
      });

      it('doubles the Tape body and the Holes at 2:1', async () => {
        const {tape, open, view, settle} = await render({leadIn: 0});
        await open(`/tapes/${tape.id}`);
        const before = bodyWidth(view());
        const holeBefore = numberAttribute(holeRects(view())[0], 'width');

        buttons(view())[2].click();
        await settle();

        expect(bodyWidth(view())).toBeCloseTo(2 * before, 1);
        expect(numberAttribute(holeRects(view())[0], 'width')).toBeCloseTo(2 * holeBefore, 1);
        expect(buttons(view()).map((button) => button.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
      });

      it('fits the Tape body to the stage width at Whole Tape', async () => {
        const {tape, open, view, settle} = await render({leadIn: 0});
        await open(`/tapes/${tape.id}`);
        await resizeStage(settle);

        buttons(view())[0].click();
        await settle();

        expect(bodyWidth(view())).toBeCloseTo(STAGE_PX, 0);
        const lastHole = holeRects(view()).at(-1) as Element;
        expect(numberAttribute(lastHole, 'x') + numberAttribute(lastHole, 'width')).toBeLessThanOrEqual(STAGE_PX + 1);
      });
    });

    describe('the overview strip (V10)', () => {
      const STAGE_PX = 800;
      const CLIENT_PX = 300;
      const SCROLL_PX = 4000;
      let observers: {callback: ResizeObserverCallback; observer: ResizeObserver}[] = [];

      beforeEach(() => {
        observers = [];
        vi.stubGlobal(
          'ResizeObserver',
          class {
            constructor(private readonly callback: ResizeObserverCallback) {
              observers.push({callback, observer: this});
            }
            observe(): void {
              /* the test drives the size */
            }
            unobserve(): void {
              /* nothing */
            }
            disconnect(): void {
              /* nothing */
            }
          },
        );
      });
      afterEach(() => vi.unstubAllGlobals());

      const prepare = async (options: RenderOptions = {}) => {
        const rendered = await render(options);
        await rendered.open(`/tapes/${rendered.tape.id}`);
        const entry = {contentRect: {width: STAGE_PX}} as ResizeObserverEntry;
        observers.forEach(({callback, observer}) => callback([entry], observer));
        let scrollLeft = 0;
        const scroll = rendered.view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
        Object.defineProperty(scroll, 'clientWidth', {value: CLIENT_PX, configurable: true});
        Object.defineProperty(scroll, 'scrollWidth', {value: SCROLL_PX, configurable: true});
        Object.defineProperty(scroll, 'scrollLeft', {
          configurable: true,
          get: () => scrollLeft,
          set: (value: number) => {
            scrollLeft = value;
          },
        });
        scroll.dispatchEvent(new Event('scroll'));
        await rendered.settle();
        const overview = rendered.view()?.querySelector('[data-testid="overview"]') as SVGSVGElement;
        return {...rendered, scroll, overview};
      };
      const frame = (overview: Element) => overview.querySelector('[data-testid="overview-frame"]') as Element;

      it('draws the whole Tape at stage width: body and Holes, no ruler', async () => {
        const {tape, organ, overview} = await prepare({leadIn: 0});

        expect(overview).not.toBeNull();
        expect(overview.getAttribute('aria-label')).toBe('Whole Tape, the framed part is shown above');
        expect(numberAttribute(overview, 'width')).toBeCloseTo(STAGE_PX, 0);
        expect(overview.querySelector('.tape')).not.toBeNull();
        expect(overview.querySelectorAll('[data-testid="hole"]')).toHaveLength(tapeGeometry(tape, organ).slots.length);
        expect(overview.querySelector('[data-testid="ruler-number"]')).toBeNull();
      });

      it('frames the visible part of the stage and moves the frame when the stage scrolls', async () => {
        const {overview, scroll, settle} = await prepare();
        const initial = overviewFrame(0, CLIENT_PX, SCROLL_PX, STAGE_PX);
        expect(numberAttribute(frame(overview), 'x')).toBeCloseTo(initial.x, 1);
        expect(numberAttribute(frame(overview), 'width')).toBeCloseTo(initial.width, 1);

        Object.defineProperty(scroll, 'scrollLeft', {value: 1000, configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await settle();

        const moved = overviewFrame(1000, CLIENT_PX, SCROLL_PX, STAGE_PX);
        expect(numberAttribute(frame(overview), 'x')).toBeCloseTo(moved.x, 1);
        expect(numberAttribute(frame(overview), 'width')).toBeCloseTo(moved.width, 1);
      });

      it('scrolls the stage to the clicked point, centred', async () => {
        const {overview, scroll, settle} = await prepare();
        Object.defineProperty(overview, 'getBoundingClientRect', {
          value: () => new DOMRect(10, 0, STAGE_PX, 40),
          configurable: true,
        });

        overview.dispatchEvent(new MouseEvent('click', {clientX: 10 + 400, bubbles: true}));
        await settle();

        expect(scroll.scrollLeft).toBeCloseTo(scrollLeftFor(400, STAGE_PX, SCROLL_PX, CLIENT_PX), 0);
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

      const controls = all(view(), 'button, input, select, textarea, [contenteditable]').filter(
        (control) => control.closest('[data-testid="zoom"]') === null && !['export', 'side-panel-toggle'].includes(control.getAttribute('data-testid') ?? ''),
      );
      expect(controls).toHaveLength(0);
    });

    it('cannot be opened when its Organ is unknown', async () => {
      const {tape, open, router} = await render({organUnknown: true});

      await open(`/tapes/${tape.id}`);

      expect(router.url).toBe('/tapes');
    });
  });
});
