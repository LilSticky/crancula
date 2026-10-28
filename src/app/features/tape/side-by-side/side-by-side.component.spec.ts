import {ApplicationRef, Component} from '@angular/core';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {of} from 'rxjs';
import {vi} from 'vitest';
import {
  column,
  columnCount,
  createTape,
  defaultSelectedParts,
  midiNoteNumber,
  millimetres,
  newPlotterId,
  type Organ,
  type Plotter,
  type PlotterDraft,
  proposeTransposition,
  readMidiSong,
  type RollPlotter,
  type Song,
  sideBySideCut,
  sideBySideSvg,
  tapeGeometry,
  type Tape,
  validatePlotter,
} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {pixelsPerMillimetre} from '../tape-view/pixels-per-millimetre';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi, type InMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {formatNumber} from '../../shared/format-number';
import {OrganLibrary} from '../../organ/organ-library.store';
import {PlotterLibrary} from '../../plotter/plotter-library.store';
import {PlotterPreference} from '../../plotter/plotter-preference';
import {TapeLibrary} from '../tape-library.store';
import {SideBySideComponent} from './side-by-side.component';

const TICKS_PER_QUARTER = 480;
const PLOTTER_KEY = 'crancula.plotter';
const LANGUAGE_KEY = 'crancula.language';

@Component({selector: 'cranc-stub', template: ''})
class StubComponent {}

const stubRoutes = [
  {path: 'tapes', component: StubComponent},
  {path: 'tapes/side-by-side', component: StubComponent},
];

/** Three quarter notes on three rows of `organ`, as a Tape named `name` with its Song. */
function tapeNamed(organ: Organ, name: string): {readonly tape: Tape; readonly song: Song} {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {
        events: [61, 63, 65].flatMap((note) => [
          {delta: 0, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
          {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel: 0, note, velocity: 0}},
        ]),
      },
    ],
  });
  const read = readMidiSong(bytes, `${name}.mid`);
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const selectedParts = defaultSelectedParts(read.value);
  const created = createTape({
    song: read.value,
    selectedParts,
    organ,
    transposition: proposeTransposition(read.value, selectedParts, organ),
    name,
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  return {tape: created.value.tape, song: read.value};
}

function plotterOf(draft: PlotterDraft): Plotter {
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A roll plotter, "Vinyl cutter" with a working width of 300 mm unless named otherwise; Tape spacing 3 mm. */
function rollPlotter(name = 'Vinyl cutter', workingWidth = 300): RollPlotter {
  const plotter = plotterOf({
    id: newPlotterId(),
    name,
    workingWidth,
    roll: true,
    workingLength: null,
    overlap: null,
    tapeSpacing: 3,
  });
  if (plotter.roll !== true) throw new Error('invalid test Plotter: not a roll plotter');
  return plotter;
}

/** The sheet Plotter "Cutting mat", which the side-by-side page never offers. */
function sheetPlotter(): Plotter {
  return plotterOf({
    id: newPlotterId(),
    name: 'Cutting mat',
    workingWidth: 300,
    roll: false,
    workingLength: 300,
    overlap: 20,
    tapeSpacing: 3,
  });
}

async function setUp(plotters: readonly Plotter[] = [rollPlotter()]) {
  localStorage.removeItem(PLOTTER_KEY);
  const api: InMemoryCranculaApi = createInMemoryCranculaApi();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(stubRoutes),
      provideTestTranslations('en'),
      {provide: CRANCULA_API, useValue: api},
      // The saved notice runs a six-second timer that would hold whenStable; the spec does not read it.
      {provide: MatSnackBar, useValue: {open: () => ({onAction: () => of()})}},
    ],
  });
  const street = testOrgan('Street organ', 3, {tapeBed: {tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null}});
  const barrel = testOrgan('Barrel piano', 3, {tapeBed: {tapeWidth: 60, holeDiameter: 2.5, rowSpacing: 3.5, guideMargin: null}});
  const organs = TestBed.inject(OrganLibrary);
  const tapes = TestBed.inject(TapeLibrary);
  const library = TestBed.inject(PlotterLibrary);
  await organs.put(street);
  await organs.put(barrel);
  const reference = tapeNamed(street, 'Reference');
  const waltz = tapeNamed(barrel, 'Waltz');
  await tapes.create(reference.tape, reference.song);
  await tapes.create(waltz.tape, waltz.song);
  for (const plotter of plotters) await library.put(plotter);
  return {
    api,
    street,
    barrel,
    reference: reference.tape,
    waltz: waltz.tape,
    router: TestBed.inject(Router),
    translate: TestBed.inject(TranslateService),
  };
}

