import {Component} from '@angular/core';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {provideRouter, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {
  createTape,
  defaultSelectedParts,
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
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi, type InMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {formatNumber} from '../../shared/format-number';
import {OrganLibrary} from '../../organ/organ-library.store';
import {PlotterLibrary} from '../../plotter/plotter-library.store';
import {TapeLibrary} from '../tape-library.store';
import {SideBySideComponent} from './side-by-side.component';

const TICKS_PER_QUARTER = 480;
const PLOTTER_KEY = 'crancula.plotter';

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

/** The roll plotter "Vinyl cutter": working width 300 mm, Tape spacing 3 mm. */
function rollPlotter(): RollPlotter {
  const plotter = plotterOf({
    id: newPlotterId(),
    name: 'Vinyl cutter',
    workingWidth: 300,
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
    providers: [provideRouter(stubRoutes), provideTestTranslations('en'), {provide: CRANCULA_API, useValue: api}],
  });
  const street = testOrgan('Street organ', 3, {tapeBed: {tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5}});
  const barrel = testOrgan('Barrel piano', 3, {tapeBed: {tapeWidth: 60, holeDiameter: 2.5, rowSpacing: 3.5}});
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

/** The Organ of a Tape with its tape width changed to `width`, keeping its id and name. */
function widened(organ: Organ, width: number): Organ {
  return {...organ, tapeBed: {...organ.tapeBed, tapeWidth: required(millimetres(width), 'valid width')}};
}

describe('SideBySideComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(PLOTTER_KEY);
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
    expect(saveButton(element).disabled).toBe(true);

    finish();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(saveButton(element).disabled).toBe(false);
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

  it('drops the Lanes of a removed Tape at once', async () => {
    const view = await setUp();
    const {fixture, element} = await open(view, [view.reference, view.waltz]);

    await TestBed.inject(TapeLibrary).remove(view.reference.id);
    fixture.detectChanges();

    expect(rows(element).map((row) => textIn(row, 'lane-tape'))).toEqual(['Waltz']);
  });
});
