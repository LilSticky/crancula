// API: PlotterSectionComponent (standalone, OnPush, selector `cranc-plotter-section`); inputs `pieces: TapePieces | undefined`
// (the Tape cut for the picked Plotter, computed by the Tape view) and `tapeWidth: number | undefined` (mm); no outputs,
// the section changes no Tape. It reads the described Plotters from PlotterLibrary and the picked one from PlotterPreference.
import {Component, computed, inject, input} from '@angular/core';
import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatSelectHarness} from '@angular/material/select/testing';
import {
  column,
  columnCount,
  midiNoteNumber,
  millimetres,
  newPlotterId,
  organId,
  type Hole,
  type Organ,
  type Plotter,
  type PlotterDraft,
  type Tape,
  tapeGeometry,
  tapeId,
  tapePieces,
  transposition,
  validatePlotter,
} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {partIndex, songId} from '@api/song/song';
import {testOrgan} from '../../../../../testing/organs';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {PlotterLibrary} from '../../../plotter/plotter-library.store';
import {PlotterPreference} from '../../../plotter/plotter-preference';
import {PlotterSectionComponent} from './plotter-section.component';

const PLOTTER_KEY = 'crancula.plotter';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** A sheet Plotter of a working length × working width, named as the user describes it. */
function sheetPlotter(name: string, workingLength: number, workingWidth: number, overlap = 20): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name, workingWidth, roll: false, workingLength, overlap};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A roll Plotter (a vinyl cutter) of a working width. */
function rollPlotter(name: string, workingWidth: number): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name, workingWidth, roll: true, workingLength: null, overlap: null};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** The Organ of the section: one Pipe (note 60), a tape 120 mm wide, Lead-in 20 mm. */
const ORGAN: Organ = testOrgan('Fairground', 1);

/** A Hole on the first Pipe of ORGAN, `length` Columns long from Column `start`. */
function holeOf(start: number, length: number): Hole {
  return {
    pipe: defined(midiNoteNumber(60), 'pipe note'),
    start: defined(column(start), 'start'),
    length: defined(columnCount(length), 'hole length'),
  };
}

/** A Tape of `columns` Columns of `columnLength` mm with the given Holes. */
function tapeWith(columns: number, columnLength = 5, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    length: defined(columnCount(columns), 'length'),
    holes,
  });
}

/**
 * Stands in for the Tape view, which computes the Tape pieces of the picked Plotter once and passes them on. The section
 * takes the too-wide state from them too (`kind: 'too-wide'`), so the stub passes nothing else.
 */
@Component({
  imports: [PlotterSectionComponent],
  template: '<cranc-plotter-section [pieces]="pieces()" />',
})
class TapeViewStubComponent {
  readonly tape = input.required<Tape>();
  readonly organ = input.required<Organ>();
  private readonly picked = inject(PlotterPreference).picked;
  protected readonly pieces = computed(() => {
    const plotter = this.picked();
    return plotter === undefined ? undefined : tapePieces(tapeGeometry(this.tape(), this.organ()), plotter);
  });
}

async function render(options: {readonly tape?: Tape; readonly organ?: Organ} = {}) {
  TestBed.configureTestingModule({providers: [provideTestTranslations('en'), provideRouter([])]});
  const fixture: ComponentFixture<TapeViewStubComponent> = TestBed.createComponent(TapeViewStubComponent);
  fixture.componentRef.setInput('tape', options.tape ?? tapeWith(10));
  fixture.componentRef.setInput('organ', options.organ ?? ORGAN);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const picker = (): Promise<MatSelectHarness> => loader.getHarness(MatSelectHarness.with({selector: '[data-testid="plotter-picker"]'}));
  const piecesText = (): string | undefined => element.querySelector('[data-testid="plotter-pieces"]')?.textContent?.trim();
  /** Lets the section show what the pick changed. */
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return {element, picker, piecesText, settle, library: TestBed.inject(PlotterLibrary), preference: TestBed.inject(PlotterPreference)};
}

