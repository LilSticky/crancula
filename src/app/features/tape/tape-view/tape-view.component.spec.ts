import {BreakpointObserver, type BreakpointState} from '@angular/cdk/layout';
import {ApplicationRef, Component, computed, signal} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {firstValueFrom, type Observable, of} from 'rxjs';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {
  createTape,
  noteName,
  changeColumnLength,
  defaultSelectedParts,
  millimetres,
  newPlotterId,
  proposeTransposition,
  readMidiSong,
  type CranculaApi,
  type EditCommand,
  type MidiNoteNumber,
  type Organ,
  type Plotter,
  type PlotterDraft,
  type Tape,
  toTapeLibrarySnapshot,
  tapeGeometry,
  validatePlotter,
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
import {TapeSectionComponent} from './tape-section/tape-section.component';
import {By} from '@angular/platform-browser';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatTooltipHarness} from '@angular/material/tooltip/testing';
import {TapeRecorder, type RecordingState} from '../recording/tape-recorder';
import {PREVIEW_SOUND, type PreviewSound, type PreviewVoice} from '../preview/preview-sound';
import {type HarnessLoader} from '@angular/cdk/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {PlotterLibrary} from '../../plotter/plotter-library.store';
import {PlotterPreference} from '../../plotter/plotter-preference';

const PLOTTER_KEY = 'crancula.plotter';

/** A sheet Plotter of 300 mm working width and length, named as the user describes it. */
function cuttingMat(): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name: 'Cutting mat', workingWidth: 300, roll: false, workingLength: 300, overlap: 20};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** The scale the Tape opens at: 1:1, true size on screen. */
const SCALE = pixelsPerMillimetre('1:1', 0, 0);

/** The value, or an error that names what the view lacks. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
}

/** Whether the Preview toggle reads Stop preview: the state is told by its label, not by a pressed state. */
function isPreviewing(view: HTMLElement | null): boolean {
  return view?.querySelector('[data-testid="preview-toggle"]')?.textContent?.includes('Stop preview') ?? false;
}

/** Resolves after two animation frames, once the playhead has moved on the frame after a clock change. */
const twoFrames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Resolves after `milliseconds` of real time, long enough for the Preview's scheduler to tick. */
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

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
  /** The number of Columns of the Tape with `holes`; 100 when not given. */
  readonly columns?: number;
  /** The notes of the Organ's Pipes from row 1 on, for `holes`; the notes 53 to 77 when not given. */
  readonly pipeNotes?: readonly number[];
  /** The Column length of the Tape with `holes` in mm; 2.5 when not given. */
  readonly columnLength?: number;
  /** The language of the texts; English when not given. */
  readonly language?: 'en' | 'de';
  /** The Lead of the Song has a Time signature of 3/4 and the Key of G major in its meta events. */
  readonly metre?: boolean;
  /** Writing the Tape library fails. */
  readonly saveFails?: boolean;
  /** Uses the real PlotterExport (and the real problems dialog) instead of a stub. */
  readonly realExport?: boolean;
  /** The window width in px the faked BreakpointObserver answers for; the real one when not given. */
  readonly windowWidth?: number;
  /** The platform the shortcuts are read for; faked through the PLATFORM token. */
  readonly platform?: Platform;
  /** The Organ's Tape per Crank turn in mm; none (the Preview is unavailable) when not given. */
  readonly tapePerCrankTurn?: number;
}

/** The sound of a Preview: a clock the test moves, and a record of every start and stop. */
class FakePreviewSound implements PreviewSound {
  readonly starts: {readonly pipe: MidiNoteNumber; readonly at: number; readonly voice: PreviewVoice}[] = [];
  readonly stops: {readonly voice: PreviewVoice; readonly at: number}[] = [];
  private seconds = 0;

  now(): number {
    return this.seconds;
  }

  advance(seconds: number): void {
    this.seconds += seconds;
  }

  start(pipe: MidiNoteNumber, at: number): PreviewVoice {
    const voice: PreviewVoice = {};
    this.starts.push({pipe, at, voice});
    return voice;
  }

  stop(voice: PreviewVoice, at: number): void {
    this.stops.push({voice, at});
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}
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

/** A Time signature of 3/4 and the Key of G major at Tick 0. */
const METRE_EVENTS = [
  {delta: 0, event: {type: 'timeSignature' as const, beats: 3, beatType: 4}},
  {delta: 0, event: {type: 'keySignature' as const, fifths: 1, mode: 'major' as const}},
];

async function render(options: RenderOptions = {}) {
  const inMemory = createInMemoryCranculaApi(undefined, undefined, options.saveFails ? {tapes: {save: 'failed'}} : {});
  let finishLoad: () => void = () => undefined;
  let deferredSnapshot: ReturnType<typeof toTapeLibrarySnapshot> | null = null;
  const base = options.deferLoad
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
  // The listeners the app registered for Edit Commands from the application menu, so a test can send one.
  const editListeners = new Set<(command: EditCommand) => void>();
  const api: CranculaApi = {
    ...base,
    edit: {
      onCommand: (listener) => {
        editListeners.add(listener);
        return () => void editListeners.delete(listener);
      },
    },
  };
  const sendEditCommand = (command: EditCommand): void => {
    for (const listener of [...editListeners]) listener(command);
  };
  const plotterExport = {export: vi.fn((): Promise<void> => Promise.resolve()), saving: signal(false)};
  const previewSound = new FakePreviewSound();
  const recordingState = signal<RecordingState>({status: 'idle'});
  const recorder = {
    state: recordingState.asReadonly(),
    recording: computed(() => recordingState().status !== 'idle'),
    record: vi.fn((): Promise<void> => Promise.resolve()),
  } satisfies Pick<TapeRecorder, 'state' | 'recording' | 'record'>;
  TestBed.configureTestingModule({
    providers: [
      ...(options.realExport ? [] : [{provide: PlotterExport, useValue: plotterExport}]),
      {provide: PREVIEW_SOUND, useValue: (): PreviewSound => previewSound},
      {provide: TapeRecorder, useValue: recorder},
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
  const pipeNotes = options.pipeNotes ?? Array.from({length: 25}, (_, index) => 52 + index + 1);
  const perCrankTurn = options.tapePerCrankTurn === undefined ? {} : {tapePerCrankTurn: options.tapePerCrankTurn};
  const organ = options.holes
    ? testOrgan('Street organ', pipeNotes.length, {
        leadIn: options.leadIn ?? 0,
        pipes: pipeNotes.map((note) => ({note})),
        ...perCrankTurn,
      })
    : testOrgan('Street organ', 3, {...(options.leadIn === undefined ? {} : {leadIn: options.leadIn}), ...perCrankTurn});
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
        ...(options.metre && channel === 0 ? METRE_EVENTS : []),
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
        length: (options.columns ?? 100) as ColumnCount,
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
  /** The Tape section of the side panel, as the Tape view renders it. */
  const tapeSection = (): TapeSectionComponent => {
    const found = harness.fixture.debugElement.query(By.directive(TapeSectionComponent));
    if (found === null) throw new Error('no Tape section');
    return found.injector.get(TapeSectionComponent);
  };
  return {
    tape,
    organ,
    plotterExport,
    importSummary: created.value.importSummary,
    open,
    summaryShown,
    router,
    finish,
    view,
    settle,
    sendEditCommand,
    tapeSection,
    previewSound,
    recorder,
    recordingState,
    loader: () => TestbedHarnessEnvironment.loader(harness.fixture),
  };
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
      expect(plotterExport.export).toHaveBeenCalledWith(tape, organ, undefined);
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
      expect(values(view()).slice(0, 6).filter((_, index) => index !== 1)).toEqual([
        organ.name,
        `${tape.length}`,
        `${tape.length * 2.5} mm`,
        '30 mm',
        `${tape.holes.length}`,
      ]);
      expect(section(view())?.querySelector<HTMLInputElement>('[data-testid="column-length-input"]')?.value).toBe('2.5');
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

  describe('the Plotter section below the Tape section (T033)', () => {
    beforeEach(() => {
      localStorage.removeItem(PLOTTER_KEY);
    });

    const pickerOf = (loader: () => HarnessLoader) =>
      loader().getHarness(MatSelectHarness.with({selector: '[data-testid="plotter-picker"]'}));
    const undoButton = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="undo"]') ?? null;

    it('places the Plotter section after the Tape section in the side panel', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const panel = required(view()?.querySelector('[data-testid="side-panel"]'), 'side panel');
      const tapeSection = required(panel.querySelector('[data-testid="tape-section"]'), 'Tape section');
      const plotterSection = required(panel.querySelector('[data-testid="plotter-section"]'), 'Plotter section');
      expect(tapeSection.compareDocumentPosition(plotterSection) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('keeps the Plotter picker usable while the Preview plays', async () => {
      const {tape, open, view, loader, settle} = await render({tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);
      required(view()?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]'), 'preview toggle').click();
      await settle();
      expect(isPreviewing(view())).toBe(true);
      const plotter = cuttingMat();
      await TestBed.inject(PlotterLibrary).put(plotter);
      await settle();

      const picker = await pickerOf(loader);
      expect(await picker.isDisabled()).toBe(false);
      await picker.clickOptions({text: 'Cutting mat'});

      expect(TestBed.inject(PlotterPreference).picked()?.id).toBe(plotter.id);
      expect(isPreviewing(view())).toBe(true);
    });

    it('changes no Tape and no undo history when a Plotter is picked', async () => {
      const {tape, open, view, loader, settle} = await render();
      await open(`/tapes/${tape.id}`);
      const tapes = TestBed.inject(TapeLibrary);
      const tapesBefore = tapes.tapeEntities();
      const update = vi.spyOn(tapes, 'update');
      await TestBed.inject(PlotterLibrary).put(cuttingMat());
      await settle();
      expect(undoButton(view())?.disabled).toBe(true);

      await (await pickerOf(loader)).clickOptions({text: 'Cutting mat'});
      await settle();

      expect(TestBed.inject(PlotterPreference).picked()).toBeDefined();
      expect(update).not.toHaveBeenCalled();
      expect(tapes.tapeEntities()).toEqual(tapesBefore);
      expect(undoButton(view())?.disabled).toBe(true);
    });
  });

  describe('the Joins, Overlaps and stretches of the picked Plotter (T044, T043)', () => {
    beforeEach(() => {
      localStorage.removeItem(PLOTTER_KEY);
    });

    // 150 Columns of 3 mm (450 mm) without Holes: one Join, after Column 93, for the 300 mm working length.
    const withJoin: RenderOptions = {holes: [], columns: 150, columnLength: 3};
    // 200 Columns of 3 mm with row 1 held from Column 1 for 100 Columns: Columns 1 to 101 have no place for a Join.
    const withStretch: RenderOptions = {holes: [{row: 1, start: 0, length: 100}], columns: 200, columnLength: 3};

    /** A sheet Plotter of 300 mm working length and the given working width, or a roll Plotter of that width. */
    function plotterOf(workingWidth: number, roll = false): Plotter {
      const draft: PlotterDraft = roll
        ? {id: newPlotterId(), name: 'Vinyl cutter', workingWidth, roll: true, workingLength: null, overlap: null}
        : {id: newPlotterId(), name: 'Cutting mat', workingWidth, roll: false, workingLength: 300, overlap: 20};
      const result = validatePlotter(draft);
      if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
      return result.value;
    }

    /** Describes the Plotter in the library and picks it, as the Plotter section does. */
    async function pick(plotter: Plotter): Promise<void> {
      await TestBed.inject(PlotterLibrary).put(plotter);
      TestBed.inject(PlotterPreference).pick(plotter.id);
    }

    const drawn = (view: HTMLElement | null, testId: string) => all(view, `[data-testid="tape-scroll"] [data-testid="${testId}"]`);
    const selectedHoles = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );

    it('draws a line at the Join of the picked sheet Plotter, after the Column it follows counted from 1', async () => {
      const {tape, open, view} = await render(withJoin);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);

      expect(drawn(view(), 'join').map((join) => join.getAttribute('data-after'))).toEqual(['93']);
    });

    it('draws an Overlap band for the Join of the picked sheet Plotter', async () => {
      const {tape, open, view} = await render(withJoin);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);

      expect(drawn(view(), 'overlap')).toHaveLength(1);
    });

    it('hides each Join and Overlap from assistive technology', async () => {
      const {tape, open, view} = await render(withJoin);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);

      expect([...drawn(view(), 'join'), ...drawn(view(), 'overlap')].map((element) => element.getAttribute('aria-hidden'))).toEqual([
        'true',
        'true',
      ]);
    });

    it('draws a stretch mark over the Columns of a stretch with no place for a Join, counted from 1', async () => {
      const {tape, open, view} = await render(withStretch);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);

      const marks = drawn(view(), 'stretch-mark');
      expect(marks.map((mark) => [mark.getAttribute('data-first'), mark.getAttribute('data-last')])).toEqual([['1', '101']]);
      expect(marks.map((mark) => mark.getAttribute('aria-hidden'))).toEqual(['true']);
    });

    it('draws no Join, Overlap or stretch mark while no Plotter is picked', async () => {
      const {tape, open, view} = await render(withStretch);
      await open(`/tapes/${tape.id}`);

      expect([...drawn(view(), 'join'), ...drawn(view(), 'overlap'), ...drawn(view(), 'stretch-mark')]).toEqual([]);
    });

    it('draws no Join, Overlap or stretch mark for a roll Plotter', async () => {
      const {tape, open, view} = await render(withStretch);
      await pick(plotterOf(120, true));
      await open(`/tapes/${tape.id}`);

      expect([...drawn(view(), 'join'), ...drawn(view(), 'overlap'), ...drawn(view(), 'stretch-mark')]).toEqual([]);
    });

    it('draws no Join, Overlap or stretch mark when the Tape is too wide for the picked Plotter', async () => {
      const {tape, open, view} = await render(withJoin);
      await pick(plotterOf(50));
      await open(`/tapes/${tape.id}`);

      expect([...drawn(view(), 'join'), ...drawn(view(), 'overlap'), ...drawn(view(), 'stretch-mark')]).toEqual([]);
    });

    it('lists the stretch among the Cutting Problems with its Columns, the Plotter and its working length', async () => {
      const {tape, open, view} = await render(withStretch);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);

      const entry = view()?.querySelector('[data-testid="side-panel"] [data-testid="cutting-problem-stretch"]');
      expect(entry?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Columns 1–101 are longer than the working length of Cutting mat (300 mm) with no place for a Join',
      );
    });

    it('selects nothing and scrolls the first Column of a chosen stretch into view', async () => {
      const {tape, open, view, settle} = await render(withStretch);
      await pick(plotterOf(300));
      await open(`/tapes/${tape.id}`);
      view()
        ?.querySelector('[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="0"][data-start="0"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
      expect(selectedHoles(view())).toEqual(['1:0']);
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);

      try {
        view()?.querySelector<HTMLButtonElement>('[data-testid="cutting-problem-stretch"]')?.click();
        await settle();

        expect(selectedHoles(view())).toEqual([]);
        expect(scrollIntoView.mock.contexts).toContain(view()?.querySelector('[data-testid="tape-scroll"] [data-testid="stretch-mark"]'));
      } finally {
        scrollIntoView.mockRestore();
      }
    });
  });

