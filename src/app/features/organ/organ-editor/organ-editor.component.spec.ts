import type {CdkDragDrop} from '@angular/cdk/drag-drop';
import {CdkDropList} from '@angular/cdk/drag-drop';
import {type ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {provideRouter, Router} from '@angular/router';
import {type Observable, of} from 'rxjs';
import {
  type CranculaApi,
  createTape,
  defaultSelectedParts,
  type Organ,
  type OrganLibrarySaveResult,
  proposeTransposition,
  readMidiSong,
  toTapeLibrarySnapshot,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi, type InMemoryCranculaApiFailures} from '../../../core/crancula-api.token';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganLibrary} from '../organ-library.store';
import {OrganEditorComponent} from './organ-editor.component';

const TICKS_PER_QUARTER = 480;

/** A valid Tape of the Organ with one Hole per note (the notes must be Pipes of the Organ), and its Song. */
function tapeFor(organ: Organ, name: string, notes: readonly number[]) {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {
        events: notes.flatMap((note) => [
          {delta: 0, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
          {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel: 0, note, velocity: 0}},
        ]),
      },
    ],
  });
  const read = readMidiSong(bytes, `${name}.mid`);
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const song = read.value;
  const selectedParts = defaultSelectedParts(song);
  const created = createTape({
    song,
    selectedParts,
    organ,
    transposition: proposeTransposition(song, selectedParts, organ),
    name,
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  return {tape: created.value.tape, song};
}

function render() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  const library = TestBed.inject(OrganLibrary);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return {library, navigate, open};
}

