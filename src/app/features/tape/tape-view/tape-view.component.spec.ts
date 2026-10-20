import {BreakpointObserver, type BreakpointState} from '@angular/cdk/layout';
import {Component, signal} from '@angular/core';
import {type Observable, of} from 'rxjs';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
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
  tapeGeometry,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {tapeOf} from '../../../../../api/tape/tape-fixture';
import {vi} from 'vitest';
import {overviewFrame, scrollLeftFor} from './overview-frame';
import {pixelsPerMillimetre} from './pixels-per-millimetre';
import {CuttingProblemsDialogComponent} from './cutting-problems-dialog/cutting-problems-dialog.component';
import {PlotterExport} from './plotter-export';
import {columnLines, columnNumbers, rulerNumbers} from './tape-marks';
import {type Platform} from './edit-keys';
import {PLATFORM} from './platform.token';
import {TapeViewComponent} from './tape-view.component';

/** The scale the Tape opens at: 1:1, true size on screen. */
const SCALE = pixelsPerMillimetre('1:1', 0, 0);

/** The corners of a path made of absolute M, L, H, V and Z commands. */
function pathCorners(d: string): {readonly x: number; readonly y: number}[] {
  const corners: {x: number; y: number}[] = [];
  let x = 0;
  let y = 0;
  for (const [, command, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const numbers = (args.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
    if (command === 'H') x = numbers[0] ?? x;
    else if (command === 'V') y = numbers[0] ?? y;
    else if (command !== 'Z') {
      x = numbers[0] ?? x;
      y = numbers[1] ?? y;
    }
    if (command !== 'Z') corners.push({x, y});
  }
  return corners;
}

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
  /** Uses the real PlotterExport (and the real problems dialog) instead of a stub. */
  readonly realExport?: boolean;
  /** The window width in px the faked BreakpointObserver answers for; the real one when not given. */
  readonly windowWidth?: number;
  /** The platform the shortcuts are read for; faked through the PLATFORM token. */
  readonly platform?: Platform;
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
  const plotterExport = {export: vi.fn((): Promise<void> => Promise.resolve()), saving: signal(false)};
  TestBed.configureTestingModule({
    providers: [
      ...(options.realExport ? [] : [{provide: PlotterExport, useValue: plotterExport}]),
      provideRouter([
        {path: 'tapes', component: TapeListStubComponent},
        {path: 'tapes/:id', component: TapeViewComponent},
      ]),
      provideTestTranslations(options.language ?? 'en'),
      {provide: CRANCULA_API, useValue: api},
      ...(options.platform === undefined ? [] : [{provide: PLATFORM, useValue: options.platform}]),
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
    ? tapeOf({...shortTape, length: 1 as ColumnCount, holes: []})
    : options.holes
    ? tapeOf({
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
    ? tapeOf({
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
  return {tape, organ, plotterExport, importSummary: created.value.importSummary, open, summaryShown, router, finish, view, settle};
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

    it('offers Export for the Plotter as an enabled outlined button without a later-release note', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const exportButton = view()?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="export"]');
      expect(exportButton?.disabled).toBe(false);
      expect(exportButton?.textContent).toContain('content_cut');
      expect(exportButton?.textContent).toContain('Export for the Plotter');
      expect(exportButton?.className).toContain('mat-mdc-outlined-button');
      expect(view()?.querySelector('[data-testid="export-later"]')).toBeNull();
    });

    it('exports the shown Tape with its Organ when Export for the Plotter is pressed', async () => {
      const {tape, organ, open, view, settle, plotterExport} = await render();
      await open(`/tapes/${tape.id}`);

      view()?.querySelector<HTMLButtonElement>('[data-testid="export"]')?.click();
      await settle();

      expect(plotterExport.export).toHaveBeenCalledTimes(1);
      expect(plotterExport.export).toHaveBeenCalledWith(tape, organ);
    });

    describe('for a Tape that can not be cut', () => {
      // Its Organ's holes were made so wide after the Tape was made that its Holes are shorter than the Minimum Hole Length.
      const widerOrgan = (original: Organ): Organ => ({
        ...testOrgan(original.name, 3, {tapeBed: {tapeWidth: 120, holeDiameter: 30, rowSpacing: 30}}),
        id: original.id,
      });

      afterEach(() => TestBed.inject(MatDialog).closeAll());

      it('keeps Export for the Plotter enabled', async () => {
        const {tape, open, view} = await render({realExport: true, organNow: widerOrgan});

        await open(`/tapes/${tape.id}`);

        expect(view()?.querySelector<HTMLButtonElement>('[data-testid="export"]')?.disabled).toBe(false);
      });

      it('opens the problems dialog when Export for the Plotter is pressed', async () => {
        const {tape, open, view, settle} = await render({realExport: true, organNow: widerOrgan});
        await open(`/tapes/${tape.id}`);
        const dialogOpen = vi.spyOn(TestBed.inject(MatDialog), 'open');

        view()?.querySelector<HTMLButtonElement>('[data-testid="export"]')?.click();
        await settle();

        expect(dialogOpen).toHaveBeenCalledTimes(1);
        expect(dialogOpen.mock.calls[0]?.[0]).toBe(CuttingProblemsDialogComponent);
      });
    });

    it('disables Export for the Plotter while a save is running', async () => {
      const {tape, open, view, settle, plotterExport} = await render();
      await open(`/tapes/${tape.id}`);

      plotterExport.saving.set(true);
      await settle();

      expect(view()?.querySelector<HTMLButtonElement>('[data-testid="export"]')?.disabled).toBe(true);
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

  describe('the order of the side panel (UX finding 14)', () => {
    const sectionIds = ['selected-hole', 'cutting-problems', 'add-hole', 'tape-section', 'import-summary'] as const;

    it('lists Selected Hole, Cutting Problems and Add a Hole before the Tape details and the Import Summary', async () => {
      const {tape, importSummary, open, view} = await render();

      await open(`/tapes/${tape.id}`, importSummary);

      const panel = view()?.querySelector('[data-testid="side-panel"]');
      const order = [...(panel?.querySelectorAll(sectionIds.map((id) => `[data-testid="${id}"]`).join(',')) ?? [])].map(
        (section) => section.getAttribute('data-testid'),
      );
      expect(order).toEqual([...sectionIds]);
    });

    it('opens the side panel scrolled to its top', async () => {
      const {tape, importSummary, open, view} = await render();

      await open(`/tapes/${tape.id}`, importSummary);

      expect(view()?.querySelector('[data-testid="side-panel"]')?.scrollTop).toBe(0);
    });

    it.each([
      ['tape-section', 'tape-section-toggle'],
      ['import-summary', 'import-summary-toggle'],
    ] as const)('lets the %s be collapsed and expanded with its toggle button', async (section, toggleId) => {
      const {tape, importSummary, open, view, settle} = await render();
      await open(`/tapes/${tape.id}`, importSummary);
      const toggle = () => view()?.querySelector<HTMLButtonElement>(`[data-testid="${toggleId}"]`) ?? null;

      expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
      const controlled = toggle()?.getAttribute('aria-controls') ?? '';
      expect(controlled).not.toBe('');
      expect(view()?.querySelectorAll(`[id="${controlled}"]`)).toHaveLength(1);
      toggle()?.click();
      await settle();
      expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
      expect(view()?.querySelector(`[data-testid="${section}"] dl, [data-testid="${section}"] ul`)?.checkVisibility()).not.toBe(true);
      toggle()?.click();
      await settle();
      expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('the Import Summary in the side panel (V14)', () => {
    it('is a direct section of the side panel and offers a Dismiss button', async () => {
      const {tape, importSummary, open, view} = await render();

      await open(`/tapes/${tape.id}`, importSummary);

      const panel = view()?.querySelector('[data-testid="side-panel"]');
      const summary = panel?.querySelector('[data-testid="import-summary"]') ?? null;
      expect(summary).not.toBeNull();
      expect(summary?.parentElement).toBe(panel);
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
    });

    it('gives a clicked Hole the class selected', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await click(drawn(view())[1], settle);

      expect(selected(view())).toEqual(['24:64']);
    });

    it('selects one Hole at a time', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);

      await click(drawn(view())[0], settle);
      await click(drawn(view())[2], settle);

      expect(selected(view())).toEqual(['24:83']);
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

      expect(text(view())).toContain('Select a Hole to see where it is and how long it is.');
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

      expect(warnings(view())).toEqual(['Too short to cut, see Cutting Problems']);
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

      expect(warnings(view())).toEqual(['Gap too small to cut, see Cutting Problems']);
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
      expect(getComputedStyle(element as Element).height).toBe('26px');
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

    it('opens the side panel by itself below 1180 px when the Tape view shows an Import Summary', async () => {
      const {tape, importSummary, open, view, summaryShown} = await render({windowWidth: 1100});

      await open(`/tapes/${tape.id}`, importSummary);

      expect(panel(view())).not.toBeNull();
      expect(toggle(view())?.getAttribute('aria-expanded')).toBe('true');
      expect(summaryShown()).not.toBeNull();
    });

    describe('the Export for the Plotter button', () => {
      const exportButton = (view: HTMLElement | null) =>
        view?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="export"]') ?? null;

      it('is an icon button with the scissors icon and an aria-label below 1180 px', async () => {
        const {tape, open, view} = await render({windowWidth: 1100});

        await open(`/tapes/${tape.id}`);

        expect(exportButton(view())?.getAttribute('aria-label')).toBe('Export for the Plotter');
        expect(exportButton(view())?.querySelector('mat-icon')?.textContent?.trim()).toBe('content_cut');
        expect(exportButton(view())?.textContent?.trim()).toBe('content_cut');
      });

      it('shows the label as a tooltip below 1180 px', async () => {
        const {tape, open, view, settle} = await render({windowWidth: 1100});
        await open(`/tapes/${tape.id}`);

        exportButton(view())?.dispatchEvent(new MouseEvent('mouseenter'));
        await settle();

        expect(document.body.querySelector('.mat-mdc-tooltip')?.textContent?.trim()).toBe('Export for the Plotter');
      });

      it('keeps the text label from 1180 px', async () => {
        const {tape, open, view} = await render({windowWidth: 1280});

        await open(`/tapes/${tape.id}`);

        expect(exportButton(view())?.textContent).toContain('Export for the Plotter');
      });
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

    it('draws the Tape body at true millimetres: Tape length plus the end gap wide, tape width high at 1:1 (no Lead-in)', async () => {
      const {tape, organ, open, view} = await render({leadIn: 0});
      const {totalLength} = tapeGeometry(tape, organ);
      expect(totalLength).toBeCloseTo(tape.length * tape.columnLength + organ.minimumGap, 5);

      await open(`/tapes/${tape.id}`);

      const body = view()?.querySelector('svg .tape');
      expect(body).not.toBeNull();
      expect(numberAttribute(body as Element, 'width')).toBeCloseTo(totalLength * SCALE, 1);
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

    it('draws the Lead-in as the Tape before Column 1 behind one straight diagonal from the tip to Column 1 at the bottom edge', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const {outline} = tapeGeometry(tape, organ);
      expect(outline.columnOneBottom.x).toBe(30);

      await open(`/tapes/${tape.id}`);

      const leadIn = view()?.querySelector('[data-testid="lead-in"]');
      expect(leadIn?.tagName.toLowerCase()).toBe('path');
      const corners = pathCorners(leadIn?.getAttribute('d') ?? '');
      const corner = (point: {readonly x: number; readonly y: number}) => ({x: point.x * SCALE, y: point.y * SCALE});
      const near = (a: {readonly x: number; readonly y: number}, b: {readonly x: number; readonly y: number}) =>
        Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
      // One straight diagonal over the whole Lead-in: the tip and Column 1 at the bottom edge are corners, the bottom edge before Column 1 is not.
      expect(corners.some((point) => near(point, corner(outline.tip)))).toBe(true);
      expect(corners.some((point) => near(point, corner(outline.columnOneBottom)))).toBe(true);
      expect(corners.some((point) => near(point, {x: 0, y: outline.columnOneBottom.y * SCALE}))).toBe(false);
      expect(leadIn?.querySelector('[data-testid="hole"]')).toBeNull();
    });

    it('ends the Tape body one Minimum Gap after the last Column, behind the Lead-in', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const {totalLength, length, leadIn} = tapeGeometry(tape, organ);
      expect(totalLength).toBeCloseTo(leadIn + length + organ.minimumGap, 5);

      await open(`/tapes/${tape.id}`);

      const body = view()?.querySelector('svg:not([data-testid="overview"]) .tape') as Element;
      expect(numberAttribute(body, 'x')).toBeCloseTo(leadIn * SCALE, 1);
      expect(numberAttribute(body, 'x') + numberAttribute(body, 'width')).toBeCloseTo(totalLength * SCALE, 1);
    });

    it('moves every Hole and Column line right by the Lead-in, none lie in it', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const {slots} = tapeGeometry(tape, organ);

      await open(`/tapes/${tape.id}`);

      const rects = holeRects(view());
      expect(rects).toHaveLength(slots.length);
      slots.forEach((slot, index) => {
        expect(numberAttribute(rects[index], 'x')).toBeCloseTo(slot.x * SCALE, 1);
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
      const expected = rulerNumbers(lengthMm, SCALE);
      expect(numbers.map((number) => number.textContent?.trim())).toEqual(expected.map(String));
      expected.forEach((mm, index) => {
        expect(numberAttribute(numbers[index], 'x')).toBeCloseTo((30 + mm) * SCALE, 0);
      });
    });

    it('lets the scroll container cover the whole Tape length, Lead-in and end gap included', async () => {
      const {tape, organ, open, view} = await render({leadIn: 30});
      const {totalLength} = tapeGeometry(tape, organ);

      await open(`/tapes/${tape.id}`);

      const drawing = view()?.querySelector('[data-testid="tape-scroll"] svg');
      expect(drawing).not.toBeNull();
      expect(numberAttribute(drawing as Element, 'width')).toBeGreaterThanOrEqual(totalLength * SCALE - 1);
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

    describe('the zoom to the whole Tape with a Lead-in', () => {
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

      it('fits the Tape from the tip to the end cut to the stage width, the end gap included', async () => {
        const {tape, open, view, settle} = await render({leadIn: 30});
        await open(`/tapes/${tape.id}`);
        const entry = {contentRect: {width: STAGE_PX}} as ResizeObserverEntry;
        observers.forEach(({callback, observer}) => callback([entry], observer));
        await settle();

        (view()?.querySelector('[data-testid="zoom"] button') as HTMLButtonElement).click();
        await settle();

        const body = view()?.querySelector('svg:not([data-testid="overview"]) .tape') as Element;
        expect(numberAttribute(body, 'x') + numberAttribute(body, 'width')).toBeCloseTo(STAGE_PX, 0);
      });

      it('ends the Tape in the overview strip at the end cut, one Minimum Gap after the last Column', async () => {
        const {tape, organ, open, view, settle} = await render({leadIn: 30});
        await open(`/tapes/${tape.id}`);
        const entry = {contentRect: {width: STAGE_PX}} as ResizeObserverEntry;
        observers.forEach(({callback, observer}) => callback([entry], observer));
        await settle();
        const {totalLength, leadIn} = tapeGeometry(tape, organ);

        const body = view()?.querySelector('[data-testid="overview"] .tape') as Element;
        expect(numberAttribute(body, 'x')).toBeCloseTo((leadIn * STAGE_PX) / totalLength, 0);
        expect(numberAttribute(body, 'x') + numberAttribute(body, 'width')).toBeCloseTo(STAGE_PX, 0);
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
        const {overview} = await prepare({leadIn: 0});

        expect(overview).not.toBeNull();
        expect(overview.getAttribute('aria-label')).toBe('Whole Tape, the framed part is shown above');
        expect(numberAttribute(overview, 'width')).toBeCloseTo(STAGE_PX, 0);
        expect(overview.querySelector('.tape')).not.toBeNull();
        expect(overview.querySelector('path[data-testid="overview-holes"]')).not.toBeNull();
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

    describe('a keyboard widget with a stable DOM (review findings)', () => {
      const HOLES = [
        {row: 24, start: 10, length: 5},
        {row: 25, start: 64, length: 15},
      ];
      const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
      const press = async (view: HTMLElement | null, key: string, settle: () => Promise<void>) => {
        tapeSvg(view).dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
        await settle();
      };
      const selectedRects = (view: HTMLElement | null) =>
        all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected');

      /** A scroll container with a settable `scrollLeft` that, like a browser, then fires `scroll`. */
      const driveScrolling = (scroll: HTMLElement, clientWidth: number) => {
        let scrollLeft = 0;
        Object.defineProperty(scroll, 'clientWidth', {value: clientWidth, configurable: true});
        Object.defineProperty(scroll, 'scrollLeft', {
          configurable: true,
          get: () => scrollLeft,
          set: (value: number) => {
            scrollLeft = value;
            scroll.dispatchEvent(new Event('scroll'));
          },
        });
      };

      it('scrolls to a keyboard-selected Hole outside the rendered window and draws it selected', async () => {
        const {tape, organ, open, view, settle} = await render({longTape: true});
        await open(`/tapes/${tape.id}`);
        const scroll = view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
        const clientWidth = 1000;
        driveScrolling(scroll, clientWidth);
        const geometry = tapeGeometry(tape, organ);
        const total = (geometry.leadIn + geometry.length) * SCALE;
        scroll.scrollLeft = total - clientWidth;
        await settle();
        const lastDrawn = holeRects(view()).at(-1) as Element;
        lastDrawn.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await settle();
        scroll.scrollLeft = 0;
        await settle();
        expect(selectedRects(view())).toHaveLength(0); // The selected Hole is outside the window now.

        await press(view(), 'ArrowLeft', settle);

        const row = Number(lastDrawn.getAttribute('data-row')) + 1;
        const start = Number(lastDrawn.getAttribute('data-start')) - 4;
        const slot = geometry.slots.find((candidate) => candidate.row === row && candidate.start === start);
        expect(slot).toBeDefined();
        const left = (geometry.leadIn + (slot?.x ?? 0)) * SCALE;
        expect(scroll.scrollLeft).toBeLessThanOrEqual(left);
        expect(scroll.scrollLeft + clientWidth).toBeGreaterThanOrEqual(left + (slot?.width ?? 0) * SCALE);
        const rects = selectedRects(view());
        expect(rects).toHaveLength(1);
        expect(rects[0].getAttribute('data-start')).toBe(String(start));
      });

      it('makes the Tape drawing an application, not an image', async () => {
        const {tape, open, view} = await render({holes: HOLES});

        await open(`/tapes/${tape.id}`);

        expect(tapeSvg(view()).getAttribute('role')).toBe('application');
      });

      it('names the selected Hole with its row, note and Columns, and sets no aria-selected on Holes', async () => {
        const {tape, open, view, settle} = await render({holes: HOLES});
        await open(`/tapes/${tape.id}`);

        await press(view(), 'ArrowRight', settle);
        await press(view(), 'ArrowDown', settle);

        const [rect] = selectedRects(view());
        const inspector = all(view(), '[data-testid="selected-hole"] p').map((paragraph) => paragraph.textContent?.trim() ?? '');
        expect(inspector.length).toBeGreaterThanOrEqual(2);
        expect(rect.getAttribute('aria-label')).toContain(inspector[0]); // "Row 25, F5"
        expect(rect.getAttribute('aria-label')).toContain(inspector[1]); // "Columns a-b"
        expect(all(view(), '[aria-selected]')).toHaveLength(0);
      });

      it('describes the focusable Tape drawing by the key help line while a Hole is selected', async () => {
        const {tape, open, view, settle} = await render({holes: HOLES});
        await open(`/tapes/${tape.id}`);

        await press(view(), 'ArrowRight', settle);

        const helpId = view()?.querySelector('[data-testid="hole-keys"]')?.id;
        expect(helpId).toBe('hole-keys-help');
        expect(tapeSvg(view()).getAttribute('aria-describedby')?.split(/\s+/)).toContain('hole-keys-help');
      });

      it('announces the Selected Hole section politely', async () => {
        const {tape, open, view} = await render({holes: HOLES});

        await open(`/tapes/${tape.id}`);

        expect(view()?.querySelector('[data-testid="selected-hole"]')?.getAttribute('aria-live')).toBe('polite');
      });

      for (const key of ['Enter', ' ']) {
        it(`selects the first Hole on ${key === ' ' ? 'Space' : key} when none is selected`, async () => {
          const {tape, open, view, settle} = await render({holes: HOLES});
          await open(`/tapes/${tape.id}`);

          await press(view(), key, settle);

          expect(selectedRects(view()).map((rect) => rect.getAttribute('data-start'))).toEqual(['10']);
        });
      }

      it('draws all Holes in the overview as one path and no rects', async () => {
        const {tape, open, view} = await render({holes: HOLES});

        await open(`/tapes/${tape.id}`);

        const overview = view()?.querySelector('[data-testid="overview"]') as Element;
        expect(overview.querySelectorAll('path[data-testid="overview-holes"]')).toHaveLength(1);
        expect(overview.querySelectorAll('rect[data-testid="hole"]')).toHaveLength(0);
      });

      it('keeps the overview Hole path element and its data when the stage scrolls', async () => {
        const {tape, open, view, settle} = await render({longTape: true});
        await open(`/tapes/${tape.id}`);
        const scroll = view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
        const path = view()?.querySelector('[data-testid="overview-holes"]') as Element;
        expect(path).not.toBeNull();
        const data = path.getAttribute('d');

        Object.defineProperty(scroll, 'scrollLeft', {value: 300, configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await settle();

        expect(view()?.querySelector('[data-testid="overview-holes"]')).toBe(path);
        expect(path.getAttribute('d')).toBe(data);
      });

      it('keeps the DOM node of an already drawn Hole after a small scroll that drops the first Holes', async () => {
        const {tape, open, view, settle} = await render({longTape: true});
        await open(`/tapes/${tape.id}`);
        const scroll = view()?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
        const key = (rect: Element) => `${rect.getAttribute('data-row')}:${rect.getAttribute('data-start')}`;
        const before = new Map(holeRects(view()).map((rect) => [key(rect), rect]));

        Object.defineProperty(scroll, 'scrollLeft', {value: 2500, configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await settle();

        const after = holeRects(view());
        const kept = after.filter((rect) => before.get(key(rect)) === rect);
        const common = after.filter((rect) => before.has(key(rect)));
        expect(common.length).toBeGreaterThan(0);
        expect(kept).toHaveLength(common.length);
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
        (control) => control.closest('[data-testid="zoom"], [data-testid="add-hole"]') === null && !['export', 'side-panel-toggle', 'undo', 'redo', 'tape-section-toggle', 'import-summary-toggle'].includes(control.getAttribute('data-testid') ?? ''),
      );
      expect(controls).toHaveLength(0);
    });

    it('cannot be opened when its Organ is unknown', async () => {
      const {tape, open, router} = await render({organUnknown: true});

      await open(`/tapes/${tape.id}`);

      expect(router.url).toBe('/tapes');
    });
  });

  describe('editing Holes with the keyboard (US1)', () => {
    // The Pipe of row r is note 52 + r. Row 24 is E5, row 25 F5. Starts count from 0, so start 10 is Column 11.
    const holes = [
      {row: 22, start: 0, length: 2},
      {row: 24, start: 10, length: 3},
      {row: 25, start: 20, length: 1},
      {row: 25, start: 30, length: 2},
    ];
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const press = async (view: HTMLElement | null, init: KeyboardEventInit, settle: () => Promise<void>) => {
      const event = new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true});
      tapeSvg(view).dispatchEvent(event);
      await settle();
      return event;
    };
    const select = async (view: HTMLElement | null, row: number, start: number, settle: () => Promise<void>) => {
      rectAt(view, row, start)?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
    };
    const setup = async (options: RenderOptions = {holes}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const snackBarOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      return {...rendered, update, snackBarOpen};
    };

    it('moves the selected Hole one Column later with Alt+ArrowRight, saving once per key', async () => {
      const {tape, view, settle, update} = await setup();
      await select(view(), 24, 10, settle);

      await press(view(), {key: 'ArrowRight', altKey: true}, settle);
      expect(update).toHaveBeenCalledTimes(1);
      await press(view(), {key: 'ArrowRight', altKey: true}, settle);

      expect(update).toHaveBeenCalledTimes(2);
      expect(storedHoles(tape.id)).toContain('24:12+3');
      expect(selected(view())).toEqual(['24:12']);
    });

    it('moves the selected Hole to the row below with Alt+ArrowDown', async () => {
      const {tape, view, settle} = await setup();
      await select(view(), 24, 10, settle);

      await press(view(), {key: 'ArrowDown', altKey: true}, settle);

      expect(storedHoles(tape.id)).toContain('25:10+3');
      expect(storedHoles(tape.id)).not.toContain('24:10+3');
      expect(selected(view())).toEqual(['25:10']);
    });

    it('changes the end with Shift+Arrow and the start with Alt+Shift+Arrow', async () => {
      const {tape, view, settle} = await setup();
      await select(view(), 24, 10, settle);

      for (let times = 0; times < 3; times++) await press(view(), {key: 'ArrowRight', shiftKey: true}, settle);
      expect(storedHoles(tape.id)).toContain('24:10+6');
      for (let times = 0; times < 2; times++) await press(view(), {key: 'ArrowRight', altKey: true, shiftKey: true}, settle);

      expect(storedHoles(tape.id)).toContain('24:12+4');
      expect(selected(view())).toEqual(['24:12']);
    });

    it('does nothing and saves nothing for Shift+ArrowLeft on a Hole of 1 Column', async () => {
      const {tape, view, settle, update} = await setup();
      await select(view(), 25, 20, settle);
      const before = storedHoles(tape.id);

      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });

    it('does nothing and saves nothing for Alt+ArrowLeft and Alt+Shift+ArrowLeft at Column 1', async () => {
      const {tape, view, settle, update} = await setup();
      await select(view(), 22, 0, settle);
      const before = storedHoles(tape.id);

      await press(view(), {key: 'ArrowLeft', altKey: true}, settle);
      await press(view(), {key: 'ArrowLeft', altKey: true, shiftKey: true}, settle);

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });

    it('removes the selected Hole with Delete and selects the next Hole of its row', async () => {
      const {tape, view, settle, update} = await setup();
      await select(view(), 25, 20, settle);

      await press(view(), {key: 'Delete'}, settle);

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).not.toContain('25:20+1');
      expect(selected(view())).toEqual(['25:30']);
    });

    it('removes the selected Hole with Backspace and selects the previous Hole when it was the last of its row', async () => {
      const {tape, view, settle} = await setup();
      await select(view(), 25, 30, settle);

      await press(view(), {key: 'Backspace'}, settle);

      expect(storedHoles(tape.id)).not.toContain('25:30+2');
      expect(selected(view())).toEqual(['25:20']);
    });

    it('selects nothing after removing the only Hole of its row', async () => {
      const {tape, view, settle} = await setup();
      await select(view(), 24, 10, settle);

      await press(view(), {key: 'Delete'}, settle);

      expect(storedHoles(tape.id)).toHaveLength(holes.length - 1);
      expect(selected(view())).toEqual([]);
    });

    it('ignores the edit keys without a selection', async () => {
      const {tape, view, settle, update} = await setup();
      const before = storedHoles(tape.id);

      await press(view(), {key: 'Delete'}, settle);
      await press(view(), {key: 'ArrowRight', altKey: true}, settle);
      await press(view(), {key: 'ArrowRight', shiftKey: true}, settle);

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });

    it('prevents the default of the edit keys', async () => {
      const {view, settle} = await setup();
      await select(view(), 24, 10, settle);

      const keys: KeyboardEventInit[] = [
        {key: 'ArrowRight', altKey: true},
        {key: 'ArrowRight', shiftKey: true},
        {key: 'ArrowRight', altKey: true, shiftKey: true},
        {key: 'ArrowDown', altKey: true},
      ];
      for (const init of keys) expect((await press(view(), init, settle)).defaultPrevented).toBe(true);
      expect((await press(view(), {key: 'Delete'}, settle)).defaultPrevented).toBe(true);
    });

    describe('onto a Hole of the same Pipe', () => {
      const crowded = [
        {row: 24, start: 10, length: 3},
        {row: 24, start: 13, length: 3},
      ];

      it('refuses the key, changes and saves nothing, and tells which Hole is in the way', async () => {
        const {tape, view, settle, update, snackBarOpen} = await setup({holes: crowded});
        await select(view(), 24, 10, settle);
        const before = storedHoles(tape.id);

        await press(view(), {key: 'ArrowRight', altKey: true}, settle);

        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
        expect(snackBarOpen).toHaveBeenCalledTimes(1);
        expect(snackBarOpen.mock.calls[0]?.[0]).toBe('The Hole would overlap the Hole of E5 at Column 14.');
      });

      it('still selects the neighbours with the plain arrows', async () => {
        const {view, settle} = await setup({holes: crowded});
        await select(view(), 24, 10, settle);

        await press(view(), {key: 'ArrowRight'}, settle);

        expect(selected(view())).toEqual(['24:13']);
      });
    });
  });

  describe('editing Holes with the pointer (US1)', () => {
    const RULER_PX = 24;
    // Row 24 is E5, row 25 F5. Starts count from 0.
    const holes = [
      {row: 24, start: 10, length: 3},
      {row: 24, start: 30, length: 3},
    ];
    const drawing = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const setup = async (options: RenderOptions = {holes}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = drawing(rendered.view());
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** Pointer position in the middle of a Column (from 0) and a row (from 1), or `offset` px from its left edge. */
      const at = (column: number, row: number, offset?: number) => ({
        clientX: (geometry.leadIn + column * geometry.columnLength + (offset === undefined ? geometry.columnLength / 2 : 0)) * SCALE + (offset ?? 0),
        clientY: (geometry.rowCentres[row - 1] ?? 0) * SCALE + RULER_PX,
      });
      const pointer = (type: string, position: {clientX: number; clientY: number}) =>
        new PointerEvent(type, {...position, pointerId: 1, button: 0, bubbles: true, cancelable: true});
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const snackBarOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const down = async (target: Element, position: {clientX: number; clientY: number}) => {
        target.dispatchEvent(pointer('pointerdown', position));
        await rendered.settle();
      };
      const move = async (position: {clientX: number; clientY: number}) => {
        svg.dispatchEvent(pointer('pointermove', position));
        await frame();
        await rendered.settle();
      };
      const up = async (position: {clientX: number; clientY: number}) => {
        svg.dispatchEvent(pointer('pointerup', position));
        await rendered.settle();
      };
      const click = async (target: Element) => {
        target.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await rendered.settle();
      };
      const handle = (end: 'start' | 'end') => rendered.view()?.querySelector(`[data-testid="hole-handle"][data-end="${end}"]`) ?? null;
      return {...rendered, svg, at, down, move, up, click, handle, update, snackBarOpen};
    };

    it('moves a Hole body to the snapped Column and row on release, with one save, and selects it', async () => {
      const {tape, view, at, down, move, up, update} = await setup();
      const body = rectAt(view(), 24, 10) as Element;

      await down(body, at(11, 24));
      await move(at(13, 25));
      await up(at(13, 25));

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toContain('25:12+3');
      expect(storedHoles(tape.id)).not.toContain('24:10+3');
      expect(selected(view())).toEqual(['25:12']);
    });

    it('treats a move under 4 px as a click: selects the Hole, edits nothing', async () => {
      const {tape, view, at, down, move, up, click, update} = await setup();
      const body = rectAt(view(), 24, 10) as Element;
      const pressed = at(11, 24);
      const before = storedHoles(tape.id);

      await down(body, pressed);
      await move({clientX: pressed.clientX + 2, clientY: pressed.clientY + 1});
      await up({clientX: pressed.clientX + 2, clientY: pressed.clientY + 1});
      await click(body);

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
      expect(selected(view())).toEqual(['24:10']);
    });

    it('moves only the end of the selected Hole when its end handle is dragged', async () => {
      const {tape, view, at, down, move, up, click, handle, update} = await setup();
      await click(rectAt(view(), 24, 10) as Element);
      const endHandle = handle('end');
      expect(endHandle).not.toBeNull();

      await down(endHandle as Element, at(13, 24, -1));
      await move(at(14, 24));
      await up(at(14, 24));

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toContain('24:10+5');
      expect(selected(view())).toEqual(['24:10']);
    });

    it('moves only the start of the selected Hole when its start handle is dragged', async () => {
      const {tape, view, at, down, move, up, click, handle, update} = await setup();
      await click(rectAt(view(), 24, 10) as Element);
      const startHandle = handle('start');
      expect(startHandle).not.toBeNull();

      await down(startHandle as Element, at(10, 24, 1));
      await move(at(11, 24));
      await up(at(11, 24));

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toContain('24:11+2');
    });

    it('marks and counts the Hole whose would-be result has a Cutting Problem while the end handle is dragged, before release', async () => {
      // Columns of 1.5 mm: a Hole of 1 Column is 1.5 mm, below the Minimum Hole Length of 2.5 mm.
      const {view, at, down, move, click, handle, update} = await setup({holes: [{row: 24, start: 10, length: 2}], columnLength: 1.5});
      await click(rectAt(view(), 24, 10) as Element);
      const marks = () => all(view(), '[data-testid="tape-scroll"] [data-testid="hole-mark"]');
      const count = () => view()?.querySelector('[data-testid="cutting-problems-count"]')?.textContent?.replace(/\s+/g, ' ').trim();
      expect(marks()).toHaveLength(0);
      expect(count()).toBe('None');

      await down(handle('end') as Element, at(12, 24, -1));
      await move(at(10, 24));

      expect(update).not.toHaveBeenCalled();
      expect(marks()).toHaveLength(1);
      expect(count()).toBe("1 Hole can't be cut");
    });

    it('offers handles for the selected Hole only', async () => {
      const {view, click, handle} = await setup();
      expect(handle('start')).toBeNull();

      await click(rectAt(view(), 24, 10) as Element);

      expect(all(view(), '[data-testid="hole-handle"]').map((element) => element.getAttribute('data-end'))).toEqual(['start', 'end']);
    });

    it('cancels the drag on Escape: nothing is saved or changed', async () => {
      const {tape, view, svg, at, down, move, up, update} = await setup();
      const before = storedHoles(tape.id);

      await down(rectAt(view(), 24, 10) as Element, at(11, 24));
      await move(at(13, 25));
      svg.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
      await up(at(13, 25));

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
      expect(rectAt(view(), 24, 10)).not.toBeNull();
    });

    it('shows the would-be Tape while dragging, before anything is saved', async () => {
      const {tape, view, at, down, move, update} = await setup();
      const before = storedHoles(tape.id);

      await down(rectAt(view(), 24, 10) as Element, at(11, 24));
      await move(at(13, 25));

      expect(rectAt(view(), 25, 12)).not.toBeNull();
      expect(rectAt(view(), 24, 10)).toBeNull();
      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });

    it('shows a refused position with the class refused, and on release tells why and changes nothing', async () => {
      const {tape, view, at, down, move, up, update, snackBarOpen} = await setup();
      const before = storedHoles(tape.id);

      await down(rectAt(view(), 24, 10) as Element, at(11, 24));
      await move(at(31, 24));

      expect(all(view(), 'rect[data-testid="hole-ghost"].refused')).toHaveLength(1);
      expect(all(view(), 'rect[data-testid="hole"].refused')).toHaveLength(0);
      await up(at(31, 24));
      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
      expect(snackBarOpen).toHaveBeenCalledTimes(1);
      expect(all(view(), 'rect[data-testid="hole"].refused')).toHaveLength(0);
    });

    describe('a refused position while dragging (contract: Pointer)', () => {
      const ghosts = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] [data-testid="hole-ghost"]');

      it('draws a refused ghost of the Hole under the pointer and leaves the Hole at its original place unchanged, during a body drag', async () => {
        const {tape, view, at, down, move, up, update} = await setup();
        const before = storedHoles(tape.id);

        await down(rectAt(view(), 24, 10) as Element, at(11, 24));
        await move(at(31, 24));

        const found = ghosts(view());
        expect(found).toHaveLength(1);
        expect(found[0]?.classList.contains('refused')).toBe(true);
        expect(found[0]?.getAttribute('data-row')).toBe('23');
        expect(found[0]?.getAttribute('data-start')).toBe('30');
        expect(rectAt(view(), 24, 10)).not.toBeNull();
        expect(rectAt(view(), 24, 10)?.classList.contains('refused')).toBe(false);
        expect(rectAt(view(), 24, 30)?.classList.contains('refused')).toBe(false);
        expect(all(view(), 'rect[data-testid="hole"].refused')).toHaveLength(0);

        await up(at(31, 24));
        expect(ghosts(view())).toHaveLength(0);
        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
      });

      it('draws a refused ghost of the Hole and leaves the Hole unchanged, during a resize drag', async () => {
        const {tape, view, at, down, move, up, click, handle, update} = await setup();
        const before = storedHoles(tape.id);
        await click(rectAt(view(), 24, 10) as Element);

        await down(handle('end') as Element, at(13, 24, -1));
        await move(at(31, 24));

        const found = ghosts(view());
        expect(found).toHaveLength(1);
        expect(found[0]?.classList.contains('refused')).toBe(true);
        expect(found[0]?.getAttribute('data-row')).toBe('23');
        expect(found[0]?.getAttribute('data-start')).toBe('10');
        expect(rectAt(view(), 24, 10)?.classList.contains('refused')).toBe(false);
        expect(all(view(), 'rect[data-testid="hole"].refused')).toHaveLength(0);

        await up(at(31, 24));
        expect(ghosts(view())).toHaveLength(0);
        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
      });
    });

    it('shows the cursors: grab over a Hole body, grabbing while dragging, ew-resize over a handle', async () => {
      const {view, svg, at, down, move, up, click, handle} = await setup();
      expect(rectAt(view(), 24, 10)?.classList.contains('grab')).toBe(true);

      await click(rectAt(view(), 24, 10) as Element);
      expect(handle('end')?.classList.contains('ew-resize')).toBe(true);

      await down(rectAt(view(), 24, 10) as Element, at(11, 24));
      await move(at(13, 24));
      expect(svg.classList.contains('grabbing')).toBe(true);
      await up(at(13, 24));
      expect(svg.classList.contains('grabbing')).toBe(false);
    });

    it('adds a Hole of the row\'s Pipe at the Column of a double-click on an empty spot, with one save, and selects it', async () => {
      const {tape, view, svg, at, update, settle} = await setup();

      svg.dispatchEvent(new MouseEvent('dblclick', {...at(20, 25), bubbles: true, cancelable: true}));
      await settle();

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:20+'))).toHaveLength(1);
      expect(selected(view())).toEqual(['25:20']);
    });

    it('adds nothing on a double-click on a Hole', async () => {
      const {tape, view, at, update, settle} = await setup();
      const before = storedHoles(tape.id);

      (rectAt(view(), 24, 10) as Element).dispatchEvent(new MouseEvent('dblclick', {...at(11, 24), bubbles: true, cancelable: true}));
      await settle();

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });
  });

  describe('adding a Hole through the side panel (US2)', () => {
    const section = (view: HTMLElement | null) => view?.querySelector('[data-testid="side-panel"] cranc-add-hole') ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    /** Chooses the Pipe by note name, types the Column (from 1) and presses the submit button. */
    const addThroughForm = async (view: HTMLElement | null, note: string, typedColumn: string, settle: () => Promise<void>) => {
      view?.querySelector<HTMLElement>('[data-testid="add-hole-pipe"] .mat-mdc-select-trigger')?.click();
      await settle();
      const option = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find((candidate) => candidate.textContent?.trim() === note);
      option?.click();
      await settle();
      const input = view?.querySelector<HTMLInputElement>('[data-testid="add-hole-column"]');
      if (input) {
        input.value = typedColumn;
        input.dispatchEvent(new Event('input'));
      }
      await settle();
      view?.querySelector<HTMLButtonElement>('[data-testid="add-hole-submit"]')?.click();
      await settle();
    };

    it('shows the "Add a Hole" section in the side panel', async () => {
      const {tape, open, view} = await render({holes: [{row: 24, start: 10, length: 3}]});

      await open(`/tapes/${tape.id}`);

      expect(section(view())).not.toBeNull();
      expect(view()?.querySelector('[data-testid="side-panel"] [data-testid="add-hole"]')?.textContent).toContain('Add a Hole');
    });

    it('adds the Hole through the form with one save, selects it and returns the focus to the drawing', async () => {
      const {tape, open, view, settle} = await render({holes: [{row: 24, start: 10, length: 3}]});
      await open(`/tapes/${tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');

      await addThroughForm(view(), 'F5', '31', settle);

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:30+'))).toHaveLength(1);
      expect(selected(view())).toEqual(['25:30']);
      expect(document.activeElement).toBe(view()?.querySelector('[data-testid="tape-scroll"] svg'));
    });

    it('adds the first Hole to a Tape without Holes', async () => {
      const {tape, open, view, settle} = await render({holes: []});
      await open(`/tapes/${tape.id}`);
      expect(storedHoles(tape.id)).toEqual([]);

      await addThroughForm(view(), 'F5', '3', settle);

      expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:2+'))).toHaveLength(1);
      expect(selected(view())).toEqual(['25:2']);
    });

    it('keeps the focus in the form when the add is refused', async () => {
      const {tape, open, view, settle} = await render({holes: [{row: 24, start: 10, length: 3}]});
      await open(`/tapes/${tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const input = view()?.querySelector<HTMLInputElement>('[data-testid="add-hole-column"]');
      input?.focus();

      await addThroughForm(view(), 'E5', '11', settle);

      expect(update).not.toHaveBeenCalled();
      expect(view()?.querySelector('[data-testid="add-hole"]')?.textContent).toContain('already covers');
      expect(document.activeElement).not.toBe(view()?.querySelector('[data-testid="tape-scroll"] svg'));
    });
  });

  describe('undo and redo (US4)', () => {
    // The Pipe of row r is note 52 + r. Row 24 is E5, row 25 F5. Starts count from 0.
    const holes = [
      {row: 22, start: 0, length: 2},
      {row: 24, start: 10, length: 3},
      {row: 25, start: 20, length: 1},
      {row: 25, start: 30, length: 2},
    ];
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const button = (view: HTMLElement | null, testId: 'undo' | 'redo') =>
      view?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`) ?? null;
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const press = async (target: Element, init: KeyboardEventInit, settle: () => Promise<void>) => {
      const event = new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true});
      target.dispatchEvent(event);
      await settle();
      return event;
    };
    const select = async (view: HTMLElement | null, row: number, start: number, settle: () => Promise<void>) => {
      rectAt(view, row, start)?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
    };
    const setup = async (options: RenderOptions = {holes}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      return {...rendered, update, opened: storedHoles(rendered.tape.id)};
    };

    describe('the buttons in the page head', () => {
      it('are Material icon buttons with the undo and redo icons', async () => {
        const {view} = await setup();

        for (const [testId, icon] of [['undo', 'undo'], ['redo', 'redo']] as const) {
          const element = button(view(), testId);
          expect(element?.classList).toContain('mat-mdc-icon-button');
          expect(element?.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
        }
      });

      it('are disabled while there is nothing to undo or redo', async () => {
        const {view} = await setup();

        expect(button(view(), 'undo')?.disabled).toBe(true);
        expect(button(view(), 'redo')?.disabled).toBe(true);
      });

      it('name the action and its shortcut in the aria-label and the tooltip on Windows', async () => {
        const {view, settle} = await setup({holes, platform: 'win32'});

        expect(button(view(), 'undo')?.getAttribute('aria-label')).toBe('Undo (Ctrl+Z)');
        expect(button(view(), 'redo')?.getAttribute('aria-label')).toContain('Redo (');
        button(view(), 'undo')?.dispatchEvent(new MouseEvent('mouseenter'));
        await settle();
        expect(document.body.querySelector('.mat-mdc-tooltip')?.textContent?.trim()).toBe('Undo (Ctrl+Z)');
      });

      it('name the Cmd shortcut on macOS', async () => {
        const {view} = await setup({holes, platform: 'darwin'});

        expect(button(view(), 'undo')?.getAttribute('aria-label')).toBe('Undo (⌘Z)');
      });

      // Global theme styles are not loaded in unit tests, so the contrast is guarded on the token value:
      // the Material default (on-surface at 38%) is below 3:1 in both schemes; light-dark() tokens carry both.
      it('colour the disabled Undo and Redo icons with at least 3:1 contrast (#121 finding 18)', async () => {
        const {view} = await setup();

        for (const testId of ['undo', 'redo'] as const) {
          const target = button(view(), testId);
          if (!target) throw new Error(`no ${testId} button`);
          const token = getComputedStyle(target).getPropertyValue('--mat-icon-button-disabled-icon-color').trim();
          const share = /^color-mix\(in srgb,\s*var\(--mat-sys-on-surface\)\s+(\d+)%/.exec(token)?.[1];
          const strongEnough = token === 'var(--mat-sys-on-surface-variant)' || (share !== undefined && Number(share) >= 60);
          expect(strongEnough, `${testId}: disabled icon colour token is "${token}"`).toBe(true);
        }
      });
    });

    it('undoes an edit with the button: the Tape and the earlier selection are back, saved once (4.1)', async () => {
      const {tape, view, settle, update, opened} = await setup();
      await select(view(), 24, 10, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', altKey: true}, settle);
      expect(selected(view())).toEqual(['24:11']);
      update.mockClear();

      button(view(), 'undo')?.click();
      await settle();

      expect(storedHoles(tape.id)).toEqual(opened);
      expect(selected(view())).toEqual(['24:10']);
      expect(update).toHaveBeenCalledTimes(1);
      expect(button(view(), 'undo')?.disabled).toBe(true);
      expect(button(view(), 'redo')?.disabled).toBe(false);
    });

    it('redoes the undone edit with the button (4.2)', async () => {
      const {tape, view, settle, update} = await setup();
      await select(view(), 24, 10, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', altKey: true}, settle);
      const edited = storedHoles(tape.id);
      button(view(), 'undo')?.click();
      await settle();
      update.mockClear();

      button(view(), 'redo')?.click();
      await settle();

      expect(storedHoles(tape.id)).toEqual(edited);
      expect(selected(view())).toEqual(['24:11']);
      expect(update).toHaveBeenCalledTimes(1);
      expect(button(view(), 'redo')?.disabled).toBe(true);
    });

    it('disables Redo after a new edit following an undo (4.3)', async () => {
      const {view, settle} = await setup();
      await select(view(), 24, 10, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', altKey: true}, settle);
      button(view(), 'undo')?.click();
      await settle();
      expect(button(view(), 'redo')?.disabled).toBe(false);

      await press(tapeSvg(view()), {key: 'ArrowDown', altKey: true}, settle);

      expect(button(view(), 'redo')?.disabled).toBe(true);
    });

    it('adds no undo step for a refused edit (4.5)', async () => {
      const {view, settle} = await setup();
      await select(view(), 25, 20, settle);

      await press(tapeSvg(view()), {key: 'ArrowLeft', shiftKey: true}, settle); // A Hole of 1 Column can not be shortened.

      expect(button(view(), 'undo')?.disabled).toBe(true);
    });

    it('undoes three edits one by one back to the opened Tape (SC-006)', async () => {
      const {tape, view, settle, update, opened} = await setup();
      await select(view(), 24, 10, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', altKey: true}, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', shiftKey: true}, settle);
      await press(tapeSvg(view()), {key: 'Delete'}, settle);
      expect(storedHoles(tape.id)).toHaveLength(opened.length - 1);
      update.mockClear();

      for (let times = 0; times < 3; times++) {
        button(view(), 'undo')?.click();
        await settle();
      }

      expect(storedHoles(tape.id)).toEqual(opened);
      expect(update).toHaveBeenCalledTimes(3);
      expect(button(view(), 'undo')?.disabled).toBe(true);
    });

    it('starts with nothing to undo when the Tape view is left and the Tape opened again (FR-014)', async () => {
      const {tape, view, open, settle} = await setup();
      await select(view(), 24, 10, settle);
      await press(tapeSvg(view()), {key: 'ArrowRight', altKey: true}, settle);
      expect(button(view(), 'undo')?.disabled).toBe(false);

      await open('/tapes');
      await open(`/tapes/${tape.id}`);

      expect(button(view(), 'undo')?.disabled).toBe(true);
      expect(button(view(), 'redo')?.disabled).toBe(true);
    });

    describe('the shortcuts', () => {
      const edited = async (platform: Platform) => {
        const rendered = await setup({holes, platform});
        await select(rendered.view(), 24, 10, rendered.settle);
        await press(tapeSvg(rendered.view()), {key: 'ArrowRight', altKey: true}, rendered.settle);
        return rendered;
      };

      it('undo with Ctrl+Z wherever the focus is in the Tape view, and prevent the default', async () => {
        const {tape, view, settle, opened} = await edited('win32');

        const event = await press(view()?.querySelector('[data-testid="export"]') as Element, {key: 'z', ctrlKey: true}, settle);

        expect(event.defaultPrevented).toBe(true);
        expect(storedHoles(tape.id)).toEqual(opened);
      });

      it('redo with Ctrl+Y and with Ctrl+Shift+Z on Windows', async () => {
        const {tape, view, settle} = await edited('win32');
        const done = storedHoles(tape.id);
        for (const init of [{key: 'y', ctrlKey: true}, {key: 'Z', ctrlKey: true, shiftKey: true}]) {
          button(view(), 'undo')?.click();
          await settle();

          const event = await press(tapeSvg(view()), init, settle);

          expect(event.defaultPrevented).toBe(true);
          expect(storedHoles(tape.id)).toEqual(done);
        }
      });

      it('undo with Cmd+Z and redo with Cmd+Shift+Z on macOS, and ignore Ctrl+Z there', async () => {
        const {tape, view, settle, opened} = await edited('darwin');
        const done = storedHoles(tape.id);

        const ctrl = await press(tapeSvg(view()), {key: 'z', ctrlKey: true}, settle);
        expect(ctrl.defaultPrevented).toBe(false);
        expect(storedHoles(tape.id)).toEqual(done);

        await press(tapeSvg(view()), {key: 'z', metaKey: true}, settle);
        expect(storedHoles(tape.id)).toEqual(opened);
        await press(tapeSvg(view()), {key: 'Z', metaKey: true, shiftKey: true}, settle);
        expect(storedHoles(tape.id)).toEqual(done);
      });

      it('keep the selected Hole when there is nothing to undo or redo', async () => {
        const {view, settle} = await setup({holes, platform: 'win32'});
        await select(view(), 24, 10, settle);

        await press(tapeSvg(view()), {key: 'z', ctrlKey: true}, settle);
        expect(selected(view())).toEqual(['24:10']);
        await press(tapeSvg(view()), {key: 'y', ctrlKey: true}, settle);
        expect(selected(view())).toEqual(['24:10']);
      });

      it('ignore Cmd+Z on Windows', async () => {
        const {tape, view, settle} = await edited('win32');
        const done = storedHoles(tape.id);

        await press(tapeSvg(view()), {key: 'z', metaKey: true}, settle);

        expect(storedHoles(tape.id)).toEqual(done);
      });

      it('leave a text field its own undo: Ctrl+Z in the Add a Hole Column field changes nothing', async () => {
        const {tape, view, settle} = await edited('win32');
        const done = storedHoles(tape.id);
        const field = view()?.querySelector('[data-testid="add-hole-column"]') as Element;

        const event = await press(field, {key: 'z', ctrlKey: true}, settle);

        expect(event.defaultPrevented).toBe(false);
        expect(storedHoles(tape.id)).toEqual(done);
      });
    });
  });

  describe('marking and listing Cutting Problems (US3)', () => {
    // The Minimum Hole Length is 2.5 mm, the Minimum Gap 1.5 mm. The Pipe of row r is note 52 + r.
    const marks = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] [data-testid="hole-mark"]');
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const press = async (view: HTMLElement | null, init: KeyboardEventInit, settle: () => Promise<void>) => {
      tapeSvg(view).dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
      await settle();
    };
    const select = async (view: HTMLElement | null, row: number, start: number, settle: () => Promise<void>) => {
      rectAt(view, row, start)?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
    };
    const squash = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const countText = (view: HTMLElement | null) => squash(view?.querySelector('[data-testid="cutting-problems-count"]'));
    const entries = (view: HTMLElement | null) => all(view, '[data-testid="cutting-problems"] [data-testid="cutting-problem"]');

    // Columns of 1.5 mm: 2 Columns are 3 mm (long enough), 1 Column is 1.5 mm (too short).
    const shortenable = {holes: [{row: 24, start: 10, length: 2}], columnLength: 1.5};
    // Columns of 1 mm: a gap of 2 Columns is 2 mm (enough), of 1 Column is 1 mm (too close).
    const spaced = {
      holes: [
        {row: 25, start: 10, length: 5},
        {row: 25, start: 17, length: 5},
      ],
      columnLength: 1,
    };

    it('marks a Hole shortened below the Minimum Hole Length and names the problem in mm on the Selected Hole', async () => {
      const {tape, open, view, settle} = await render(shortenable);
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      expect(marks(view())).toHaveLength(0);

      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);

      expect(marks(view())).toHaveLength(1);
      expect(
        all(view(), '[data-testid="selected-hole"] [data-testid="hole-warning"]').map((warning) => squash(warning)),
      ).toEqual(['Too short to cut, see Cutting Problems']);
    });

    it('marks both Holes when a move leaves a gap below the Minimum Gap, and removes the marks when it is fixed', async () => {
      const {tape, open, view, settle} = await render(spaced);
      await open(`/tapes/${tape.id}`);
      await select(view(), 25, 17, settle);
      expect(marks(view())).toHaveLength(0);

      await press(view(), {key: 'ArrowLeft', altKey: true}, settle);
      expect(marks(view())).toHaveLength(2);

      await press(view(), {key: 'ArrowRight', altKey: true}, settle);
      expect(marks(view())).toHaveLength(0);
    });

    it('counts the marked Holes and lists one entry for each in the Cutting Problems section of the side panel', async () => {
      const {tape, open, view, settle} = await render(spaced);
      await open(`/tapes/${tape.id}`);
      expect(countText(view())).toBe('None');
      expect(entries(view())).toHaveLength(0);
      await select(view(), 25, 17, settle);

      await press(view(), {key: 'ArrowLeft', altKey: true}, settle);

      expect(view()?.querySelector('[data-testid="side-panel"] [data-testid="cutting-problems"]')).not.toBeNull();
      expect(countText(view())).toBe("2 Holes can't be cut");
      expect(entries(view())).toHaveLength(2);
    });

    it('updates the count at once when the problem is fixed', async () => {
      const {tape, open, view, settle} = await render(shortenable);
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);
      expect(countText(view())).toBe("1 Hole can't be cut");

      await press(view(), {key: 'ArrowRight', shiftKey: true}, settle);

      expect(countText(view())).toBe('None');
      expect(marks(view())).toHaveLength(0);
    });

    it('selects the Hole of a chosen entry and scrolls it into view', async () => {
      const {tape, open, view, settle} = await render(shortenable);
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);
      await press(view(), {key: 'Escape'}, settle);
      expect(selected(view())).toEqual([]);
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);

      try {
        (entries(view())[0] as HTMLElement | undefined)?.click();
        await settle();

        expect(selected(view())).toEqual(['24:10']);
        expect(scrollIntoView.mock.contexts).toContain(rectAt(view(), 24, 10));
      } finally {
        scrollIntoView.mockRestore();
      }
    });

    it('opens the cutting problems dialog when Export for the Plotter is pressed on a Tape with a marked Hole', async () => {
      const {tape, open, view, settle} = await render({...shortenable, realExport: true});
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);
      const dialogOpen = vi.spyOn(TestBed.inject(MatDialog), 'open');

      try {
        view()?.querySelector<HTMLButtonElement>('[data-testid="export"]')?.click();
        await settle();

        expect(dialogOpen).toHaveBeenCalledTimes(1);
        expect(dialogOpen.mock.calls[0]?.[0]).toBe(CuttingProblemsDialogComponent);
      } finally {
        TestBed.inject(MatDialog).closeAll();
      }
    });

    describe('for a Hole whose Pipe is not on the Organ (FR-019)', () => {
      const withTwoPipes = (original: Organ): Organ => ({...testOrgan(original.name, 2), id: original.id});
      const withoutPipe = (tape: Tape, organ: Organ) => {
        const remaining = new Set(organ.pipes.slice(0, 2).map(({note}) => note));
        return tape.holes.filter((hole) => !remaining.has(hole.pipe));
      };
      const stored = (tapeId: string) => TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? [];

      it('counts it and lists it as text, not as a button, without a mark', async () => {
        const {tape, organ, open, view} = await render({organNow: withTwoPipes});
        const orphans = withoutPipe(tape, organ);
        expect(orphans.length).toBeGreaterThan(0);

        await open(`/tapes/${tape.id}`);

        const noPipeEntries = entries(view()).filter((entry) => squash(entry).includes('the Organ has no Pipe for this note'));
        expect(noPipeEntries).toHaveLength(orphans.length);
        expect(noPipeEntries.every((entry) => entry.tagName !== 'BUTTON')).toBe(true);
        expect(countText(view())).toMatch(/^\d+ Holes? can't be cut$/);
        expect(marks(view())).toHaveLength(0);
      });

      it('stays unchanged by edits of the other Holes', async () => {
        const {tape, organ, open, view, settle} = await render({organNow: withTwoPipes});
        const orphans = withoutPipe(tape, organ);
        await open(`/tapes/${tape.id}`);
        const first = all(view(), '[data-testid="tape-scroll"] rect[data-testid="hole"]')[0];
        first?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await settle();

        await press(view(), {key: 'Delete'}, settle);

        expect(stored(tape.id).filter((hole) => orphans.some((orphan) => orphan.pipe === hole.pipe && orphan.start === hole.start))).toEqual(
          orphans,
        );
        expect(stored(tape.id)).toHaveLength(tape.holes.length - 1);
      });
    });
  });

  describe('growing the Tape (US5)', () => {
    const RULER_PX = 24;
    // Row 24 is E5. The Tape has 100 Columns of 2.5 mm; the last Hole ends at its end (starts count from 0).
    const holes = [
      {row: 24, start: 10, length: 3},
      {row: 24, start: 97, length: 3},
    ];
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const storedTape = (tapeId: string) => TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId);
    const lengthOf = (tapeId: string) => storedTape(tapeId)?.length;
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const subtitle = (view: HTMLElement | null) => view?.querySelector('cranc-page-head p')?.textContent?.trim();
    const texts = (view: HTMLElement | null, testId: string) =>
      Array.from(view?.querySelectorAll(`svg [data-testid="${testId}"]`) ?? []).map((element) => element.textContent?.trim());

    const setup = async () => {
      const rendered = await render({holes});
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = rendered.view()?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      const at = (column: number, row: number, offset?: number) => ({
        clientX: (geometry.leadIn + column * geometry.columnLength + (offset === undefined ? geometry.columnLength / 2 : 0)) * SCALE + (offset ?? 0),
        clientY: (geometry.rowCentres[row - 1] ?? 0) * SCALE + RULER_PX,
      });
      const pointer = (type: string, position: {clientX: number; clientY: number}) =>
        new PointerEvent(type, {...position, pointerId: 1, button: 0, bubbles: true, cancelable: true});
      const down = async (target: Element, position: {clientX: number; clientY: number}) => {
        target.dispatchEvent(pointer('pointerdown', position));
        await rendered.settle();
      };
      const move = async (position: {clientX: number; clientY: number}) => {
        svg.dispatchEvent(pointer('pointermove', position));
        await frame();
        await rendered.settle();
      };
      const up = async (position: {clientX: number; clientY: number}) => {
        svg.dispatchEvent(pointer('pointerup', position));
        await rendered.settle();
      };
      const click = async (target: Element) => {
        target.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await rendered.settle();
      };
      const press = async (init: KeyboardEventInit) => {
        svg.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      const undo = async () => {
        rendered.view()?.querySelector<HTMLButtonElement>('[data-testid="undo"]')?.click();
        await rendered.settle();
      };
      return {...rendered, svg, at, down, move, up, click, press, undo};
    };

    it('grows the Tape when Shift+ArrowRight lengthens the last Hole past the end, and the drawing, ruler, Column numbers and subtitle follow (5.1)', async () => {
      const {tape, organ, view, click, press} = await setup();
      await click(rectAt(view(), 24, 97) as Element);
      const widthBefore = Number(view()?.querySelector('svg .tape')?.getAttribute('width'));

      for (let times = 0; times < 4; times++) await press({key: 'ArrowRight', shiftKey: true});

      const grown = storedTape(tape.id);
      expect(grown?.length).toBe(104);
      expect(Number(view()?.querySelector('svg .tape')?.getAttribute('width'))).toBeCloseTo(widthBefore + 4 * 2.5 * SCALE, 0);
      expect(subtitle(view())).toBe('For the Street organ. 104 Columns of 2.5 mm, 260 mm of Tape.');
      if (grown === undefined) return;
      expect(texts(view(), 'ruler-number')).toEqual(rulerNumbers(tapeGeometry(grown, organ).length, SCALE).map(String));
      expect(texts(view(), 'column-number')).toEqual(columnNumbers(104, 2.5 * SCALE).map(({number}) => String(number)));
      expect(view()?.querySelectorAll('svg [data-testid="column-mark"]')).toHaveLength(columnLines(104).length);
    });

    it('grows the Tape when a drag is released past its end (5.1)', async () => {
      const {tape, view, at, down, move, up, click} = await setup();
      await click(rectAt(view(), 24, 97) as Element);
      const endHandle = view()?.querySelector('[data-testid="hole-handle"][data-end="end"]') as Element;

      await down(endHandle, at(100, 24, -1));
      await move(at(103, 24));
      await up(at(103, 24));

      expect(lengthOf(tape.id)).toBe(104);
      expect(subtitle(view())).toContain('104 Columns');
    });

    it('keeps the length when the grown Hole is removed (5.2)', async () => {
      const {tape, view, click, press} = await setup();
      await click(rectAt(view(), 24, 97) as Element);
      for (let times = 0; times < 2; times++) await press({key: 'ArrowRight', shiftKey: true});

      await press({key: 'Delete'});

      expect(storedTape(tape.id)?.holes).toHaveLength(1);
      expect(lengthOf(tape.id)).toBe(102);
      expect(subtitle(view())).toContain('102 Columns');
    });

    it('shrinks the Tape back with undo, step by step (5.3)', async () => {
      const {tape, view, click, press, undo} = await setup();
      await click(rectAt(view(), 24, 97) as Element);
      for (let times = 0; times < 2; times++) await press({key: 'ArrowRight', shiftKey: true});
      await press({key: 'Delete'});

      await undo();
      expect(lengthOf(tape.id)).toBe(102);
      await undo();
      expect(lengthOf(tape.id)).toBe(101);
      await undo();

      expect(lengthOf(tape.id)).toBe(100);
      expect(subtitle(view())).toContain('100 Columns');
    });

    describe('scrolling the stage during a drag (research R6)', () => {
      const STAGE_PX = 500;
      const SCROLL_PX = 945;
      const scrollOf = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"]') as HTMLElement;
      const prepare = async () => {
        const setUp = await setup();
        const scroll = scrollOf(setUp.view());
        let scrollLeft = 0;
        const clamp = (value: number) => Math.min(Math.max(value, 0), SCROLL_PX - STAGE_PX);
        Object.defineProperty(scroll, 'clientWidth', {value: STAGE_PX, configurable: true});
        Object.defineProperty(scroll, 'scrollWidth', {value: SCROLL_PX, configurable: true});
        Object.defineProperty(scroll, 'scrollLeft', {
          configurable: true,
          get: () => scrollLeft,
          set: (value: number) => {
            scrollLeft = clamp(value);
          },
        });
        Object.defineProperty(scroll, 'scrollBy', {
          configurable: true,
          value: (first: number | ScrollToOptions) => {
            scrollLeft = clamp(scrollLeft + (typeof first === 'number' ? first : (first.left ?? 0)));
          },
        });
        Object.defineProperty(scroll, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, STAGE_PX, 300), configurable: true});
        // As in a browser, the drawing moves left by what the stage is scrolled.
        Object.defineProperty(setUp.svg, 'getBoundingClientRect', {value: () => new DOMRect(-scrollLeft, 0, 4000, 300), configurable: true});
        scroll.dispatchEvent(new Event('scroll'));
        await setUp.settle();
        return {...setUp, scroll};
      };
      // A manual frame queue: the test decides when a frame runs, so nothing depends on real timing.
      const queued = new Map<number, FrameRequestCallback>();
      let nextFrame = 1;
      const flushFrames = async (setUp: Awaited<ReturnType<typeof prepare>>, count: number) => {
        for (let index = 0; index < count; index++) {
          const callbacks = Array.from(queued.values());
          queued.clear();
          callbacks.forEach((callback) => callback(0));
          await setUp.settle();
        }
      };
      beforeEach(() => {
        queued.clear();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
          const id = nextFrame++;
          queued.set(id, callback);
          return id;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
          queued.delete(id);
        });
      });
      afterEach(() => vi.restoreAllMocks());
      const pointerEvent = (type: string, position: {clientX: number; clientY: number}) =>
        new PointerEvent(type, {...position, pointerId: 1, button: 0, bubbles: true, cancelable: true});
      const grab = async (setUp: Awaited<ReturnType<typeof prepare>>, clientX: number) => {
        const start = setUp.at(11, 24);
        await setUp.down(rectAt(setUp.view(), 24, 10) as Element, start);
        for (const x of [60, clientX]) {
          setUp.svg.dispatchEvent(pointerEvent('pointermove', {clientX: x, clientY: start.clientY}));
          await flushFrames(setUp, 1);
        }
        return {clientX, clientY: start.clientY};
      };
      const drag = async (setUp: Awaited<ReturnType<typeof prepare>>, clientX: number) => {
        await grab(setUp, clientX);
        await flushFrames(setUp, 3);
      };
      const draggedStart = (view: HTMLElement | null) =>
        Array.from(view?.querySelectorAll('[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="23"]') ?? [])
          .map((rect) => Number(rect.getAttribute('data-start')))
          .filter((start) => start !== 97);

      it('scrolls the stage right while the pointer is within 24 px of its right edge', async () => {
        const setUp = await prepare();

        await drag(setUp, STAGE_PX - 10);

        expect(setUp.scroll.scrollLeft).toBeGreaterThan(0);
      });

      it('scrolls the stage left while the pointer is within 24 px of its left edge', async () => {
        const setUp = await prepare();
        setUp.scroll.scrollLeft = 300;
        setUp.scroll.dispatchEvent(new Event('scroll'));
        await setUp.settle();
        const before = setUp.scroll.scrollLeft;
        expect(before).toBeGreaterThan(0);

        await drag(setUp, 10);

        expect(setUp.scroll.scrollLeft).toBeLessThan(before);
      });

      it('does not scroll the stage while the pointer is further than 24 px from both edges', async () => {
        const setUp = await prepare();

        await drag(setUp, STAGE_PX / 2);

        expect(setUp.scroll.scrollLeft).toBe(0);
      });

      it('moves the preview of the dragged Hole to later Columns while the stage scrolls under the resting pointer', async () => {
        const setUp = await prepare();
        await grab(setUp, STAGE_PX - 10);
        const before = draggedStart(setUp.view());
        const scrolledBefore = setUp.scroll.scrollLeft;

        await flushFrames(setUp, 3);

        expect(setUp.scroll.scrollLeft).toBeGreaterThan(scrolledBefore);
        expect(draggedStart(setUp.view())[0]).toBeGreaterThan(before[0] ?? Infinity);
      });

      it('stops scrolling the stage after the pointer is released', async () => {
        const setUp = await prepare();
        const position = await grab(setUp, STAGE_PX - 10);
        await flushFrames(setUp, 2);
        expect(setUp.scroll.scrollLeft).toBeGreaterThan(0);

        setUp.svg.dispatchEvent(pointerEvent('pointerup', position));
        await setUp.settle();
        const resting = setUp.scroll.scrollLeft;
        await flushFrames(setUp, 4);

        expect(setUp.scroll.scrollLeft).toBe(resting);
      });

      it('stops scrolling the stage after the drag is cancelled', async () => {
        const setUp = await prepare();
        await grab(setUp, STAGE_PX - 10);
        await flushFrames(setUp, 2);
        expect(setUp.scroll.scrollLeft).toBeGreaterThan(0);

        setUp.svg.dispatchEvent(pointerEvent('pointercancel', {clientX: 0, clientY: 0}));
        await setUp.settle();
        const resting = setUp.scroll.scrollLeft;
        await flushFrames(setUp, 4);

        expect(setUp.scroll.scrollLeft).toBe(resting);
      });
    });
  });
});
