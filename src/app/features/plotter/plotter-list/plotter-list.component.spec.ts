import {Component} from '@angular/core';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatDialog} from '@angular/material/dialog';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {provideRouter, Router} from '@angular/router';
import {of, type Observable} from 'rxjs';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {newPlotterId, type Plotter, type PlotterDraft, validatePlotter} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {PlotterLibrary} from '../plotter-library.store';
import {PlotterListComponent} from './plotter-list.component';

/** A sheet Plotter of a working length × working width, named as the user describes it. */
function sheetPlotter(name: string, workingLength: number, workingWidth: number, overlap = 20): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name, workingWidth, roll: false, workingLength, overlap, tapeSpacing: 3};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A roll plotter (a vinyl cutter) of a working width. */
function rollPlotter(name: string, workingWidth: number): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name, workingWidth, roll: true, workingLength: null, overlap: null, tapeSpacing: 3};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

@Component({template: ''})
class StubComponent {}

const stubRoutes = [{path: 'plotters/:id', component: StubComponent}];

async function render() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  const library = TestBed.inject(PlotterLibrary);
  const fixture = TestBed.createComponent(PlotterListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, library, element: fixture.nativeElement as HTMLElement};
}

const rowTexts = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('[data-testid="plotter-row"]')].map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '');

describe('PlotterListComponent', () => {
  it('titles the page in a page head', async () => {
    const {element} = await render();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Plotters');
  });

  it('says that there are no Plotters yet, with the only Describe a Plotter button', async () => {
    const {element} = await render();

    const empty = element.querySelector('[data-testid="plotter-list-empty"]');
    expect(empty?.textContent).toContain('No Plotters yet. Describe the plotter you cut Tapes with.');
    const button = empty?.querySelector('[data-testid="new-plotter"]');
    expect(button?.textContent?.trim()).toContain('Describe a Plotter');
    expect(button?.getAttribute('href')).toBe('/plotters/new');
    expect(element.querySelectorAll('[data-testid="plotter-row"]')).toHaveLength(0);
  });

  it('lists the Plotters by name', async () => {
    const {fixture, library, element} = await render();
    await library.put(sheetPlotter('Cutting mat', 300, 120));
    await library.put(sheetPlotter('Anton', 300, 120));
    await fixture.whenStable();

    expect(rowTexts(element)).toEqual([expect.stringContaining('Anton'), expect.stringContaining('Cutting mat')]);
  });

  it('links each Plotter to its editor', async () => {
    const {fixture, library, element} = await render();
    const plotter = sheetPlotter('Cutting mat', 300, 120);
    await library.put(plotter);
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="plotter"]')?.getAttribute('href')).toBe(`/plotters/${plotter.id}`);
  });

  it('opens the editor with a click on the row', async () => {
    TestBed.configureTestingModule({providers: [provideRouter(stubRoutes), provideTestTranslations()]});
    const plotter = sheetPlotter('Cutting mat', 300, 120);
    await TestBed.inject(PlotterLibrary).put(plotter);
    const fixture = TestBed.createComponent(PlotterListComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="plotter-row"]')?.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/plotters/${plotter.id}`);
  });

  it('shows the Working area as length × width in mm and the Overlap of a sheet Plotter', async () => {
    const {fixture, library, element} = await render();
    await library.put(sheetPlotter('Cutting mat', 300, 120, 20));
    await fixture.whenStable();

    const [row] = rowTexts(element);
    expect(row).toContain('300 × 120 mm');
    expect(row).toContain('20 mm');
  });

  it('shows the width of a roll plotter and no Overlap', async () => {
    const {fixture, library, element} = await render();
    await library.put(rollPlotter('Vinyl cutter', 120));
    await fixture.whenStable();

    const [row] = rowTexts(element);
    expect(row).toContain('roll, 120 mm wide');
    expect(row).not.toMatch(/\b20 mm/);
  });

  it('shows a dash in the Overlap cell of a roll plotter, so the column does not look broken', async () => {
    const {fixture, library, element} = await render();
    await library.put(rollPlotter('Vinyl cutter', 120));
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="plotter-row"] td:nth-child(3)')?.textContent?.trim()).toBe('—');
  });

  it('holds the only Describe a Plotter button while there are Plotters, and no empty state', async () => {
    const {fixture, library, element} = await render();
    await library.put(sheetPlotter('Cutting mat', 300, 120));
    await fixture.whenStable();

    const buttons = element.querySelectorAll('[data-testid="new-plotter"]');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('href')).toBe('/plotters/new');
    expect(element.querySelector('[data-testid="plotter-list-empty"]')).toBeNull();
  });

  it('keeps two Plotters with the same name as two rows (scenario 4)', async () => {
    const {fixture, library, element} = await render();
    await library.put(sheetPlotter('Cutting mat', 300, 120));
    await library.put(sheetPlotter('Cutting mat', 200, 90));
    await fixture.whenStable();

    expect(library.entities()).toHaveLength(2);
    expect(rowTexts(element)).toHaveLength(2);
  });

  describe('remove', () => {
    /** Opens the list with two Plotters and a stub for the confirm dialog, which answers `confirmed`; the Organ and Tape writes are spied. */
    async function renderWithDialog(confirmed: boolean) {
      const api = createInMemoryCranculaApi();
      const organSave = vi.spyOn(api.organs, 'save');
      const tapeSave = vi.spyOn(api.tapes, 'save');
      const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(confirmed),
      }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideTestTranslations(),
          {provide: CRANCULA_API, useValue: api},
          {provide: MatDialog, useValue: {open}},
        ],
      });
      const library = TestBed.inject(PlotterLibrary);
      const anton = sheetPlotter('Anton', 300, 120);
      const cuttingMat = sheetPlotter('Cutting mat', 300, 120);
      await library.put(anton);
      await library.put(cuttingMat);
      const fixture = TestBed.createComponent(PlotterListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();
      await chooseFromRowMenu(fixture, 'Cutting mat', 'remove-plotter');
      await fixture.whenStable();
      return {library, anton, cuttingMat, open, organSave, tapeSave};
    }

    it('opens the confirm dialog for removing the Plotter', async () => {
      const {open, cuttingMat} = await renderWithDialog(false);

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: cuttingMat.id, name: 'Cutting mat'}},
      });
    });

    it('changes nothing when the dialog is cancelled', async () => {
      const {library, anton, cuttingMat} = await renderWithDialog(false);

      expect(library.entities().map(({id}) => id).sort()).toEqual([anton.id, cuttingMat.id].sort());
    });

    it('removes only the chosen Plotter when the dialog is confirmed', async () => {
      const {library, anton, cuttingMat} = await renderWithDialog(true);

      expect(library.entities().map(({id}) => id)).toEqual([anton.id]);
      expect(library.entities().map(({id}) => id)).not.toContain(cuttingMat.id);
    });

    it('writes no Tape and no Organ when a Plotter is removed (FR-004)', async () => {
      const {organSave, tapeSave} = await renderWithDialog(true);

      expect(organSave).not.toHaveBeenCalled();
      expect(tapeSave).not.toHaveBeenCalled();
    });
  });
});

/** Chooses an item of the row menu of the Plotter named `name`, as the Organ list does for its rows. */
async function chooseFromRowMenu(fixture: ComponentFixture<PlotterListComponent>, name: string, testId: string): Promise<void> {
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const menu = await loader.getHarness(MatMenuHarness.with({selector: `[aria-label="More actions for ${name}"]`}));
  await menu.open();
  const [item] = await menu.getItems({selector: `[data-testid="${testId}"]`});
  if (!item) throw new Error(`no ${testId} in the menu of ${name}`);
  await item.click();
}