describe('PlotterSectionComponent', () => {
  beforeEach(() => {
    localStorage.removeItem(PLOTTER_KEY);
  });

  describe('the Plotter picker', () => {
    it('lists No Plotter first, then every described Plotter by name', async () => {
      const {library, picker} = await render();
      await library.put(sheetPlotter('Cutting mat', 300, 120));
      await library.put(sheetPlotter('Anton', 300, 120));

      const select = await picker();
      await select.open();
      const options = await select.getOptions();

      expect(await Promise.all(options.map((option) => option.getText()))).toEqual(['No Plotter', 'Anton', 'Cutting mat']);
    });

    it('shows the picked Plotter', async () => {
      const {library, preference, picker} = await render();
      const anton = sheetPlotter('Anton', 300, 120);
      await library.put(anton);
      preference.pick(anton.id);

      expect(await (await picker()).getValueText()).toBe('Anton');
    });

    it('picks the Plotter chosen in the picker in the preference', async () => {
      const {library, preference, picker} = await render();
      const anton = sheetPlotter('Anton', 300, 120);
      await library.put(anton);

      await (await picker()).clickOptions({text: 'Anton'});

      expect(preference.picked()?.id).toBe(anton.id);
    });

    it('clears the pick when No Plotter is chosen', async () => {
      const {library, preference, picker} = await render();
      const anton = sheetPlotter('Anton', 300, 120);
      await library.put(anton);
      preference.pick(anton.id);

      await (await picker()).clickOptions({text: 'No Plotter'});

      expect(preference.picked()).toBeUndefined();
    });
  });

  describe('the Tape pieces of the picked Plotter', () => {
    it('says how many Tape pieces a Tape longer than the working length is cut in', async () => {
      // 100 Columns of 5 mm is 500 mm: longer than the 300 mm working length, cut once at the Join after Column 56.
      const {library, preference, piecesText, settle} = await render({tape: tapeWith(100, 5)});
      const cuttingMat = sheetPlotter('Cutting mat', 300, 120);
      await library.put(cuttingMat);
      preference.pick(cuttingMat.id);
      await settle();

      expect(piecesText()).toBe('Cut in 2 Tape pieces');
    });

    it('says a Tape that fits the working length is in one Tape piece', async () => {
      const {library, preference, piecesText, settle} = await render({tape: tapeWith(10, 5)});
      const cuttingMat = sheetPlotter('Cutting mat', 300, 120);
      await library.put(cuttingMat);
      preference.pick(cuttingMat.id);
      await settle();

      expect(piecesText()).toBe('Fits in one Tape piece');
    });

    it('says a roll Plotter cuts the Tape in one Tape piece, however long', async () => {
      const {library, preference, piecesText, settle} = await render({tape: tapeWith(100, 5)});
      const vinylCutter = rollPlotter('Vinyl cutter', 120);
      await library.put(vinylCutter);
      preference.pick(vinylCutter.id);
      await settle();

      expect(piecesText()).toBe('Roll plotter: one Tape piece');
    });

    it("says the Tape can't be cut in pieces when a stretch has no place for a Join", async () => {
      // A Hole of 100 Columns (500 mm) from Column 1 leaves no Join within the 300 mm working length.
      const {library, preference, piecesText, settle} = await render({tape: tapeWith(100, 5, [holeOf(0, 100)])});
      const cuttingMat = sheetPlotter('Cutting mat', 300, 120);
      await library.put(cuttingMat);
      preference.pick(cuttingMat.id);
      await settle();

      expect(piecesText()).toBe("Can't be cut in pieces: see Cutting Problems");
    });

    it('says the Tape is too wide for the picked Plotter, instead of the Tape pieces', async () => {
      const wide = testOrgan('Fairground', 1, {
        tapeBed: {tapeWidth: 140, holeDiameter: 2.5, rowSpacing: 3.5},
      });
      const {element, library, preference, piecesText, settle} = await render({tape: tapeWith(100, 5), organ: wide});
      const cuttingMat = sheetPlotter('Cutting mat', 300, 120);
      await library.put(cuttingMat);
      preference.pick(cuttingMat.id);
      await settle();

      expect(element.querySelector('[data-testid="plotter-too-wide"]')?.textContent?.trim()).toBe(
        "The Tape is 140 mm wide, the Plotter's working width is 120 mm",
      );
      expect(element.querySelector('[data-testid="plotter-too-wide"]')?.getAttribute('role')).toBe('status');
      expect(piecesText()).toBeUndefined();
    });

    it('says nothing about Tape pieces while no Plotter is picked', async () => {
      const {library, piecesText, settle} = await render({tape: tapeWith(100, 5)});
      await library.put(sheetPlotter('Cutting mat', 300, 120));
      await settle();

      expect(piecesText()).toBeUndefined();
    });
  });
});