/** Opens the page at the URL with the Tapes as Lanes, in the order given. */
async function open(view: Awaited<ReturnType<typeof setUp>>, tapeList: readonly Tape[]) {
  await view.router.navigateByUrl(`/tapes/side-by-side?${tapeList.map((tape) => `tape=${tape.id}`).join('&')}`);
  const fixture = TestBed.createComponent(SideBySideComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, element: fixture.nativeElement as HTMLElement};
}

/** The drawing of the roll, the SVG to scale. */
function svgOf(element: HTMLElement): SVGSVGElement {
  const svg = element.querySelector<SVGSVGElement>('[data-testid="side-by-side-drawing"]');
  if (!svg) throw new Error('no side-by-side-drawing');
  return svg;
}

/** The zoom choices in their order: Whole Tape, then 1:1. */
function zoomButtons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll<HTMLButtonElement>('[data-testid="zoom"] button')];
}

function oneToOneButton(element: HTMLElement): HTMLButtonElement {
  const button = zoomButtons(element).at(1);
  if (!button) throw new Error('no 1:1 zoom button');
  return button;
}

/** The id of the pattern a fill refers to, from `url(#id)`; undefined for any other fill. */
function patternIdOf(fill: string | null): string | undefined {
  return /^url\(#(.+)\)$/.exec(fill ?? '')?.[1];
}

function rows(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>('[data-testid="lane"]')];
}

function textIn(row: HTMLElement, testId: string): string | undefined {
  return row.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
}

function saveButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('[data-testid="save-side-by-side"]');
  if (!button) throw new Error('no save-side-by-side button');
  return button;
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`no ${what}`);
  return value;
}

function freeText(element: HTMLElement): string | undefined {
  return element.querySelector('[data-testid="side-by-side-free"]')?.textContent?.trim();
}

function drawingOf(element: HTMLElement): HTMLElement {
  return required(element.querySelector<HTMLElement>('[data-testid="side-by-side-drawing"]'), 'side-by-side-drawing');
}

function laneMark(element: HTMLElement, testId: string, lane: number): HTMLElement {
  return required(
    element.querySelector<HTMLElement>(`[data-testid="${testId}"][data-lane="${lane}"]`),
    `${testId} of Lane ${lane}`,
  );
}

function buttonIn(row: HTMLElement, testId: string): HTMLButtonElement {
  return required(row.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), testId);
}

