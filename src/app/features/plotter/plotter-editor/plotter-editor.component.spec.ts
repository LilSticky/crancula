import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatSelectHarness} from '@angular/material/select/testing';
import {MatSlideToggleHarness} from '@angular/material/slide-toggle/testing';
import {MatDialog} from '@angular/material/dialog';
import {type ActivatedRouteSnapshot, provideRouter, Router, type RouterStateSnapshot} from '@angular/router';
import {type CranculaApi, newPlotterId, type Plotter, type PlotterDraft, validatePlotter} from '@api/index';
import {of} from 'rxjs';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {LeaveUnsavedDialogComponent} from '../../shared/leave-unsaved/leave-unsaved-dialog/leave-unsaved-dialog.component';
import {leaveUnsavedGuard} from '../../shared/leave-unsaved/leave-unsaved.guard';
import {PlotterLibrary} from '../plotter-library.store';
import {PlotterEditorComponent} from './plotter-editor.component';

/** Opens the editor of a new Plotter in the given language, with the Plotter library and the router under test. */
function render(language: 'en' | 'de' = 'en') {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations(language)]});
  const library = TestBed.inject(PlotterLibrary);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {library, navigate, open};
}

/** A stored sheet Plotter: "Cutting mat", 120 mm wide, 300 mm long, with the default Overlap of 20 mm. */
function storedSheet(): Plotter {
  const draft: PlotterDraft = {id: newPlotterId(), name: 'Cutting mat', workingWidth: 120, roll: false, workingLength: 300, overlap: 20, tapeSpacing: 3};
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Opens the editor: a new Plotter, or the stored Plotter with `id` as the route `/plotters/:id` gives it. */
async function open(id?: string) {
  const fixture: ComponentFixture<PlotterEditorComponent> = TestBed.createComponent(PlotterEditorComponent);
  if (id !== undefined) fixture.componentRef.setInput('id', id);
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

  it('says in a hint line under the title what the Working area and the Overlap are', async () => {
    const {open: openEditor} = render();
    const {element} = await openEditor();

    expect(element.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
      'Working area: the largest length and width it cuts in one go. Overlap: the strip glued under the next Tape piece.',
    );
  });

  it('has a Cancel action that returns to the Plotter list without storing the Plotter', async () => {
    const {open: openEditor, library, navigate} = render();
    const {element} = await openEditor();
    const put = vi.spyOn(library, 'put');
    const cancel = element.querySelector<HTMLButtonElement>('[data-testid="cancel-plotter"]');

    expect(cancel?.textContent?.trim()).toBe('Cancel');
    cancel?.click();

    expect(navigate.mock.calls[0]?.[0]).toEqual(['/plotters']);
    expect(put).not.toHaveBeenCalled();
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

  describe('editing a stored Plotter', () => {
    it('fills the form with the stored Plotter when it is opened at /plotters/:id', async () => {
      const {open: openEditor, library} = render();
      const stored = storedSheet();
      await library.put(stored);

      const {field, rollToggle, formatSelect} = await openEditor(stored.id);

      expect(field('plotter-name').value).toBe('Cutting mat');
      expect(field('plotter-working-width').value).toBe('120');
      expect(field('plotter-working-length').value).toBe('300');
      expect(field('plotter-overlap').value).toBe('20');
      expect(await (await rollToggle()).isChecked()).toBe(false);
      expect(await (await formatSelect()).getValueText()).toBe('SVG');
    });

    it('keeps the id of the stored Plotter when it is saved with a new name', async () => {
      const {open: openEditor, library} = render();
      const stored = storedSheet();
      await library.put(stored);
      const {field, type, save} = await openEditor(stored.id);

      await type(field('plotter-name'), 'Anton');
      await save();

      expect(library.entities()).toHaveLength(1);
      expect(library.entities()[0]).toMatchObject({id: stored.id, name: 'Anton', workingLength: 300});
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

    describe('when a retry follows a failed write', () => {
      it('stores one Plotter, not a second one under a new id', async () => {
        const inMemory = createInMemoryCranculaApi();
        let writes = 0;
        const api: CranculaApi = {
          ...inMemory,
          plotters: {
            ...inMemory.plotters,
            save: (snapshot) => {
              writes += 1;
              return writes === 1 ? Promise.resolve({status: 'failed', reason: 'disk full'}) : inMemory.plotters.save(snapshot);
            },
          },
        };
        TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations(), {provide: CRANCULA_API, useValue: api}]});
        const library = TestBed.inject(PlotterLibrary);
        vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        const {fillValidSheet, save} = await open();
        await fillValidSheet();

        await save();
        await save();

        expect(writes).toBe(2);
        expect(library.entities()).toHaveLength(1);
      });
    });
  });

  describe('unsaved changes', () => {
    /** Renders the editor with a leave dialog that the user answers with "stay" (`false`). */
    function renderWithLeaveDialog() {
      const dialog = vi.fn((...args: readonly unknown[]) => ({afterClosed: () => of(false), args}));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open: dialog}}],
      });
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      return {dialog};
    }

    /** Asks the leave guard whether the editor may be left; the dialog opens when there are unsaved changes. */
    function askToLeave(editor: PlotterEditorComponent): void {
      // The answer is the dialog's; these tests only look at whether the dialog opened.
      void TestBed.runInInjectionContext(() =>
        leaveUnsavedGuard(editor, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
      );
    }

    it('has no unsaved changes while the new Plotter is untouched', async () => {
      renderWithLeaveDialog();
      const {fixture} = await open();

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('asks through the leave dialog, naming the field with a problem, before leaving a changed Plotter', async () => {
      const {dialog} = renderWithLeaveDialog();
      const {fixture, fillValidSheet, field, type} = await open();
      await fillValidSheet();
      await type(field('plotter-name'), '');

      askToLeave(fixture.componentInstance);

      expect(dialog.mock.calls[0]?.[0]).toBe(LeaveUnsavedDialogComponent);
      expect(dialog.mock.calls[0]?.[1]).toEqual({
        data: {
          problems: [
            {
              field: {key: 'PLOTTER.EDITOR.NAME', params: {}},
              message: {key: 'PLOTTER.ERROR.NAME_REQUIRED', params: {}},
            },
          ],
        },
      });
    });

    it('has no unsaved changes while a stored Plotter is untouched', async () => {
      renderWithLeaveDialog();
      const stored = storedSheet();
      await TestBed.inject(PlotterLibrary).put(stored);
      const {fixture} = await open(stored.id);

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('asks through the leave dialog, naming the field with a problem, before leaving a changed stored Plotter', async () => {
      const {dialog} = renderWithLeaveDialog();
      const stored = storedSheet();
      await TestBed.inject(PlotterLibrary).put(stored);
      const {fixture, field, type} = await open(stored.id);
      await type(field('plotter-name'), '');

      askToLeave(fixture.componentInstance);

      expect(dialog.mock.calls[0]?.[0]).toBe(LeaveUnsavedDialogComponent);
      expect(dialog.mock.calls[0]?.[1]).toEqual({
        data: {
          problems: [
            {
              field: {key: 'PLOTTER.EDITOR.NAME', params: {}},
              message: {key: 'PLOTTER.ERROR.NAME_REQUIRED', params: {}},
            },
          ],
        },
      });
    });

    it('does not ask after the Plotter was saved', async () => {
      const {dialog} = renderWithLeaveDialog();
      const {fixture, fillValidSheet, save} = await open();
      await fillValidSheet();
      await save();

      askToLeave(fixture.componentInstance);

      expect(dialog).not.toHaveBeenCalled();
    });

    it('counts a roll change alone as an unsaved change', async () => {
      renderWithLeaveDialog();
      const {fixture, fillValidSheet, save, rollToggle} = await open();
      await fillValidSheet();
      await save();

      await (await rollToggle()).check();

      expect(fixture.componentInstance.unsavedChanges()).toEqual({problems: []});
    });

    it('marks the form field of the roll dirty when the toggle is switched', async () => {
      const {open: openEditor} = render();
      const {fixture, rollToggle} = await openEditor();

      await (await rollToggle()).check();

      expect(fixture.componentInstance['plotter'].roll().dirty()).toBe(true);
    });
  });

  describe('Tape spacing of a roll plotter (Story 4)', () => {
    /** Opens a new Plotter with the roll on, named "Vinyl cutter" with a working width of 300 mm. */
    async function openRollPlotter() {
      const {open: openEditor, library} = render();
      const opened = await openEditor();
      await (await opened.rollToggle()).check();
      await opened.type(opened.field('plotter-name'), 'Vinyl cutter');
      await opened.type(opened.field('plotter-working-width'), '300');
      return {...opened, library};
    }

    /** A stored roll plotter "Vinyl cutter", 300 mm wide, with a Tape spacing of 5 mm. */
    function storedRoll(): Plotter {
      const draft: PlotterDraft = {id: newPlotterId(), name: 'Vinyl cutter', workingWidth: 300, roll: true, workingLength: null, overlap: null, tapeSpacing: 5};
      const result = validatePlotter(draft);
      if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
      return result.value;
    }

    it('does not ask for a Tape spacing while the Plotter is a sheet', async () => {
      const {open: openEditor} = render();
      const {element} = await openEditor();

      expect(element.querySelector('[data-testid="plotter-tape-spacing"]')).toBeNull();
    });

    it('shows a new roll plotter with a Tape spacing of 3 and the hint in the card subtitle, under neither field', async () => {
      const {field, element} = await openRollPlotter();

      expect(field('plotter-tape-spacing').value).toBe('3');
      expect(element.querySelector('mat-card [mat-card-subtitle]')?.textContent).toContain(
        'Blank strip between Tapes cut side by side',
      );
      expect(element.querySelector('mat-card .fields mat-hint')).toBeNull();
      expect(element.querySelector('[data-testid="plotter-working-length"]')).toBeNull();
    });

    it('reads a Tape spacing typed as "2,5" as 2.5', async () => {
      const {field, type, save, library} = await openRollPlotter();

      await type(field('plotter-tape-spacing'), '2,5');
      await save();

      expect(library.entities()).toEqual([expect.objectContaining({roll: true, tapeSpacing: 2.5})]);
    });

    it('shows a negative Tape spacing under its field and keeps Save disabled', async () => {
      const {field, type, violationAt, saveButton} = await openRollPlotter();

      await type(field('plotter-tape-spacing'), '-1');

      expect(violationAt('tapeSpacing')).toEqual(['Must not be negative.']);
      expect(saveButton().disabled).toBe(true);
    });

    it('asks for a Tape spacing once it was cleared, and keeps Save disabled', async () => {
      const {field, type, violationAt, saveButton} = await openRollPlotter();

      await type(field('plotter-tape-spacing'), '1');
      await type(field('plotter-tape-spacing'), '');

      expect(violationAt('tapeSpacing')).toEqual(['Please enter a value.']);
      expect(saveButton().disabled).toBe(true);
    });

    it('saves a Tape spacing of 0, which lets Tapes touch', async () => {
      const {field, type, save, library} = await openRollPlotter();

      await type(field('plotter-tape-spacing'), '0');
      await save();

      expect(library.entities()).toEqual([expect.objectContaining({roll: true, tapeSpacing: 0})]);
    });

    it('shows the stored Tape spacing of a roll plotter when it is opened', async () => {
      const {open: openEditor, library} = render();
      const stored = storedRoll();
      await library.put(stored);

      const {field} = await openEditor(stored.id);

      expect(field('plotter-tape-spacing').value).toBe('5');
    });
  });
});