  describe('the Tape pieces and Cutting Problems follow the library (T054)', () => {
    beforeEach(() => {
      localStorage.removeItem(PLOTTER_KEY);
    });

    // 150 Columns of 3 mm (450 mm) without Holes and a Lead-in of 0 mm: one Join, after Column 93, for the 300 mm working length.
    const withJoin: RenderOptions = {holes: [], columns: 150, columnLength: 3};
    // 200 Columns of 3 mm with row 1 held from Column 1 for 100 Columns: Columns 1 to 101 have no place for a Join.
    const withStretch: RenderOptions = {holes: [{row: 1, start: 0, length: 100}], columns: 200, columnLength: 3};

    /** A sheet Plotter with the given id, working length and working width 300 mm, named "Cutting mat". */
    function sheet(id: Plotter['id'], workingLength: number): Plotter {
      const draft: PlotterDraft = {id, name: 'Cutting mat', workingWidth: 300, roll: false, workingLength, overlap: 20};
      const result = validatePlotter(draft);
      if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
      return result.value;
    }

    /** Describes the Plotter in the library and picks it, as the Plotter section does. */
    async function pick(plotter: Plotter): Promise<void> {
      await TestBed.inject(PlotterLibrary).put(plotter);
      TestBed.inject(PlotterPreference).pick(plotter.id);
    }

    const joinsOf = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] [data-testid="join"]').map((join) => join.getAttribute('data-after'));
    const stretchesOf = (view: HTMLElement | null) => all(view, '[data-testid="side-panel"] [data-testid="cutting-problem-stretch"]');
    const piecesText = (view: HTMLElement | null) => view?.querySelector('[data-testid="plotter-pieces"]')?.textContent?.trim();

    it('recomputes the Join and the Tape pieces at once when the working length of the picked Plotter changes (scenario 1)', async () => {
      const {tape, open, view, settle} = await render(withJoin);
      const cuttingMat = sheet(newPlotterId(), 300);
      await pick(cuttingMat);
      await open(`/tapes/${tape.id}`);
      expect(joinsOf(view())).toEqual(['93']);

      await TestBed.inject(PlotterLibrary).put(sheet(cuttingMat.id, 600));
      await settle();

      expect(joinsOf(view())).toEqual([]);
      expect(piecesText(view())).toBe('Fits in one Tape piece');
    });

    it('recomputes the Join at once when the Lead-in of the Organ changes', async () => {
      const {tape, organ, open, view, settle} = await render(withJoin);
      await pick(sheet(newPlotterId(), 300));
      await open(`/tapes/${tape.id}`);
      expect(joinsOf(view())).toEqual(['93']);

      // With a Lead-in of 60 mm the Overlap after Column 73 is the last that ends within 300 mm.
      await TestBed.inject(OrganLibrary).put({...organ, leadIn: required(millimetres(60), 'Lead-in of 60 mm')});
      await settle();

      expect(joinsOf(view())).toEqual(['73']);
    });

    it('recomputes the Tape pieces at once when the Column length of the shown Tape changes', async () => {
      const {tape, open, view, settle, tapeSection} = await render(withJoin);
      await pick(sheet(newPlotterId(), 300));
      await open(`/tapes/${tape.id}`);

      // At 6 mm per Column the 900 mm Tape needs four Tape pieces: Joins after Columns 46, 92 and 138.
      const changed = changeColumnLength(tape, 6);
      if (!changed.ok) throw new Error('invalid test Column length: 6 mm');
      tapeSection().columnLengthChange.emit(changed.value);
      await settle();

      expect(joinsOf(view())).toEqual(['46', '92', '138']);
      expect(piecesText(view())).toBe('Cut in 4 Tape pieces');
    });

    it('shows No Plotter and drops the Cutting Problems of a Plotter that was removed (edge case)', async () => {
      const {tape, open, view, settle, loader} = await render(withStretch);
      const cuttingMat = sheet(newPlotterId(), 300);
      await pick(cuttingMat);
      await open(`/tapes/${tape.id}`);
      expect(stretchesOf(view())).toHaveLength(1);

      await TestBed.inject(PlotterLibrary).remove(cuttingMat.id);
      await settle();

      const picker = await loader().getHarness(MatSelectHarness.with({selector: '[data-testid="plotter-picker"]'}));
      expect(await picker.getValueText()).toBe('No Plotter');
      expect(stretchesOf(view())).toHaveLength(0);
      expect(all(view(), '[data-testid="tape-scroll"] [data-testid="stretch-mark"]')).toHaveLength(0);
      expect(piecesText(view())).toBeUndefined();
    });
  });

  describe('the song metre in the Tape details (US4)', () => {
    it("shows the Time signature and the Key of the Tape's Song in the Tape details, read-only, and nowhere else in the side panel", async () => {
      const {tape, open, view} = await render({metre: true});

      await open(`/tapes/${tape.id}`);

      const metre = view()?.querySelector('[data-testid="tape-section"] [data-testid="song-metre"]');
      expect(metre?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3/4, G major');
      expect(view()?.querySelectorAll('[data-testid="song-metre"]')).toHaveLength(1);
      expect(view()?.querySelector('[data-testid="side-panel"] > cranc-song-metre')).toBeNull();
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

      expect(toggle(view())?.getAttribute('aria-label')).toBe('Tape details');
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

    it('shows the page head actions as icons below 1180 px, with their labels as accessible names', async () => {
      const {tape, open, view} = await render({windowWidth: 1100, tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);

      const names: Record<string, string> = {
        'preview-toggle': 'Preview',
        transpose: 'Transpose…',
        record: 'Record',
        'side-panel-toggle': 'Tape details',
      };
      for (const [testId, name] of Object.entries(names)) {
        const button = required(view()?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`), testId);
        expect(button.classList.contains('icon-only'), testId).toBe(true);
        expect(button.getAttribute('aria-label'), testId).toBe(name);
        expect(button.textContent, testId).not.toContain(name);
      }
    });

    it('shows the page head actions as icons in German at 1280 px, with their German labels as accessible names', async () => {
      const {tape, open, view} = await render({windowWidth: 1280, tapePerCrankTurn: 100, language: 'de'});
      await open(`/tapes/${tape.id}`);

      const names: Record<string, string> = {
        'preview-toggle': 'Anhören',
        transpose: 'Transponieren…',
        record: 'Aufnehmen',
        export: 'Export für den Plotter',
      };
      for (const [testId, name] of Object.entries(names)) {
        const button = required(view()?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`), testId);
        expect(button.classList.contains('icon-only'), testId).toBe(true);
        expect(button.getAttribute('aria-label'), testId).toBe(name);
        expect(button.textContent, testId).not.toContain(name);
      }
      expect(toggle(view())).toBeNull();
      expect(panel(view())).not.toBeNull();
    });

    it('keeps the full German labels of the page head actions at 1440 px', async () => {
      const {tape, open, view} = await render({windowWidth: 1440, tapePerCrankTurn: 100, language: 'de'});
      await open(`/tapes/${tape.id}`);

      const names: Record<string, string> = {
        'preview-toggle': 'Anhören',
        transpose: 'Transponieren…',
        record: 'Aufnehmen',
      };
      for (const [testId, name] of Object.entries(names)) {
        const button = required(view()?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`), testId);
        expect(button.classList.contains('icon-only'), testId).toBe(false);
        expect(button.textContent, testId).toContain(name);
      }
    });

    it('switches the page head actions to icons when the language changes to German while the Tape view is open at 1280 px', async () => {
      const {tape, open, view, settle} = await render({windowWidth: 1280, tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);
      const preview = (): HTMLButtonElement =>
        required(view()?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="preview-toggle"]'), 'preview-toggle');
      expect(preview().classList.contains('icon-only')).toBe(false);
      expect(preview().textContent).toContain('Preview');

      await firstValueFrom(TestBed.inject(TranslateService).use('de'));
      await settle();

      expect(preview().classList.contains('icon-only')).toBe(true);
      expect(preview().getAttribute('aria-label')).toBe('Anhören');
      expect(preview().textContent).not.toContain('Anhören');
    });

    it('keeps the full English labels of the page head actions at 1280 px', async () => {
      const {tape, open, view} = await render({windowWidth: 1280, tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);

      const names: Record<string, string> = {
        'preview-toggle': 'Preview',
        transpose: 'Transpose…',
        record: 'Record',
        export: 'Export for the Plotter',
      };
      for (const [testId, name] of Object.entries(names)) {
        const button = required(view()?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`), testId);
        expect(button.classList.contains('icon-only'), testId).toBe(false);
        expect(button.textContent, testId).toContain(name);
      }
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

      it('selects the first Hole on Enter when none is selected', async () => {
        const {tape, open, view, settle} = await render({holes: HOLES});
        await open(`/tapes/${tape.id}`);

        await press(view(), 'Enter', settle);

        expect(selectedRects(view()).map((rect) => rect.getAttribute('data-start'))).toEqual(['10']);
      });

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
        (control) => control.closest('[data-testid="zoom"], [data-testid="add-hole"], [data-testid="crank-speed-slider"]') === null && !['export', 'side-panel-toggle', 'undo', 'redo', 'transpose', 'tape-section-toggle', 'import-summary-toggle', 'column-length-input', 'column-length-apply', 'crank-speed-input', 'crank-speed-apply', 'preview-toggle', 'preview-start-column', 'record'].includes(control.getAttribute('data-testid') ?? ''),
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

    it('draws the handles of a selected Hole outside its body, so a press on the body near an end moves it', async () => {
      const {view, click} = await setup();
      await click(rectAt(view(), 24, 10) as Element);
      const body = required(rectAt(view(), 24, 10), 'selected Hole');
      const bodyX = Number(body.getAttribute('x'));
      const bodyEnd = bodyX + Number(body.getAttribute('width'));
      const handles = all(view(), '[data-testid="hole-handle"]');
      expect(handles).toHaveLength(2);

      const insideBody = handles
        .filter((handle) => {
          const x = Number(handle.getAttribute('x'));
          return x < bodyEnd && x + Number(handle.getAttribute('width')) > bodyX;
        })
        .map((handle) => handle.getAttribute('data-end'));
      expect(insideBody).toEqual([]);
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
      expect(count()).toBe("1 Cutting Problem");
    });

    it('a tap on a Hole and then a still tap on its grip within the double-tap window keeps the Hole, with no save', async () => {
      const {tape, view, at, down, up, click, handle, update} = await setup();
      const hole = rectAt(view(), 24, 10) as Element;

      await down(hole, at(11, 24));
      await up(at(11, 24));
      await click(hole);
      const endHandle = handle('end') as Element;
      await down(endHandle, at(13, 24, -1));
      await up(at(13, 24, -1));
      await click(endHandle);

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toContain('24:10+3');
      expect(rectAt(view(), 24, 10)).not.toBeNull();
      expect(selected(view())).toEqual(['24:10']);
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
      const {tape, view, svg, at, down, up, click, update} = await setup();

      // A double-click sends two presses, each released and then clicked.
      await down(svg, at(20, 25));
      await up(at(20, 25));
      await click(svg);
      await down(svg, at(20, 25));
      await up(at(20, 25));
      await click(svg);

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:20+'))).toHaveLength(1);
      expect(selected(view())).toEqual(['25:20']);
    });

    it('removes a Hole on a double-click and adds nothing (spec 008: two taps on a Hole)', async () => {
      const {tape, view, at, down, up, click, update} = await setup();
      const before = storedHoles(tape.id);
      const hole = rectAt(view(), 24, 10) as Element;

      // A double-click sends two presses, each released and then clicked.
      await down(hole, at(11, 24));
      await up(at(11, 24));
      await click(hole);
      await down(hole, at(11, 24));
      await up(at(11, 24));
      await click(hole);

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toHaveLength(before.length - 1);
    });
  });

  describe('adding a Hole by tapping (US1, Spot)', () => {
    const RULER_PX = 24;
    // Row 24 is E5, row 25 F5. Starts count from 0.
    const holes = [
      {row: 24, start: 10, length: 3},
      {row: 24, start: 30, length: 3},
    ];
    const rectAt = (view: HTMLElement | null, row: number, start: number) =>
      view?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`) ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const spots = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] [data-testid="spot"]');
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );

    const setup = async (options: RenderOptions = {holes, platform: 'win32'}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = required(rendered.view()?.querySelector<SVGSVGElement>('[data-testid="tape-scroll"] svg'), 'Tape drawing');
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** A position in the middle of a Column (from 0) and a row (from 1), in client px. */
      const at = (column: number, row: number) => ({
        clientX: (geometry.leadIn + (column + 0.5) * geometry.columnLength) * SCALE,
        clientY: (geometry.rowCentres[row - 1] ?? 0) * SCALE + RULER_PX,
      });
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      /** One tap: a press and a release at the same place, by the pointer of `pointerType`. */
      const tap = async (position: {clientX: number; clientY: number}, pointerType: 'mouse' | 'touch' = 'mouse', pointerId = 1) => {
        const init = {...position, pointerId, pointerType, button: 0, bubbles: true, cancelable: true};
        svg.dispatchEvent(new PointerEvent('pointerdown', init));
        svg.dispatchEvent(new PointerEvent('pointerup', init));
        await rendered.settle();
      };
      /** What a mouse double-click delivers before its dblclick: two presses, each followed by its click. */
      const doubleClick = async (position: {clientX: number; clientY: number}) => {
        await tap(position);
        svg.dispatchEvent(new MouseEvent('click', {...position, bubbles: true}));
        await tap(position);
        svg.dispatchEvent(new MouseEvent('click', {...position, bubbles: true}));
        await rendered.settle();
      };
      const press = async (init: KeyboardEventInit): Promise<void> => {
        svg.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      const click = async (target: Element) => {
        target.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await rendered.settle();
      };
      return {...rendered, svg, geometry, at, tap, doubleClick, press, click, update};
    };

    it.each(['mouse', 'touch'] as const)('a %s tap on an empty place draws a Spot there, Minimum Hole Length wide, and clears the Hole selection', async (pointerType) => {
      // 2.5 mm Minimum Hole Length over 1 mm Columns: the Hole a tap adds spans 3 Columns.
      const {view, geometry, at, tap, click} = await setup({holes, columnLength: 1, platform: 'win32'});
      await click(rectAt(view(), 24, 10) as Element);
      expect(selected(view())).toEqual(['24:10']);

      await tap(at(20, 25), pointerType);

      expect(spots(view())).toHaveLength(1);
      expect(spots(view())[0]?.getAttribute('data-row')).toBe('24');
      expect(spots(view())[0]?.getAttribute('data-start')).toBe('20');
      expect(Number(spots(view())[0]?.getAttribute('width'))).toBeCloseTo(3 * geometry.columnLength * SCALE);
      expect(selected(view())).toEqual([]);
    });

    it('draws a Spot as wide as the Hole a tap adds, cut short before the next Hole of its Pipe', async () => {
      const {view, geometry, at, tap} = await setup({holes, columnLength: 1, platform: 'win32'});

      await tap(at(8, 24));

      expect(spots(view())[0]?.getAttribute('data-start')).toBe('8');
      expect(Number(spots(view())[0]?.getAttribute('width'))).toBeCloseTo(2 * geometry.columnLength * SCALE);
    });

    it('announces the Spot in a live region outside the drawing, and not on the Spot itself', async () => {
      const {view, at, tap} = await setup();
      const live = () => view()?.querySelector('[data-testid="spot-live"]');
      expect(live()?.getAttribute('aria-live')).toBe('polite');

      await tap(at(20, 25));

      expect(live()?.textContent?.trim()).toBe('Spot: F5, Column 21. Tap again or press Enter to add a Hole.');
      expect(live()?.closest('svg')).toBeNull();
      expect(spots(view())[0]?.hasAttribute('aria-live')).toBe(false);
    });

    it('hides the drawn Spot from assistive technology, like the ghost and the marks', async () => {
      const {view, at, tap} = await setup();

      await tap(at(20, 25));

      expect(spots(view())).toHaveLength(1);
      expect(spots(view())[0]?.getAttribute('aria-hidden')).toBe('true');
    });

    it('a tap on the selected Spot adds a Hole of Minimum Hole Length, selects it, removes the Spot, with one save', async () => {
      const {tape, view, at, tap, update} = await setup();

      await tap(at(20, 25));
      await tap(at(20, 25));

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toContain('25:20+1');
      expect(selected(view())).toEqual(['25:20']);
      expect(spots(view())).toHaveLength(0);
    });

    it('undoes the Hole added by tapping in one step', async () => {
      const {tape, view, at, tap, press} = await setup();
      const before = storedHoles(tape.id);
      await tap(at(20, 25));
      await tap(at(20, 25));
      expect(storedHoles(tape.id)).toContain('25:20+1');

      await press({key: 'z', ctrlKey: true});

      expect(storedHoles(tape.id)).toEqual(before);
      expect(rectAt(view(), 25, 20)).toBeNull();
    });

    it('a tap on another empty place moves the Spot there, without a save', async () => {
      const {view, at, tap, update} = await setup();
      await tap(at(20, 25));

      await tap(at(40, 10));

      expect(spots(view())).toHaveLength(1);
      expect(spots(view())[0]?.getAttribute('data-row')).toBe('9');
      expect(spots(view())[0]?.getAttribute('data-start')).toBe('40');
      expect(update).not.toHaveBeenCalled();
    });

    it('a tap on the Lead-in clears the Spot', async () => {
      const {view, at, tap, geometry} = await setup({holes, leadIn: 10, platform: 'win32'});
      await tap(at(20, 25));
      expect(spots(view())).toHaveLength(1);

      await tap({clientX: (geometry.leadIn / 2) * SCALE, clientY: at(0, 25).clientY});

      expect(spots(view())).toHaveLength(0);
    });

    it('two mouse clicks on one empty place, as a double-click sends them, add exactly one Hole', async () => {
      const {tape, at, doubleClick, update} = await setup();

      await doubleClick(at(20, 25));

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:20+'))).toEqual(['25:20+1']);
    });

    describe('after a touch whose pointerup never reaches the drawing (F03)', () => {
      it('a fresh tap–tap on empty Tape still adds a Hole after a touch whose lostpointercapture reaches the drawing without a pointerup', async () => {
        const {tape, svg, at, tap, update, settle} = await setup();
        // The first touch goes down on empty Tape; the browser then ends it with lostpointercapture, and no pointerup follows.
        svg.dispatchEvent(new PointerEvent('pointerdown', {...at(5, 24), pointerId: 1, pointerType: 'touch', button: 0, bubbles: true, cancelable: true}));
        svg.dispatchEvent(new PointerEvent('lostpointercapture', {pointerId: 1, pointerType: 'touch', bubbles: true}));
        await settle();

        // A fresh touch is a new pointer, so it has its own pointerId.
        await tap(at(20, 25), 'touch', 2);
        await tap(at(20, 25), 'touch', 2);

        expect(update).toHaveBeenCalledTimes(1);
        expect(storedHoles(tape.id)).toContain('25:20+1');
      });
    });

    describe('while the Preview plays', () => {
      const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;

      it('a second tap adds nothing, and the Tape view shows that editing is paused', async () => {
        const {tape, view, at, tap, update, settle} = await setup({holes, tapePerCrankTurn: 100, platform: 'win32'});
        toggle(view())?.click();
        await settle();
        const before = storedHoles(tape.id);

        await tap(at(20, 25));
        await tap(at(20, 25));

        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
        expect(required(view()?.querySelector('[data-testid="editing-paused"]'), 'editing-paused notice').textContent?.trim()).toBe(
          'Editing is paused while the Preview plays',
        );
      });
    });

    describe('moving the Spot with the keyboard (US1)', () => {
      it('moves the Spot one Column or one row per arrow key', async () => {
        const {view, at, tap, press} = await setup();
        await tap(at(20, 25));

        await press({key: 'ArrowRight'});
        expect(spots(view())[0]?.getAttribute('data-start')).toBe('21');
        await press({key: 'ArrowLeft'});
        expect(spots(view())[0]?.getAttribute('data-start')).toBe('20');
        await press({key: 'ArrowUp'});
        expect(spots(view())[0]?.getAttribute('data-row')).toBe('23');
        await press({key: 'ArrowDown'});
        expect(spots(view())[0]?.getAttribute('data-row')).toBe('24');
      });

      it('moves the Spot over the Columns of a Hole to the next free one, never onto the Hole', async () => {
        const {view, at, tap, press} = await setup();
        await tap(at(9, 24));

        await press({key: 'ArrowRight'});

        expect(spots(view())[0]?.getAttribute('data-start')).toBe('13');
      });

      it('keeps the Spot on Column 0 and on the first row', async () => {
        const {view, at, tap, press} = await setup();
        await tap(at(0, 1));

        await press({key: 'ArrowLeft'});
        await press({key: 'ArrowUp'});

        expect(spots(view())[0]?.getAttribute('data-start')).toBe('0');
        expect(spots(view())[0]?.getAttribute('data-row')).toBe('0');
      });

      it('adds a Hole of Minimum Hole Length at the Spot on Enter, selects it, and removes the Spot', async () => {
        const {tape, view, at, tap, press, update} = await setup();
        await tap(at(20, 25));

        await press({key: 'Enter'});

        expect(update).toHaveBeenCalledTimes(1);
        expect(storedHoles(tape.id)).toContain('25:20+1');
        expect(selected(view())).toEqual(['25:20']);
        expect(spots(view())).toHaveLength(0);
      });

      it('clears the Spot on Escape', async () => {
        const {view, at, tap, press, update} = await setup();
        await tap(at(20, 25));

        await press({key: 'Escape'});

        expect(spots(view())).toHaveLength(0);
        expect(selected(view())).toEqual([]);
        expect(update).not.toHaveBeenCalled();
      });

      it('moves the Hole selection by arrows as before, with no Spot drawn', async () => {
        const {view, click, press} = await setup();
        await click(rectAt(view(), 24, 10) as Element);

        await press({key: 'ArrowRight'});

        expect(selected(view())).toEqual(['24:30']);
        expect(spots(view())).toHaveLength(0);
      });
    });

    describe('double-tapping a Hole (US2)', () => {
      it.each(['mouse', 'touch'] as const)(
        'a %s double-tap on a Hole removes it with one save, and selects the next Hole of its row as Delete does',
        async (pointerType) => {
          const {tape, view, at, tap, update} = await setup();

          await tap(at(11, 24), pointerType);
          await tap(at(11, 24), pointerType);

          expect(update).toHaveBeenCalledTimes(1);
          expect(storedHoles(tape.id)).not.toContain('24:10+3');
          expect(rectAt(view(), 24, 10)).toBeNull();
          expect(selected(view())).toEqual(['24:30']);
        },
      );

      it('undoes the removal by a double-tap in one step', async () => {
        const {tape, view, at, tap, press} = await setup();
        const before = storedHoles(tape.id);
        await tap(at(11, 24));
        await tap(at(11, 24));
        expect(storedHoles(tape.id)).not.toContain('24:10+3');

        await press({key: 'z', ctrlKey: true});

        expect(storedHoles(tape.id)).toEqual(before);
        expect(rectAt(view(), 24, 10)).not.toBeNull();
      });

      it('a third tap on the Hole that the first two taps added keeps it, with one save', async () => {
        const {tape, view, at, tap, update} = await setup();

        await tap(at(20, 25));
        await tap(at(20, 25));
        await tap(at(20, 25));

        expect(update).toHaveBeenCalledTimes(1);
        expect(storedHoles(tape.id).filter((hole) => hole.startsWith('25:20+'))).toEqual(['25:20+1']);
        expect(selected(view())).toEqual(['25:20']);
      });

      it('a double-tap on a Hole removes nothing while the Preview plays', async () => {
        const {tape, view, at, tap, update, settle} = await setup({holes, tapePerCrankTurn: 100, platform: 'win32'});
        required(view()?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]'), 'preview toggle').click();
        await settle();
        const before = storedHoles(tape.id);

        await tap(at(11, 24));
        await tap(at(11, 24));

        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
        expect(required(view()?.querySelector('[data-testid="editing-paused"]'), 'editing-paused notice').textContent?.trim()).toBe(
          'Editing is paused while the Preview plays',
        );
      });
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

    describe('the Edit Commands from the application menu (#122)', () => {
      let execCommand: ReturnType<typeof vi.fn<(commandId: string) => boolean>>;

      beforeEach(() => {
        // Without a Tape handler the command falls back to the text history; jsdom may not provide execCommand.
        execCommand = vi.fn<(commandId: string) => boolean>(() => true);
        Object.defineProperty(document, 'execCommand', {configurable: true, writable: true, value: execCommand});
      });

      afterEach(() => {
        Reflect.deleteProperty(document, 'execCommand');
      });

      const moveHole = async (rendered: Awaited<ReturnType<typeof setup>>) => {
        await select(rendered.view(), 24, 10, rendered.settle);
        await press(tapeSvg(rendered.view()), {key: 'ArrowRight', altKey: true}, rendered.settle);
      };

      it('undoes and redoes the edit on the Edit Commands undo and redo', async () => {
        const rendered = await setup();
        const {tape, settle, opened, sendEditCommand} = rendered;
        await moveHole(rendered);
        const moved = storedHoles(tape.id);
        expect(moved).not.toEqual(opened);

        sendEditCommand('undo');
        await settle();
        expect(storedHoles(tape.id)).toEqual(opened);

        sendEditCommand('redo');
        await settle();
        expect(storedHoles(tape.id)).toEqual(moved);
        expect(execCommand).not.toHaveBeenCalled();
      });

      it('no longer undoes the Tape once the Tape view is left', async () => {
        const rendered = await setup();
        const {tape, router, settle, sendEditCommand} = rendered;
        await moveHole(rendered);
        const moved = storedHoles(tape.id);

        await router.navigateByUrl('/tapes');
        await settle();
        sendEditCommand('undo');
        await settle();

        expect(storedHoles(tape.id)).toEqual(moved);
        expect(execCommand).toHaveBeenCalledExactlyOnceWith('undo');
      });
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
      expect(countText(view())).toBe("2 Cutting Problems");
      expect(entries(view())).toHaveLength(2);
    });

    it('updates the count at once when the problem is fixed', async () => {
      const {tape, open, view, settle} = await render(shortenable);
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      await press(view(), {key: 'ArrowLeft', shiftKey: true}, settle);
      expect(countText(view())).toBe("1 Cutting Problem");

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
        expect(countText(view())).toMatch(/^\d+ Cutting Problems?$/);
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

  describe('transposing Holes (T008)', () => {
    // The Pipe of row r is note 52 + r. Row 24 is E5, row 25 F5, so transposing a Hole of row 24 by +1 lands on row 25.
    const holes = [{row: 24, start: 10, length: 3}];
    const transposeButton = (view: HTMLElement | null) =>
      view?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="transpose"]') ?? null;
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );

    it('shows a Transpose button in the action bar, enabled on a Tape with Holes', async () => {
      const {tape, open, view} = await render({holes});

      await open(`/tapes/${tape.id}`);

      expect(transposeButton(view())?.textContent?.trim()).toBe('Transpose…');
      expect(transposeButton(view())?.disabled).toBe(false);
    });

    it('disables the Transpose button on a Tape without Holes', async () => {
      const {tape, open, view} = await render({oneColumn: true});

      await open(`/tapes/${tape.id}`);

      expect(transposeButton(view())).not.toBeNull();
      expect(transposeButton(view())?.disabled).toBe(true);
    });

    it('commits a transposition applied in the dialog as one saved edit and selects the resulting Holes', async () => {
      const {tape, open, view, settle} = await render({holes});
      await open(`/tapes/${tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const flush = async () => {
        TestBed.inject(ApplicationRef).tick();
        await settle();
      };

      transposeButton(view())?.click();
      await flush();
      const field = document.body.querySelector<HTMLInputElement>('[data-testid="transpose-semitones"]');
      expect(field).not.toBeNull();
      if (field === null) return;
      field.value = '1';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await flush();
      document.body.querySelector<HTMLButtonElement>('[data-testid="transpose-apply"]')?.click();
      await settle();

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedHoles(tape.id)).toEqual(['25:10+3']);
      expect(selected(view())).toEqual(['25:10']);
      TestBed.inject(MatDialog).closeAll();
    });
  });

  describe('undoing a transposition (T025)', () => {
    // The Organ has no D#4, D#5 or C#4 (notes 63, 75 and 61 left out), so transposing by +1 moves a C4 Hole
    // by an octave onto C#5 and removes a D4 Hole; a C5 Hole moves onto C#5 and merges with the C4 Hole.
    const pipeNotes = Array.from({length: 25}, (_, index) => 53 + index).filter((note) => ![61, 63, 75].includes(note));
    const rowOf = (note: number): number => pipeNotes.indexOf(note) + 1;
    const holes = [
      {row: rowOf(60), start: 10, length: 3},
      {row: rowOf(72), start: 10, length: 5},
      {row: rowOf(62), start: 20, length: 2},
      {row: rowOf(66), start: 30, length: 2},
    ];
    const transposeButton = (view: HTMLElement | null) =>
      view?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="transpose"]') ?? null;
    const button = (view: HTMLElement | null, testId: 'undo' | 'redo') =>
      view?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`) ?? null;
    const rectAt = (view: HTMLElement | null, note: number, start: number): SVGRectElement => {
      const rect = view?.querySelector<SVGRectElement>(
        `[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${rowOf(note) - 1}"][data-start="${start}"]`,
      );
      if (!rect) throw new Error(`no Hole drawn on note ${note} at start ${start}`);
      return rect;
    };
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected')
        .map((rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`)
        .sort();
    /** The Holes as stored: the Pipe's note, start Column and length in Columns, sorted. */
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? [])
        .map((hole) => `${hole.pipe}:${hole.start}+${hole.length}`)
        .sort();
    const dialogInput = (testId: string): HTMLInputElement => {
      const found = document.body.querySelector(`[data-testid="${testId}"]`);
      const input = found instanceof HTMLInputElement ? found : found?.querySelector('input');
      if (!input) throw new Error(`no input in ${testId}`);
      return input;
    };

    /** Transposes the whole Tape by one semitone, selecting the C4 Hole first. */
    const transposeByOne = async () => {
      const {tape, open, view, settle} = await render({holes, pipeNotes});
      await open(`/tapes/${tape.id}`);
      const flush = async () => {
        TestBed.inject(ApplicationRef).tick();
        await settle();
      };
      const before = storedHoles(tape.id);
      rectAt(view(), 60, 10).dispatchEvent(new MouseEvent('click', {bubbles: true}));
      await settle();
      expect(selected(view())).toEqual([`${rowOf(60)}:10`]);

      transposeButton(view())?.click();
      await flush();
      dialogInput('transpose-scope-all').click();
      await flush();
      const field = document.body.querySelector<HTMLInputElement>('[data-testid="transpose-semitones"]');
      if (field === null) throw new Error('no semitones field');
      field.value = '1';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await flush();
      document.body.querySelector<HTMLButtonElement>('[data-testid="transpose-apply"]')?.click();
      await settle();

      const transposed = storedHoles(tape.id);
      expect(transposed).toEqual(['67:30+2', '73:10+5']);
      expect(selected(view())).toEqual([`${rowOf(67)}:30`, `${rowOf(73)}:10`].sort());
      return {tape, view, settle, before, transposed};
    };

    it('restores the Tape and the selection before a transposition with merges and removals in one undo', async () => {
      const {tape, view, settle, before} = await transposeByOne();
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      button(view(), 'undo')?.click();
      await settle();

      expect(storedHoles(tape.id)).toEqual(before);
      expect(selected(view())).toEqual([`${rowOf(60)}:10`]);
      expect(update).toHaveBeenCalledTimes(1);
      expect(button(view(), 'undo')?.disabled).toBe(true);
    });

    it('applies the transposition again with redo', async () => {
      const {tape, view, settle, transposed} = await transposeByOne();
      button(view(), 'undo')?.click();
      await settle();
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      button(view(), 'redo')?.click();
      await settle();

      expect(storedHoles(tape.id)).toEqual(transposed);
      expect(selected(view())).toEqual([`${rowOf(67)}:30`, `${rowOf(73)}:10`].sort());
      expect(update).toHaveBeenCalledTimes(1);
      expect(button(view(), 'redo')?.disabled).toBe(true);
    });
  });

  describe('changing the Column length (T008)', () => {
    // The Pipe of row r is note 52 + r. Row 24 has one Hole at Column 11; the Tape is 100 Columns of 2.5 mm.
    const holes = [{row: 24, start: 10, length: 3}];
    const selected = (view: HTMLElement | null) =>
      all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"].selected').map(
        (rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`,
      );
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const storedColumnLength = (tapeId: string) =>
      TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.columnLength;
    const select = async (view: HTMLElement | null, row: number, start: number, settle: () => Promise<void>) => {
      all(view, `[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`)[0]?.dispatchEvent(
        new MouseEvent('click', {bubbles: true}),
      );
      await settle();
    };
    /** The Tape with the Column length of `columnLength` mm; the other fields stay. */
    const withColumnLength = (tape: Tape, columnLength: number): Tape => {
      const changed = changeColumnLength(tape, columnLength);
      if (!changed.ok) throw new Error(`invalid test Column length: ${columnLength}`);
      return changed.value;
    };
    const numberAttribute = (element: Element, name: string) => Number(element.getAttribute(name));

    it('saves a changed Column length as one edit and keeps the selected Hole', async () => {
      const {tape, open, view, settle, tapeSection} = await render({holes});
      await open(`/tapes/${tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      await select(view(), 24, 10, settle);

      tapeSection().columnLengthChange.emit(withColumnLength(tape, 5));
      await settle();

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedColumnLength(tape.id)).toBe(5);
      expect(storedHoles(tape.id)).toEqual(['24:10+3']);
      expect(selected(view())).toEqual(['24:10']);
    });

    it('lets the Tape length text follow the new Column length', async () => {
      const {tape, organ, open, view, settle, tapeSection} = await render({holes});
      await open(`/tapes/${tape.id}`);

      tapeSection().columnLengthChange.emit(withColumnLength(tape, 5));
      await settle();

      expect(view()?.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
        `For the ${organ.name}. ${tape.length} Columns of 5 mm, ${tape.length * 5} mm of Tape.`,
      );
    });

    it('lets the drawing of the Tape body follow the new Column length', async () => {
      const {tape, organ, open, view, settle, tapeSection} = await render({holes, leadIn: 0});
      await open(`/tapes/${tape.id}`);
      const changed = withColumnLength(tape, 5);

      tapeSection().columnLengthChange.emit(changed);
      await settle();

      const body = view()?.querySelector('svg .tape');
      expect(body).not.toBeNull();
      expect(numberAttribute(body as Element, 'width')).toBeCloseTo(tapeGeometry(changed, organ).totalLength * SCALE, 1);
    });

    it('lists and marks the Cutting Problems of the applied Column length', async () => {
      // A Hole of 2 Columns is 3 mm at 1.5 mm per Column (long enough) and 2 mm at 1 mm per Column (below the 2.5 mm Minimum Hole Length).
      const {tape, open, view, settle, tapeSection} = await render({holes: [{row: 24, start: 10, length: 2}], columnLength: 1.5});
      await open(`/tapes/${tape.id}`);
      const marks = () => all(view(), '[data-testid="tape-scroll"] [data-testid="hole-mark"]');
      const countText = () => view()?.querySelector('[data-testid="cutting-problems-count"]')?.textContent?.replace(/\s+/g, ' ').trim();
      const entries = () => all(view(), '[data-testid="cutting-problems"] [data-testid="cutting-problem"]');
      expect(countText()).toBe('None');
      expect(marks()).toHaveLength(0);

      tapeSection().columnLengthChange.emit(withColumnLength(tape, 1));
      await settle();

      expect(marks()).toHaveLength(1);
      expect(countText()).toBe("1 Cutting Problem");
      expect(entries()).toHaveLength(1);
    });
  });

  describe('undoing a changed Column length (T015)', () => {
    // The Pipe of row r is note 52 + r. Row 24 has one Hole of 2 Columns at Column 10; the Tape is 100 Columns of 1.5 mm.
    const holes = [{row: 24, start: 10, length: 2}];
    const button = (view: HTMLElement | null, testId: 'undo' | 'redo') =>
      view?.querySelector<HTMLButtonElement>(`[data-testid="page-head-actions"] [data-testid="${testId}"]`) ?? null;
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const storedColumnLength = (tapeId: string) =>
      TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.columnLength;
    const storedTape = (tapeId: string): Tape => {
      const found = TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId);
      if (!found) throw new Error(`no stored Tape ${tapeId}`);
      return found;
    };
    const marks = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] [data-testid="hole-mark"]');
    const countText = (view: HTMLElement | null) =>
      view?.querySelector('[data-testid="cutting-problems-count"]')?.textContent?.replace(/\s+/g, ' ').trim();
    const press = async (target: Element, init: KeyboardEventInit, settle: () => Promise<void>) => {
      target.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
      await settle();
    };
    const select = async (view: HTMLElement | null, row: number, start: number, settle: () => Promise<void>) => {
      all(view, `[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`)[0]?.dispatchEvent(
        new MouseEvent('click', {bubbles: true}),
      );
      await settle();
    };
    /** The Tape with the Column length of `columnLength` mm; the other fields stay. */
    const withColumnLength = (tape: Tape, columnLength: number): Tape => {
      const changed = changeColumnLength(tape, columnLength);
      if (!changed.ok) throw new Error(`invalid test Column length: ${columnLength}`);
      return changed.value;
    };

    it('takes a changed Column length back in one step, with its Cutting Problems and marks', async () => {
      const {tape, open, view, settle, tapeSection} = await render({holes, columnLength: 1.5});
      await open(`/tapes/${tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      expect(countText(view())).toBe('None');

      tapeSection().columnLengthChange.emit(withColumnLength(tape, 1));
      await settle();
      expect(countText(view())).toBe("1 Cutting Problem");
      update.mockClear();

      button(view(), 'undo')?.click();
      await settle();

      expect(storedColumnLength(tape.id)).toBe(1.5);
      expect(storedHoles(tape.id)).toEqual(['24:10+2']);
      expect(countText(view())).toBe('None');
      expect(marks(view())).toHaveLength(0);
      expect(update).toHaveBeenCalledTimes(1);
      expect(button(view(), 'undo')?.disabled).toBe(true);
    });

    it('brings the Column length back with redo, with its Cutting Problems and marks', async () => {
      const {tape, open, view, settle, tapeSection} = await render({holes, columnLength: 1.5});
      await open(`/tapes/${tape.id}`);
      tapeSection().columnLengthChange.emit(withColumnLength(tape, 1));
      await settle();
      button(view(), 'undo')?.click();
      await settle();

      button(view(), 'redo')?.click();
      await settle();

      expect(storedColumnLength(tape.id)).toBe(1);
      expect(countText(view())).toBe("1 Cutting Problem");
      expect(marks(view())).toHaveLength(1);
      expect(button(view(), 'redo')?.disabled).toBe(true);
    });

    it('undoes a Hole move and a later Column length change in reverse order', async () => {
      const {tape, open, view, settle, tapeSection} = await render({holes, columnLength: 2.5});
      await open(`/tapes/${tape.id}`);
      await select(view(), 24, 10, settle);
      await press(view()?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement, {key: 'ArrowRight', altKey: true}, settle);
      expect(storedHoles(tape.id)).toEqual(['24:11+2']);

      tapeSection().columnLengthChange.emit(withColumnLength(storedTape(tape.id), 5));
      await settle();
      expect(storedColumnLength(tape.id)).toBe(5);

      button(view(), 'undo')?.click();
      await settle();
      expect(storedColumnLength(tape.id)).toBe(2.5);
      expect(storedHoles(tape.id)).toEqual(['24:11+2']);

      button(view(), 'undo')?.click();
      await settle();
      expect(storedHoles(tape.id)).toEqual(['24:10+2']);
      expect(button(view(), 'undo')?.disabled).toBe(true);
    });
  });

  describe('selecting several Holes (T020)', () => {
    const RULER_PX = 24;
    // The Pipe of row r is note 52 + r. Row 24 is E5, row 25 F5. Starts count from 0.
    // A frame from Column 5 to Column 16 over rows 24 and 25 holds the Holes at (24, 10) and (25, 12) only.
    const holes = [
      {row: 23, start: 10, length: 3},
      {row: 24, start: 10, length: 3},
      {row: 24, start: 30, length: 3},
      {row: 25, start: 12, length: 2},
      {row: 25, start: 40, length: 2},
    ];
    type Modifiers = Pick<MouseEventInit, 'ctrlKey' | 'metaKey'>;
    type Gesture = Modifiers & {readonly pointerType?: 'mouse' | 'touch' | 'pen'; readonly pointerId?: number};
    type Position = {readonly clientX: number; readonly clientY: number};
    const drawn = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] rect[data-testid="hole"]') as SVGRectElement[];
    const selected = (view: HTMLElement | null) =>
      drawn(view)
        .filter((rect) => rect.classList.contains('selected'))
        .map((rect) => `${Number(rect.getAttribute('data-row')) + 1}:${rect.getAttribute('data-start')}`)
        .sort();
    const storedHoles = (tapeId: string) =>
      (TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId)?.holes ?? []).map(
        (hole) => `${hole.pipe - 52}:${hole.start}+${hole.length}`,
      );
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const rectAt = (view: HTMLElement | null, row: number, start: number): SVGRectElement => {
      const rect = view?.querySelector<SVGRectElement>(
        `[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`,
      );
      if (!rect) throw new Error(`no Hole drawn at row ${row}, start ${start}`);
      return rect;
    };
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const setup = async (options: RenderOptions = {holes}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = tapeSvg(rendered.view());
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** The middle of a Column (from 0) in a row (from 1), in client coordinates. */
      const at = (column: number, row: number): Position => ({
        clientX: (geometry.leadIn + (column + 0.5) * geometry.columnLength) * SCALE,
        clientY: (geometry.rowCentres[row - 1] ?? 0) * SCALE + RULER_PX,
      });
      const pointer = (type: string, position: Position, gesture: Gesture = {}) =>
        new PointerEvent(type, {pointerId: 1, ...position, ...gesture, button: 0, bubbles: true, cancelable: true});
      const down = async (target: Element, position: Position, gesture: Gesture = {}) => {
        target.dispatchEvent(pointer('pointerdown', position, gesture));
        await rendered.settle();
      };
      const move = async (position: Position, gesture: Gesture = {}) => {
        svg.dispatchEvent(pointer('pointermove', position, gesture));
        await frame();
        await rendered.settle();
      };
      const up = async (position: Position, gesture: Gesture = {}) => {
        svg.dispatchEvent(pointer('pointerup', position, gesture));
        await rendered.settle();
      };
      /** The system takes a drag over as a scroll: the pointer is cancelled, and no release follows. */
      const cancel = async (gesture: Gesture = {}) => {
        svg.dispatchEvent(pointer('pointercancel', {clientX: 0, clientY: 0}, gesture));
        await rendered.settle();
      };
      const click = async (row: number, start: number, modifiers: Modifiers = {}) => {
        rectAt(rendered.view(), row, start).dispatchEvent(new MouseEvent('click', {bubbles: true, ...modifiers}));
        await rendered.settle();
      };
      const press = async (init: KeyboardEventInit) => {
        svg.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      return {...rendered, svg, at, down, move, up, cancel, click, press, update};
    };

    it('adds a Hole to the selection with Ctrl-click and takes it out again with a second Ctrl-click', async () => {
      const {view, click} = await setup({holes, platform: 'win32'});
      await click(24, 10);

      await click(24, 30, {ctrlKey: true});
      expect(selected(view())).toEqual(['24:10', '24:30']);

      await click(24, 10, {ctrlKey: true});
      expect(selected(view())).toEqual(['24:30']);
    });

    it('adds a Hole to the selection with Cmd-click on macOS', async () => {
      const {view, click} = await setup({holes, platform: 'darwin'});
      await click(24, 10);

      await click(24, 30, {metaKey: true});

      expect(selected(view())).toEqual(['24:10', '24:30']);
    });

    it('selects only the clicked Hole with a plain click after a several-Hole selection', async () => {
      const {view, click} = await setup({holes, platform: 'win32'});
      await click(24, 10);
      await click(24, 30, {ctrlKey: true});
      expect(selected(view())).toEqual(['24:10', '24:30']);

      await click(25, 12);

      expect(selected(view())).toEqual(['25:12']);
    });

    it('draws a selection frame while dragging from an empty spot and selects the Holes it overlaps on release', async () => {
      const {view, svg, at, down, move, up} = await setup({holes, platform: 'win32'});

      await down(svg, at(5, 24));
      await move(at(16, 25));

      expect(view()?.querySelector('[data-testid="selection-frame"]')).not.toBeNull();
      expect(selected(view())).toEqual([]);

      await up(at(16, 25));

      expect(selected(view())).toEqual(['24:10', '25:12']);
    });

    it('adds the Holes of a frame to the selection when dragging from an empty spot with Ctrl', async () => {
      const {view, svg, at, down, move, up, click} = await setup({holes, platform: 'win32'});
      await click(23, 10);

      await down(svg, at(5, 24), {ctrlKey: true});
      await move(at(16, 25));
      await up(at(16, 25));

      expect(selected(view())).toEqual(['23:10', '24:10', '25:12']);
    });

    it('clears the selection on a press without travel on an empty spot', async () => {
      const {view, svg, at, down, up, click} = await setup({holes, platform: 'win32'});
      await click(24, 10);
      expect(selected(view())).toEqual(['24:10']);

      await down(svg, at(5, 24));
      await up(at(5, 24));

      expect(selected(view())).toEqual([]);
    });

    it('extends the selection to the next Hole of the row with Ctrl+ArrowRight', async () => {
      const {view, click, press} = await setup({holes, platform: 'win32'});
      await click(24, 10);

      await press({key: 'ArrowRight', ctrlKey: true});

      expect(selected(view())).toEqual(['24:10', '24:30']);
    });

    it('extends the selection to the next Hole of the row with Cmd+ArrowRight on macOS', async () => {
      const {view, click, press} = await setup({holes, platform: 'darwin'});
      await click(24, 10);

      await press({key: 'ArrowRight', metaKey: true});

      expect(selected(view())).toEqual(['24:10', '24:30']);
    });

    it('selects every Hole that has a row with Ctrl+A and draws each of them selected', async () => {
      const {view, click, press} = await setup({holes, platform: 'win32'});
      await click(24, 10);

      await press({key: 'a', ctrlKey: true});

      expect(selected(view())).toEqual(['23:10', '24:10', '24:30', '25:12', '25:40']);
      expect(drawn(view())).toHaveLength(holes.length);
    });

    it('leaves out a Hole whose Pipe is not on the Organ when selecting all with Ctrl+A', async () => {
      const withTwoPipes = (original: Organ): Organ => ({...testOrgan(original.name, 2), id: original.id});
      const {tape, organ, view, press} = await setup({platform: 'win32', organNow: withTwoPipes});
      const remaining = new Set(organ.pipes.slice(0, 2).map(({note}) => note));
      const withRow = tape.holes.filter((hole) => remaining.has(hole.pipe));
      expect(withRow.length).toBeLessThan(tape.holes.length);

      await press({key: 'a', ctrlKey: true});

      expect(selected(view())).toHaveLength(withRow.length);
    });

    it('clears a several-Hole selection on Escape', async () => {
      const {view, click, press} = await setup({holes, platform: 'win32'});
      await click(24, 10);
      await click(24, 30, {ctrlKey: true});
      expect(selected(view())).toEqual(['24:10', '24:30']);

      await press({key: 'Escape'});

      expect(selected(view())).toEqual([]);
    });

    it('shows "2 Holes selected" in the Selected Hole section for two selected Holes', async () => {
      const {view, click} = await setup({holes, platform: 'win32'});
      await click(24, 10);

      await click(24, 30, {ctrlKey: true});

      const count = view()?.querySelector('[data-testid="selected-hole"] [data-testid="selection-count"]');
      expect(count?.textContent?.trim()).toBe('2 Holes selected');
    });

    it('offers no Hole handles and changes nothing with the edit keys while several Holes are selected', async () => {
      const {tape, view, click, press, update} = await setup({holes, platform: 'win32'});
      await click(24, 10);
      expect(all(view(), '[data-testid="hole-handle"]')).toHaveLength(2);
      await click(24, 30, {ctrlKey: true});
      const before = storedHoles(tape.id);

      await press({key: 'ArrowRight', altKey: true});
      await press({key: 'ArrowDown', altKey: true});
      await press({key: 'Delete'});

      expect(all(view(), '[data-testid="hole-handle"]')).toHaveLength(0);
      expect(update).not.toHaveBeenCalled();
      expect(storedHoles(tape.id)).toEqual(before);
    });

    describe('drawing by touch (US3)', () => {
      const touch: Gesture = {pointerType: 'touch'};
      const spots = (view: HTMLElement | null) => all(view, '[data-testid="tape-scroll"] [data-testid="spot"]');
      const holeAt = (view: HTMLElement | null, row: number, start: number): Element =>
        required(rectAt(view, row, start), `Hole at row ${row}, start ${start}`);

      it('draws no selection frame and selects no Spot when a touch drags on an empty spot', async () => {
        const {view, svg, at, down, move, up} = await setup({holes, platform: 'win32'});

        await down(svg, at(5, 24), touch);
        await move(at(16, 25), touch);

        expect(view()?.querySelector('[data-testid="selection-frame"]')).toBeNull();

        await up(at(16, 25), touch);

        expect(selected(view())).toEqual([]);
        expect(spots(view())).toHaveLength(0);
      });

      it('changes nothing when the system takes a touch drag over as a scroll (pointercancel)', async () => {
        const {tape, view, svg, at, down, move, cancel, click, update} = await setup({holes, platform: 'win32'});
        await click(24, 10);
        const before = storedHoles(tape.id);

        await down(svg, at(5, 24), touch);
        await move(at(16, 25), touch);
        await cancel(touch);

        expect(view()?.querySelector('[data-testid="selection-frame"]')).toBeNull();
        expect(selected(view())).toEqual(['24:10']);
        expect(spots(view())).toHaveLength(0);
        expect(update).not.toHaveBeenCalled();
        expect(storedHoles(tape.id)).toEqual(before);
      });

      it('draws a selection frame when a pen drags over empty Tape, as a mouse does', async () => {
        const {view, svg, at, down, move} = await setup({holes, platform: 'win32'});
        const pen: Gesture = {pointerType: 'pen'};

        await down(svg, at(5, 24), pen);
        await move(at(16, 25), pen);

        expect(view()?.querySelector('[data-testid="selection-frame"]')).not.toBeNull();
      });

      it('adds no Hole, selects no Spot and saves nothing when two fingers press empty Tape at once', async () => {
        const {tape, view, svg, at, down, up, update} = await setup({holes, platform: 'win32'});
        const before = storedHoles(tape.id);
        const second: Gesture = {pointerType: 'touch', pointerId: 2};

        await down(svg, at(5, 24), touch);
        await down(svg, at(20, 25), second);
        await up(at(5, 24), touch);
        await up(at(20, 25), second);

        expect(storedHoles(tape.id)).toEqual(before);
        expect(spots(view())).toHaveLength(0);
        expect(view()?.querySelector('[data-testid="selection-frame"]')).toBeNull();
        expect(update).not.toHaveBeenCalled();
      });

      it('does not move a Hole that a first finger holds while a second finger lands on empty Tape', async () => {
        const {tape, view, svg, at, down, move, up, update} = await setup({holes, platform: 'win32'});
        const before = storedHoles(tape.id);
        const second: Gesture = {pointerType: 'touch', pointerId: 2};

        await down(holeAt(view(), 24, 10), at(11, 24), touch);
        await down(svg, at(30, 25), second);
        await move(at(16, 24), touch);
        await up(at(16, 24), touch);
        await up(at(30, 25), second);

        expect(storedHoles(tape.id)).toEqual(before);
        expect(update).not.toHaveBeenCalled();
      });

      it('cancels a Hole drag when a second finger lands after the capture moved from the Hole to the drawing (F03)', async () => {
        const {tape, view, svg, at, down, move, up, update, settle} = await setup({holes, platform: 'win32'});
        const before = storedHoles(tape.id);
        const second: Gesture = {pointerType: 'touch', pointerId: 2};

        await down(holeAt(view(), 24, 10), at(11, 24), touch);
        await move(at(16, 24), touch);
        // The capture moves while the first finger is still down: a Hole that is still drawn loses it, then the drawing gets it.
        required(drawn(view()).at(0), 'a drawn Hole').dispatchEvent(new PointerEvent('lostpointercapture', {pointerId: 1, pointerType: 'touch', bubbles: true}));
        svg.dispatchEvent(new PointerEvent('gotpointercapture', {pointerId: 1, pointerType: 'touch', bubbles: true}));
        await settle();
        await down(svg, at(30, 25), second);
        await move(at(20, 24), touch);
        await up(at(20, 24), touch);
        await up(at(30, 25), second);

        expect(storedHoles(tape.id)).toEqual(before);
        expect(update).not.toHaveBeenCalled();
      });

      it('lets a touch pan the drawing: its touch-action is pan-x pan-y', async () => {
        const {view} = await setup({holes, platform: 'win32'});

        expect(getComputedStyle(tapeSvg(view())).touchAction).toBe('pan-x pan-y');
      });

      it('keeps the touch-action of Holes and their grips at none, so a touch drags them', async () => {
        const {view, click} = await setup({holes, platform: 'win32'});
        await click(24, 10);
        const handles = all(view(), '[data-testid="hole-handle"]');
        expect(handles).toHaveLength(2);

        expect(getComputedStyle(holeAt(view(), 24, 30)).touchAction).toBe('none');
        expect(getComputedStyle(holeAt(view(), 24, 10)).touchAction).toBe('none');
        for (const handle of handles) expect(getComputedStyle(handle).touchAction).toBe('none');
      });
    });
  });

  describe('dragging the playhead grip (US4)', () => {
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    /** A point in the ruler, where the playhead grip sits. */
    const RULER_Y = 4;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const playhead = (view: HTMLElement | null) => view?.querySelector('[data-testid="playhead"]') ?? null;
    const playheadColumn = (view: HTMLElement | null) => Number(required(playhead(view), 'playhead').getAttribute('data-column'));
    const grip = (view: HTMLElement | null) => required(view?.querySelector('[data-testid="playhead-grip"]'), 'playhead grip');
    const undoButton = (view: HTMLElement | null) => required(view?.querySelector<HTMLButtonElement>('[data-testid="undo"]'), 'undo');

    const setup = async () => {
      const rendered = await render({holes: sounding, tapePerCrankTurn, platform: 'win32'});
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = required(rendered.view()?.querySelector<SVGSVGElement>('[data-testid="tape-scroll"] svg'), 'Tape drawing');
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** The x position in px of the left edge of a Column (from 0), as the ruler and the playhead draw it. */
      const columnX = (column: number) => (geometry.leadIn + column * geometry.columnLength) * SCALE;
      /** A position in the ruler over the middle of a Column (from 0). */
      const onColumn = (column: number) => ({clientX: columnX(column + 0.5), clientY: RULER_Y});
      const pointer = (type: string, position: {clientX: number; clientY: number}) =>
        new PointerEvent(type, {...position, pointerId: 1, button: 0, bubbles: true, cancelable: true});
      /** The grip takes the pointer, so its presses, moves and releases are dispatched on it. */
      const down = async (position: {clientX: number; clientY: number}) => {
        grip(rendered.view()).dispatchEvent(pointer('pointerdown', position));
        await rendered.settle();
      };
      const move = async (position: {clientX: number; clientY: number}) => {
        grip(rendered.view()).dispatchEvent(pointer('pointermove', position));
        await rendered.settle();
      };
      const up = async (position: {clientX: number; clientY: number}) => {
        grip(rendered.view()).dispatchEvent(pointer('pointerup', position));
        await rendered.settle();
      };
      /** A whole drag of the grip from one position to another. */
      const drag = async (from: {clientX: number; clientY: number}, to: {clientX: number; clientY: number}) => {
        await down(from);
        await move(to);
        await up(to);
      };
      const clickToggle = async (): Promise<void> => {
        toggle(rendered.view())?.click();
        await rendered.settle();
      };
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      return {...rendered, columnX, onColumn, down, move, up, drag, clickToggle, undoButton, update};
    };

    it('moves the playhead by the Columns the grip is dragged, rounded down, when stopped', async () => {
      const {onColumn, columnX, drag, view} = await setup();

      await drag(onColumn(0), {clientX: columnX(37.9), clientY: RULER_Y});

      expect(playheadColumn(view())).toBe(37);
    });

    it('clamps the playhead to the Tape: no later than its last Column, no earlier than Column 0', async () => {
      const {onColumn, columnX, drag, view} = await setup();

      await drag(onColumn(0), {clientX: columnX(500), clientY: RULER_Y});
      expect(playheadColumn(view())).toBe(99);

      await drag(onColumn(99), {clientX: columnX(-50), clientY: RULER_Y});
      expect(playheadColumn(view())).toBe(0);
    });

    it('stops the sound when the grip is pressed while the Preview plays', async () => {
      const {onColumn, clickToggle, down, previewSound} = await setup();
      await clickToggle();
      const stopsBefore = previewSound.stops.length;

      await down(onColumn(0));

      expect(previewSound.stops.length).toBeGreaterThan(stopsBefore);
    });

    it('plays again from the Column the grip is released on, while the Preview plays', async () => {
      const {onColumn, columnX, clickToggle, down, move, up, view} = await setup();
      await clickToggle();
      await down(onColumn(0));
      await move({clientX: columnX(37.5), clientY: RULER_Y});

      await up({clientX: columnX(37.5), clientY: RULER_Y});

      expect(isPreviewing(view())).toBe(true);
      expect(playheadColumn(view())).toBe(37);
    });

    it('resumes a Preview that was playing when the grip loses its pointer, from the Column last moved to', async () => {
      const {onColumn, columnX, clickToggle, down, move, view, settle} = await setup();
      await clickToggle();
      await down(onColumn(0));
      await move({clientX: columnX(37.5), clientY: RULER_Y});

      grip(view()).dispatchEvent(new PointerEvent('lostpointercapture', {pointerId: 1, bubbles: true}));
      await settle();

      expect(isPreviewing(view())).toBe(true);
      expect(playheadColumn(view())).toBe(37);
    });

    it('does not pass the lost pointer capture of the grip on to the drawing', async () => {
      const {onColumn, clickToggle, down, view, settle} = await setup();
      await clickToggle();
      await down(onColumn(0));
      const onDrawing = vi.fn();
      const svg = required(view()?.querySelector('[data-testid="tape-scroll"] svg'), 'Tape drawing');
      svg.addEventListener('lostpointercapture', onDrawing);

      grip(view()).dispatchEvent(new PointerEvent('lostpointercapture', {pointerId: 1, bubbles: true}));
      await settle();

      expect(onDrawing).not.toHaveBeenCalled();
    });

    it('leaves the Tape and the undo history unchanged by a playhead drag while the Preview plays', async () => {
      const {onColumn, columnX, clickToggle, drag, update, undoButton, view, tape} = await setup();
      const storedHoles = () => TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tape.id)?.holes;
      const holesBefore = storedHoles();
      const undoDisabledBefore = undoButton(view()).disabled;
      await clickToggle();

      await drag(onColumn(0), {clientX: columnX(37.5), clientY: RULER_Y});

      expect(update).not.toHaveBeenCalled();
      expect(storedHoles()).toEqual(holesBefore);
      expect(undoButton(view()).disabled).toBe(undoDisabledBefore);
    });
  });

  describe('the Preview in the Tape view (T024)', () => {
    /** A Hole at Column 0 of the first Pipe, so a Preview starts a voice at once and the fake sound records its stop. */
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const playhead = (view: HTMLElement | null) => view?.querySelector('[data-testid="playhead"]') ?? null;
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;
    const numberAttribute = (element: Element, name: string) => Number(element.getAttribute(name));

    const setup = async (options: RenderOptions = {holes: sounding, tapePerCrankTurn}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      return rendered;
    };

    const press = async (target: Element, init: KeyboardEventInit, settle: () => Promise<void>) => {
      target.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
      await settle();
    };

    describe('the toggle', () => {
      it('reads Preview before it plays, and has no pressed state', async () => {
        const {view} = await setup();

        expect(isPreviewing(view())).toBe(false);
        expect(toggle(view())?.textContent).toContain('Preview');
        expect(toggle(view())?.textContent).not.toContain('Stop');
        expect(toggle(view())?.hasAttribute('aria-pressed')).toBe(false);
      });

      it('reads Stop preview while it plays, and has no pressed state', async () => {
        const {view, settle} = await setup();

        toggle(view())?.click();
        await settle();

        expect(isPreviewing(view())).toBe(true);
        expect(toggle(view())?.textContent).toContain('Stop preview');
        expect(toggle(view())?.hasAttribute('aria-pressed')).toBe(false);
      });

      it('starts the Preview on a click and stops it on the next click', async () => {
        const {view, settle, previewSound} = await setup();

        toggle(view())?.click();
        await settle();
        expect(previewSound.starts.length).toBeGreaterThan(0);
        expect(previewSound.stops).toHaveLength(0);

        toggle(view())?.click();
        await settle();
        expect(isPreviewing(view())).toBe(false);
        expect(previewSound.stops.length).toBeGreaterThan(0);
      });

      it('is enabled and shows no unavailable notice when the Organ has a Tape per Crank turn', async () => {
        const {view} = await setup();

        expect(toggle(view())?.disabled).toBe(false);
        expect(view()?.querySelector('[data-testid="preview-unavailable"]')).toBeNull();
      });

      it('toggles with Space when the focus is on the Tape view', async () => {
        const {view, settle} = await setup();

        await press(tapeSvg(view()), {key: ' '}, settle);
        expect(isPreviewing(view())).toBe(true);

        await press(tapeSvg(view()), {key: ' '}, settle);
        expect(isPreviewing(view())).toBe(false);
      });

      it('starts the Preview on Space with nothing selected and selects no Hole', async () => {
        const {view, settle} = await setup();

        await press(tapeSvg(view()), {key: ' '}, settle);

        expect(isPreviewing(view())).toBe(true);
        expect(view()?.querySelectorAll('[data-testid="tape-scroll"] rect[data-testid="hole"].selected')).toHaveLength(0);
      });

      it('ignores a repeated Space keydown so holding Space does not toggle again', async () => {
        const {view, settle} = await setup();

        await press(tapeSvg(view()), {key: ' '}, settle);
        expect(isPreviewing(view())).toBe(true);

        await press(tapeSvg(view()), {key: ' ', repeat: true}, settle);

        expect(isPreviewing(view())).toBe(true);
      });

      it('ignores Space in a text field', async () => {
        const {view, settle} = await setup();
        const field = view()?.querySelector('[data-testid="add-hole-column"]');
        expect(field).not.toBeNull();

        await press(field as Element, {key: ' '}, settle);

        expect(isPreviewing(view())).toBe(false);
      });

      it('ignores Space on the toggle itself, which answers its own click', async () => {
        const {view, settle} = await setup();

        await press(toggle(view()) as HTMLButtonElement, {key: ' '}, settle);

        expect(isPreviewing(view())).toBe(false);
      });

      /** Dispatches Space on `target` and tells whether the view left the key to it (not prevented). */
      const spaceOn = async (target: Element, settle: () => Promise<void>): Promise<boolean> => {
        const event = new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true});
        target.dispatchEvent(event);
        await settle();
        return event.defaultPrevented;
      };

      it('ignores Space in a combobox, such as the Pipe picker of Add a Hole', async () => {
        const {view, settle} = await setup();
        const picker = required(view()?.querySelector('[data-testid="add-hole-pipe"]'), 'Pipe picker');
        expect(picker.getAttribute('role')).toBe('combobox');

        const prevented = await spaceOn(picker, settle);

        expect(isPreviewing(view())).toBe(false);
        expect(prevented).toBe(false);
      });

      it('ignores Space on a link, and leaves the key to it', async () => {
        const {view, settle} = await setup({holes: sounding});
        const link = required(view()?.querySelector('[data-testid="preview-open-organ"]'), 'link to the Organ');

        const prevented = await spaceOn(link, settle);

        expect(isPreviewing(view())).toBe(false);
        expect(prevented).toBe(false);
      });

      it('ignores Space on an option', async () => {
        const {view, settle} = await setup();
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        required(view(), 'view').appendChild(option);

        const prevented = await spaceOn(option, settle);

        expect(isPreviewing(view())).toBe(false);
        expect(prevented).toBe(false);
      });

      it('ignores Space in a contenteditable element', async () => {
        const {view, settle} = await setup();
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        required(view(), 'view').appendChild(editable);

        const prevented = await spaceOn(editable, settle);

        expect(isPreviewing(view())).toBe(false);
        expect(prevented).toBe(false);
      });

      it('ignores Space that an earlier listener already prevented', async () => {
        const {view, settle} = await setup();
        const prevent = (event: KeyboardEvent): void => {
          event.preventDefault();
        };
        // On the view's root, which sees the event before the Tape view does (the fixture is not in the document).
        const root = view();
        root?.addEventListener('keydown', prevent, {capture: true});
        try {
          await press(tapeSvg(root), {key: ' '}, settle);
        } finally {
          root?.removeEventListener('keydown', prevent, {capture: true});
        }

        expect(isPreviewing(view())).toBe(false);
      });
    });

    describe('the playhead', () => {
      it('is drawn at Column 0 when stopped, at the Lead-in, with its Column in data-column', async () => {
        const {tape, organ, view} = await setup({holes: sounding, tapePerCrankTurn, leadIn: 30});
        const {leadIn, columnLength} = tapeGeometry(tape, organ);

        const line = playhead(view());

        expect(line).not.toBeNull();
        expect(numberAttribute(line as Element, 'data-column')).toBe(0);
        expect(numberAttribute(line as Element, 'x')).toBeCloseTo((leadIn + 0 * columnLength) * SCALE, 1);
      });
    });

    describe('without a Tape per Crank turn', () => {
      it('keeps the toggle focusable, marks it aria-disabled, and describes it by the reason', async () => {
        const {view} = await setup({});
        const reason = required(view()?.querySelector('[data-testid="preview-unavailable-reason"]'), 'unavailable reason');

        expect(toggle(view())?.disabled).toBe(false);
        expect(toggle(view())?.getAttribute('aria-disabled')).toBe('true');
        expect(reason.id).not.toBe('');
        expect(toggle(view())?.getAttribute('aria-describedby')).toBe(reason.id);
        expect(reason.textContent?.trim()).toBe("Set the Organ's Tape per Crank turn to hear this Tape");
      });

      it('keeps the reason for the toggle in the DOM while the compact side panel is closed', async () => {
        const {tape, open, view} = await render({windowWidth: 1100});
        await open(`/tapes/${tape.id}`);

        expect(view()?.querySelector('[data-testid="side-panel"]')).toBeNull();
        const reason = required(view()?.querySelector('[data-testid="preview-unavailable-reason"]'), 'unavailable reason');
        expect(toggle(view())?.getAttribute('aria-describedby')).toBe(reason.id);
      });

      it('shows the unavailable notice inside the side panel, not in the stage, and links to the Organ editor', async () => {
        const {tape, organ, open, view} = await render({windowWidth: 1400});
        await open(`/tapes/${tape.id}`);

        const notice = required(view()?.querySelector('[data-testid="preview-unavailable"]'), 'unavailable notice');
        expect(notice.closest('aside.side-panel')).not.toBeNull();
        expect(view()?.querySelector('[data-testid="preview-open-organ"]')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
      });
    });

    describe('leaving the Tape view', () => {
      it('stops the Preview when the view is destroyed', async () => {
        const {view, settle, previewSound, router} = await setup();
        toggle(view())?.click();
        await settle();
        const stopsBefore = previewSound.stops.length;

        await router.navigateByUrl('/tapes');
        await settle();

        expect(previewSound.stops.length).toBeGreaterThan(stopsBefore);
      });
    });
  });

  describe('recording a Tape (T023)', () => {
    it('shows a Record button with its text left of Export in the page head', async () => {
      const {tape, open, view} = await render();
      await open(`/tapes/${tape.id}`);

      const record = required(view()?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="record"]'), 'record button');
      const exportButton = required(view()?.querySelector<HTMLButtonElement>('[data-testid="page-head-actions"] [data-testid="export"]'), 'export button');
      expect(record.textContent).toContain('Record');
      expect(record.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('records the shown Tape with its Organ when Record is pressed', async () => {
      const {tape, organ, open, view, settle, recorder} = await render({tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);

      required(view()?.querySelector<HTMLButtonElement>('[data-testid="record"]'), 'record button').click();
      await settle();

      expect(recorder.record).toHaveBeenCalledTimes(1);
      expect(recorder.record).toHaveBeenCalledWith(tape, organ);
    });

    it('is disabled, and shows the percent of the Recording, while it runs', async () => {
      const {tape, open, view, settle, recordingState} = await render({tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);

      recordingState.set({status: 'rendering', progress: 0.42});
      await settle();

      const record = required(view()?.querySelector<HTMLButtonElement>('[data-testid="record"]'), 'record button');
      expect(record.getAttribute('aria-disabled')).toBe('true');
      expect(record.textContent?.replace(/\s+/g, ' ')).toContain('Recording… 42 %');
    });

    it('shows a spinner and the Record text, without a percent, while the file is chosen and while writing', async () => {
      const {tape, open, view, settle, recordingState} = await render({tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);

      for (const status of ['choosing', 'writing'] as const) {
        recordingState.set({status});
        await settle();

        const record = required(view()?.querySelector<HTMLButtonElement>('[data-testid="record"]'), 'record button');
        const spinner = required(record.querySelector('mat-progress-spinner'), 'spinner');
        expect(spinner.getAttribute('aria-valuenow')).toBeNull();
        expect(record.textContent?.replace(/\s+/g, ' ')).toContain('Record');
        expect(record.textContent).not.toContain('%');
      }
    });

    describe('while it records (UX review 1 to 3)', () => {
      const recordButton = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="record"]') ?? null;

      it('replaces the record icon with a determinate spinner that shows the percent, on the label line', async () => {
        const {tape, open, view, settle, recordingState} = await render({tapePerCrankTurn: 100});
        await open(`/tapes/${tape.id}`);

        recordingState.set({status: 'rendering', progress: 0.2});
        await settle();

        const record = required(recordButton(view()), 'record button');
        expect(record.querySelector('mat-icon')).toBeNull();
        const spinner = required(record.querySelector('mat-progress-spinner'), 'spinner');
        expect(spinner.getAttribute('aria-valuenow')).toBe('20');
        expect(record.textContent?.replace(/\s+/g, ' ')).toContain('Recording… 20 %');
      });

      it('keeps the normal colours of the button: not disabled, but aria-disabled and aria-busy', async () => {
        const {tape, open, view, settle, recordingState} = await render({tapePerCrankTurn: 100});
        await open(`/tapes/${tape.id}`);

        recordingState.set({status: 'encoding', progress: 0.5});
        await settle();

        const record = required(recordButton(view()), 'record button');
        expect(record.classList.contains('mat-mdc-button-disabled')).toBe(false);
        expect(record.getAttribute('aria-disabled')).toBe('true');
        expect(record.getAttribute('aria-busy')).toBe('true');
      });

      it('does not record when pressed while it records', async () => {
        const {tape, open, view, settle, recordingState, recorder} = await render({tapePerCrankTurn: 100});
        await open(`/tapes/${tape.id}`);

        recordingState.set({status: 'writing'});
        await settle();
        required(recordButton(view()), 'record button').click();
        await settle();

        expect(recorder.record).not.toHaveBeenCalled();
      });

      it('shows the spinner instead of the dot below 1180 px, and the percent as tooltip and accessible name', async () => {
        const {tape, open, view, settle, recordingState, loader} = await render({windowWidth: 1100, tapePerCrankTurn: 100});
        await open(`/tapes/${tape.id}`);

        recordingState.set({status: 'rendering', progress: 0.2});
        await settle();

        const record = required(recordButton(view()), 'record button');
        expect(record.querySelector('mat-icon')).toBeNull();
        expect(record.querySelector('mat-progress-spinner')).not.toBeNull();
        expect(record.getAttribute('aria-label')).toBe('Recording… 20 %');
        const tooltip = await loader().getHarness(MatTooltipHarness.with({selector: '[data-testid="record"]'}));
        await tooltip.show();
        expect(await tooltip.getTooltipText()).toBe('Recording… 20 %');
      });
    });

    it('does not record when Record is clicked while the Preview plays', async () => {
      const {tape, open, view, settle, recorder} = await render({holes: [{row: 1, start: 0, length: 10}], tapePerCrankTurn: 100});
      await open(`/tapes/${tape.id}`);
      required(view()?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]'), 'preview toggle').click();
      await settle();

      required(view()?.querySelector<HTMLButtonElement>('[data-testid="record"]'), 'record button').click();
      await settle();

      expect(recorder.record).not.toHaveBeenCalled();
    });

    it('does not start the Preview when its button is clicked for a Tape without a Tape per Crank turn', async () => {
      const {tape, open, view, settle, previewSound} = await render({holes: [{row: 1, start: 0, length: 10}]});
      await open(`/tapes/${tape.id}`);

      required(view()?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]'), 'preview toggle').click();
      await settle();

      expect(isPreviewing(view())).toBe(false);
      expect(previewSound.starts).toHaveLength(0);
    });
  });

  describe('recording and the Preview (T026)', () => {
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const recordButton = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="record"]') ?? null;
    const tapeSvg = (view: HTMLElement | null) => view?.querySelector('[data-testid="tape-scroll"] svg') as SVGSVGElement;

    it('disables Record with the tooltip for a Tape per Crank turn when the Organ has none', async () => {
      const {tape, open, view, loader} = await render();
      await open(`/tapes/${tape.id}`);

      expect(recordButton(view())?.getAttribute('aria-disabled')).toBe('true');
      const tooltip = await loader().getHarness(MatTooltipHarness.with({selector: '[data-testid="record"]'}));
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe("Set the Organ's Tape per Crank turn to record this Tape");
    });

    it('disables Record with the tooltip to stop the Preview while the Preview plays', async () => {
      const {tape, open, view, settle, loader} = await render({holes: sounding, tapePerCrankTurn});
      await open(`/tapes/${tape.id}`);

      toggle(view())?.click();
      await settle();

      expect(recordButton(view())?.getAttribute('aria-disabled')).toBe('true');
      const tooltip = await loader().getHarness(MatTooltipHarness.with({selector: '[data-testid="record"]'}));
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe('Stop the Preview to record this Tape');
    });

    it('disables the Preview button with the tooltip to wait for the Recording while recording', async () => {
      const {tape, open, view, settle, recordingState, loader} = await render({holes: sounding, tapePerCrankTurn});
      await open(`/tapes/${tape.id}`);

      recordingState.set({status: 'writing'});
      await settle();

      expect(toggle(view())?.getAttribute('aria-disabled')).toBe('true');
      const tooltip = await loader().getHarness(MatTooltipHarness.with({selector: '[data-testid="preview-toggle"]'}));
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe('Wait for the Recording to finish');
    });

    it('does not start the Preview on Space while recording', async () => {
      const {tape, open, view, settle, recordingState, previewSound} = await render({holes: sounding, tapePerCrankTurn});
      await open(`/tapes/${tape.id}`);

      recordingState.set({status: 'writing'});
      await settle();
      tapeSvg(view()).dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true}));
      await settle();

      expect(isPreviewing(view())).toBe(false);
      expect(previewSound.starts).toHaveLength(0);
    });
  });

  describe('the start Column (T036)', () => {
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const playhead = (view: HTMLElement | null) => view?.querySelector('[data-testid="playhead"]') ?? null;

    const setup = async () => {
      const rendered = await render({holes: sounding, tapePerCrankTurn});
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const svg = required(rendered.view()?.querySelector<SVGSVGElement>('[data-testid="tape-scroll"] svg'), 'Tape drawing');
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** The x position in px of the left edge of a Column (from 0), as the ruler and the playhead draw it. */
      const columnX = (column: number) => (geometry.leadIn + column * geometry.columnLength) * SCALE;
      const clickRuler = async (clientX: number): Promise<void> => {
        required(rendered.view()?.querySelector('[data-testid="ruler"]'), 'ruler').dispatchEvent(new MouseEvent('click', {bubbles: true, clientX, clientY: 4}));
        await rendered.settle();
      };
      /** Types a Column into the start field the way a user does (1-based), and presses Enter. */
      const typeStart = async (text: string): Promise<void> => {
        const field = required(rendered.view()?.querySelector<HTMLInputElement>('[data-testid="preview-start-column"]'), 'start Column field');
        field.value = text;
        field.dispatchEvent(new Event('input', {bubbles: true}));
        field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      const clickToggle = async (): Promise<void> => {
        toggle(rendered.view())?.click();
        await rendered.settle();
      };
      return {...rendered, columnX, clickRuler, typeStart, clickToggle};
    };

    it('moves the playhead to the Column under a click on the ruler, rounded down', async () => {
      const {columnX, clickRuler, view} = await setup();

      await clickRuler(columnX(37.9));

      const line = required(playhead(view()), 'playhead');
      expect(line.getAttribute('data-column')).toBe('37');
      expect(Number(line.getAttribute('x'))).toBeCloseTo(columnX(37), 1);
    });

    it('moves the playhead to the Column typed in the start field, which counts Columns from 1', async () => {
      const {typeStart, view} = await setup();

      await typeStart('38');

      expect(required(playhead(view()), 'playhead').getAttribute('data-column')).toBe('37');
    });

    it('starts from Column 1 when Play is pressed with the playhead at the end', async () => {
      const {clickToggle, previewSound, settle, view} = await setup();
      await clickToggle();
      // 100 Columns of 0.025 s each: the Tape ends after 2.5 s of the clock.
      previewSound.advance(3);
      await pause(80);
      await settle();
      expect(isPreviewing(view())).toBe(false);

      await clickToggle();

      expect(isPreviewing(view())).toBe(true);
      expect(required(playhead(view()), 'playhead').getAttribute('data-column')).toBe('0');
    });

    it('does nothing on a click on the ruler while the Preview plays', async () => {
      const {clickToggle, clickRuler, columnX, view} = await setup();
      await clickToggle();

      await clickRuler(columnX(37.5));

      expect(required(playhead(view()), 'playhead').getAttribute('data-column')).toBe('0');
    });
  });

  describe('following the playhead while it plays (T038)', () => {
    /** 100 Columns of 50 mm: a Tape far wider than the stage, at 0.5 s per Column. */
    const wide = {holes: [{row: 1, start: 0, length: 10}], tapePerCrankTurn: 100, columnLength: 50};
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const playhead = (view: HTMLElement | null) => view?.querySelector('[data-testid="playhead"]') ?? null;
    const stage = (view: HTMLElement | null) => required(view?.querySelector<HTMLElement>('[data-testid="tape-scroll"]'), 'stage');

    const setup = async () => {
      const rendered = await render(wide);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const clickToggle = async (): Promise<void> => {
        toggle(rendered.view())?.click();
        await rendered.settle();
      };
      return {...rendered, clickToggle};
    };

    it('scrolls the stage to keep the playhead in view while it plays', async () => {
      const {clickToggle, previewSound, settle, view} = await setup();
      await clickToggle();

      // Column 50 of 100: well beyond the window the stage shows at the start.
      previewSound.advance(25);
      await twoFrames();
      await settle();

      const scroll = stage(view());
      const x = Number(required(playhead(view()), 'playhead').getAttribute('x'));
      expect(scroll.scrollLeft).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(scroll.scrollLeft);
      expect(x).toBeLessThanOrEqual(scroll.scrollLeft + scroll.clientWidth);
    });

    it('does not scroll while the owner scrolled within the last 2 seconds', async () => {
      const {clickToggle, previewSound, settle, view} = await setup();
      await clickToggle();
      stage(view()).dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaX: 200}));

      previewSound.advance(25);
      await twoFrames();
      await settle();

      expect(stage(view()).scrollLeft).toBe(0);
    });
  });

  describe('editing while the Preview plays (T040)', () => {
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    const RULER_PX = 24;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const button = (view: HTMLElement | null, testId: string) =>
      required(view?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), testId);
    const pointer = (type: string, position: {clientX: number; clientY: number}) =>
      new PointerEvent(type, {...position, pointerId: 1, button: 0, bubbles: true, cancelable: true});
    const storedTape = (tapeId: string) => TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId);

    const setup = async (options: RenderOptions = {holes: sounding, tapePerCrankTurn, platform: 'win32'}) => {
      const rendered = await render(options);
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const view = rendered.view;
      const svg = required(view()?.querySelector<SVGSVGElement>('[data-testid="tape-scroll"] svg'), 'Tape drawing');
      Object.defineProperty(svg, 'getBoundingClientRect', {value: () => new DOMRect(0, 0, 4000, 300), configurable: true});
      const geometry = tapeGeometry(rendered.tape, rendered.organ);
      /** A position in the middle of a Column (from 0) and a row (from 1), in client px. */
      const at = (column: number, row: number) => ({
        clientX: (geometry.leadIn + (column + 0.5) * geometry.columnLength) * SCALE,
        clientY: (geometry.rowCentres[row - 1] ?? 0) * SCALE + RULER_PX,
      });
      const holeRect = (row: number, start: number) =>
        required(view()?.querySelector(`[data-testid="tape-scroll"] rect[data-testid="hole"][data-row="${row - 1}"][data-start="${start}"]`), 'Hole');
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const holeCount = () => storedTape(rendered.tape.id)?.holes.length;
      const press = async (target: Element, init: KeyboardEventInit): Promise<void> => {
        target.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      const clickToggle = async (): Promise<void> => {
        toggle(view())?.click();
        await rendered.settle();
      };
      const select = async (row: number, start: number): Promise<void> => {
        holeRect(row, start).dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await rendered.settle();
      };
      /** Presses a Hole, drags it to another Column and releases it on the drawing. */
      const drag = async (row: number, start: number, from: number, to: number): Promise<void> => {
        holeRect(row, start).dispatchEvent(pointer('pointerdown', at(from, row)));
        await rendered.settle();
        svg.dispatchEvent(pointer('pointermove', at(to, row)));
        await twoFrames();
        await rendered.settle();
        svg.dispatchEvent(pointer('pointerup', at(to, row)));
        await rendered.settle();
      };
      return {...rendered, svg, update, holeCount, press, clickToggle, select, drag, button, storedTape};
    };

    it('ignores a pointer drag of a Hole while it plays', async () => {
      const {clickToggle, drag, update} = await setup();
      await clickToggle();

      await drag(1, 0, 5, 8);

      expect(update).not.toHaveBeenCalled();
    });

    it('ignores Delete on the selected Hole while it plays', async () => {
      const {select, clickToggle, press, svg, update, holeCount} = await setup();
      await select(1, 0);
      await clickToggle();

      await press(svg, {key: 'Delete'});

      expect(update).not.toHaveBeenCalled();
      expect(holeCount()).toBe(1);
    });

    it('ignores Ctrl+Z while it plays, so an edit made before stays', async () => {
      const {select, clickToggle, press, svg, update, holeCount} = await setup();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await clickToggle();

      await press(svg, {key: 'z', ctrlKey: true});

      expect(update).toHaveBeenCalledTimes(1);
      expect(holeCount()).toBe(0);
    });

    it('ignores Ctrl+Y while it plays, so an undone edit stays undone', async () => {
      const {select, clickToggle, press, svg, update, holeCount} = await setup();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await press(svg, {key: 'z', ctrlKey: true});
      await clickToggle();

      await press(svg, {key: 'y', ctrlKey: true});

      expect(update).toHaveBeenCalledTimes(2);
      expect(holeCount()).toBe(1);
    });

    it('ignores Ctrl+A and then Alt+ArrowRight, which would move the selected Hole, while it plays', async () => {
      const {clickToggle, press, svg, update} = await setup();
      await clickToggle();

      await press(svg, {key: 'a', ctrlKey: true});
      await press(svg, {key: 'ArrowRight', altKey: true});

      expect(update).not.toHaveBeenCalled();
    });

    it('ignores the Undo command from the application menu while it plays', async () => {
      const {select, clickToggle, press, svg, sendEditCommand, update, holeCount} = await setup();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await clickToggle();

      sendEditCommand('undo');

      expect(update).toHaveBeenCalledTimes(1);
      expect(holeCount()).toBe(0);
    });

    it('ignores the Redo command from the application menu while it plays', async () => {
      const {select, clickToggle, press, svg, sendEditCommand, update, holeCount} = await setup();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await press(svg, {key: 'z', ctrlKey: true});
      await clickToggle();

      sendEditCommand('redo');

      expect(update).toHaveBeenCalledTimes(2);
      expect(holeCount()).toBe(1);
    });

    it('disables Undo and Redo while it plays', async () => {
      const {select, clickToggle, press, svg, button, view, settle} = await setup();
      // Two edits, then one undo: an edit to undo and an edit to redo.
      const field = required(view()?.querySelector<HTMLInputElement>('[data-testid="column-length-input"]'), 'Column length field');
      field.value = '5';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await settle();
      button(view(), 'column-length-apply').click();
      await settle();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await press(svg, {key: 'z', ctrlKey: true});
      expect(button(view(), 'undo').disabled).toBe(false);
      expect(button(view(), 'redo').disabled).toBe(false);

      await clickToggle();

      expect(button(view(), 'undo').disabled).toBe(true);
      expect(button(view(), 'redo').disabled).toBe(true);
    });

    it('disables Transpose and the Column length Apply while it plays', async () => {
      const {clickToggle, button, settle, view} = await setup();
      const field = required(view()?.querySelector<HTMLInputElement>('[data-testid="column-length-input"]'), 'Column length field');
      field.value = '5';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await settle();
      expect(button(view(), 'column-length-apply').disabled).toBe(false);
      expect(button(view(), 'transpose').disabled).toBe(false);

      await clickToggle();

      expect(button(view(), 'column-length-apply').disabled).toBe(true);
      expect(button(view(), 'transpose').disabled).toBe(true);
    });

    it('disables the Add a Hole controls while it plays', async () => {
      const {clickToggle, button, settle, view} = await setup();
      const column = required(view()?.querySelector<HTMLInputElement>('[data-testid="add-hole-column"]'), 'Add a Hole Column field');
      expect(column.disabled).toBe(false);

      await clickToggle();
      await settle();

      expect(required(view()?.querySelector<HTMLInputElement>('[data-testid="add-hole-column"]'), 'Add a Hole Column field').disabled).toBe(true);
      expect(button(view(), 'add-hole-submit').disabled).toBe(true);
    });

    it('shows that editing is paused while it plays, and not after it stops', async () => {
      const {clickToggle, view} = await setup();
      expect(view()?.querySelector('[data-testid="editing-paused"]')).toBeNull();

      await clickToggle();
      expect(required(view()?.querySelector('[data-testid="editing-paused"]'), 'editing-paused notice').textContent?.trim()).toBe(
        'Editing is paused while the Preview plays',
      );

      await clickToggle();
      expect(view()?.querySelector('[data-testid="editing-paused"]')).toBeNull();
    });

    it('announces that editing is paused in a status region', async () => {
      const {clickToggle, view} = await setup();

      await clickToggle();

      expect(required(view()?.querySelector('[data-testid="editing-paused"]'), 'editing-paused notice').getAttribute('role')).toBe('status');
    });

    it('still applies a new Crank speed while it plays, as one save', async () => {
      const {clickToggle, settle, update, storedTape, tape, view} = await setup();
      await clickToggle();
      const field = required(view()?.querySelector<HTMLInputElement>('[data-testid="crank-speed-input"]'), 'Crank speed field');

      field.value = '120';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await settle();
      field.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
      await settle();

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedTape(tape.id)?.crankSpeed).toBe(120);
    });

    it('edits again after it stops', async () => {
      const {select, clickToggle, press, svg, update, holeCount} = await setup();
      await clickToggle();
      await clickToggle();

      await select(1, 0);
      await press(svg, {key: 'Delete'});

      expect(update).toHaveBeenCalledTimes(1);
      expect(holeCount()).toBe(0);
    });

    it('enables Undo again after it stops', async () => {
      const {select, clickToggle, press, svg, button, settle, view} = await setup();
      await select(1, 0);
      await press(svg, {key: 'Delete'});
      await clickToggle();
      await clickToggle();
      await settle();

      expect(button(view(), 'undo').disabled).toBe(false);
    });
  });

  describe('the Crank speed slider (T030)', () => {
    // A Hole at Column 0, so the Preview has a voice; at 100 mm per Crank turn and 2.5 mm Columns, 60 turns per minute is 0.025 s per Column.
    const sounding = [{row: 1, start: 0, length: 10}];
    const tapePerCrankTurn = 100;
    const toggle = (view: HTMLElement | null) => view?.querySelector<HTMLButtonElement>('[data-testid="preview-toggle"]') ?? null;
    const playhead = (view: HTMLElement | null) => view?.querySelector('[data-testid="playhead"]') ?? null;
    const storedTape = (tapeId: string) => TestBed.inject(TapeLibrary).tapeEntities().find((candidate) => candidate.id === tapeId);

    const setup = async () => {
      const rendered = await render({holes: sounding, tapePerCrankTurn});
      await rendered.open(`/tapes/${rendered.tape.id}`);
      const update = vi.spyOn(TestBed.inject(TapeLibrary), 'update');
      const button = (testId: string): HTMLButtonElement =>
        required(rendered.view()?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), testId);
      /** Moves the slider thumb to `speed`, the way a drag does; `release` ends the drag as letting go does. */
      const slide = async (speed: number, release: boolean): Promise<void> => {
        const thumb = required(rendered.view()?.querySelector<HTMLInputElement>('[data-testid="crank-speed-slider"] input'), 'Crank speed slider');
        thumb.value = String(speed);
        thumb.dispatchEvent(new Event('input', {bubbles: true}));
        if (release) thumb.dispatchEvent(new Event('change', {bubbles: true}));
        await rendered.settle();
      };
      const startPreview = async (): Promise<void> => {
        toggle(rendered.view())?.click();
        await rendered.settle();
      };
      const pressOnDrawing = async (init: KeyboardEventInit): Promise<void> => {
        const svg = required(rendered.view()?.querySelector('[data-testid="tape-scroll"] svg'), 'Tape drawing');
        svg.dispatchEvent(new KeyboardEvent('keydown', {...init, bubbles: true, cancelable: true}));
        await rendered.settle();
      };
      return {...rendered, update, button, slide, startPreview, pressOnDrawing, storedTape};
    };

    it('moves the playhead at the tempo of the slider while the Preview plays', async () => {
      const {startPreview, slide, previewSound, settle, view} = await setup();
      await startPreview();

      // 40 Columns at 60 turns per minute, then 0.5 s at 120 turns per minute: 40 more Columns, so Column 80.
      previewSound.advance(1);
      await slide(120, false);
      previewSound.advance(0.5);
      await pause(100);
      await settle();

      expect(Number(required(playhead(view()), 'playhead').getAttribute('data-column'))).toBeCloseTo(80, 0);
    });

    it('saves nothing while the slider moves', async () => {
      const {slide, update, storedTape, tape} = await setup();

      await slide(120, false);

      expect(update).not.toHaveBeenCalled();
      expect(storedTape(tape.id)?.crankSpeed).toBe(60);
    });

    it('adds no undo step for a move of the slider', async () => {
      const {slide, button, settle, view, storedTape, tape} = await setup();
      // An edit to undo: a Column length of 5 mm.
      const field = required(view()?.querySelector<HTMLInputElement>('[data-testid="column-length-input"]'), 'Column length field');
      field.value = '5';
      field.dispatchEvent(new Event('input', {bubbles: true}));
      await settle();
      button('column-length-apply').click();
      await settle();

      await slide(120, false);
      button('undo').click();
      await settle();

      expect(storedTape(tape.id)?.columnLength).toBe(2.5);
    });

    it('saves a release as one Crank speed change that one Ctrl+Z restores', async () => {
      const {slide, pressOnDrawing, update, storedTape, tape} = await setup();

      await slide(120, true);

      expect(update).toHaveBeenCalledTimes(1);
      expect(storedTape(tape.id)?.crankSpeed).toBe(120);
      await pressOnDrawing({key: 'z', ctrlKey: true});
      expect(update).toHaveBeenCalledTimes(2);
      expect(storedTape(tape.id)?.crankSpeed).toBe(60);
    });
  });
});
