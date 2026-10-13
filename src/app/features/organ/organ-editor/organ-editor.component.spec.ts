import {TestBed} from '@angular/core/testing';
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
