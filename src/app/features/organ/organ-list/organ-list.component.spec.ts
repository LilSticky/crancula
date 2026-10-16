import {Component} from '@angular/core';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatDialog} from '@angular/material/dialog';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {MatTooltipHarness} from '@angular/material/tooltip/testing';
import {provideRouter, Router} from '@angular/router';
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
import {LanguagePreference} from '../../shared/language-preference';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {testOrgan} from '../../../../testing/organs';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganLibrary} from '../organ-library.store';
import {OrganListComponent} from './organ-list.component';

const TICKS_PER_QUARTER = 480;

@Component({selector: 'cranc-stub', template: ''})
class StubComponent {}

const stubRoutes = [{path: 'organs/:id', component: StubComponent}];

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

/** The Street organ: 31 Pipes from F3 to B5. */
function streetOrgan(): Organ {
  return testOrgan('Street organ', 31, {pipes: Array.from({length: 31}, (_, row) => ({note: 83 - row}))});
}

async function render() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations()]});
  const library = TestBed.inject(OrganLibrary);
  const fixture = TestBed.createComponent(OrganListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, library, element: fixture.nativeElement as HTMLElement};
}

/** The Organ is in the library, which holds `tapeCount` Tapes of it (or could not be read). */
async function renderWithTapeLibrary(organ: Organ, tapeCount: number, options: {unreadable?: boolean; language?: 'en' | 'de'} = {}) {
  const made = Array.from({length: tapeCount}, (_, index) => tapeFor(organ, `Tape ${index + 1}`, [organ.pipes[0]?.note ?? 60]));
  const snapshot = toTapeLibrarySnapshot(
    made.map(({tape}) => tape),
    made.map(({song}) => song),
  );
  const failures: InMemoryCranculaApiFailures = options.unreadable ? {tapes: {load: 'unreadable'}} : {};
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestTranslations(options.language ?? 'en'),
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(undefined, snapshot, failures)},
    ],
  });
  await TestBed.inject(TapeLibrary).load();
  await TestBed.inject(OrganLibrary).put(organ);
  const fixture = TestBed.createComponent(OrganListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return {fixture, element: fixture.nativeElement as HTMLElement};
}

/** Opens the row menu of the Organ named `name` and clicks the item with `testId`. */
async function chooseFromRowMenu(fixture: ComponentFixture<OrganListComponent>, name: string, testId: string) {
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const menu = await loader.getHarness(MatMenuHarness.with({selector: `[aria-label="More actions for ${name}"]`}));
  await menu.open();
  const [item] = await menu.getItems({selector: `[data-testid="${testId}"]`});
  if (!item) throw new Error(`no ${testId} in the menu of ${name}`);
  await item.click();
}

const collapse = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();

