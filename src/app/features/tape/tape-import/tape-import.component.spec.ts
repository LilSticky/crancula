import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {
  allowedTranspositions,
  defaultSelectedParts,
  transposition,
  fitOf,
  MAXIMUM_MIDI_FILE_SIZE,
  minimumHoleLength,
  type Organ,
  type PartIndex,
  proposeTransposition,
  readMidiSong,
  type Song,
  tapeLengthInMillimetres,
} from '@api/index';
import {formatNumber} from '../../shared/format-number';
import {createTapeFromDraft} from './tape-import-form';
import {encodeSmf, type SmfTimedEvent} from '../../../../../api/song/midi/smf-test-helper';
import {type PartSpec, scoreXml, type ScoreSpec} from '../../../../../api/song/musicxml/score-test-helper';
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

function scoreFile(spec: ScoreSpec, name = 'score.musicxml'): File {
  return new File([scoreXml(spec)], name, {type: 'application/vnd.recordare.musicxml+xml'});
}

const C4 = {step: 'C', octave: 4} as const;

/** A Flute of two quarter Notes and a Drums Part of three unpitched Notes, as a Score. */
function fluteAndDrums(options: {workTitle?: string} = {}): ScoreSpec {
  const flute: PartSpec = {
    name: 'Flute',
    measures: [{entries: [{kind: 'note', pitch: C4, duration: 1}, {kind: 'note', pitch: C4, duration: 1}]}],
  };
  const drums: PartSpec = {
    name: 'Drums',
    measures: [
      {
        entries: [
          {kind: 'note', pitch: 'unpitched', displayPitch: C4, duration: 1},
          {kind: 'note', pitch: 'unpitched', displayPitch: C4, duration: 1},
          {kind: 'note', pitch: 'unpitched', displayPitch: C4, duration: 1},
        ],
      },
    ],
  };
  return {...options, parts: [flute, drums]};
}

function songOf(bytes: Uint8Array, name: string): Song {
  const result = readMidiSong(bytes, name);
  if (!result.ok) throw new Error(`invalid test Song: ${result.error}`);
  return result.value;
}

function singleNoteBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(0, [60], 'Lead')],
  });
}

/** A melody one semitone below the Pipes of `testOrgan` (59, 61, 63): the proposal is +1. */
function lowMelodyBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(0, [59, 61, 63], 'Lead')],
  });
}

function highestNoteBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(0, [60, 127], 'Lead')],
  });
}

async function render(
  options: {organs?: readonly Organ[]; failToSave?: boolean; unreadableTapes?: boolean; language?: 'en' | 'de'} = {},
) {
  const api = createInMemoryCranculaApi(
    undefined,
    undefined,
    options.failToSave ? {tapes: {save: 'failed'}} : options.unreadableTapes ? {tapes: {load: 'unreadable'}} : {},
  );
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideTestTranslations(options.language), {provide: CRANCULA_API, useValue: api}],
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
  const textOf = (testId: string) => query(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const stepper = (label: string) => {
    const button = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!button) throw new Error(`no button ${label}`);
    return button;
  };
  const step = async (label: string) => {
    stepper(label).click();
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
    partRow, partCheckbox, toggle, fit, textOf, stepper, step,
  };
}