async function open(id?: string) {
  const fixture = TestBed.createComponent(OrganEditorComponent);
  if (id) fixture.componentRef.setInput('id', id);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

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
  /** Enters text that a number field cannot read, like "1e" (jsdom drops such text, so the browser's verdict is stubbed). */
  const typeUnreadableNumber = async (input: HTMLInputElement) => {
    Object.defineProperty(input, 'validity', {value: {badInput: true}, configurable: true});
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const click = async (testId: string) => {
    field(testId).click();
    await fixture.whenStable();
  };
  const saveButton = () => {
    const button = element.querySelector<HTMLButtonElement>('[data-testid="save-organ"]');
    if (!button) throw new Error('no Save button');
    return button;
  };
  const save = async () => {
    saveButton().click();
    await fixture.whenStable();
  };
  const pipeRows = () => [...element.querySelectorAll<HTMLElement>('[data-testid="pipe"]')];

  async function fillValidOrgan() {
    await type(field('name'), 'Street organ');
    await type(field('tape-width'), '120');
    await type(field('hole-diameter'), '2.5');
    await type(field('row-spacing'), '3.5');
    await type(field('minimum-gap'), '1.5');
    await click('add-pipe');
    await type(field('pipe-note'), '60');
  }

  /** The rule message shown at a field, by the field's path in the Organ. */
  const violationAt = (path: string) =>
    [...element.querySelectorAll(`[data-testid="violation"][data-path="${path}"]`)].map((error) => error.textContent?.trim());

  return {fixture, element, field, type, typeUnreadableNumber, click, save, saveButton, pipeRows, fillValidOrgan, violationAt};
}

describe('OrganEditorComponent', () => {
  it('titles the page in a page head', async () => {
    const {open: openEditor} = render();
    const {element} = await openEditor();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('New Organ');
  });

  describe('a new Organ', () => {
    it('has empty fields for name, Tape Bed and Minimum Gap', async () => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      for (const testId of ['name', 'tape-width', 'hole-diameter', 'row-spacing', 'minimum-gap']) {
        expect(field(testId).value).toBe('');
      }
    });

    it('shows the Minimum Hole Length as the read-only hole diameter', async () => {
      const {open: openEditor} = render();
      const {field, type} = await openEditor();

      await type(field('hole-diameter'), '2.5');

      expect(field('minimum-hole-length').readOnly).toBe(true);
      expect(field('minimum-hole-length').value).toBe('2.5');
    });

    it('adds Pipes as last rows and names their notes', async () => {
      const {open: openEditor} = render();
      const {element, click, pipeRows, type} = await openEditor();

      await click('add-pipe');
      await click('add-pipe');
      const notes = element.querySelectorAll<HTMLInputElement>('[data-testid="pipe-note"]');
      await type(notes[0], '60');
      await type(notes[1], '61');

      expect(pipeRows().map((row) => row.querySelector('[data-testid="pipe-note-name"]')?.textContent?.trim())).toEqual([
        'C4',
        'C#4',
      ]);
    });
  });

  describe('the read-only Minimum Hole Length', () => {
    it('is shown as the hole diameter with the decimal comma in German', async () => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 2, {tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5}});
      await TestBed.inject(OrganLibrary).put(organ);
      const {field} = await open(organ.id);

      expect(field('minimum-hole-length').value).toBe('2,5');
    });

    it('has the class cr-readonly, the suffix "mm" and the hint "Equals the hole diameter"', async () => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      const formField = field('minimum-hole-length').closest('mat-form-field');
      expect(field('minimum-hole-length').readOnly).toBe(true);
      expect(field('minimum-hole-length').classList).toContain('cr-readonly');
      expect(formField?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
      expect(formField?.querySelector('mat-hint')?.textContent?.trim()).toBe('Equals the hole diameter');
      expect(formField?.querySelector('mat-label')?.textContent).not.toContain('(mm)');
    });
  });

  describe('the derived Border', () => {
    /** The Border field's text; absent counts as empty. */
    const borderOf = (element: HTMLElement) =>
      element.querySelector<HTMLInputElement>('[data-testid="border"]')?.value ?? '';

    it('is shown read-only, centring the rows of the Pipes on the tape width (6.25 for the street organ)', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field} = await openEditor(organ.id);

      expect(field('border').readOnly).toBe(true);
      expect(borderOf(element)).toBe('6.25');
    });

    it('is formatted with the decimal comma in German', async () => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 31);
      await TestBed.inject(OrganLibrary).put(organ);
      const {element} = await open(organ.id);

      expect(borderOf(element)).toBe('6,25');
    });

    it('is labelled with the Border label', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      const labels = [...element.querySelectorAll('mat-label')].map((label) => label.textContent?.trim());
      expect(labels).toContain('Border');
    });

    it('is a read-only field with the suffix "mm" and the hint "On each side, the rows are centred"', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {field} = await openEditor(organ.id);

      const formField = field('border').closest('mat-form-field');
      expect(field('border').classList).toContain('cr-readonly');
      expect(formField?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
      expect(formField?.querySelector('mat-hint')?.textContent?.trim()).toBe('On each side, the rows are centred');
    });

    it('updates when a Pipe is removed', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, click} = await openEditor(organ.id);

      await click('remove-pipe');

      expect(borderOf(element)).toBe('8');
    });

    it('updates when a Pipe is added', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, click} = await openEditor(organ.id);

      await click('add-pipe');

      expect(borderOf(element)).toBe('4.5');
    });

    it('updates when the tape width changes', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field, type} = await openEditor(organ.id);

      await type(field('tape-width'), '130');

      expect(borderOf(element)).toBe('11.25');
    });

    it.each(['tape-width', 'hole-diameter', 'row-spacing'])('is empty while the %s is missing', async (testId) => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field, type} = await openEditor(organ.id);

      await type(field(testId), '');

      expect(borderOf(element)).toBe('');
    });

    it('is empty while there are no Pipes', async () => {
      const {open: openEditor} = render();
      const {element, field, type} = await openEditor();
      await type(field('tape-width'), '120');
      await type(field('hole-diameter'), '2.5');
      await type(field('row-spacing'), '3.5');

      expect(borderOf(element)).toBe('');
    });

    it('is not shown when the rows do not fit the tape width', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field, type} = await openEditor(organ.id);

      await type(field('tape-width'), '100');

      expect(borderOf(element)).toBe('');
    });
  });

  describe('saving', () => {
    it('stores nothing while a valid Organ is only edited', async () => {
      const {open: openEditor, library, navigate} = render();
      const {fillValidOrgan} = await openEditor();

      await fillValidOrgan();

      expect(library.entities()).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('stores a new Organ when Save is pressed and opens it by id', async () => {
      const {open: openEditor, library, navigate} = render();
      const {fillValidOrgan, save} = await openEditor();
      await fillValidOrgan();

      await save();

      const [stored] = library.entities();
      expect(stored?.name).toBe('Street organ');
      expect(stored?.pipes.map((pipe) => pipe.note)).toEqual([60]);
      expect(navigate).toHaveBeenCalledWith(['/organs', stored?.id], {replaceUrl: true});
    });

    it('does not open a new Organ by id before its first save', async () => {
      const {open: openEditor, navigate} = render();
      const {fillValidOrgan} = await openEditor();

      await fillValidOrgan();

      expect(navigate).not.toHaveBeenCalledWith(['/organs', expect.anything()], expect.anything());
    });

    it('stores a changed stored Organ under the same id when Save is pressed', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {field, type, save} = await openEditor(organ.id);

      await type(field('name'), 'Renamed');
      expect(library.entities().map(({name}) => name)).toEqual(['Street organ']);
      await save();

      expect(library.entities().map(({id, name}) => ({id, name}))).toEqual([{id: organ.id, name: 'Renamed'}]);
    });

    it('does not navigate when a stored Organ is saved', async () => {
      const {open: openEditor, library, navigate} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {field, type, save} = await openEditor(organ.id);
      navigate.mockClear();

      await type(field('name'), 'Renamed');
      await save();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('saving to disk', () => {
    /** An API whose disk write is decided by the test: `finish` ends the pending write. */
    function renderWithDiskWrite() {
      const inMemory = createInMemoryCranculaApi();
      const writes: Array<(result: OrganLibrarySaveResult) => void> = [];
      const api: CranculaApi = {
        organs: {
          load: () => inMemory.organs.load(),
          save: () => new Promise<OrganLibrarySaveResult>((resolve) => writes.push(resolve)),
        },
        tapes: inMemory.tapes,
        app: inMemory.app,
      };
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: CRANCULA_API, useValue: api}],
      });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const finish = async (result: OrganLibrarySaveResult, fixture: ComponentFixture<OrganEditorComponent>) => {
        writes.shift()?.(result);
        await fixture.whenStable();
        fixture.detectChanges();
      };
      /** Presses Save without waiting for the disk write. */
      const startSaving = async (editor: Awaited<ReturnType<typeof open>>) => {
        editor.saveButton().click();
        await Promise.resolve();
        editor.fixture.detectChanges();
      };
      return {navigate, finish, startSaving, writes};
    }

    it('keeps Save enabled and the changes unsaved when writing fails', async () => {
      const {finish, startSaving} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();

      await startSaving(editor);
      await finish({status: 'failed', reason: 'disk full'}, editor.fixture);

      expect(editor.saveButton().disabled).toBe(false);
      expect(editor.fixture.componentInstance.unsavedChanges()).not.toBeNull();
    });

    it('does not open a new Organ by id when writing fails', async () => {
      const {navigate, finish, startSaving} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();

      await startSaving(editor);
      await finish({status: 'failed', reason: 'disk full'}, editor.fixture);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('disables Save and has no unsaved changes once writing succeeded', async () => {
      const {finish, startSaving} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();

      await startSaving(editor);
      await finish({status: 'saved'}, editor.fixture);

      expect(editor.saveButton().disabled).toBe(true);
      expect(editor.fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('opens a new Organ by id only after writing succeeded, with no unsaved changes left', async () => {
      const {navigate, finish, startSaving} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();
      const unsavedAtNavigation: Array<ReturnType<OrganEditorComponent['unsavedChanges']>> = [];
      navigate.mockImplementation(() => {
        unsavedAtNavigation.push(editor.fixture.componentInstance.unsavedChanges());
        return Promise.resolve(true);
      });

      await startSaving(editor);
      expect(navigate).not.toHaveBeenCalled();
      await finish({status: 'saved'}, editor.fixture);

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(unsavedAtNavigation).toEqual([null]);
    });

    it('disables Save while the write is in flight, so that nothing is written twice', async () => {
      const {finish, startSaving, writes} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();

      await startSaving(editor);

      expect(editor.saveButton().disabled).toBe(true);
      editor.saveButton().click();
      await Promise.resolve();
      expect(writes).toHaveLength(1);
      await finish({status: 'saved'}, editor.fixture);
    });

    it('enables Save again after a failed write so that the user can retry', async () => {
      const {finish, startSaving, writes} = renderWithDiskWrite();
      const editor = await open();
      await editor.fillValidOrgan();
      await startSaving(editor);
      await finish({status: 'failed', reason: 'disk full'}, editor.fixture);

      await startSaving(editor);
      expect(writes).toHaveLength(1);
      await finish({status: 'saved'}, editor.fixture);

      expect(editor.saveButton().disabled).toBe(true);
      expect(editor.fixture.componentInstance.unsavedChanges()).toBeNull();
    });
  });

  describe('the Save button', () => {
    it('is disabled while nothing was changed', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {saveButton} = await openEditor(organ.id);

      expect(saveButton().disabled).toBe(true);
    });

    it('is disabled on an untouched new Organ', async () => {
      const {open: openEditor} = render();
      const {saveButton} = await openEditor();

      expect(saveButton().disabled).toBe(true);
    });

    it('is disabled while the Organ is changed but invalid', async () => {
      const {open: openEditor} = render();
      const {field, type, saveButton} = await openEditor();

      await type(field('name'), 'Street organ');

      expect(saveButton().disabled).toBe(true);
    });

    it('is enabled once the Organ is changed and valid', async () => {
      const {open: openEditor} = render();
      const {fillValidOrgan, saveButton} = await openEditor();

      await fillValidOrgan();

      expect(saveButton().disabled).toBe(false);
    });

    it('is disabled again after saving', async () => {
      const {open: openEditor} = render();
      const {fillValidOrgan, save, saveButton} = await openEditor();
      await fillValidOrgan();

      await save();

      expect(saveButton().disabled).toBe(true);
    });

    it('is enabled again by a further change after saving', async () => {
      const {open: openEditor} = render();
      const {fillValidOrgan, save, saveButton, field, type} = await openEditor();
      await fillValidOrgan();
      await save();

      await type(field('name'), 'Renamed');

      expect(saveButton().disabled).toBe(false);
    });

    it('is disabled again when the change is reverted', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {field, type, saveButton} = await openEditor(organ.id);

      await type(field('name'), 'Renamed');
      await type(field('name'), 'Street organ');

      expect(saveButton().disabled).toBe(true);
    });
  });

  describe('unsavedChanges', () => {
    it('is null for a pristine new draft', async () => {
      const {open: openEditor} = render();
      const {fixture} = await openEditor();

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('is null when a stored Organ is reopened without changes', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture} = await openEditor(organ.id);

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('is null after only focusing and blurring a field of a pristine new draft', async () => {
      const {open: openEditor} = render();
      const {fixture, field} = await openEditor();
      const name = field('name');

      name.dispatchEvent(new Event('focus'));
      name.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('has no problems after a change that leaves the Organ valid', async () => {
      const {open: openEditor} = render();
      const {fixture, fillValidOrgan} = await openEditor();

      await fillValidOrgan();

      expect(fixture.componentInstance.unsavedChanges()).toEqual({problems: []});
    });

    it('is null after saving', async () => {
      const {open: openEditor} = render();
      const {fixture, fillValidOrgan, save} = await openEditor();
      await fillValidOrgan();

      await save();

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('is null again when a change is reverted to the saved version', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, field, type} = await openEditor(organ.id);

      await type(field('name'), 'Renamed');
      await type(field('name'), 'Street organ');

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('lists the broken rule with the label of its field', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, field, type} = await openEditor(organ.id);

      await type(field('name'), '');

      expect(fixture.componentInstance.unsavedChanges()).toEqual({
        problems: [
          {
            field: {key: 'ORGAN.EDITOR.NAME', params: {}},
            message: {key: 'ORGAN.VIOLATION.NAME_REQUIRED', params: {}},
          },
        ],
      });
    });

    it('labels a Tape Bed field with its own label', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, field, type} = await openEditor(organ.id);

      await type(field('tape-width'), '0');

      expect(fixture.componentInstance.unsavedChanges()?.problems).toEqual([
        {
          field: {key: 'ORGAN.EDITOR.TAPE_WIDTH', params: {}},
          message: {key: 'ORGAN.VIOLATION.MUST_BE_POSITIVE', params: {}},
        },
      ]);
    });

    it('labels a Pipe problem with its 1-based row and lists every Pipe of a duplicate', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 3);
      await library.put(organ);
      const {fixture, pipeRows, type} = await openEditor(organ.id);
      const noteOfRow = (row: number) => {
        const input = pipeRows()[row]?.querySelector<HTMLInputElement>('[data-testid="pipe-note"]');
        if (!input) throw new Error(`no note field in row ${row}`);
        return input;
      };

      await type(noteOfRow(2), '60');

      const message = {key: 'ORGAN.VIOLATION.DUPLICATE_PIPE', params: {noteName: 'C4'}};
      expect(fixture.componentInstance.unsavedChanges()?.problems).toEqual([
        {field: {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: 1}}, message},
        {field: {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: 3}}, message},
      ]);
    });

    it('labels the missing Pipes with the Pipes label', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 1);
      await library.put(organ);
      const {fixture, click} = await openEditor(organ.id);

      await click('remove-pipe');

      expect(fixture.componentInstance.unsavedChanges()?.problems).toEqual([
        {
          field: {key: 'ORGAN.EDITOR.PIPES', params: {}},
          message: {key: 'ORGAN.VIOLATION.PIPES_REQUIRED', params: {}},
        },
      ]);
    });

    it('lists missing values the user never touched', async () => {
      const {open: openEditor} = render();
      const {fixture, field, type} = await openEditor();

      await type(field('name'), 'Street organ');

      const problems = fixture.componentInstance.unsavedChanges()?.problems ?? [];
      expect(problems).toContainEqual({
        field: {key: 'ORGAN.EDITOR.TAPE_WIDTH', params: {}},
        message: {key: 'ORGAN.VIOLATION.VALUE_REQUIRED', params: {}},
      });
      expect(problems).toContainEqual({
        field: {key: 'ORGAN.EDITOR.PIPES', params: {}},
        message: {key: 'ORGAN.VIOLATION.PIPES_REQUIRED', params: {}},
      });
    });

    it('lists an empty Pipe row added to a stored Organ', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, click} = await openEditor(organ.id);

      await click('add-pipe');

      expect(fixture.componentInstance.unsavedChanges()?.problems).toEqual([
        {
          field: {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: 3}},
          message: {key: 'ORGAN.VIOLATION.PIPE_NOTE_REQUIRED', params: {}},
        },
      ]);
    });
  });

  describe('an unknown id', () => {
    it('goes back to the Organ list', async () => {
      const {open: openEditor, navigate} = render();

      await openEditor('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f');

      expect(navigate).toHaveBeenCalledWith(['/organs'], {replaceUrl: true});
    });
  });

  describe('a stored Organ', () => {
    it('shows its values', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);

      const {field, pipeRows} = await openEditor(organ.id);

      expect(field('name').value).toBe('Street organ');
      expect(field('tape-width').value).toBe('120');
      expect(pipeRows()).toHaveLength(2);
    });
  });

  describe('the Pipe rack', () => {
    async function openWithRack(pipeCount: number) {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', pipeCount);
      await library.put(organ);
      const editor = await openEditor(organ.id);
      const columns = () => [...editor.element.querySelectorAll<HTMLElement>('[data-testid="rack-column"]')];
      return {...editor, columns};
    }

    it('lays 31 Pipes out in 3 columns, read down then across', async () => {
      const {columns} = await openWithRack(31);

      expect(columns()).toHaveLength(3);
      expect(columns().map((column) => column.querySelectorAll('[data-testid="pipe"]').length)).toEqual([11, 11, 9]);
    });

    it('starts column 2 with row 12', async () => {
      const {columns} = await openWithRack(31);

      const firstOfSecond = columns()[1]?.querySelector('[data-testid="pipe"] [data-testid="pipe-row-number"]');
      expect(firstOfSecond?.textContent?.trim()).toBe('12');
    });

    it('heads each column with "Row" and "MIDI note"', async () => {
      const {columns} = await openWithRack(31);

      for (const column of columns()) {
        const headers = [...column.querySelectorAll('[data-testid="rack-header-cell"]')].map((cell) => cell.textContent?.trim());
        expect(headers).toEqual(['Row', 'MIDI note']);
      }
    });

    it('shows each Pipe row with row number, note input, note name and a menu button', async () => {
      const {pipeRows} = await openWithRack(3);

      const row = pipeRows()[1];
      expect(row?.querySelector('[data-testid="pipe-row-number"]')?.textContent?.trim()).toBe('2');
      expect(row?.querySelector<HTMLInputElement>('[data-testid="pipe-note"]')?.value).toBe('62');
      expect(row?.querySelector('[data-testid="pipe-note-name"]')?.textContent?.trim()).toBe('D4');
      expect(row?.querySelector('[data-testid="pipe-menu"]')).not.toBeNull();
    });

    it('marks sharp note names with the class sharp and leaves naturals unmarked', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2, {pipes: [{note: 60}, {note: 61}]});
      await library.put(organ);
      const {pipeRows} = await openEditor(organ.id);

      const names = pipeRows().map((row) => row.querySelector('[data-testid="pipe-note-name"]'));
      expect(names.map((name) => name?.classList.contains('sharp'))).toEqual([false, true]);
    });
  });

  describe('arranging Pipes', () => {
    async function openWithPipes() {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 3);
      await library.put(organ);
      const editor = await openEditor(organ.id);
      const notesInRows = () =>
        editor.pipeRows().map((row) => Number(row.querySelector<HTMLInputElement>('[data-testid="pipe-note"]')?.value));
      const storedNotes = () => library.entities()[0]?.pipes.map((pipe) => pipe.note);
      const saved = async () => {
        await editor.save();
        return storedNotes();
      };
      const press = async (row: number, testId: string) => {
        const button = editor.pipeRows()[row]?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
        if (!button) throw new Error(`no ${testId} in row ${row}`);
        button.click();
        await editor.fixture.whenStable();
      };
      const drop = async (previousIndex: number, currentIndex: number) => {
        const list = editor.fixture.debugElement.query(By.directive(CdkDropList));
        const dropList: CdkDropList = list.injector.get(CdkDropList);
        dropList.dropped.emit({previousIndex, currentIndex} as CdkDragDrop<unknown>);
        await editor.fixture.whenStable();
      };
      return {...editor, notesInRows, storedNotes, saved, press, drop, original: organ.pipes.map((pipe) => pipe.note)};
    }

    it('moves a Pipe up one row with its move-up button and saves the order', async () => {
      const {press, notesInRows, storedNotes, saved, original} = await openWithPipes();

      await press(2, 'move-up');
      expect(storedNotes()).toEqual(original);

      const expected = [original[0], original[2], original[1]];
      expect(notesInRows()).toEqual(expected);
      expect(await saved()).toEqual(expected);
    });

    it('moves a Pipe down one row with its move-down button and saves the order', async () => {
      const {press, notesInRows, saved, original} = await openWithPipes();

      await press(0, 'move-down');

      const expected = [original[1], original[0], original[2]];
      expect(notesInRows()).toEqual(expected);
      expect(await saved()).toEqual(expected);
    });

    it('disables move-up on the first row and move-down on the last row', async () => {
      const {pipeRows} = await openWithPipes();
      const rows = pipeRows();
      const button = (row: number, testId: string) =>
        rows[row]?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

      expect(button(0, 'move-up')?.disabled).toBe(true);
      expect(button(0, 'move-down')?.disabled).toBe(false);
      expect(button(1, 'move-up')?.disabled).toBe(false);
      expect(button(1, 'move-down')?.disabled).toBe(false);
      expect(button(2, 'move-up')?.disabled).toBe(false);
      expect(button(2, 'move-down')?.disabled).toBe(true);
    });

    it('moves a Pipe to the dropped row when dragged and saves the order', async () => {
      const {drop, notesInRows, saved, original} = await openWithPipes();

      await drop(2, 0);

      const expected = [original[2], original[0], original[1]];
      expect(notesInRows()).toEqual(expected);
      expect(await saved()).toEqual(expected);
    });

    async function clearNoteOfRow(editor: Awaited<ReturnType<typeof openWithPipes>>, row: number) {
      const input = editor.pipeRows()[row]?.querySelector<HTMLInputElement>('[data-testid="pipe-note"]');
      if (!input) throw new Error(`no note field in row ${row}`);
      await editor.type(input, '');
    }

    it('shows the missing-note message on the row the moved Pipe now holds', async () => {
      const editor = await openWithPipes();
      await clearNoteOfRow(editor, 2);
      expect(editor.violationAt('pipes.2.note')).toHaveLength(1);

      await editor.press(2, 'move-up');

      expect(editor.violationAt('pipes.1.note')).toEqual(['Enter the MIDI note of this Pipe.']);
      expect(editor.violationAt('pipes.2.note')).toEqual([]);
    });

    it('shows the missing-note message on the row the Pipe holds after an earlier row was removed', async () => {
      const editor = await openWithPipes();
      await clearNoteOfRow(editor, 2);
      expect(editor.violationAt('pipes.2.note')).toHaveLength(1);

      await editor.press(0, 'remove-pipe');

      expect(editor.violationAt('pipes.1.note')).toEqual(['Enter the MIDI note of this Pipe.']);
      expect(editor.violationAt('pipes.0.note')).toEqual([]);
    });

    it('removes a Pipe, keeps the other rows contiguous and saves the result', async () => {
      const {press, pipeRows, notesInRows, saved, original} = await openWithPipes();

      await press(1, 'remove-pipe');

      const expected = [original[0], original[2]];
      expect(pipeRows()).toHaveLength(2);
      expect(notesInRows()).toEqual(expected);
      expect(await saved()).toEqual(expected);
    });
  });

  describe('deleting the Organ', () => {
    async function openWithDialog(confirmed: boolean) {
      const dialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({afterClosed: () => of(confirmed)}));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open: dialog}}],
      });
      const library = TestBed.inject(OrganLibrary);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const editor = await open(organ.id);
      navigate.mockClear();
      await editor.click('delete-organ');
      return {library, navigate, organ, dialog};
    }

    it('opens the confirm dialog for deleting the Organ', async () => {
      const {dialog, organ} = await openWithDialog(false);

      expect(dialog.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(dialog.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: organ.id, name: 'Street organ'}},
      });
    });

    it('removes the Organ and goes to the Organ list when confirmed', async () => {
      const {library, navigate} = await openWithDialog(true);

      expect(library.entities()).toEqual([]);
      expect(navigate).toHaveBeenCalledWith(['/organs']);
    });

    it('does not navigate and keeps the unsaved changes when removing fails', async () => {
      const dialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(true),
      }));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open: dialog}}],
      });
      const library = TestBed.inject(OrganLibrary);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, field, type, click} = await open(organ.id);
      await type(field('name'), '');
      expect(fixture.componentInstance.unsavedChanges()).not.toBeNull();
      vi.spyOn(library, 'remove').mockRejectedValue(new Error('disk full'));
      navigate.mockClear();

      await click('delete-organ');

      expect(navigate).not.toHaveBeenCalled();
      expect(fixture.componentInstance.unsavedChanges()).not.toBeNull();
    });

    it('has no unsaved changes after the Organ was deleted', async () => {
      const dialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(true),
      }));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open: dialog}}],
      });
      const library = TestBed.inject(OrganLibrary);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, field, type, click} = await open(organ.id);
      await type(field('name'), 'Renamed');

      await click('delete-organ');

      expect(fixture.componentInstance.unsavedChanges()).toBeNull();
    });

    it('keeps the Organ and stays in the editor when cancelled', async () => {
      const {library, navigate, organ} = await openWithDialog(false);

      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('deleting the Organ that has Tapes', () => {
    async function openAndDelete(options: {confirmed?: boolean; failures?: InMemoryCranculaApiFailures; unreadable?: boolean} = {}) {
      const organ = testOrgan('Street organ', 3);
      const first = tapeFor(organ, 'First', [60, 62]);
      const second = tapeFor(organ, 'Second', [62, 64]);
      const snapshot = toTapeLibrarySnapshot([first.tape, second.tape], [first.song, second.song]);
      const failures: InMemoryCranculaApiFailures = options.unreadable ? {tapes: {load: 'unreadable'}} : (options.failures ?? {});
      const dialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(options.confirmed === true),
      }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideTestTranslations(),
          {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, snapshot, failures)},
          {provide: MatDialog, useValue: {open: dialog}},
        ],
      });
      const library = TestBed.inject(OrganLibrary);
      const tapes = TestBed.inject(TapeLibrary);
      await tapes.load();
      await library.put(organ);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const snackBarOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const editor = await open(organ.id);
      navigate.mockClear();
      await editor.click('delete-organ');
      return {organ, library, tapes, dialog, navigate, snackBarOpen};
    }

    it('names the number of the Organ\'s Tapes in the confirmation', async () => {
      const {dialog, organ} = await openAndDelete();

      expect(dialog).toHaveBeenCalledTimes(1);
      expect(dialog.mock.calls[0]?.[1]).toMatchObject({
        data: {
          action: ConfirmableAction.DELETE,
          entity: {id: organ.id, name: 'Street organ'},
          consequence: {params: {count: 2}},
        },
      });
    });

    it('removes the Organ\'s Tapes and then the Organ when confirmed', async () => {
      const {library, tapes, navigate} = await openAndDelete({confirmed: true});

      expect(tapes.tapeEntities()).toEqual([]);
      expect(library.entities()).toEqual([]);
      expect(navigate).toHaveBeenCalledWith(['/organs']);
    });

    it('keeps the Organ and its Tapes when cancelled', async () => {
      const {organ, library, tapes} = await openAndDelete({confirmed: false});

      expect(tapes.tapeEntities()).toHaveLength(2);
      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
    });

    it('keeps the Organ when removing its Tapes could not be written', async () => {
      const {organ, library, navigate} = await openAndDelete({confirmed: true, failures: {tapes: {save: 'failed'}}});

      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('refuses to delete while the Tapes could not be read, with a message and no change', async () => {
      const {organ, library, dialog, snackBarOpen, navigate} = await openAndDelete({confirmed: true, unreadable: true});

      expect(dialog).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalledTimes(1);
      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('saving with removed Pipes that have Holes', () => {
    /** An Organ with the Pipes 60, 62, 64, 66, and two Tapes on it: 3 Holes on 60, 62, 64 and 2 Holes on 60, 62. */
    async function openWithTapes(options: {confirmed?: boolean; failures?: InMemoryCranculaApiFailures; unreadable?: boolean} = {}) {
      const organ = testOrgan('Street organ', 4);
      const first = tapeFor(organ, 'First', [60, 62, 64]);
      const second = tapeFor(organ, 'Second', [60, 62]);
      const snapshot = toTapeLibrarySnapshot([first.tape, second.tape], [first.song, second.song]);
      const failures: InMemoryCranculaApiFailures = options.unreadable ? {tapes: {load: 'unreadable'}} : (options.failures ?? {});
      const dialog = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(options.confirmed === true),
      }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideTestTranslations(),
          {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, snapshot, failures)},
          {provide: MatDialog, useValue: {open: dialog}},
        ],
      });
      const library = TestBed.inject(OrganLibrary);
      const tapes = TestBed.inject(TapeLibrary);
      await tapes.load();
      await library.put(organ);
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const snackBarOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const editor = await open(organ.id);
      const removeRows = async (count: number) => {
        for (let removed = 0; removed < count; removed++) await editor.click('remove-pipe');
      };
      const storedNotes = () => library.entities()[0]?.pipes.map((pipe) => pipe.note);
      const holeCount = () => tapes.tapeEntities().reduce((sum, tape) => sum + tape.holes.length, 0);
      return {...editor, organ, library, tapes, dialog, snackBarOpen, removeRows, storedNotes, holeCount};
    }

    it('asks first, naming the number of Tapes and Holes', async () => {
      const {removeRows, save, dialog, organ} = await openWithTapes();
      await removeRows(3);

      await save();

      expect(dialog).toHaveBeenCalledTimes(1);
      expect(dialog.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(dialog.mock.calls[0]?.[1]).toMatchObject({
        data: {entity: {id: organ.id, name: 'Street organ'}, consequence: {params: {tapes: 2, holes: 5}}},
      });
    });

    it('removes the Holes of the removed Pipes, keeps the Tapes, and then saves the Organ when confirmed', async () => {
      const {removeRows, save, tapes, storedNotes, holeCount} = await openWithTapes({confirmed: true});
      await removeRows(3);

      await save();

      expect(holeCount()).toBe(0);
      expect(tapes.tapeEntities()).toHaveLength(2);
      expect(storedNotes()).toEqual([66]);
    });

    it('changes neither the Organ nor its Tapes when cancelled', async () => {
      const {removeRows, save, storedNotes, holeCount, fixture} = await openWithTapes({confirmed: false});
      await removeRows(3);

      await save();

      expect(holeCount()).toBe(5);
      expect(storedNotes()).toEqual([60, 62, 64, 66]);
      expect(fixture.componentInstance.unsavedChanges()).not.toBeNull();
    });

    it('does not save the Organ when removing the Holes could not be written', async () => {
      const {removeRows, save, storedNotes, fixture} = await openWithTapes({confirmed: true, failures: {tapes: {save: 'failed'}}});
      await removeRows(3);

      await save();

      expect(storedNotes()).toEqual([60, 62, 64, 66]);
      expect(fixture.componentInstance.unsavedChanges()).not.toBeNull();
    });

    it('asks nothing when removed Pipes have no Holes', async () => {
      const {pipeRows, fixture, save, dialog, storedNotes} = await openWithTapes();
      // The last row (note 66) is a Pipe without Holes.
      const last = pipeRows()[3]?.querySelector<HTMLButtonElement>('[data-testid="remove-pipe"]');
      if (!last) throw new Error('no remove-pipe in the last row');
      last.click();
      await fixture.whenStable();

      await save();

      expect(dialog).not.toHaveBeenCalled();
      expect(storedNotes()).toEqual([60, 62, 64]);
    });

    it('asks nothing when Pipes are only reordered or added', async () => {
      const {press, click, element, type, save, dialog, storedNotes} = await openWithTapesForArranging();
      await press(0, 'move-down');
      await click('add-pipe');
      const notes = element.querySelectorAll<HTMLInputElement>('[data-testid="pipe-note"]');
      const added = notes[notes.length - 1];
      if (!added) throw new Error('no note field for the added Pipe');
      await type(added, '68');

      await save();

      expect(dialog).not.toHaveBeenCalled();
      expect(storedNotes()).toEqual([62, 60, 64, 66, 68]);
    });

    it('refuses to save removed Pipes while the Tapes could not be read, with a message and no change', async () => {
      const {removeRows, save, dialog, snackBarOpen, storedNotes} = await openWithTapes({confirmed: true, unreadable: true});
      await removeRows(3);

      await save();

      expect(dialog).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalledTimes(1);
      expect(storedNotes()).toEqual([60, 62, 64, 66]);
    });

    it('still saves other changes while the Tapes could not be read', async () => {
      const {field, type, save, library} = await openWithTapes({unreadable: true});

      await type(field('name'), 'Renamed');
      await save();

      expect(library.entities()[0]?.name).toBe('Renamed');
    });

    async function openWithTapesForArranging() {
      const editor = await openWithTapes();
      const press = async (row: number, testId: string) => {
        const button = editor.pipeRows()[row]?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
        if (!button) throw new Error(`no ${testId} in row ${row}`);
        button.click();
        await editor.fixture.whenStable();
      };
      return {...editor, press};
    }
  });

  describe('a number field with text that is not a number', () => {
    it('asks for a number next to the field', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('tape-width'), 'abc');

      expect(violationAt('tapeBed.tapeWidth')).toEqual(['Enter a number.']);
    });

    it('asks for a number next to a Pipe note', async () => {
      const {open: openEditor} = render();
      const {field, click, typeUnreadableNumber, violationAt} = await openEditor();
      await click('add-pipe');

      await typeUnreadableNumber(field('pipe-note'));

      expect(violationAt('pipes.0.note')).toEqual(['Enter a number.']);
    });

    it('disables Save and lists the problem when leaving', async () => {
      const {open: openEditor} = render();
      const {fixture, field, fillValidOrgan, type, saveButton} = await openEditor();
      await fillValidOrgan();

      await type(field('tape-width'), 'abc');

      expect(saveButton().disabled).toBe(true);
      expect(fixture.componentInstance.unsavedChanges()?.problems).toEqual([
        {
          field: {key: 'ORGAN.EDITOR.TAPE_WIDTH', params: {}},
          message: {key: 'ORGAN.EDITOR.NOT_A_NUMBER', params: {}},
        },
      ]);
    });

    it('goes away once a number is typed', async () => {
      const {open: openEditor} = render();
      const {field, type, typeUnreadableNumber, violationAt, saveButton, fillValidOrgan} = await openEditor();
      await fillValidOrgan();
      await typeUnreadableNumber(field('tape-width'));

      Object.defineProperty(field('tape-width'), 'validity', {value: {badInput: false}, configurable: true});
      await type(field('tape-width'), '120');

      expect(violationAt('tapeBed.tapeWidth')).toEqual([]);
      expect(saveButton().disabled).toBe(false);
    });
  });

  describe('the mm fields', () => {
    const mmFields = ['tape-width', 'hole-diameter', 'row-spacing', 'minimum-gap'];

    it.each(mmFields)('%s is a text input for decimals', async (testId) => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      expect(field(testId).type).toBe('text');
      expect(field(testId).getAttribute('inputmode')).toBe('decimal');
    });

    it.each(mmFields)('%s has the visible suffix "mm" and a label without "(mm)"', async (testId) => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      const formField = field(testId).closest('mat-form-field');
      expect(formField?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
      expect(formField?.querySelector('mat-label')?.textContent).not.toContain('(mm)');
    });

    it.each(mmFields)('%s shows a stored 2.5 as 2.5 in English when not focused', async (testId) => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2, {
        tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 2.5},
        minimumGap: 2.5,
      });
      await library.put(organ);
      const {field} = await openEditor(organ.id);

      expect(field(testId).value).toBe(testId === 'tape-width' ? '120' : '2.5');
    });

    it.each(mmFields)('%s shows a stored 2.5 as 2,5 in German when not focused', async (testId) => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 2, {
        tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 2.5},
        minimumGap: 2.5,
      });
      await TestBed.inject(OrganLibrary).put(organ);
      const {field} = await open(organ.id);

      expect(field(testId).value).toBe(testId === 'tape-width' ? '120' : '2,5');
    });

    it('keeps "2," in the field while typing', async () => {
      const {open: openEditor} = render();
      const {field, type} = await openEditor();

      await type(field('minimum-gap'), '2,');

      expect(field('minimum-gap').value).toBe('2,');
    });

    it('stores 2.5 in the draft when "2,5" is typed', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {field, type, save} = await openEditor(organ.id);

      await type(field('minimum-gap'), '2,5');
      await save();

      expect(library.entities()[0]?.minimumGap).toBe(2.5);
    });

    it('asks for a number next to a field when "abc" is typed', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('tape-width'), 'abc');

      expect(violationAt('tapeBed.tapeWidth')).toEqual(['Enter a number.']);
    });
  });

  describe('the two sheets', () => {
    const sheet = (element: HTMLElement, testId: string) => {
      const found = element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!found) throw new Error(`no ${testId}`);
      return found;
    };
    const testIdsIn = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-testid]')].map((node) => node.getAttribute('data-testid'));

    it('is a Tape Bed sheet titled "Tape Bed" in an outlined card', async () => {
      const {open: openEditor} = render();
      const {element} = await openEditor();

      const tapeBed = sheet(element, 'tape-bed-sheet');
      expect(tapeBed.tagName.toLowerCase()).toBe('mat-card');
      expect(tapeBed.classList).toContain('mat-mdc-card-outlined');
      expect(tapeBed.querySelector('.sheet-title')?.textContent?.trim()).toBe('Tape Bed');
    });

    it('orders Name, Tape width, Hole diameter, Spacing between rows, Minimum Gap, Border, Minimum Hole Length in the Tape Bed sheet', async () => {
      const {open: openEditor} = render();
      const {element} = await openEditor();

      const wanted = ['name', 'tape-width', 'hole-diameter', 'row-spacing', 'minimum-gap', 'border', 'minimum-hole-length'];
      expect(testIdsIn(sheet(element, 'tape-bed-sheet')).filter((id) => wanted.includes(id ?? ''))).toEqual(wanted);
    });

    it('lets the Name field span the full width of the sheet', async () => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      expect(field('name').closest('mat-form-field')?.classList).toContain('full-width');
    });

    it('is a Pipes sheet with a head holding the title, the Pipe count and Add Pipe as a text button', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      const pipes = sheet(element, 'pipes-sheet');
      expect(pipes.tagName.toLowerCase()).toBe('mat-card');
      const head = pipes.querySelector<HTMLElement>('.sheet-head');
      expect(head?.querySelector('.sheet-title')?.textContent?.trim()).toBe('Pipes');
      expect(head?.querySelector('[data-testid="pipe-count"]')?.textContent?.trim()).toBe('31 Pipes');
      expect(head?.querySelector('[data-testid="add-pipe"]')?.classList).toContain('mat-mdc-button');
      expect(pipes.querySelectorAll('[data-testid="pipe"]')).toHaveLength(31);
    });

    it('keeps the Pipes out of the Tape Bed sheet', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      expect(sheet(element, 'tape-bed-sheet').querySelector('[data-testid="pipe"], [data-testid="add-pipe"]')).toBeNull();
    });
  });

  describe('the fit check', () => {
    const fitCheck = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-testid="fit-check"]');
    const text = (element: HTMLElement) => fitCheck(element)?.textContent?.replace(/\s+/g, ' ').trim();

    it('says how many rows take how much of the tape width and what border is left (Street organ)', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      expect(text(element)).toContain('31 rows take 107.5 mm of the 120 mm tape width, a border of 6.25 mm on each side');
      expect(fitCheck(element)?.classList).not.toContain('error');
    });

    it('lies in the Tape Bed sheet', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      expect(element.querySelector('[data-testid="tape-bed-sheet"] [data-testid="fit-check"]')).not.toBeNull();
    });

    it('uses the decimal comma in German', async () => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 31);
      await TestBed.inject(OrganLibrary).put(organ);
      const {element} = await open(organ.id);

      const sentence = text(element);
      expect(sentence).toContain('107,5');
      expect(sentence).toContain('6,25');
      expect(sentence).toContain('120');
      expect(sentence).not.toContain('107.5');
    });

    describe('with a tape width of 100 mm', () => {
      async function openTooNarrow() {
        const {open: openEditor, library} = render();
        const organ = testOrgan('Street organ', 31);
        await library.put(organ);
        const editor = await openEditor(organ.id);
        await editor.type(editor.field('tape-width'), '100');
        return editor;
      }

      it('becomes an error with an icon, the 107.5 mm the rows take and the 100 mm tape width', async () => {
        const {element} = await openTooNarrow();

        expect(fitCheck(element)?.classList).toContain('error');
        expect(fitCheck(element)?.querySelector('mat-icon')).not.toBeNull();
        expect(text(element)).toContain('107.5');
        expect(text(element)).toContain('100');
        expect(text(element)).not.toContain('border of');
      });

      it('gives the Tape width field the error state but no second message', async () => {
        const {field, violationAt} = await openTooNarrow();

        expect(field('tape-width').closest('mat-form-field')?.classList).toContain('mat-form-field-invalid');
        expect(violationAt('tapeBed.tapeWidth')).toEqual([]);
      });
    });

    it.each(['tape-width', 'hole-diameter', 'row-spacing'])('is absent while the %s is missing', async (testId) => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field, type} = await openEditor(organ.id);

      await type(field(testId), '');

      expect(fitCheck(element)).toBeNull();
    });

    it('is absent while there are no Pipes', async () => {
      const {open: openEditor} = render();
      const {element, field, type} = await openEditor();
      await type(field('tape-width'), '120');
      await type(field('hole-diameter'), '2.5');
      await type(field('row-spacing'), '3.5');

      expect(fitCheck(element)).toBeNull();
    });
  });

  describe('one Pipe', () => {
    it('counts "1 Pipe" and the fit check starts "1 row takes"', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 1);
      await library.put(organ);
      const {element} = await openEditor(organ.id);

      expect(element.querySelector('[data-testid="pipe-count"]')?.textContent?.trim()).toBe('1 Pipe');
      expect(element.querySelector('[data-testid="fit-check"]')?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^1 row takes /);
    });

    it('counts "1 Pfeife" and the fit check starts "1 Reihe belegt" in German', async () => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const organ = testOrgan('Street organ', 1);
      await TestBed.inject(OrganLibrary).put(organ);
      const {element} = await open(organ.id);

      expect(element.querySelector('[data-testid="pipe-count"]')?.textContent?.trim()).toBe('1 Pfeife');
      expect(element.querySelector('[data-testid="fit-check"]')?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(/^1 Reihe belegt /);
    });
  });

  describe('the Tape Bed drawing', () => {
    const drawing = (element: HTMLElement) =>
      element.querySelector<SVGSVGElement>('[data-testid="tape-bed-sheet"] svg[data-testid="tape-bed-drawing"]');
    const numberAttribute = (node: Element, name: string) => Number(node.getAttribute(name));

    async function openStreetOrgan(pipes: number) {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', pipes);
      await library.put(organ);
      return openEditor(organ.id);
    }

    it('is an SVG in the Tape Bed sheet whose viewBox is in mm and as high as the tape width (120 mm)', async () => {
      const {element} = await openStreetOrgan(3);

      const svg = drawing(element);
      expect(svg).not.toBeNull();
      const [minX, minY, width, height] = (svg?.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      expect([minX, minY]).toEqual([0, 0]);
      expect(width).toBeGreaterThan(0);
      expect(height).toBe(120);
    });

    it('draws the Tape as a rect as high as the tape width', async () => {
      const {element} = await openStreetOrgan(3);

      const tapes = drawing(element)?.querySelectorAll('rect[data-testid="tape-bed-tape"]') ?? [];
      expect(tapes).toHaveLength(1);
      expect(numberAttribute(tapes[0], 'y')).toBe(0);
      expect(numberAttribute(tapes[0], 'height')).toBe(120);
    });

    it('draws a border band as high as the Border at the top and at the bottom edge', async () => {
      const {element} = await openStreetOrgan(3);

      const bands = [...(drawing(element)?.querySelectorAll('[data-testid="tape-bed-border"]') ?? [])];
      expect(bands).toHaveLength(2);
      expect(bands.map((band) => numberAttribute(band, 'height'))).toEqual([55.25, 55.25]);
      const tops = bands.map((band) => numberAttribute(band, 'y')).sort((a, b) => a - b);
      expect(tops[0]).toBeCloseTo(0);
      expect(tops[1]).toBeCloseTo(120 - 55.25);
    });

    it('draws one line per row at border + hole diameter / 2 + (row - 1) x spacing, row 1 nearest the top', async () => {
      const {element} = await openStreetOrgan(3);

      const rows = [...(drawing(element)?.querySelectorAll('line[data-testid="tape-bed-row"]') ?? [])];
      expect(rows).toHaveLength(3);
      [56.5, 60, 63.5].forEach((y, index) => {
        expect(numberAttribute(rows[index], 'y1')).toBeCloseTo(y);
        expect(numberAttribute(rows[index], 'y2')).toBeCloseTo(y);
      });
    });

    it('has a text alternative naming the tape width, the Border and the number of rows', async () => {
      const {element} = await openStreetOrgan(3);

      const svg = drawing(element);
      expect(svg?.getAttribute('role')).toBe('img');
      const label = svg?.getAttribute('aria-label') ?? '';
      expect(label).toContain('120');
      expect(label).toContain('55.25');
      expect(label).toContain('3');
    });

    it('draws no Holes', async () => {
      const {element} = await openStreetOrgan(3);

      expect(drawing(element)).not.toBeNull();
      expect(drawing(element)?.querySelector('circle, ellipse, [data-testid*="hole"]')).toBeNull();
    });

    it.each(['tape-width', 'hole-diameter', 'row-spacing'])('is absent while the %s is missing', async (testId) => {
      const {element, field, type} = await openStreetOrgan(3);

      expect(drawing(element)).not.toBeNull();
      await type(field(testId), '');

      expect(drawing(element)).toBeNull();
    });

    it('is absent while the Border is negative (tape width 100 mm, 31 rows)', async () => {
      const {element, field, type} = await openStreetOrgan(31);

      expect(drawing(element)).not.toBeNull();
      await type(field('tape-width'), '100');

      expect(drawing(element)).toBeNull();
    });
  });

  describe('rule violations', () => {
    it('shows no "missing value" messages on an untouched new Organ', async () => {
      const {open: openEditor} = render();
      const {element} = await openEditor();
      expect(element.querySelectorAll('[data-testid="violation"]')).toHaveLength(0);
    });

    it('asks for a name once the name was cleared', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('name'), 'x');
      await type(field('name'), '');

      expect(violationAt('name')).toEqual(['Please enter a name.']);
    });

    it('asks for a value once a measurement was cleared', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('tape-width'), '1');
      await type(field('tape-width'), '');

      expect(violationAt('tapeBed.tapeWidth')).toEqual(['Please enter a value.']);
    });

    it('asks for Pipes once the Organ was edited', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('name'), 'Street organ');

      expect(violationAt('pipes')).toEqual(['Add at least one Pipe.']);
    });

    it('asks for the note of a new Pipe once it was cleared', async () => {
      const {open: openEditor} = render();
      const {field, type, click, violationAt} = await openEditor();

      await click('add-pipe');
      await type(field('pipe-note'), '6');
      await type(field('pipe-note'), '');

      expect(violationAt('pipes.0.note')).toEqual(['Enter the MIDI note of this Pipe.']);
    });

    it('rejects a note outside 0–127 right away', async () => {
      const {open: openEditor} = render();
      const {field, type, click, violationAt} = await openEditor();

      await click('add-pipe');
      await type(field('pipe-note'), '128');

      expect(violationAt('pipes.0.note')).toEqual(['128 is not a MIDI note (0–127).']);
    });

    it('marks both Pipes of a duplicate note', async () => {
      const {open: openEditor} = render();
      const {element, type, click, violationAt} = await openEditor();

      await click('add-pipe');
      await click('add-pipe');
      const notes = element.querySelectorAll<HTMLInputElement>('[data-testid="pipe-note"]');
      await type(notes[0], '60');
      await type(notes[1], '60');

      expect(violationAt('pipes.0.note')).toEqual(['Another Pipe already plays C4.']);
      expect(violationAt('pipes.1.note')).toEqual(['Another Pipe already plays C4.']);
    });

    it('requires a positive Minimum Gap', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('minimum-gap'), '0');

      expect(violationAt('minimumGap')).toEqual(['Must be greater than 0.']);
    });

    it('requires a row spacing of at least the hole diameter', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('hole-diameter'), '3');
      await type(field('row-spacing'), '2.5');

      expect(violationAt('tapeBed.rowSpacing')).toEqual([
        'Must be at least the hole diameter (3 mm), or neighbouring holes overlap.',
      ]);
    });

    it('shows how much tape width the Pipes need in the fit check, not next to the Tape width field', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {element, field, type, violationAt} = await openEditor(organ.id);

      await type(field('tape-width'), '100');

      expect(violationAt('tapeBed.tapeWidth')).toEqual([]);
      expect(element.querySelector('[data-testid="fit-check"]')?.textContent).toContain('107.5');
    });

    it('stores only the fixed version of a stored Organ edited into an invalid state, once saved', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ');
      await library.put(organ);
      const put = vi.spyOn(library, 'put');
      const {field, type, save, saveButton} = await openEditor(organ.id);

      await type(field('name'), '');
      expect(saveButton().disabled).toBe(true);
      expect(put).not.toHaveBeenCalled();
      expect(library.entities()[0]?.name).toBe('Street organ');

      await type(field('name'), 'Fixed');
      await save();
      expect(put).toHaveBeenCalledTimes(1);
      expect(library.entities()[0]?.name).toBe('Fixed');
    });
  });
});