describe('OrganListComponent', () => {
  it('titles the page in a page head', async () => {
    const {element} = await render();

    expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Organs');
  });

  it('says that there are no Organs yet', async () => {
    const {element} = await render();
    expect(element.textContent).toContain('No Organs yet.');
  });

  describe('the ledger', () => {
    it('is a mat-table with the cr-ledger class inside an outlined card', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      expect(element.querySelector('mat-card[appearance="outlined"] table.mat-mdc-table.cr-ledger')).not.toBeNull();
      expect(element.querySelectorAll('[data-testid="organ"]')).toHaveLength(1);
      expect(element.textContent).not.toContain('No Organs yet.');
    });

    it('has a header row with the column headers Name and Tapes, so screen readers announce the columns', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      const headers = [...element.querySelectorAll('thead th')]
        .map((th) => th.textContent?.trim() ?? '')
        .filter((header) => header !== '');
      expect(headers).toEqual(expect.arrayContaining(['Name', 'Tapes']));
    });

    it('gives every column header an accessible name, the miniature "Tape Bed" and the menu "Actions"', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      const headers = [...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
      expect(headers.every((header) => header !== '')).toBe(true);
      expect(headers).toEqual(expect.arrayContaining(['Tape Bed', 'Actions']));
    });

    it('lists the Organs by name', async () => {
      const {fixture, library, element} = await render();
      await library.put(testOrgan('Street organ', 31));
      await library.put(testOrgan('Barrel piano', 1));
      await library.put(testOrgan('Anton', 2));
      await fixture.whenStable();

      const names = [...element.querySelectorAll('[data-testid="organ"]')].map((link) => link.textContent?.trim());
      expect(names).toEqual(['Anton', 'Barrel piano', 'Street organ']);
    });

    it('sorts "Ärger" with "Anton" before "Bach" after switching to German', async () => {
      const {fixture, library, element} = await render();
      await library.put(testOrgan('Bach'));
      await library.put(testOrgan('Ärger'));
      await library.put(testOrgan('Anton'));
      await fixture.whenStable();

      TestBed.inject(LanguagePreference).choose('de');
      await fixture.whenStable();
      fixture.detectChanges();

      const names = [...element.querySelectorAll('[data-testid="organ"]')].map((link) => link.textContent?.trim());
      expect(names).toEqual(['Anton', 'Ärger', 'Bach']);
      localStorage.removeItem('crancula.language');
    });

    it('states the Pipes, their range and the Tape Bed in the facts line', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      expect(collapse(element.querySelector('[data-testid="organ-facts"]')?.textContent)).toBe(
        '31 Pipes, F3–B5. 120 mm Tape, hole diameter 2.5 mm',
      );
    });

    it('uses the singular for one Pipe', async () => {
      const {fixture, library, element} = await render();
      await library.put(testOrgan('Small organ', 1, {pipes: [{note: 60}]}));
      await fixture.whenStable();

      expect(collapse(element.querySelector('[data-testid="organ-facts"]')?.textContent)).toBe(
        '1 Pipe, C4. 120 mm Tape, hole diameter 2.5 mm',
      );
    });

    it('writes the hole diameter with the decimal comma in German', async () => {
      TestBed.configureTestingModule({providers: [provideRouter([]), provideTestTranslations('de')]});
      await TestBed.inject(OrganLibrary).put(streetOrgan());
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();

      const facts = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="organ-facts"]')?.textContent;
      expect(facts).toContain('31 Pfeifen, F3–B5');
      expect(facts).toContain('2,5 mm');
    });

    it('draws a hidden miniature with one line per row of the Tape Bed', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      const miniature = element.querySelector('[data-testid="organ-miniature"]');
      expect(miniature?.getAttribute('aria-hidden')).toBe('true');
      expect(miniature?.querySelectorAll('line')).toHaveLength(31);
    });

    it('opens the editor with a click on the row outside the link and the menu', async () => {
      TestBed.configureTestingModule({providers: [provideRouter(stubRoutes), provideTestTranslations()]});
      const organ = streetOrgan();
      await TestBed.inject(OrganLibrary).put(organ);
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="organ-facts"]')?.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`/organs/${organ.id}`);
    });

    it('does not open the editor when the menu button is clicked', async () => {
      TestBed.configureTestingModule({providers: [provideRouter(stubRoutes), provideTestTranslations()]});
      await TestBed.inject(OrganLibrary).put(streetOrgan());
      const fixture = TestBed.createComponent(OrganListComponent);
      fixture.autoDetectChanges();
      await fixture.whenStable();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label="More actions for Street organ"]')?.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/');
    });
  });

  it('links each Organ to its editor', async () => {
    const {fixture, library, element} = await render();
    const organ = testOrgan('Street organ');
    await library.put(organ);
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="organ"]')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
  });

  describe('the Tapes of each Organ', () => {
    it('counts two Tapes as a link to the Tape list filtered by the Organ', async () => {
      const organ = streetOrgan();
      const {element} = await renderWithTapeLibrary(organ, 2);

      const cell = element.querySelector('[data-testid="organ-tapes"]');
      expect(cell?.textContent?.trim()).toBe('2 Tapes');
      expect(cell?.getAttribute('href')).toBe(`/tapes?organ=${organ.id}`);
    });

    it('counts one Tape as "1 Tape"', async () => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), 1);

      expect(element.querySelector('[data-testid="organ-tapes"]')?.textContent?.trim()).toBe('1 Tape');
    });

    it('says "No Tapes" without a link when there are none', async () => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), 0);

      const cell = element.querySelector('[data-testid="organ-tapes"]');
      expect(cell?.textContent?.trim()).toBe('No Tapes');
      expect(cell?.closest('a')).toBeNull();
    });

    it.each([
      [2, '2 Lochbänder'],
      [1, '1 Lochband'],
      [0, 'Keine Lochbänder'],
    ])('counts %i Tapes in German as "%s"', async (count, text) => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), count, {language: 'de'});

      expect(element.querySelector('[data-testid="organ-tapes"]')?.textContent?.trim()).toBe(text);
    });

    it('shows no Tape count while the Tape library could not be read', async () => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), 2, {unreadable: true});

      expect(element.querySelector('[data-testid="organ"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="organ-tapes"]')).toBeNull();
    });
  });

  describe('the row menu', () => {
    it('is a more_vert button labelled and given a tooltip "More actions for Street organ"', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      const button = element.querySelector('[aria-label="More actions for Street organ"]');
      expect(button?.textContent?.trim()).toBe('more_vert');
      const tooltip = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatTooltipHarness.with({selector: '[aria-label="More actions for Street organ"]'}),
      );
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe('More actions for Street organ');
    });

    it('holds Delete Organ', async () => {
      const {fixture, library} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();
      const menu = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatMenuHarness.with({selector: '[aria-label="More actions for Street organ"]'}),
      );

      await menu.open();

      const [item] = await menu.getItems({selector: '[data-testid="delete-organ"]'});
      expect((await item?.getText())?.replace('delete', '').trim()).toBe('Delete Organ');
    });

    it('has no bare delete icon button in the row', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      expect(element.querySelector('button[data-testid="delete-organ"]')).toBeNull();
    });
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
      await chooseFromRowMenu(fixture, 'Street organ', 'delete-organ');
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
      await chooseFromRowMenu(fixture, 'Street organ', 'delete-organ');
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

  describe('the page head', () => {
    it('has the subtitle', async () => {
      const {element} = await render();

      expect(element.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
        'Each Organ knows its Tape Bed and its Pipes. Tapes are punched for one Organ.',
      );
    });

    it('holds the only New Organ button while there are Organs, and there is no empty state', async () => {
      const {fixture, library, element} = await render();
      await library.put(streetOrgan());
      await fixture.whenStable();

      const link = element.querySelector('cranc-page-head [data-testid="new-organ"]');
      expect(link?.textContent?.trim()).toContain('New Organ');
      expect(link?.getAttribute('href')).toBe('/organs/new');
      expect(element.querySelectorAll('[data-testid="new-organ"]')).toHaveLength(1);
      expect(element.querySelector('[data-testid="empty-state"]')).toBeNull();
    });
  });

  describe('without Organs', () => {
    it('shows an empty state with the only New Organ button and no ledger', async () => {
      const {element} = await render();

      const empty = element.querySelector('[data-testid="empty-state"]');
      expect(collapse(empty?.textContent)).toContain('No Organs yet. Describe your Organ: its Tape Bed and Pipes.');
      expect(element.querySelectorAll('[data-testid="new-organ"]')).toHaveLength(1);
      const button = empty?.querySelector('[data-testid="new-organ"]');
      expect(button?.getAttribute('href')).toBe('/organs/new');
      expect(button?.classList.contains('mat-mdc-unelevated-button')).toBe(true);
      expect(element.querySelector('table')).toBeNull();
    });
  });

  describe('the next step', () => {
    it('is offered with one Organ and no Tapes', async () => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), 0);

      const strip = element.querySelector('[data-testid="next-step"]');
      expect(collapse(strip?.textContent)).toContain('Your Organ is ready. Bring a MIDI Song onto a Tape for it.');
      const link = strip?.querySelector('a');
      expect(link?.getAttribute('href')).toBe('/tapes/new');
      expect(link?.classList.contains('mat-mdc-outlined-button')).toBe(true);
    });

    it('is absent without an Organ', async () => {
      const {element} = await render();

      expect(element.querySelector('[data-testid="next-step"]')).toBeNull();
    });

    it('is absent once a Tape exists', async () => {
      const {element} = await renderWithTapeLibrary(streetOrgan(), 1);

      expect(element.querySelector('[data-testid="next-step"]')).toBeNull();
    });
  });
});