describe('TapeImportComponent', () => {
  it('titles the page in a page head', async () => {
    const {element} = await render();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Bring a Song onto a Tape');
  });

  describe('without a stored Organ', () => {
    it('shows an empty state as a sheet with an icon, the sentence and the filled link "Describe an Organ", and no form', async () => {
      const {query, element, textOf} = await render();

      expect(query('import-form')).toBeNull();
      const hint = query('no-organ-hint');
      expect(hint?.tagName.toLowerCase()).toBe('mat-card');
      expect(hint?.querySelector('mat-icon')).not.toBeNull();
      expect(textOf('no-organ-hint')).toContain('You need an Organ first: the Tape is punched for its Pipes.');
      const link = element.querySelector('[data-testid="no-organ-hint"] a');
      expect(link?.getAttribute('href')).toBe('/organs/new');
      expect(link?.textContent?.trim()).toBe('Describe an Organ');
      expect(link?.classList).toContain('mat-mdc-unelevated-button');
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

    it('shows the reason of a Song Rejection in words and creates nothing', async () => {
      const {choose, query, textOf, tapes, navigate, create} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(new Uint8Array([1, 2, 3]), 'notes.mid'));

      expect(query('song-rejection')?.dataset['code']).toBe('not-a-song-source');
      expect(textOf('song-rejection')).toContain('This file is neither a MIDI file nor a MusicXML Score.');
      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
      await create();
      expect(tapes.tapeEntities()).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('rejects a file over 16 MiB as too large', async () => {
      const {choose, query, tapes} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(new Uint8Array(MAXIMUM_MIDI_FILE_SIZE + 1)));

      expect(query('song-rejection')?.dataset['code']).toBe('too-large');
      expect(tapes.tapeEntities()).toEqual([]);
    });

    it('prefills the name with the title of a Score, not with the file name', async () => {
      const {choose, field} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(scoreFile(fluteAndDrums({workTitle: 'Gymnopedie'}), 'score.musicxml'));

      expect(field('name').value).toBe('Gymnopedie');
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

    it('lists each Part as a row with its name and its number of Notes, and no fieldset', async () => {
      const {choose, partRow, query} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(threePartBytes()));

      expect(query('parts')?.querySelector('fieldset')).toBeNull();
      expect([0, 1, 2].map((index) => textOf(partRow(index), 'part-name'))).toEqual(['Lead', 'Bass', 'Drums']);
      expect([0, 1, 2].map((index) => textOf(partRow(index), 'part-note-count'))).toEqual(['3', '6', '2']);
      expect([0, 1, 2].map((index) => partRow(index)?.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'Lead 3 Notes',
        'Bass 6 Notes',
        expect.stringMatching(/^Drums 2 Notes/),
      ]);
    });

    it('writes "1 Note" for a Part with one Note', async () => {
      const {choose, partRow} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(singleNoteBytes()));

      expect(partRow(0)?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Lead 1 Note');
    });

    it('says that no Pipe plays a percussion Part and says nothing at the others', async () => {
      const {choose, partRow} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(threePartBytes()));

      expect(textOf(partRow(2), 'part-percussion')).toBe('Percussion: no Pipe plays it');
      expect(textOf(partRow(0), 'part-percussion')).toBeUndefined();
      expect(textOf(partRow(1), 'part-percussion')).toBeUndefined();
    });

    it('selects the Parts that are not percussion and leaves percussion unselected', async () => {
      const {choose, partCheckbox} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(threePartBytes()));

      expect([0, 1, 2].map((index) => partCheckbox(index).checked)).toEqual([true, true, false]);
    });

    it('lists the Parts of a Score with their names and Note counts', async () => {
      const {choose, partRow} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(scoreFile(fluteAndDrums()));

      expect(textOf(partRow(0), 'part-name')).toBe('Flute');
      expect(textOf(partRow(0), 'part-note-count')).toBe('2');
      expect(textOf(partRow(1), 'part-name')).toBe('Drums');
      expect(textOf(partRow(1), 'part-note-count')).toBe('3');
    });

    it('leaves the percussion Part of a Score unselected', async () => {
      const {choose, partCheckbox} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(scoreFile(fluteAndDrums()));

      expect([0, 1].map((index) => partCheckbox(index).checked)).toEqual([true, false]);
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

  describe('Transposition', () => {
    const selected = (...indices: number[]) => new Set(indices as PartIndex[]);
    const semitones = (value: number) => {
      const result = transposition(value);
      if (result === undefined) throw new Error(`invalid test Transposition ${value}`);
      return result;
    };

    it('limits the Transposition input to the allowed Transpositions of the selected Parts', async () => {
      const {choose, field} = await render({organs: [testOrgan('Street organ', 3)]});
      const song = songOf(melodyBytes(), 'melody.mid');

      await choose(midiFile(melodyBytes()));

      const {lowest, highest} = allowedTranspositions(song, defaultSelectedParts(song));
      expect(field('transposition').min).toBe(String(lowest));
      expect(field('transposition').max).toBe(String(highest));
    });

    it('shows the Fit for a chosen Transposition instead of the proposal', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, field, type, fit} = await render({organs: [organ]});
      const song = songOf(melodyBytes(), 'melody.mid');
      await choose(midiFile(melodyBytes()));

      await type(field('transposition'), '7');

      expect(fit()).toEqual(fitOf(song, defaultSelectedParts(song), organ, semitones(7)));
    });

    it('creates the Tape with the chosen Transposition', async () => {
      const {choose, field, type, create, tapes} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('transposition'), '7');
      await create();

      expect(tapes.tapeEntities()[0]?.transposition).toBe(7);
    });

    it('restores the proposal with "use proposal"', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, field, type, query, fit, fixture} = await render({organs: [organ]});
      const song = songOf(melodyBytes(), 'melody.mid');
      const proposed = proposeTransposition(song, defaultSelectedParts(song), organ);
      await choose(midiFile(melodyBytes()));
      await type(field('transposition'), '7');

      query('use-proposal')?.click();
      await fixture.whenStable();

      expect(field('transposition').value).toBe(String(proposed));
      expect(fit()).toEqual(fitOf(song, selected(0), organ, proposed));
    });

    it('refuses +1 when the highest selected Note is G9 and disables Create', async () => {
      const {choose, field, type, violationsAt, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(highestNoteBytes()));

      await type(field('transposition'), '1');

      expect(violationsAt('transposition')).toEqual(['transposition-out-of-range']);
      expect(query('create-tape')?.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('sheets', () => {
    it('shows the subtitle in the page head', async () => {
      const {element} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(element.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
        'Choose a Song Source, the Organ and the Parts. The Fit shows how the Song meets the Pipes before the Tape is created.',
      );
    });

    it('holds a Song sheet and a Fit sheet, both outlined cards, inside the form', async () => {
      const {query} = await render({organs: [testOrgan('Street organ', 3)]});

      const form = query('import-form');
      for (const id of ['song-sheet', 'fit-sheet']) {
        const sheet = query(id);
        expect(sheet?.tagName.toLowerCase()).toBe('mat-card');
        expect(sheet?.classList).toContain('mat-mdc-card-outlined');
        expect(form?.contains(sheet ?? null)).toBe(true);
      }
    });

    it('titles the groups of the Song sheet Song, Organ, Parts, Transposition in this order', async () => {
      const {element, query} = await render({organs: [testOrgan('Street organ', 3)]});

      const titles = [...(query('song-sheet')?.querySelectorAll('[data-testid="group-title"]') ?? [])].map((title) =>
        title.textContent?.trim(),
      );
      expect(titles).toEqual(['Song', 'Organ', 'Parts', 'Transposition']);
      expect(element.querySelector('[data-testid="fit-sheet"] [data-testid="fit"]')).not.toBeNull();
    });
  });

  describe('file chip', () => {
    it('offers only "Choose a Song Source" before a file is chosen', async () => {
      const {query, textOf} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(textOf('choose-song')).toContain('Choose a Song Source');
      expect(query('song-file-name')).toBeNull();
      expect(query('song-facts')).toBeNull();
    });

    it('shows the chosen file name, not the Song name, with the facts of the Song', async () => {
      const {choose, query, textOf} = await render({organs: [testOrgan('Street organ', 3)]});
      expect(songOf(threePartBytes(), 'three-parts.mid').name).toBe('Lead');

      await choose(midiFile(threePartBytes(), 'three-parts.mid'));

      expect(textOf('song-file-name')).toContain('three-parts.mid');
      expect(query('song-file-name')?.closest('mat-chip, .mat-mdc-chip')).not.toBeNull();
      expect(textOf('song-facts')).toBe('3 Parts, 11 Notes');
      expect(textOf('choose-song')).toContain('Choose another file');
      expect(query('song-name')).toBeNull();
    });

    it('accepts MIDI, MusicXML, compressed MusicXML and PDF files as Song Sources', async () => {
      const {field} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(field('song-file').accept).toBe('.mid,.midi,.musicxml,.xml,.mxl,.pdf');
    });

    it('uses the singular for one Part and one Note', async () => {
      const {choose, textOf} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(singleNoteBytes(), 'one.mid'));

      expect(textOf('song-facts')).toBe('1 Part, 1 Note');
    });

    it('shows the rejection with an icon and no chip, and drops the chip of the previous file', async () => {
      const {choose, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes(), 'melody.mid'));

      await choose(midiFile(new Uint8Array([1, 2, 3]), 'notes.mid'));

      expect(query('song-rejection')?.querySelector('mat-icon')).not.toBeNull();
      expect(query('song-file-name')).toBeNull();
      expect(query('song-facts')).toBeNull();
    });
  });

  describe('Organ range hint', () => {
    it('shows the number of Pipes and the range of the chosen Organ', async () => {
      const {textOf} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(textOf('organ-range')).toBe('3 Pipes, C4–E4');
    });

    it('shows no range while no Organ is chosen and follows the choice', async () => {
      const street = testOrgan('Street organ', 3);
      const {query, organSelect, textOf, fixture} = await render({organs: [street, testOrgan('Parlour organ', 2)]});
      expect(query('organ-range')).toBeNull();

      const select = organSelect();
      select.value = street.id;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(textOf('organ-range')).toBe('3 Pipes, C4–E4');
    });
  });

  describe('Transposition stepper', () => {
    const UP = 'One semitone up';
    const DOWN = 'One semitone down';
    const selected = (...indices: number[]) => new Set(indices as PartIndex[]);

    it('raises the Transposition by one semitone and the Fit follows', async () => {
      const organ = testOrgan('Street organ', 3);
      const {choose, step, field, fit} = await render({organs: [organ]});
      const song = songOf(melodyBytes(), 'melody.mid');
      await choose(midiFile(melodyBytes()));
      const proposed = Number(field('transposition').value);

      await step(UP);

      expect(field('transposition').value).toBe(String(proposed + 1));
      const raised = transposition(proposed + 1);
      expect(raised).toBeDefined();
      if (raised !== undefined) expect(fit()).toEqual(fitOf(song, selected(0), organ, raised));
    });

    it('lowers the Transposition by one semitone', async () => {
      const {choose, step, field} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));
      const proposed = Number(field('transposition').value);

      await step(DOWN);

      expect(field('transposition').value).toBe(String(proposed - 1));
    });

    it('labels both buttons and draws them as icon buttons', async () => {
      const {choose, stepper} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      expect(stepper(UP).querySelector('mat-icon')?.textContent?.trim()).toBe('add');
      expect(stepper(DOWN).querySelector('mat-icon')?.textContent?.trim()).toBe('remove');
      expect(stepper(UP).classList).toContain('mat-mdc-icon-button');
    });

    it('disables "up" at the highest allowed Transposition', async () => {
      const {choose, field, type, stepper} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(highestNoteBytes()));

      await type(field('transposition'), '0');

      expect(stepper(UP).disabled).toBe(true);
      expect(stepper(DOWN).disabled).toBe(false);
    });

    it('disables "down" at the lowest allowed Transposition', async () => {
      const {choose, field, type, stepper} = await render({organs: [testOrgan('Street organ', 3)]});
      const song = songOf(highestNoteBytes(), 'melody.mid');
      await choose(midiFile(highestNoteBytes()));
      const {lowest} = allowedTranspositions(song, defaultSelectedParts(song));

      await type(field('transposition'), String(lowest));

      expect(stepper(DOWN).disabled).toBe(true);
      expect(stepper(UP).disabled).toBe(false);
    });
  });

  describe('proposal sentence', () => {
    const UP = 'One semitone up';
    const DOWN = 'One semitone down';
    const RULE = 'it puts the most Notes directly on a Pipe.';

    it('explains the proposal while it is chosen and offers no button', async () => {
      const {choose, textOf, query} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(melodyBytes()));

      expect(textOf('proposal')).toBe(`This is the proposal: ${RULE}`);
      expect(query('use-proposal')).toBeNull();
    });

    it('names a negative proposal with a minus sign once another Transposition is chosen', async () => {
      const {choose, step, textOf, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await step(UP);

      expect(textOf('proposal')).toBe(`The proposal is −1 semitone: ${RULE}`);
      expect(query('use-proposal')).not.toBeNull();
    });

    it('names a positive proposal with a plus sign', async () => {
      const {choose, step, textOf} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(lowMelodyBytes()));

      await step(DOWN);

      expect(textOf('proposal')).toBe(`The proposal is +1 semitone: ${RULE}`);
    });

    it('names a proposal of 0 as 0', async () => {
      const {choose, step, textOf} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(threePartBytes()));

      await step(UP);

      expect(textOf('proposal')).toBe(`The proposal is 0 semitones: ${RULE}`);
    });

    it('restores the proposal sentence with "use proposal"', async () => {
      const {choose, step, query, fixture, textOf} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));
      await step(UP);

      query('use-proposal')?.click();
      await fixture.whenStable();

      expect(textOf('proposal')).toBe(`This is the proposal: ${RULE}`);
      expect(query('use-proposal')).toBeNull();
    });

    it('speaks German', async () => {
      const {choose, step, textOf, stepper} = await render({
        organs: [testOrgan('Street organ', 3)],
        language: 'de',
      });
      await choose(midiFile(melodyBytes()));

      expect(textOf('proposal')).toBe('Das ist der Vorschlag: Er legt die meisten Noten direkt auf eine Pfeife.');
      await step('Einen Halbton höher');

      expect(textOf('proposal')).toBe(
        'Der Vorschlag ist −1 Halbton: Er legt die meisten Noten direkt auf eine Pfeife.',
      );
      expect(stepper('Einen Halbton tiefer')).toBeDefined();
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

    // un-skip in T039
    it.skip('puts the grace notes that a Score leaves out into the Import Summary', async () => {
      const {choose, create, navigate} = await render({organs: [testOrgan('Street organ', 3)]});
      const grace: ScoreSpec = {
        parts: [
          {
            name: 'Flute',
            measures: [{entries: [{kind: 'note', pitch: C4, grace: true}, {kind: 'note', pitch: C4, duration: 1}]}],
          },
        ],
      };
      await choose(scoreFile(grace));

      await create();

      expect(navigate).toHaveBeenCalledWith(expect.anything(), {
        state: {importSummary: expect.objectContaining({leftOut: {graceNotes: 1, ornaments: 0}})},
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
      expect(page.query('tape-load-problem')?.getAttribute('role')).toBe('alert');
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

  describe('Column length', () => {
    it('is a decimal text input with the suffix "mm" and the label "Column length"', async () => {
      const {choose, field} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      const input = field('column-length');
      const formField = input.closest('mat-form-field');
      expect(input.type).toBe('text');
      expect(input.inputMode).toBe('decimal');
      expect(formField?.querySelector('[matTextSuffix]')?.textContent?.trim()).toBe('mm');
      expect(formField?.querySelector('mat-label')?.textContent?.trim()).toBe('Column length');
    });

    it('shows the Minimum Hole Length with a decimal comma in German and accepts "3,5"', async () => {
      const {choose, field, type, create, tapes} = await render({
        organs: [testOrgan('Street organ', 3)],
        language: 'de',
      });
      await choose(midiFile(melodyBytes()));
      expect(field('column-length').value).toBe('2,5');

      await type(field('column-length'), '3,5');
      await create();

      expect(tapes.tapeEntities()[0]?.columnLength).toBe(3.5);
    });
  });

  describe('Fit sheet', () => {
    const row = (element: HTMLElement, testId: string) => {
      const shown = element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!shown) throw new Error(`no row ${testId}`);
      return shown;
    };
    const part = (shown: HTMLElement, testId: string) =>
      shown.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

    it('shows three rows with icon, label and count', async () => {
      const {choose, element} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      const rows = ['fit-matching', 'fit-moved', 'fit-unplayable'].map((id) => row(element, id));
      expect(rows.map((shown) => shown.querySelector('mat-icon')?.textContent?.trim())).toEqual([
        'check_circle',
        'swap_vert',
        'block',
      ]);
      expect(rows.map((shown) => shown.textContent)).toEqual([
        expect.stringContaining('Notes matching a Pipe'),
        expect.stringContaining('Notes moved by octaves'),
        expect.stringContaining('Unplayable Notes'),
      ]);
      expect(rows.map((shown) => part(shown, 'fit-count'))).toEqual(['3', '0', '0']);
    });

    it('keeps the data attributes of the Fit', async () => {
      const {choose, fit} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      expect(fit()).toEqual({matchingAPipe: 3, movedByOctaves: 0, unplayable: 0});
    });

    it('holds one sentence and no rows before a Song is chosen, and the sheet is no live region itself', async () => {
      const {query, textOf} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(textOf('fit-empty')).toBe('Choose a Song Source and an Organ to see how the Song fits its Pipes.');
      expect(query('fit-matching')).toBeNull();
      expect(query('fit-sheet')?.hasAttribute('aria-live')).toBe(false);
    });

    it('drops the sentence once the Fit is shown', async () => {
      const {choose, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      expect(query('fit-empty')).toBeNull();
    });
  });

  describe('Fit Notes', () => {
    /**
     * Lead C3, D3, C#4 and Bass D3 at Transposition 0 on the Pipes C4, D4, E4: three Notes are moved by an octave
     * (C3 and Bass D3 on Column 1, D3 on Column 9), C#4 on Column 17 has no Pipe.
     */
    function mixedBytes(): Uint8Array {
      return encodeSmf({
        format: 1,
        division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
        tracks: [track(0, [48, 50, 61], 'Lead'), track(1, [50], 'Bass')],
      });
    }

    async function openMixed(language?: 'en' | 'de') {
      const page = await render({organs: [testOrgan('Street organ', 3)], language});
      await page.choose(midiFile(mixedBytes()));
      await page.type(page.field('transposition'), '0');
      return page;
    }

    const asButton = (element: HTMLElement | null) => {
      if (!(element instanceof HTMLButtonElement)) throw new Error('not a button');
      return element;
    };
    const notesOf = (page: {element: HTMLElement}, button: HTMLButtonElement) => {
      const list = page.element.ownerDocument.getElementById(button.getAttribute('aria-controls') ?? '');
      return [...(list?.querySelectorAll('[data-testid="fit-note"]') ?? [])].map((note) =>
        note.textContent?.replace(/\s+/g, ' ').trim(),
      );
    };

    it('makes the rows with a count above 0 collapsed disclosure buttons naming their list', async () => {
      const page = await openMixed();

      for (const id of ['fit-moved', 'fit-unplayable']) {
        const button = asButton(page.query(id));
        expect(button.type).toBe('button');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.hasAttribute('aria-controls')).toBe(false);
      }
      expect(page.query('fit-notes')).toBeNull();
      expect(page.fit()).toEqual({matchingAPipe: 0, movedByOctaves: 3, unplayable: 1});
    });

    it('shows the moved Notes by Column, then Part, in the wording of the Import Summary, on a click', async () => {
      const page = await openMixed();
      const button = asButton(page.query('fit-moved'));

      button.click();
      await page.fixture.whenStable();

      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(notesOf(page, button)).toEqual([
        'C3 moved by 1 octave to Pipe C4 (Part Lead, Column 1)',
        'D3 moved by 1 octave to Pipe D4 (Part Bass, Column 1)',
        'D3 moved by 1 octave to Pipe D4 (Part Lead, Column 9)',
      ]);
    });

    it('shows the Unplayable Notes on a click and collapses on a second press', async () => {
      const page = await openMixed();
      const button = asButton(page.query('fit-unplayable'));

      button.click();
      await page.fixture.whenStable();
      expect(notesOf(page, button)).toEqual(['C#4 (Part Lead, Column 17)']);

      button.click();
      await page.fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(page.query('fit-notes')).toBeNull();
    });

    it('names its list in aria-controls only while the list is open', async () => {
      const page = await openMixed();
      const button = asButton(page.query('fit-moved'));

      button.click();
      await page.fixture.whenStable();
      expect(button.getAttribute('aria-controls')).toBeTruthy();
      expect(page.element.ownerDocument.getElementById(button.getAttribute('aria-controls') ?? '')).not.toBeNull();

      button.click();
      await page.fixture.whenStable();
      expect(button.hasAttribute('aria-controls')).toBe(false);
    });

    it('starts closed again after another Song is chosen', async () => {
      const page = await openMixed();
      for (const id of ['fit-moved', 'fit-unplayable']) {
        asButton(page.query(id)).click();
        await page.fixture.whenStable();
      }

      await page.choose(midiFile(mixedBytes(), 'other.mid'));
      await page.type(page.field('transposition'), '0');

      for (const id of ['fit-moved', 'fit-unplayable']) {
        expect(asButton(page.query(id)).getAttribute('aria-expanded')).toBe('false');
      }
      expect(page.query('fit-notes')).toBeNull();
    });

    it('starts closed again when the count drops to 0 and rises again', async () => {
      const page = await openMixed();
      asButton(page.query('fit-unplayable')).click();
      await page.fixture.whenStable();

      // Part 0 (Lead) holds the only Unplayable Note
      await page.toggle(0);
      expect(page.query('fit-unplayable')?.tagName).not.toBe('BUTTON');
      await page.toggle(0);
      await page.type(page.field('transposition'), '0');

      const button = asButton(page.query('fit-unplayable'));
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(page.query('fit-notes')).toBeNull();
    });

    it('is no live region as a whole sheet; a small summary or the warning is the polite one', async () => {
      const page = await openMixed();
      const sheet = page.query('fit-sheet');

      expect(sheet?.hasAttribute('aria-live')).toBe(false);
      const live = sheet?.querySelector('[data-testid="fit-summary"], [data-testid="fit-warning"]');
      expect(live?.getAttribute('aria-live')).toBe('polite');
    });

    it('shows no Fit Notes and throws no error when a Transposition pushes a Note outside 0 to 127', async () => {
      const page = await render({organs: [testOrgan('Street organ', 3)]});
      await page.choose(midiFile(highestNoteBytes()));
      await page.type(page.field('transposition'), '0');
      const button = asButton(page.query('fit-unplayable'));
      button.click();
      await page.fixture.whenStable();
      expect(page.query('fit-notes')).not.toBeNull();

      await page.type(page.field('transposition'), '100');

      expect(page.violationsAt('transposition')).toEqual(['transposition-out-of-range']);
      expect(page.query('fit-notes')).toBeNull();
      expect(page.query('fit-note')).toBeNull();
    });

    it('is a native focusable button, so Enter and Space toggle it (the keys themselves are an e2e matter)', async () => {
      const page = await openMixed();

      for (const id of ['fit-moved', 'fit-unplayable']) {
        const button = asButton(page.query(id));
        expect(button.tagName).toBe('BUTTON');
        expect(button.tabIndex).toBe(0);
        expect(button.disabled).toBe(false);
        button.focus();
        expect(page.element.ownerDocument.activeElement).toBe(button);
      }
    });

    it('is no button for a count of 0 and for the Notes matching a Pipe', async () => {
      const {choose, query} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      for (const id of ['fit-matching', 'fit-moved', 'fit-unplayable']) {
        expect(query(id)?.tagName.toLowerCase()).not.toBe('button');
        expect(query(id)?.querySelector('button')).toBeNull();
      }
    });

    it('lists the Notes of the new Transposition in an open list after a stepper click', async () => {
      const page = await openMixed();
      const button = asButton(page.query('fit-unplayable'));
      button.click();
      await page.fixture.whenStable();

      await page.step('One semitone up');

      expect(asButton(page.query('fit-unplayable')).getAttribute('aria-expanded')).toBe('true');
      expect(notesOf(page, asButton(page.query('fit-unplayable')))).toEqual([
        'C#3 (Part Lead, Column 1)',
        'D#3 (Part Bass, Column 1)',
        'D#3 (Part Lead, Column 9)',
      ]);
    });

    describe('for a Part without a name', () => {
      /** Lead C3, D3, C#4 on Part 1, and an unnamed second Part with D3 on Column 1. */
      function unnamedSecondPartBytes(): Uint8Array {
        const unnamed = track(1, [50], 'ignored');
        return encodeSmf({
          format: 1,
          division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
          tracks: [track(0, [48, 50, 61], 'Lead'), {events: unnamed.events.slice(1)}],
        });
      }

      async function openUnnamed(language?: 'en' | 'de') {
        const page = await render({organs: [testOrgan('Street organ', 3)], language});
        await page.choose(midiFile(unnamedSecondPartBytes()));
        await page.type(page.field('transposition'), '0');
        const button = asButton(page.query('fit-moved'));
        button.click();
        await page.fixture.whenStable();
        return notesOf(page, button);
      }

      it('names it by its number once, "(Part 2, Column 1)", and a named Part by its name', async () => {
        expect(await openUnnamed()).toEqual([
          'C3 moved by 1 octave to Pipe C4 (Part Lead, Column 1)',
          'D3 moved by 1 octave to Pipe D4 (Part 2, Column 1)',
          'D3 moved by 1 octave to Pipe D4 (Part Lead, Column 9)',
        ]);
      });

      it('speaks German: "(Stimme 2, Spalte 1)"', async () => {
        expect(await openUnnamed('de')).toContain(
          'D3 um 1 Oktave auf Pfeife D4 verschoben (Stimme 2, Spalte 1)',
        );
      });
    });

    it('speaks German', async () => {
      const page = await openMixed('de');
      const button = asButton(page.query('fit-unplayable'));

      button.click();
      await page.fixture.whenStable();

      expect(button.textContent).toContain('Nicht spielbare Noten');
      expect(notesOf(page, button)).toEqual(['C#4 (Stimme Lead, Spalte 17)']);
    });
  });

  describe('Unplayable warning', () => {
    function movedOnlyBytes(): Uint8Array {
      return encodeSmf({
        format: 1,
        division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
        tracks: [track(0, [48], 'Lead')],
      });
    }

    it('warns about one Unplayable Note, marks the row and still allows Create', async () => {
      const {choose, type, field, query, textOf, create, tapes} = await render({
        organs: [testOrgan('Street organ', 3)],
      });
      await choose(midiFile(unplayableOnceBytes()));
      await type(field('transposition'), '0');

      expect(textOf('fit-warning')).toMatch(/^1 Unplayable Note: .*left off the Tape\. Another Transposition may fit better\.$/);
      expect(query('fit-unplayable')?.classList).toContain('warning');
      expect(query('fit-unplayable')?.querySelector('mat-icon')?.textContent?.trim()).toBe('warning');
      expect(query('create-tape')?.hasAttribute('disabled')).toBe(false);
      await create();
      expect(tapes.tapeEntities()).toHaveLength(1);
    });

    it('uses the plural for several Unplayable Notes', async () => {
      const {choose, type, field, textOf} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('transposition'), '0');

      expect(textOf('fit-warning')).toMatch(/^3 Unplayable Notes: .*left off the Tape\. Another Transposition may fit better\.$/);
    });

    it('shows no warning without Unplayable Notes, also when Notes were moved by octaves', async () => {
      const {choose, type, field, query, fit} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(movedOnlyBytes()));

      await type(field('transposition'), '0');

      expect(fit()).toEqual({matchingAPipe: 0, movedByOctaves: 1, unplayable: 0});
      expect(query('fit-warning')).toBeNull();
      expect(query('fit-unplayable')?.classList).not.toContain('warning');
      expect(query('fit-unplayable')?.querySelector('mat-icon')?.textContent?.trim()).toBe('block');
    });
  });

  describe('action bar', () => {
    const state = (element: HTMLElement) =>
      element
        .querySelector<HTMLElement>('cranc-action-bar [data-testid="action-bar-state"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();

    it('holds Create Tape, labelled "Create the Tape"', async () => {
      const {element, query} = await render({organs: [testOrgan('Street organ', 3)]});

      const bar = element.querySelector('cranc-action-bar');
      expect(bar?.getAttribute('aria-label')).toBe('Create the Tape');
      expect(bar?.contains(query('create-tape'))).toBe(true);
    });

    it('asks for a Song Source without a Song', async () => {
      const {element} = await render({organs: [testOrgan('Street organ', 3)]});

      expect(state(element)).toBe('Choose a Song Source');
    });

    it('asks for an Organ while none is chosen among several', async () => {
      const {element, choose} = await render({organs: [testOrgan('Street organ', 3), testOrgan('Parlour organ', 2)]});
      await choose(midiFile(melodyBytes()));

      expect(state(element)).toBe('Choose an Organ');
    });

    it('asks for a Part while none is selected', async () => {
      const {element, choose} = await render({organs: [testOrgan('Street organ', 3)]});

      await choose(midiFile(percussionOnlyBytes()));

      expect(state(element)).toBe('Select at least one Part');
    });

    it('counts the problems that prevent creating the Tape', async () => {
      const {element, choose, type, field} = await render({organs: [testOrgan('Street organ', 3)]});
      await choose(midiFile(melodyBytes()));

      await type(field('name'), '');

      expect(state(element)).toBe('1 problem prevents creating the Tape');
    });

    it('says the load problem while the Tape library could not be read', async () => {
      const {element, choose} = await render({organs: [testOrgan('Street organ', 3)], unreadableTapes: true});
      await choose(midiFile(melodyBytes()));

      expect(state(element)).toBe("Your Tapes couldn't be loaded, so no new Tape can be saved for now.");
    });

    it('names the Columns and the length in mm of the Tape when ready', async () => {
      const organ = testOrgan('Street organ', 3);
      const {element, choose} = await render({organs: [organ]});
      await choose(midiFile(melodyBytes()));

      const tape = createdTape(organ, 2.5);
      expect(state(element)).toBe(`${tape.length} Columns, ${formatNumber(tapeLengthInMillimetres(tape), 'en')} mm of Tape`);
    });

    it('writes the length of the Tape with a decimal comma in German', async () => {
      const organ = testOrgan('Street organ', 3);
      const {element, choose, type, field} = await render({organs: [organ], language: 'de'});
      await choose(midiFile(melodyBytes()));

      await type(field('column-length'), '0,3');

      const tape = createdTape(organ, 0.3);
      const millimetres = formatNumber(tapeLengthInMillimetres(tape), 'de');
      expect(millimetres).toContain(',');
      expect(state(element)).toContain(millimetres);
      expect(state(element)).toContain(`${tape.length}`);
    });
  });
});

/** The Tape the melody makes on `organ` at its proposed Transposition and the given Column length. */
function createdTape(organ: Organ, columnLength: number) {
  const song = songOf(melodyBytes(), 'melody.mid');
  const selectedParts = defaultSelectedParts(song);
  const result = createTapeFromDraft(
    {song, organ, selectedParts},
    {name: song.name, columnLength, transposition: proposeTransposition(song, selectedParts, organ)},
  );
  if (!result.ok) throw new Error('invalid test Tape');
  return result.value.tape;
}

/** One Lead Note, 61, that no Pipe of `testOrgan` plays at Transposition 0 (C#4), next to one that matches. */
function unplayableOnceBytes(): Uint8Array {
  return encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [track(0, [60, 61], 'Lead')],
  });
}

