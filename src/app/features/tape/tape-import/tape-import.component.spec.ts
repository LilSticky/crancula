import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {
  defaultSelectedParts,
  fitOf,
  MAXIMUM_MIDI_FILE_SIZE,
  minimumHoleLength,
  type Organ,
  type PartIndex,
  proposeTransposition,
  readMidiSong,
  type Song,
} from '@api/index';
import {encodeSmf, type SmfTimedEvent} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {TapeImportComponent} from './tape-import.component';

const TICKS_PER_QUARTER = 480;
const PERCUSSION_CHANNEL = 9;

function track(channel: number, notes: readonly number[], name: string): {events: readonly SmfTimedEvent[]} {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: name}}];
  for (const note of notes) {
    events.push(
      {delta: 0, event: {type: 'noteOn', channel, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel, note, velocity: 0}},
    );
  }
  return {events};
}

/** A melody one semitone above the Pipes of `testOrgan` (60, 62, 64), plus a percussion Part. */
function melodyBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(0, [61, 63, 65], 'Lead'), track(PERCUSSION_CHANNEL, [36, 38], 'Drums')],
  });
}

/**
 * Lead one semitone above the Pipes of `testOrgan` (61, 63, 65), a Bass that sits exactly on them
 * (twice, 60, 62, 64), and Drums: all Parts selected propose 0, only the Lead proposes -1.
 */
function threePartBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      track(0, [61, 63, 65], 'Lead'),
      track(1, [60, 62, 64, 60, 62, 64], 'Bass'),
      track(PERCUSSION_CHANNEL, [36, 38], 'Drums'),
    ],
  });
}

function percussionOnlyBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(PERCUSSION_CHANNEL, [36, 38], 'Drums')],
  });
}

function midiFile(bytes: Uint8Array, name = 'melody.mid'): File {
  return new File([new Uint8Array(bytes)], name, {type: 'audio/midi'});
}

function songOf(bytes: Uint8Array, name: string): Song {
  const result = readMidiSong(bytes, name);
  if (!result.ok) throw new Error(`invalid test Song: ${result.error}`);
  return result.value;
}

async function render(options: {organs?: readonly Organ[]; failToSave?: boolean; unreadableTapes?: boolean} = {}) {
  const api = createInMemoryCranculaApi(
    undefined,
    undefined,
    options.failToSave ? {tapes: {save: 'failed'}} : options.unreadableTapes ? {tapes: {load: 'unreadable'}} : {},
  );
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideTestTranslations(), {provide: CRANCULA_API, useValue: api}],
  });
  const organs = TestBed.inject(OrganLibrary);
  for (const organ of options.organs ?? []) await organs.put(organ);
  const tapes = TestBed.inject(TapeLibrary);
  if (options.unreadableTapes) await tapes.load();
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(TapeImportComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const query = (testId: string) => element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
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
  const organSelect = () => {
    const select = element.querySelector<HTMLSelectElement>('[data-testid="organ"]');
    if (!select) throw new Error('no Organ select');
    return select;
  };
  /** Chooses the file the way the browser does: the hidden file input gets its files and fires `change`. */
  const choose = async (file: File) => {
    const input = field('song-file');
    Object.defineProperty(input, 'files', {value: [file], configurable: true});
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const partRow = (index: number) =>
    element.querySelector<HTMLElement>(`[data-testid="part"][data-index="${index}"]`);
  const partCheckbox = (index: number) => {
    const checkbox = partRow(index)?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!checkbox) throw new Error(`no checkbox for Part ${index}`);
    return checkbox;
  };
  const toggle = async (index: number) => {
    partCheckbox(index).click();
    await fixture.whenStable();
  };
  const fit = () => {
    const shown = query('fit');
    if (!shown) throw new Error('no Fit shown');
    return {
      matchingAPipe: Number(shown.dataset['matchingAPipe']),
      movedByOctaves: Number(shown.dataset['movedByOctaves']),
      unplayable: Number(shown.dataset['unplayable']),
    };
  };
  const create = async () => {
    const button = field('create-tape');
    button.click();
    await fixture.whenStable();
  };
  /** The rule codes shown at a field, by the field's path in the import draft. */
  const violationsAt = (path: string) =>
    [...element.querySelectorAll<HTMLElement>(`[data-testid="violation"][data-path="${path}"]`)].map(
      (violation) => violation.dataset['code'],
    );

  return {
    fixture, element, tapes, navigate, query, field, organSelect, type, choose, create, violationsAt,
    partRow, partCheckbox, toggle, fit,
  };
}