/** Clicks a control and lets the page settle. */
async function press(fixture: ComponentFixture<SideBySideComponent>, button: HTMLButtonElement): Promise<void> {
  button.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

async function openAddMenu(fixture: ComponentFixture<SideBySideComponent>): Promise<MatMenuHarness> {
  const menu = await TestbedHarnessEnvironment.loader(fixture).getHarness(
    MatMenuHarness.with({selector: '[data-testid="add-lane"]'}),
  );
  await menu.open();
  return menu;
}

/** The add menu's items, by Tape name, opened from the page. */
async function addMenuItems(fixture: ComponentFixture<SideBySideComponent>) {
  const menu = await openAddMenu(fixture);
  return menu.getItems({selector: '[data-testid="add-lane-tape"]'});
}

/** The add menu item whose text starts with the Tape's name, the disabled ones included (their text has a hint). */
async function menuItemStartingWith(fixture: ComponentFixture<SideBySideComponent>, name: string) {
  const items = await addMenuItems(fixture);
  const texts = await Promise.all(items.map((item) => item.getText()));
  const found = texts.findIndex((text) => text.startsWith(name));
  return required(found < 0 ? undefined : items.at(found), `add menu item for ${name}`);
}

/** The Tape with one Hole on note 70, which no Pipe of its Organ has: one Cutting Problem. */
function withoutPipe(tape: Tape): Tape {
  const note = midiNoteNumber(70);
  const start = column(0);
  const length = columnCount(3);
  if (note === undefined || start === undefined || length === undefined) throw new Error('invalid test Hole');
  return tapeOf({...tape, holes: [...tape.holes, {pipe: note, start, length}]});
}

/** The measure columns of a Lane row, in order; every row has all of them, empty or not. */
const MEASURE_COLUMNS = ['number', 'tape', 'organ', 'marks', 'width', 'length', 'actions'];

/** The column names of the cells of a Lane row, in order. */
function columnsOf(row: HTMLElement): string[] {
  return [...row.children].map((cell) => cell.getAttribute('data-column') ?? '');
}

/** The cell of the Lane row in the measure column `column`, or null when the row has none. */
function cellIn(row: HTMLElement, column: string): HTMLElement | null {
  return row.querySelector<HTMLElement>(`:scope > [data-column="${column}"]`);
}

/** The mark of the Lane row with `testId`, or null when the row has none. */
function markIn(row: HTMLElement, testId: string): HTMLElement | null {
  return row.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

/** The Organ of a Tape with its tape width changed to `width`, keeping its id and name. */
function widened(organ: Organ, width: number): Organ {
  return {...organ, tapeBed: {...organ.tapeBed, tapeWidth: required(millimetres(width), 'valid width')}};
}

describe('SideBySideComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(PLOTTER_KEY);
    localStorage.removeItem(LANGUAGE_KEY);
  });

  it('lists a row per Lane in the order of the Tapes in the URL, with its number, Tape and Organ', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.waltz, view.reference]);

    expect(rows(element).map((row) => row.getAttribute('data-lane'))).toEqual(['1', '2']);
    expect(rows(element).map((row) => textIn(row, 'lane-number'))).toEqual(['1', '2']);
    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Waltz', 'Reference']);
    expect(rows(element).map((row) => textIn(row, 'lane-organ'))).toEqual(['Barrel piano', 'Street organ']);
  });

  it('lists only the roll plotters of the library, by name, in the plotter picker', async () => {
    const view = await setUp([sheetPlotter(), rollPlotter()]);
    const {fixture} = await open(view, [view.reference]);
    const picker = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({selector: '[data-testid="side-by-side-plotter"]'}),
    );

    await picker.open();
    const options = await picker.getOptions();

    expect(await Promise.all(options.map((option) => option.getText()))).toEqual(['Vinyl cutter']);
  });

  it('starts with the only roll plotter picked', async () => {
    const view = await setUp([sheetPlotter(), rollPlotter()]);
    const {fixture} = await open(view, [view.reference]);
    const picker = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatSelectHarness.with({selector: '[data-testid="side-by-side-plotter"]'}),
    );

    expect(await picker.getValueText()).toBe('Vinyl cutter');
  });

  it('saves the cut through the roll plotter with the Lanes in order', async () => {
    const roll = rollPlotter();
    const view = await setUp([roll]);
    const {fixture, element} = await open(view, [view.waltz, view.reference]);
    const translate = view.translate;

    saveButton(element).click();
    await fixture.whenStable();

    expect(view.api.plotter.lastSaveSvgRequest).toEqual({
      suggestedFileName: 'Waltz and 1 more.svg',
      svg: sideBySideSvg(
        sideBySideCut(
          [
            {tape: view.waltz, organ: view.barrel},
            {tape: view.reference, organ: view.street},
          ],
          roll,
        ),
      ),
      dialogTitle: String(translate.instant('TAPE.EXPORT.DIALOG_TITLE')),
      filterName: String(translate.instant('TAPE.EXPORT.FILTER_NAME')),
    });
  });

  it('is disabled while the save runs', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.waltz, view.reference]);
    let finish: () => void = () => undefined;
    vi.spyOn(view.api.plotter, 'saveSvg').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({status: 'cancelled'});
        }),
    );

    saveButton(element).click();
    fixture.detectChanges();
    expect(saveButton(element).getAttribute('aria-disabled')).toBe('true');

    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveButton(element).getAttribute('aria-disabled')).toBeNull();
  });

  it('writes nothing to localStorage while the Lanes are shown and saved', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.waltz, view.reference]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    saveButton(element).click();
    await fixture.whenStable();

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('shows the free width of the roll plotter after one Lane', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference]);

    expect(freeText(element)).toBe('200 mm of 300 mm free');
  });

  it('shows the free width after a Tape is added as a Lane from the add menu', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference]);

    const waltz = await menuItemStartingWith(fixture, 'Waltz');
    await waltz.click();
    fixture.detectChanges();

    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Reference', 'Waltz']);
    expect(freeText(element)).toBe('137 mm of 300 mm free');
  });

  it('shows how many mm too wide the Lanes are when they pass the working width', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.reference, view.reference]);

    expect(freeText(element)).toBe('6 mm too wide');
  });

  it('flags the Lane past the working width as overflow in the drawing', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.reference, view.reference]);

    expect(laneMark(element, 'lane-outline', 3).classList.contains('overflow')).toBe(true);
    expect(laneMark(element, 'lane-outline', 1).classList.contains('overflow')).toBe(false);
  });

  it('offers Whole Tape and 1:1 in a toggle group named Zoom, Whole Tape pressed', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference]);

    expect(element.querySelector('[data-testid="zoom"]')?.getAttribute('aria-label')).toBe('Zoom');
    expect(zoomButtons(element).map((button) => button.textContent?.trim())).toEqual(['Whole Tape', '1:1']);
    expect(zoomButtons(element).map((button) => button.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('draws the drawing at true size at 1:1', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);
    const svg = svgOf(element);
    // The viewBox is the roll in mm: its first two numbers are the origin, the third the length of the Tape.
    const lengthMm = Number(svg.getAttribute('viewBox')?.split(' ')[2]);

    oneToOneButton(element).click();
    await fixture.whenStable();
    fixture.detectChanges();

    // jsdom does no layout, so the bound width attribute stands in for the rendered width.
    expect(Number(svg.getAttribute('width'))).toBeCloseTo(lengthMm * pixelsPerMillimetre('1:1', 0, 0), 0);
  });

  it('hatches the part of the roll past the working width when the Lanes pass it', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.reference, view.reference]);
    const band = element.querySelector('[data-testid="overflow-band"]');
    const patternId = patternIdOf(band?.getAttribute('fill') ?? null);

    expect(band?.getAttribute('aria-hidden')).toBe('true');
    expect(patternId).toBeDefined();
    expect(svgOf(element).querySelector(`pattern[id="${patternId ?? ''}"] line`)).not.toBeNull();
    expect(laneMark(element, 'lane-outline', 3).classList.contains('overflow')).toBe(true);
  });

  it('draws no hatched part past the working width when the Lanes fit', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.reference]);

    expect(element.querySelector('[data-testid="overflow-band"]')).toBeNull();
  });

  it('lists every Tape in the add menu, grouped by Organ', async () => {
    const view = await setUp();
    const {fixture} = await open(view, []);

    const items = await addMenuItems(fixture);

    expect(await Promise.all(items.map((item) => item.getText()))).toEqual(['Waltz', 'Reference']);
  });

  it('adds a Tape that is already in a Lane as a new Lane', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference]);

    const reference = await menuItemStartingWith(fixture, 'Reference');
    await reference.click();
    fixture.detectChanges();

    expect(rows(element).map((row) => row.getAttribute('data-lane'))).toEqual(['1', '2']);
    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Reference', 'Reference']);
  });

  it('disables a Tape that does not fit, naming the width it needs and the free width', async () => {
    const view = await setUp();
    const {fixture} = await open(view, [view.reference, view.reference, view.waltz]);

    const reference = await menuItemStartingWith(fixture, 'Reference');

    expect(await reference.isDisabled()).toBe(true);
    expect(await reference.getText()).toContain('needs 103 mm, only 34 mm free');
  });

  it('draws each Lane, the free band and the working-width line in the drawing', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.waltz]);
    const drawing = drawingOf(element);

    expect(drawing.getAttribute('role')).toBe('img');
    expect(drawing.getAttribute('aria-label')).toBe('2 Lanes, 163 mm used, 137 mm free');
    expect([...drawing.querySelectorAll('[data-testid="lane-outline"]')].map((mark) => mark.getAttribute('data-lane'))).toEqual(
      ['1', '2'],
    );
    expect([...drawing.querySelectorAll('[data-testid="lane-holes"]')].map((mark) => mark.getAttribute('data-lane'))).toEqual(
      ['1', '2'],
    );
    expect(drawing.querySelector('[data-testid="free-band"]')).not.toBeNull();
    expect(drawing.querySelector('[data-testid="working-width-line"]')).not.toBeNull();
  });

  it('draws the working-width dash the same at Whole Tape and at 1:1: the stylesheet sets it, not the scale', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);
    const wholeDash = getComputedStyle(required(element.querySelector<SVGElement>('[data-testid="working-width-line"]'), 'working-width line')).strokeDasharray;

    oneToOneButton(element).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const line = required(element.querySelector<SVGElement>('[data-testid="working-width-line"]'), 'working-width line');

    expect(line.hasAttribute('stroke-dasharray')).toBe(false);
    expect(wholeDash).not.toBe('');
    expect(getComputedStyle(line).strokeDasharray).toBe(wholeDash);
  });

  it('fits the drawing to the page width by default: its mm viewBox, the fit-width class and no fixed size', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.waltz]);
    const drawing = drawingOf(element);

    expect(drawing.getAttribute('viewBox')).toMatch(/^0 0 [\d.]+ [\d.]+$/);
    expect(drawing.classList.contains('fit-width')).toBe(true);
    expect(drawing.style.width).toBe('');
    expect(drawing.style.height).toBe('');
  });

  it('hides the inner marks of the drawing from assistive technology', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.waltz]);
    const drawing = drawingOf(element);

    for (const testId of ['lane-outline', 'lane-holes', 'free-band', 'working-width-line']) {
      for (const mark of drawing.querySelectorAll(`[data-testid="${testId}"]`)) {
        expect(mark.getAttribute('aria-hidden')).toBe('true');
      }
    }
  });

  it('shows the width and the length of each Lane in the number format of the app', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference]);
    const length = formatNumber(tapeGeometry(view.reference, view.street).totalLength, 'en');

    expect(textIn(rows(element)[0], 'lane-width')).toBe('100 mm wide');
    expect(textIn(rows(element)[0], 'lane-length')).toBe(`${length} mm long`);
  });

  it('lays every Lane out in the same measure columns, with an empty marks cell for a Lane without marks', async () => {
    const view = await setUp();
    await TestBed.inject(TapeLibrary).update(withoutPipe(view.waltz));
    const {element} = await open(view, [view.reference, view.waltz]);

    expect(rows(element).map(columnsOf)).toEqual([MEASURE_COLUMNS, MEASURE_COLUMNS]);
    expect(required(cellIn(rows(element)[0], 'marks'), 'the marks cell').textContent?.trim()).toBe('');
    expect(textIn(rows(element)[1], 'lane-problems')).toBe('1 Cutting Problem');
  });

  it('keeps the same measure columns for a Lane whose Organ is not available', async () => {
    const view = await setUp();
    await TestBed.inject(OrganLibrary).remove(view.barrel.id);
    const {element} = await open(view, [view.reference, view.waltz]);

    expect(rows(element).map(columnsOf)).toEqual([MEASURE_COLUMNS, MEASURE_COLUMNS]);
    expect(textIn(rows(element)[1], 'lane-organ')).toBe('Organ not available');
    expect(required(cellIn(rows(element)[1], 'width'), 'the width cell').textContent?.trim()).toBe('');
    expect(required(cellIn(rows(element)[1], 'length'), 'the length cell').textContent?.trim()).toBe('');
  });

  it('moves a Lane up, renumbers the Lanes and updates the drawing at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);
    const before = laneMark(element, 'lane-outline', 1).getAttribute('d');

    await press(fixture, buttonIn(rows(element)[1], 'lane-up'));

    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Waltz', 'Reference']);
    expect(rows(element).map((row) => row.getAttribute('data-lane'))).toEqual(['1', '2']);
    expect(freeText(element)).toBe('137 mm of 300 mm free');
    expect(laneMark(element, 'lane-outline', 1).getAttribute('d')).not.toBe(before);
  });

  it('disables moving the first Lane up and the last Lane down', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.waltz]);

    expect(buttonIn(rows(element)[0], 'lane-up').disabled).toBe(true);
    expect(buttonIn(rows(element)[1], 'lane-down').disabled).toBe(true);
    expect(buttonIn(rows(element)[0], 'lane-down').disabled).toBe(false);
  });

  it('removes a Lane, renumbers the others and updates the free width at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);

    await press(fixture, buttonIn(rows(element)[0], 'lane-remove'));

    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Waltz']);
    expect(rows(element).map((row) => row.getAttribute('data-lane'))).toEqual(['1']);
    expect(freeText(element)).toBe('240 mm of 300 mm free');
  });

  it('allows saving with one Lane', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference]);

    expect(saveButton(element).disabled).toBe(false);
  });

  it('shows the empty text when there are no Lanes', async () => {
    const view = await setUp();
    const {element} = await open(view, []);

    expect(element.querySelector('[data-testid="side-by-side-empty"]')).not.toBeNull();
    expect(rows(element)).toEqual([]);
  });

  it('shows a renamed Tape at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference]);

    await TestBed.inject(TapeLibrary).rename(view.reference.id, 'Renamed');
    fixture.detectChanges();

    expect(textIn(rows(element)[0], 'lane-tape')).toBe('Renamed');
  });

  it('shows a changed Organ at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference]);

    await TestBed.inject(OrganLibrary).put(widened(view.street, 80));
    fixture.detectChanges();

    expect(textIn(rows(element)[0], 'lane-width')).toBe('80 mm wide');
  });

  it('marks a Lane whose Tape has Cutting Problems with their count, before Save is tried', async () => {
    const view = await setUp();
    await TestBed.inject(TapeLibrary).update(withoutPipe(view.waltz));
    const {element} = await open(view, [view.reference, view.waltz]);

    expect(markIn(rows(element)[1], 'lane-problems')?.textContent?.trim()).toBe('1 Cutting Problem');
    expect(markIn(rows(element)[0], 'lane-problems')).toBeNull();
  });

  it('names one Lane in the drawing as "1 Lane", not "1 Lanes"', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference]);

    expect(drawingOf(element).getAttribute('aria-label')).toBe('1 Lane, 100 mm used, 200 mm free');
  });

  it('marks one Cutting Problem as "1 Schnittproblem" in German', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'de');
    const view = await setUp();
    await TestBed.inject(TapeLibrary).update(withoutPipe(view.waltz));
    const {element} = await open(view, [view.waltz]);

    expect(markIn(rows(element)[0], 'lane-problems')?.textContent?.trim()).toBe('1 Schnittproblem');
  });

  it('names one Lane in the drawing as "1 Bahn" in German', async () => {
    localStorage.setItem(LANGUAGE_KEY, 'de');
    const view = await setUp();
    const {element} = await open(view, [view.waltz]);

    expect(drawingOf(element).getAttribute('aria-label')).toBe('1 Bahn, 60 mm belegt, 240 mm frei');
  });

  it('groups the Tapes of the add menu under a group named for their Organ', async () => {
    const view = await setUp();
    const {fixture} = await open(view, []);
    await openAddMenu(fixture);

    const groups = [...document.querySelectorAll<HTMLElement>('[role="group"][aria-label]')].map((group) => ({
      name: group.getAttribute('aria-label'),
      items: [...group.querySelectorAll<HTMLElement>('[data-testid="add-lane-tape"]')].map((item) =>
        (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
    }));
    expect(groups).toEqual([
      {name: 'Barrel piano', items: ['Waltz']},
      {name: 'Street organ', items: ['Reference']},
    ]);
  });

  it('marks the Lane that does not fit the working width, and only that Lane', async () => {
    const view = await setUp();
    const {element} = await open(view, [view.reference, view.reference, view.reference]);

    expect(markIn(rows(element)[2], 'lane-does-not-fit')?.textContent?.trim()).toBe('Does not fit');
    expect(markIn(rows(element)[0], 'lane-does-not-fit')).toBeNull();
    expect(markIn(rows(element)[1], 'lane-does-not-fit')).toBeNull();
  });

  it('disables a Tape whose Organ is gone in the add menu, saying it has no Organ', async () => {
    const view = await setUp();
    await TestBed.inject(OrganLibrary).remove(view.barrel.id);
    const {fixture} = await open(view, [view.reference]);

    const waltz = await menuItemStartingWith(fixture, 'Waltz');

    expect(await waltz.isDisabled()).toBe(true);
    expect(await waltz.getText()).toContain('has no Organ');
  });

  it('drops the Lanes of a removed Tape at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);

    await TestBed.inject(TapeLibrary).remove(view.reference.id);
    fixture.detectChanges();

    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Waltz']);
  });

  describe('the roll plotter picked on the page (Story 5)', () => {
    afterEach(() => TestBed.inject(MatDialog).closeAll());

    /** The picker of the page, a roll plotter select by name. */
    async function pickerOf(fixture: ComponentFixture<SideBySideComponent>) {
      return TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness.with({selector: '[data-testid="side-by-side-plotter"]'}));
    }

    /** The texts the Cutting Problems dialog lists now, in order. */
    function dialogEntries(): string[] {
      TestBed.inject(ApplicationRef).tick();
      return [...document.querySelectorAll('[data-testid="export-problem"]')].map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim());
    }

    /** The same Plotter as a sheet Plotter: the stored roll plotter, edited into a sheet. */
    function asSheet(plotter: RollPlotter): Plotter {
      return plotterOf({
        id: plotter.id,
        name: plotter.name,
        workingWidth: plotter.workingWidth,
        roll: false,
        workingLength: 300,
        overlap: 20,
        tapeSpacing: 3,
      });
    }

    it('starts with the roll plotter the Tape view picked', async () => {
      const vinyl = rollPlotter();
      const narrow = rollPlotter('Narrow cutter', 150);
      const view = await setUp([vinyl, narrow]);
      TestBed.inject(PlotterPreference).pick(vinyl.id);

      const {fixture} = await open(view, [view.reference]);

      expect(await (await pickerOf(fixture)).getValueText()).toBe('Vinyl cutter');
    });

    it('ignores a picked sheet Plotter, and starts with none when several roll plotters are there', async () => {
      const sheet = sheetPlotter();
      const view = await setUp([sheet, rollPlotter(), rollPlotter('Narrow cutter', 150)]);
      TestBed.inject(PlotterPreference).pick(sheet.id);

      const {fixture, element} = await open(view, [view.reference]);

      expect(await (await pickerOf(fixture)).getValueText()).toBe('');
      expect(element.querySelector('[data-testid="side-by-side-drawing"]')).toBeNull();
    });

    it('starts with none when several roll plotters are there and the Tape view picked none', async () => {
      const view = await setUp([rollPlotter(), rollPlotter('Narrow cutter', 150)]);

      const {fixture, element} = await open(view, [view.reference]);

      expect(await (await pickerOf(fixture)).getValueText()).toBe('');
      expect(element.querySelector('[data-testid="side-by-side-drawing"]')).toBeNull();
    });

    it('does not write the Tape view preference when a roll plotter is picked on the page', async () => {
      const view = await setUp([rollPlotter(), rollPlotter('Narrow cutter', 150)]);
      const pick = vi.spyOn(TestBed.inject(PlotterPreference), 'pick');
      const {fixture} = await open(view, [view.reference]);

      await (await pickerOf(fixture)).clickOptions({text: 'Narrow cutter'});

      expect(await (await pickerOf(fixture)).getValueText()).toBe('Narrow cutter');
      expect(pick).not.toHaveBeenCalled();
    });

    it('says there is no roll plotter and links to the Plotter editor, and still lists the Lanes', async () => {
      const view = await setUp([sheetPlotter()]);

      const {element} = await open(view, [view.reference]);

      const status = element.querySelector('[data-testid="side-by-side-no-plotter"]');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.textContent?.trim()).toBe('No roll plotter yet. Cutting side by side needs a roll plotter, such as a vinyl cutter.');
      const link = element.querySelector('[data-testid="side-by-side-describe-plotter"]');
      expect(link?.textContent?.trim()).toBe('Describe a Plotter…');
      expect(link?.getAttribute('href')).toBe('/plotters/new');
      expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Reference']);
      expect(element.querySelector('[data-testid="side-by-side-drawing"]')).toBeNull();
      expect(element.querySelector('[data-testid="side-by-side-free"]')).toBeNull();
    });

    it('disables Save while there is no roll plotter, and keeps it focusable', async () => {
      const view = await setUp([sheetPlotter()]);

      const {element} = await open(view, [view.reference]);

      expect(saveButton(element).disabled).toBe(false);
      expect(saveButton(element).getAttribute('aria-disabled')).toBe('true');
    });

    it('does nothing when Save is pressed while there is no roll plotter', async () => {
      const view = await setUp([sheetPlotter()]);
      const {fixture, element} = await open(view, [view.reference]);
      const saveSvg = vi.spyOn(view.api.plotter, 'saveSvg');

      await press(fixture, saveButton(element));

      expect(dialogEntries()).toEqual([]);
      expect(saveSvg).not.toHaveBeenCalled();
    });

    it('describes the disabled Save by the reason that there is no roll plotter', async () => {
      const view = await setUp([sheetPlotter()]);

      const {element} = await open(view, [view.reference]);

      const described = (saveButton(element).getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .map((id) => element.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '');
      expect(described).toContain('No roll plotter yet. Cutting side by side needs a roll plotter, such as a vinyl cutter.');
    });

    it('puts the no-roll-plotter message and the Describe a Plotter link before the plotter picker', async () => {
      const view = await setUp([sheetPlotter()]);

      const {element} = await open(view, [view.reference]);

      const message = required(element.querySelector<HTMLElement>('[data-testid="side-by-side-no-plotter"]'), 'no-plotter message');
      const link = required(element.querySelector<HTMLElement>('[data-testid="side-by-side-describe-plotter"]'), 'Describe a Plotter link');
      const picker = required(element.querySelector<HTMLElement>('[data-testid="side-by-side-plotter"]'), 'plotter picker');
      expect(message.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(link.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    });

    it('recomputes the free width and marks the Lane that no longer fits when a narrower roll plotter is picked', async () => {
      const view = await setUp([rollPlotter(), rollPlotter('Narrow cutter', 150)]);
      const {fixture, element} = await open(view, [view.reference, view.waltz]);

      await (await pickerOf(fixture)).clickOptions({text: 'Narrow cutter'});
      fixture.detectChanges();

      expect(freeText(element)).toBe('13 mm too wide');
      expect(markIn(rows(element)[1], 'lane-does-not-fit')?.textContent?.trim()).toBe('Does not fit');
      expect(markIn(rows(element)[0], 'lane-does-not-fit')).toBeNull();
    });

    it('refuses to save the Lane that no longer fits, naming it, and saves no file', async () => {
      const view = await setUp([rollPlotter(), rollPlotter('Narrow cutter', 150)]);
      const {fixture, element} = await open(view, [view.reference, view.waltz]);
      await (await pickerOf(fixture)).clickOptions({text: 'Narrow cutter'});
      const saveSvg = vi.spyOn(view.api.plotter, 'saveSvg');

      await press(fixture, saveButton(element));

      expect(dialogEntries()).toEqual(['Lane 2: Waltz needs 63 mm, only 50 mm free']);
      expect(saveSvg).not.toHaveBeenCalled();
    });

    it('reads as no Plotter when the picked roll plotter is removed, and refuses to save without one', async () => {
      const vinyl = rollPlotter();
      const view = await setUp([vinyl, rollPlotter('Narrow cutter', 150)]);
      TestBed.inject(PlotterPreference).pick(vinyl.id);
      const {fixture, element} = await open(view, [view.reference]);
      expect(await (await pickerOf(fixture)).getValueText()).toBe('Vinyl cutter');
      const saveSvg = vi.spyOn(view.api.plotter, 'saveSvg');

      await TestBed.inject(PlotterLibrary).remove(vinyl.id);
      fixture.detectChanges();
      expect(await (await pickerOf(fixture)).getValueText()).toBe('');
      await press(fixture, saveButton(element));

      expect(dialogEntries()).toEqual(['No roll plotter is picked: pick one to cut side by side.']);
      expect(saveSvg).not.toHaveBeenCalled();
    });

    it('reads as no Plotter when the picked roll plotter is turned into a sheet Plotter, and refuses to save without one', async () => {
      const vinyl = rollPlotter();
      const view = await setUp([vinyl, rollPlotter('Narrow cutter', 150)]);
      TestBed.inject(PlotterPreference).pick(vinyl.id);
      const {fixture, element} = await open(view, [view.reference]);
      expect(await (await pickerOf(fixture)).getValueText()).toBe('Vinyl cutter');
      const saveSvg = vi.spyOn(view.api.plotter, 'saveSvg');

      await TestBed.inject(PlotterLibrary).put(asSheet(vinyl));
      fixture.detectChanges();
      expect(await (await pickerOf(fixture)).getValueText()).toBe('');
      await press(fixture, saveButton(element));

      expect(dialogEntries()).toEqual(['No roll plotter is picked: pick one to cut side by side.']);
      expect(saveSvg).not.toHaveBeenCalled();
    });
  });
});