describe('TapeImportComponent live Tape preview', () => {
  const UP = 'One semitone up';
  const previewHoles = (element: HTMLElement) =>
    element.querySelectorAll('[data-testid="tape-preview"] [data-testid="preview-hole"]').length;

  it('shows no preview before a Song is chosen', async () => {
    const {query} = await render({organs: [testOrgan('Street organ', 3)]});

    expect(query('tape-preview')).toBeNull();
  });

  it('shows no preview when the draft cannot make a Tape', async () => {
    const {query, choose} = await render({organs: [testOrgan('Street organ', 3)]});

    await choose(midiFile(percussionOnlyBytes()));

    expect(query('tape-preview')).toBeNull();
  });

  it('shows the preview of the Tape about to be created once the draft is ready', async () => {
    const {query, choose, element} = await render({organs: [testOrgan('Street organ', 3)]});

    await choose(midiFile(threePartBytes()));

    expect(query('tape-preview')?.getAttribute('role')).toBe('img');
    expect(previewHoles(element)).toBeGreaterThan(0);
  });

  it('shows fewer Holes when a Part is deselected', async () => {
    const {choose, toggle, element} = await render({organs: [testOrgan('Street organ', 3)]});
    await choose(midiFile(threePartBytes()));
    const both = previewHoles(element);

    await toggle(1);

    expect(previewHoles(element)).toBeLessThan(both);
    expect(previewHoles(element)).toBeGreaterThan(0);
  });

  it('shows other Holes when the Transposition changes', async () => {
    const {choose, step, element} = await render({organs: [testOrgan('Street organ', 3)]});
    await choose(midiFile(threePartBytes()));
    const proposed = previewHoles(element);

    await step(UP);

    expect(previewHoles(element)).toBeLessThan(proposed);
  });

  it('stores nothing by showing the preview', async () => {
    const {choose, tapes, navigate, query} = await render({organs: [testOrgan('Street organ', 3)]});

    await choose(midiFile(threePartBytes()));

    expect(query('tape-preview')).not.toBeNull();
    expect(tapes.tapeEntities()).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
