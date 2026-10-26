import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {newPlotterId, type Plotter, type PlotterDraft, validatePlotter} from '@api/index';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {PlotterLibrary} from '../plotter-library.store';
import {PlotterListComponent} from './plotter-list.component';

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

  it('shows the width of a roll Plotter and no Overlap', async () => {
    const {fixture, library, element} = await render();
    await library.put(rollPlotter('Vinyl cutter', 120));
    await fixture.whenStable();

    const [row] = rowTexts(element);
    expect(row).toContain('roll, 120 mm wide');
    expect(row).not.toMatch(/\b20 mm/);
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
});