describe('TapeImportComponent', () => {
  describe('without a stored Organ', () => {
    it('shows a hint with a link to the new Organ page and no form', async () => {
      const {query, element} = await render();

      expect(query('import-form')).toBeNull();
      expect(query('no-organ-hint')).not.toBeNull();
      expect(element.querySelector('[data-testid="no-organ-hint"] a')?.getAttribute('href')).toBe('/organs/new');
    });
  });

  describe('with Organs', () => {
    it('shows the form and no hint', async () => {
      const {query} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(query('no-organ-hint')).toBeNull();
      expect(query('import-form')).not.toBeNull();
    });

    it('preselects the only Organ', async () => {
      const organ = testOrgan('Street organ', 3);
      const {organSelect} = await render({organs: [organ]});

      expect(organSelect().value).toBe(organ.id);
    });

    it('leaves the choice open between several Organs', async () => {
      const {organSelect} = await render({organs: [testOrgan('Street organ', 3), testOrgan('Parlour organ', 2)]});

      expect(organSelect().value).toBe('');
    });
  });

  describe('choosing a file', () => {
    it('prefills the name with the Song name and the Column length with the Minimum Hole Length', async () => {
      const organ = testOrgan('Street organ', 3);
      const {field, choose} = await render({organs: [organ]});
      const song = songOf(melodyBytes(), 'melody.mid');

      await choose(midiFile(melodyBytes()));

      expect(field('name').value).toBe(song.name);
      expect(field('column-length').value).toBe(String(minimumHoleLength(organ.tapeBed)));
    });

    it('shows the reason of a Song Rejection and creates nothing', async () => {
      const {choose, query, tapes, navigate, create} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(new Uint8Array([1, 2, 3]), 'notes.mid'));

      expect(query('song-rejection')?.dataset['code']).toBe('not-a-midi-file');
      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
      await create();
      expect(tapes.tapeEntities()).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('rejects a file over 16 MiB as not a MIDI file without reading it', async () => {
      const {choose, query, tapes} = await render({organs: [testOrgan('Street organ', 3)]});
      const huge = midiFile(melodyBytes());
      Object.defineProperty(huge, 'size', {value: MAXIMUM_MIDI_FILE_SIZE + 1});
      const read = vi.spyOn(huge, 'arrayBuffer');

      await choose(huge);

      expect(query('song-rejection')?.dataset['code']).toBe('not-a-midi-file');
      expect(read).not.toHaveBeenCalled();
      expect(tapes.tapeEntities()).toEqual([]);
    });

    it('clears the rejection once a readable file is chosen', async () => {
      const {choose, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(new Uint8Array([1, 2, 3]), 'notes.mid'));

      await choose(midiFile(melodyBytes()));

      expect(query('song-rejection')).toBeNull();
    });
  });

  describe('Parts', () => {
    const selected = (...indices: number[]) => new Set(indices as PartIndex[]);
    const textOf = (row: HTMLElement | null, testId: string) =>
      row?.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

    it('shows each Part with its name and its number of Notes', async () => {
      const {choose, partRow} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(threePartBytes()));

      expect([0, 1, 2].map((index) => textOf(partRow(index), 'part-name'))).toEqual(['Lead', 'Bass', 'Drums']);
      expect([0, 1, 2].map((index) => textOf(partRow(index), 'part-note-count'))).toEqual(['3', '6', '2']);
    });

    it('selects the Parts that are not percussion and leaves percussion unselected', async () => {
      const {choose, partCheckbox} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(threePartBytes()));

      expect([0, 1, 2].map((index) => partCheckbox(index).checked)).toEqual([true, true, false]);
    });

    it('starts with nothing selected and Create disabled for a Song of only percussion', async () => {
      const {choose, partCheckbox, query} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(percussionOnlyBytes()));

      expect(partCheckbox(0).checked).toBe(false);
      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
    });

    it('shows the Fit of the proposed Transposition for the selected Parts', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, field, fit} = await render({organs: [organ]});
      const song = songOf(threePartBytes(), 'melody.mid');

      await choose(midiFile(threePartBytes()));

      const proposed = proposeTransposition(song, selected(0, 1), organ);
      expect(field('transposition').value).toBe(String(proposed));
      expect(fit()).toEqual(fitOf(song, selected(0, 1), organ, proposed));
    });

    it('updates the proposed Transposition and its Fit when a Part is deselected', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, field, fit, toggle} = await render({organs: [organ]});
      const song = songOf(threePartBytes(), 'melody.mid');
      await choose(midiFile(threePartBytes()));

      await toggle(1);

      const proposed = proposeTransposition(song, selected(0), organ);
      expect(proposed).not.toBe(proposeTransposition(song, selected(0, 1), organ));
      expect(field('transposition').value).toBe(String(proposed));
      expect(fit()).toEqual(fitOf(song, selected(0), organ, proposed));
      expect(fit()).toEqual({matchingAPipe: 3, movedByOctaves: 0, unplayable: 0});
    });

    it('resets a chosen Transposition to the new proposal when the selection changes', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, field, type, toggle} = await render({organs: [organ]});
      const song = songOf(threePartBytes(), 'melody.mid');
      await choose(midiFile(threePartBytes()));
      await type(field('transposition'), '5');

      await toggle(0);

      expect(field('transposition').value).toBe(String(proposeTransposition(song, selected(1), organ)));
    });

    it('disables Create while no Part is selected', async () => {
      const {choose, toggle, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(threePartBytes()));

      await toggle(0);
      await toggle(1);

      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
    });

    it('creates the Tape with only the selected Parts', async () => {
      const {choose, toggle, create, tapes} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(threePartBytes()));
      await toggle(1);

      await create();

      expect(tapes.tapeEntities()[0]?.selectedParts).toEqual([0]);
    });
  });

  describe('rules', () => {
    it('shows a missing name at the name field', async () => {
      const {choose, type, field, violationsAt} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('name'), '');

      expect(violationsAt('name')).toEqual(['name-required']);
    });

    it('shows a Column length that is not positive at the Column length field', async () => {
      const {choose, type, field, violationsAt} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('column-length'), '0');

      expect(violationsAt('columnLength')).toEqual(['column-length-must-be-positive']);
    });

    it('shows a Transposition out of range at the Transposition field', async () => {
      const {choose, type, field, violationsAt} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('transposition'), '100');

      expect(violationsAt('transposition')).toEqual(['transposition-out-of-range']);
    });
  });

  describe('Create', () => {
    async function createdWith(options: {failToSave?: boolean} = {}) {
      const organ = testOrgan('Street organ', 3);
      const page = await render({organs: [organ], failToSave: options.failToSave});
      await page.choose(midiFile(melodyBytes()));
      await page.create();
      const [tape] = page.tapes.tapeEntities();
      return {...page, organ, tape};
    }

    it('creates the Tape on the default Parts with the proposed Transposition', async () => {
      const {tape, organ} = await createdWith();
      const song = songOf(melodyBytes(), 'melody.mid');

      expect(tape?.organId).toBe(organ.id);
      expect(tape?.selectedParts).toEqual([...defaultSelectedParts(song)]);
      expect(tape?.transposition).toBe(proposeTransposition(song, defaultSelectedParts(song), organ));
      expect(tape?.name).toBe(song.name);
    });

    it('stores the Song with the Tape', async () => {
      const {tapes, tape} = await createdWith();

      expect(tapes.songEntities().map(({id}) => id)).toEqual([tape?.songId]);
    });

    it('opens the Tape by id with the Import Summary as navigation state', async () => {
      const {navigate, tape} = await createdWith();

      expect(navigate).toHaveBeenCalledWith(['/tapes', tape?.id], {
        state: {importSummary: expect.objectContaining({transposition: tape?.transposition, notesOnTape: 3})},
      });
    });

    it('opens the Tape also when writing it to disk failed', async () => {
      const {navigate, tape, tapes} = await createdWith({failToSave: true});

      expect(tapes.saveProblem()).not.toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/tapes', tape?.id], expect.anything());
    });

    it('does not navigate, shows the load problem and disables Create when the Tape library could not be read', async () => {
      const page = await render({organs: [testOrgan('Street organ', 3)], unreadableTapes: true});
      await page.choose(midiFile(melodyBytes()));

      expect(page.query('tape-load-problem')).not.toBeNull();
      expect(page.query('create-tape')?.hasAttribute('disabled')).toBe(true);
      await page.create();
      expect(page.navigate).not.toHaveBeenCalled();
      expect(page.tapes.tapeEntities()).toEqual([]);
    });

    it('is disabled until a Song was chosen', async () => {
      const {query} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
    });
  });
});
