import {Component} from '@angular/core';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {TestBed} from '@angular/core/testing';
import {MatSelectHarness} from '@angular/material/select/testing';
import {provideRouter, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {
  createTape,
  defaultSelectedParts,
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
  type Tape,
  validatePlotter,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi, type InMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
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
});
