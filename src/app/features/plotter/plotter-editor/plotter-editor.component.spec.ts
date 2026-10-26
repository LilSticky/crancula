import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatSelectHarness} from '@angular/material/select/testing';
import {MatSlideToggleHarness} from '@angular/material/slide-toggle/testing';
import {provideRouter, Router} from '@angular/router';
import type {CranculaApi} from '@api/index';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {PlotterLibrary} from '../plotter-library.store';
import {PlotterEditorComponent} from './plotter-editor.component';

/** Opens the editor of a new Plotter in the given language, with the Plotter library and the router under test. */
function render(language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations(language)]});
  const library = TestBed.inject(PlotterLibrary);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {library, navigate, open};
}

async function open() {
  const fixture: ComponentFixture<PlotterEditorComponent> = TestBed.createComponent(PlotterEditorComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);

  const field = (testId: string) => {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    if (!input) throw new Error(`no field ${testId}`);
    return input;
  };
  const type = async (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const saveButton = () => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="save-plotter"]');
    if (!button) throw new Error('no Save button');
    return button;
  };
  const save = async () => {
    saveButton().click();
    await fixture.whenStable();
  };
  const formatSelect = () => loader.getHarness(MatSelectHarness.with({selector: '[data-testid="plotter-format"]'}));
  const rollToggle = () => loader.getHarness(MatSlideToggleHarness.with({selector: '[data-testid="plotter-roll"]'}));

  /** Enters a valid sheet Plotter: "Cutting mat", 120 mm wide, 300 mm long, with the default Overlap. */
  const fillValidSheet = async () => {
    await type(field('plotter-name'), 'Cutting mat');
    await type(field('plotter-working-width'), '120');
    await type(field('plotter-working-length'), '300');
  };

  /** The rule message shown at a field, by the field's path in the Plotter. */
  const violationAt = (path: string) =>
    [...element.querySelectorAll(`[data-testid="violation"][data-path="${path}"]`)].map((error) => error.textContent?.trim());

  return {fixture, element, field, type, save, saveButton, formatSelect, rollToggle, fillValidSheet, violationAt};
}

describe('PlotterEditorComponent', () => {
  it('titles the new Plotter in a page head', async () => {
    const {open: openEditor} = render();
    const {element} = await openEditor();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('New Plotter');
  });

  it('has empty name, working width and working length, and the default Overlap of 20 mm', async () => {
    const {open: openEditor} = render();
    const {field} = await openEditor();

    expect(field('plotter-name').value).toBe('');
    expect(field('plotter-working-width').value).toBe('');
    expect(field('plotter-working-length').value).toBe('');
    expect(field('plotter-overlap').value).toBe('20');
  });

  it('offers only SVG as the format, and SVG is already chosen', async () => {
    const {open: openEditor} = render();
    const {formatSelect} = await openEditor();

    const select = await formatSelect();
    expect(await select.getValueText()).toBe('SVG');
    await select.open();
    const options = await select.getOptions();
    expect(await Promise.all(options.map((option) => option.getText()))).toEqual(['SVG']);
  });

  it('labels the roll toggle "Roll plotter (cuts any length)"', async () => {
    const {open: openEditor} = render();
    const {rollToggle} = await openEditor();

    expect(await (await rollToggle()).getLabelText()).toBe('Roll plotter (cuts any length)');
  });

  it('hides the working length and Overlap while the roll toggle is on, and shows them with their values when it is off', async () => {
    const {open: openEditor} = render();
    const {element, field, type, rollToggle} = await openEditor();
    await type(field('plotter-working-length'), '300');
    await type(field('plotter-overlap'), '25');

    const toggle = await rollToggle();
    await toggle.check();
    expect(element.querySelector('[data-testid="plotter-working-length"]')).toBeNull();
    expect(element.querySelector('[data-testid="plotter-overlap"]')).toBeNull();

    await toggle.uncheck();
    expect(field('plotter-working-length').value).toBe('300');
    expect(field('plotter-overlap').value).toBe('25');
  });

  describe('rule violations', () => {
    it('shows no "missing value" messages on an untouched new Plotter', async () => {
      const {open: openEditor} = render();
      const {element} = await openEditor();

      expect(element.querySelectorAll('[data-testid="violation"]')).toHaveLength(0);
    });

    it('asks for a name once the name was cleared', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-name'), 'x');
      await type(field('plotter-name'), '');

      expect(violationAt('name')).toEqual(['Please enter a name.']);
    });

    it('asks for a value once a measurement was cleared', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-working-width'), '1');
      await type(field('plotter-working-width'), '');

      expect(violationAt('workingWidth')).toEqual(['Please enter a value.']);
    });

    it('refuses a working width of 0 under the working width field', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-working-width'), '0');

      expect(violationAt('workingWidth')).toEqual(['Must be greater than 0.']);
    });

    it('refuses a negative working length under the working length field', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-working-length'), '-300');

      expect(violationAt('workingLength')).toEqual(['Must be greater than 0.']);
    });

    it('refuses an Overlap of 0 under the Overlap field', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-overlap'), '0');

      expect(violationAt('overlap')).toEqual(['Must be greater than 0.']);
    });

    it('says the Overlap must be shorter than the working length, under the Overlap field', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('plotter-working-length'), '300');
      await type(field('plotter-overlap'), '300');

      expect(violationAt('overlap')).toEqual(['The Overlap must be shorter than the working length.']);
    });
  });

  describe('saving', () => {
    it('keeps Save disabled while the Plotter is invalid and enables it once it is valid', async () => {
      const {open: openEditor} = render();
      const {fillValidSheet, saveButton} = await openEditor();
      expect(saveButton().disabled).toBe(true);

      await fillValidSheet();

      expect(saveButton().disabled).toBe(false);
    });

    it('stores the new Plotter with its values when Save is pressed, then returns to the Plotter list', async () => {
      const {open: openEditor, library, navigate} = render();
      const {fillValidSheet, save} = await openEditor();
      await fillValidSheet();

      await save();

      const [stored] = library.entities();
      expect(library.entities()).toHaveLength(1);
      expect(stored).toMatchObject({name: 'Cutting mat', format: 'svg', roll: false, workingWidth: 120, workingLength: 300, overlap: 20});
      expect(navigate.mock.calls[0]?.[0]).toEqual(['/plotters']);
    });

    it('reads a decimal comma as a point in German', async () => {
      const {open: openEditor, library} = render('de');
      const {field, type, save, fillValidSheet} = await openEditor();
      await fillValidSheet();
      await type(field('plotter-working-width'), '120,5');

      await save();

      expect(library.entities()).toEqual([expect.objectContaining({workingWidth: 120.5})]);
    });

    describe('when writing fails', () => {
      /** Opens the editor of a new Plotter whose disk write fails with "disk full". */
      function renderWithFailingWrite() {
        const inMemory = createInMemoryCranculaApi();
        const api: CranculaApi = {...inMemory, plotters: {...inMemory.plotters, save: () => Promise.resolve({status: 'failed', reason: 'disk full'})}};
        TestBed.configureTestingModule({
          providers: [provideRouter([]), provideTestTranslations(), {provide: CRANCULA_API, useValue: api}],
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        return {navigate};
      }

      it('stays on the editor with the Plotter still entered and Save enabled', async () => {
        const {navigate} = renderWithFailingWrite();
        const {field, save, saveButton, fillValidSheet} = await open();
        await fillValidSheet();

        await save();

        expect(navigate).not.toHaveBeenCalled();
        expect(field('plotter-name').value).toBe('Cutting mat');
        expect(saveButton().disabled).toBe(false);
      });
    });
  });
});
