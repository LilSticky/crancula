import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideRouter} from '@angular/router';
import {MatSnackBar} from '@angular/material/snack-bar';
import {type Observable, of} from 'rxjs';
import {
  createTape,
  defaultSelectedParts,
  type Organ,
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
import {OrganListComponent} from './organ-list.component';

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

async function render() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  const library = TestBed.inject(OrganLibrary);
  const fixture = TestBed.createComponent(OrganListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, library, element: fixture.nativeElement as HTMLElement};
}

describe('OrganListComponent', () => {
  it('titles the page in a page head', async () => {
    const {element} = await render();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Organs');
  });

  it('says that there are no Organs yet', async () => {
    const {element} = await render();
    expect(element.textContent).toContain('No Organs yet.');
  });

  it('lists the Organs by name with their Pipe count', async () => {
    const {fixture, library, element} = await render();
    await library.put(testOrgan('Street organ', 31));
    await library.put(testOrgan('Small organ', 1));
    await fixture.whenStable();

    const rows = [...element.querySelectorAll('[data-testid="organ"]')].map((row) =>
      [...row.querySelectorAll('[matListItemTitle], [matListItemLine]')].map((part) => part.textContent?.trim()).join(' '),
    );
    expect(rows).toEqual(['Street organ 31 Pipes', 'Small organ 1 Pipes']);
    expect(element.textContent).not.toContain('No Organs yet.');
  });

  it('links each Organ to its editor', async () => {
    const {fixture, library, element} = await render();
    const organ = testOrgan('Street organ');
    await library.put(organ);
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="organ"]')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
  });

  describe('delete', () => {
    async function renderWithDialog(confirmed: boolean) {
      const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({afterClosed: () => of(confirmed)}));
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideTestTranslations(), {provide: MatDialog, useValue: {open}}],
      });
      const library = TestBed.inject(OrganLibrary);
      const organ = testOrgan('Street organ');
      await library.put(organ);
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const button = element.querySelector<HTMLButtonElement>('[data-testid="delete-organ"]');
      if (!button) throw new Error('no delete-organ button');
      button.click();
      await fixture.whenStable();
      return {library, organ, open};
    }

    it('opens the confirm dialog for deleting the Organ', async () => {
      const {open, organ} = await renderWithDialog(false);

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: organ.id, name: 'Street organ'}},
      });
    });

    it('changes nothing when the dialog is cancelled', async () => {
      const {library, organ} = await renderWithDialog(false);

      expect(library.entities().map(({id}) => id)).toEqual([organ.id]);
    });

    it('removes the Organ from the library when the dialog is confirmed', async () => {
      const {library} = await renderWithDialog(true);

      expect(library.entities()).toEqual([]);
    });
  });

  describe('delete with Tapes', () => {
    async function renderWithTapes(options: {confirmed?: boolean; failures?: InMemoryCranculaApiFailures; unreadable?: boolean} = {}) {
      const organ = testOrgan('Street organ', 3);
      const first = tapeFor(organ, 'First', [60, 62]);
      const second = tapeFor(organ, 'Second', [62, 64]);
      const snapshot = toTapeLibrarySnapshot([first.tape, second.tape], [first.song, second.song]);
      const failures: InMemoryCranculaApiFailures = options.unreadable ? {tapes: {load: 'unreadable'}} : (options.failures ?? {});
      const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
        afterClosed: () => of(options.confirmed === true),
      }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideTestTranslations(),
          {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, snapshot, failures)},
          {provide: MatDialog, useValue: {open}},
        ],
      });
      const organs = TestBed.inject(OrganLibrary);
      const tapes = TestBed.inject(TapeLibrary);
      await tapes.load();
      await organs.put(organ);
      const snackBarOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();
      const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="delete-organ"]');
      if (!button) throw new Error('no delete-organ button');
      button.click();
      await fixture.whenStable();
      return {organ, organs, tapes, open, snackBarOpen};
    }

    it('names the number of the Organ\'s Tapes in the confirmation', async () => {
      const {open, organ} = await renderWithTapes();

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {
          action: ConfirmableAction.DELETE,
          entity: {id: organ.id, name: 'Street organ'},
          consequence: {params: {count: 2}},
        },
      });
    });

    it('removes the Organ\'s Tapes and then the Organ when confirmed', async () => {
      const {organs, tapes} = await renderWithTapes({confirmed: true});

      expect(tapes.tapeEntities()).toEqual([]);
      expect(organs.entities()).toEqual([]);
    });

    it('keeps the Organ and its Tapes when cancelled', async () => {
      const {organ, organs, tapes} = await renderWithTapes({confirmed: false});

      expect(tapes.tapeEntities()).toHaveLength(2);
      expect(organs.entities().map(({id}) => id)).toEqual([organ.id]);
    });

    it('keeps the Organ when removing its Tapes could not be written', async () => {
      const {organ, organs} = await renderWithTapes({confirmed: true, failures: {tapes: {save: 'failed'}}});

      expect(organs.entities().map(({id}) => id)).toEqual([organ.id]);
    });

    it('refuses to delete while the Tapes could not be read, with a message and no change', async () => {
      const {organ, organs, open, snackBarOpen} = await renderWithTapes({confirmed: true, unreadable: true});

      expect(open).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalledTimes(1);
      expect(organs.entities().map(({id}) => id)).toEqual([organ.id]);
    });
  });

  it('offers to create a new Organ', async () => {
    const {element} = await render();
    const link = element.querySelector('[data-testid="new-organ"]');
    expect(link?.textContent?.trim()).toContain('New Organ');
    expect(link?.getAttribute('href')).toBe('/organs/new');
  });
});
