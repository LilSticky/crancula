import type {CdkDragDrop} from '@angular/cdk/drag-drop';
import {CdkDropList} from '@angular/cdk/drag-drop';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideRouter, Router} from '@angular/router';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {OrganLibrary} from '../organ-library.store';
import {OrganEditorComponent} from './organ-editor.component';

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
  const click = async (testId: string) => {
    field(testId).click();
    await fixture.whenStable();
  };
  const pipeRows = () => [...element.querySelectorAll<HTMLElement>('[data-testid="pipe"]')];

  async function fillValidOrgan() {
    await type(field('name'), 'Street organ');
    await type(field('tape-width'), '120');
    await type(field('border'), '5');
    await type(field('hole-diameter'), '2.5');
    await type(field('row-spacing'), '3.5');
    await type(field('minimum-gap'), '1.5');
    await click('add-pipe');
    await type(field('pipe-note'), '60');
  }

  /** The rule message shown at a field, by the field's path in the Organ. */
  const violationAt = (path: string) =>
    [...element.querySelectorAll(`[data-testid="violation"][data-path="${path}"]`)].map((error) => error.textContent?.trim());

  return {fixture, element, field, type, click, pipeRows, fillValidOrgan, violationAt};
}

describe('OrganEditorComponent', () => {
  describe('a new Organ', () => {
    it('has empty fields for name, Tape Bed and Minimum Gap', async () => {
      const {open: openEditor} = render();
      const {field} = await openEditor();

      for (const testId of ['name', 'tape-width', 'border', 'hole-diameter', 'row-spacing', 'minimum-gap']) {
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

    it('stores the Organ as soon as it is valid and opens it by id', async () => {
      const {open: openEditor, library, navigate} = render();
      const {fillValidOrgan} = await openEditor();

      await fillValidOrgan();

      const [stored] = library.entities();
      expect(stored?.name).toBe('Street organ');
      expect(stored?.pipes.map((pipe) => pipe.note)).toEqual([60]);
      expect(navigate).toHaveBeenCalledWith(['/organs', stored?.id], {replaceUrl: true});
    });

    it('stores nothing while the Organ is invalid', async () => {
      const {open: openEditor, library, navigate} = render();
      const {fillValidOrgan, field, type} = await openEditor();

      await fillValidOrgan();
      const [stored] = library.entities();
      await library.remove(stored.id);
      navigate.mockClear();
      await type(field('name'), '');

      expect(library.entities()).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('hasInvalidDraft', () => {
    it('is false for a pristine new draft', async () => {
      const {open: openEditor} = render();
      const {fixture} = await openEditor();

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(false);
    });

    it('is false after an edit that leaves the Organ valid', async () => {
      const {open: openEditor} = render();
      const {fixture, fillValidOrgan} = await openEditor();

      await fillValidOrgan();

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(false);
    });

    it('is true after an edit that breaks a rule', async () => {
      const {open: openEditor} = render();
      const {fixture, field, type} = await openEditor();

      await type(field('name'), 'Street organ');

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(true);
    });

    it('is false when a stored Organ is reopened without changes', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture} = await openEditor(organ.id);

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(false);
    });
  });

  describe('hasInvalidDraft by real changes', () => {
    it('is true after removing Pipes from a stored Organ until it breaks a rule', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, click} = await openEditor(organ.id);

      await click('remove-pipe');
      await click('remove-pipe');

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(true);
    });

    it('is true after adding an empty Pipe row to a stored Organ', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {fixture, click} = await openEditor(organ.id);

      await click('add-pipe');

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(true);
    });

    it('is false after only focusing and blurring a field of a pristine new draft', async () => {
      const {open: openEditor} = render();
      const {fixture, field} = await openEditor();
      const name = field('name');

      name.dispatchEvent(new Event('focus'));
      name.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(fixture.componentInstance.hasInvalidDraft()).toBe(false);
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

    it('stores valid changes under the same id', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 2);
      await library.put(organ);
      const {field, type} = await openEditor(organ.id);

      await type(field('name'), 'Renamed');

      expect(library.entities().map(({id, name}) => ({id, name}))).toEqual([{id: organ.id, name: 'Renamed'}]);
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
      return {...editor, notesInRows, storedNotes, press, drop, original: organ.pipes.map((pipe) => pipe.note)};
    }

    it('moves a Pipe up one row with its move-up button and stores the order', async () => {
      const {press, notesInRows, storedNotes, original} = await openWithPipes();

      await press(2, 'move-up');

      const expected = [original[0], original[2], original[1]];
      expect(notesInRows()).toEqual(expected);
      expect(storedNotes()).toEqual(expected);
    });

    it('moves a Pipe down one row with its move-down button and stores the order', async () => {
      const {press, notesInRows, storedNotes, original} = await openWithPipes();

      await press(0, 'move-down');

      const expected = [original[1], original[0], original[2]];
      expect(notesInRows()).toEqual(expected);
      expect(storedNotes()).toEqual(expected);
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

    it('moves a Pipe to the dropped row when dragged and stores the order', async () => {
      const {drop, notesInRows, storedNotes, original} = await openWithPipes();

      await drop(2, 0);

      const expected = [original[2], original[0], original[1]];
      expect(notesInRows()).toEqual(expected);
      expect(storedNotes()).toEqual(expected);
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

    it('removes a Pipe, keeps the other rows contiguous and stores the result', async () => {
      const {press, pipeRows, notesInRows, storedNotes, original} = await openWithPipes();

      await press(1, 'remove-pipe');

      const expected = [original[0], original[2]];
      expect(pipeRows()).toHaveLength(2);
      expect(notesInRows()).toEqual(expected);
      expect(storedNotes()).toEqual(expected);
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

    it('requires positive measurements and a border that is not negative', async () => {
      const {open: openEditor} = render();
      const {field, type, violationAt} = await openEditor();

      await type(field('minimum-gap'), '0');
      await type(field('border'), '-1');

      expect(violationAt('minimumGap')).toEqual(['Must be greater than 0.']);
      expect(violationAt('tapeBed.border')).toEqual(['Must not be negative.']);
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

    it('shows how much tape width the Pipes need', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ', 31);
      await library.put(organ);
      const {field, type, violationAt} = await openEditor(organ.id);

      await type(field('tape-width'), '100');

      expect(violationAt('tapeBed.tapeWidth')).toEqual(['The Pipes need 117.5 mm, but the tape is only 100 mm wide.']);
    });

    it('stores only the fixed version of a stored Organ edited into an invalid state', async () => {
      const {open: openEditor, library} = render();
      const organ = testOrgan('Street organ');
      await library.put(organ);
      const put = vi.spyOn(library, 'put');
      const {field, type} = await openEditor(organ.id);

      await type(field('name'), '');
      expect(put).not.toHaveBeenCalled();
      expect(library.entities()[0]?.name).toBe('Street organ');

      await type(field('name'), 'Fixed');
      expect(put).toHaveBeenCalledTimes(1);
      expect(library.entities()[0]?.name).toBe('Fixed');
    });
  });
});
