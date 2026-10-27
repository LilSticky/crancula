import {Component} from '@angular/core';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatDialog} from '@angular/material/dialog';
import {MatMenuHarness} from '@angular/material/menu/testing';
import {provideRouter, Router} from '@angular/router';
import {type Observable, of} from 'rxjs';
import {
  createTape,
  defaultSelectedParts,
  type Organ,
  proposeTransposition,
  readMidiSong,
  type Tape,
  tapeLengthInMillimetres,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {TapeListComponent} from './tape-list.component';

const TICKS_PER_QUARTER = 480;

@Component({selector: 'cranc-stub', template: ''})
class StubComponent {}

const stubRoutes = [
  {path: 'tapes', component: StubComponent},
  {path: 'tapes/new', component: StubComponent},
  {path: 'tapes/side-by-side', component: StubComponent},
  {path: 'tapes/:id', component: StubComponent},
  {path: 'organs/new', component: StubComponent},
  {path: 'organs/:id', component: StubComponent},
];

function tapeFor(organ: Organ, name: string, columnLength = 2.5) {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {
        events: [61, 63, 65].flatMap((note) => [
          {delta: 0, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
          {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel: 0, note, velocity: 0}},
        ]),
      },
    ],
  });
  const read = readMidiSong(bytes, 'melody.mid');
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const song = read.value;
  const selectedParts = defaultSelectedParts(song);
  const created = createTape({
    song,
    selectedParts,
    organ,
    transposition: proposeTransposition(song, selectedParts, organ),
    name,
    columnLength,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  const tape: Tape = created.value.tape;
  return {tape, song};
}

interface RenderOptions {
  readonly dialogConfirms?: boolean;
  readonly language?: 'en' | 'de';
  /** The URL the list is shown at, e.g. `/tapes?organ=<id>`; its `organ` query parameter filters the list. */
  readonly url?: string;
}

async function render(options: RenderOptions = {}) {
  const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
    afterClosed: () => of(options.dialogConfirms === true),
  }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter(stubRoutes),
      provideTestTranslations(options.language ?? 'en'),
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi()},
      ...(options.dialogConfirms === undefined ? [] : [{provide: MatDialog, useValue: {open}}]),
    ],
  });
  const organs = TestBed.inject(OrganLibrary);
  const tapes = TestBed.inject(TapeLibrary);
  const router = TestBed.inject(Router);
  if (options.url !== undefined) await router.navigateByUrl(options.url);
  const fixture = TestBed.createComponent(TapeListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const add = async (organ: Organ, name: string, known = true, columnLength = 2.5) => {
    if (known) await organs.put(organ);
    const {tape, song} = tapeFor(organ, name, columnLength);
    await tapes.create(tape, song);
    await fixture.whenStable();
    return tape;
  };
  const text = (selector: string) => element.querySelector(selector)?.textContent?.trim() ?? '';
  return {fixture, element, tapes, organs, router, add, text, open};
}

const collapse = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();

/** Opens the row menu of the Tape named `name` and clicks the item with `testId`. */
async function chooseFromRowMenu(fixture: ComponentFixture<TapeListComponent>, name: string, testId: string) {
  const loader = TestbedHarnessEnvironment.loader(fixture);
  const menu = await loader.getHarness(MatMenuHarness.with({selector: `[aria-label="More actions for ${name}"]`}));
  await menu.open();
  const [item] = await menu.getItems({selector: `[data-testid="${testId}"]`});
  if (!item) throw new Error(`no ${testId} in the menu of ${name}`);
  await item.click();
}

describe('TapeListComponent', () => {
  describe('the ledger', () => {
    it('is a mat-table with the cr-ledger class inside an outlined card', async () => {
      const {add, element} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      expect(element.querySelector('mat-card[appearance="outlined"] table.mat-mdc-table.cr-ledger')).not.toBeNull();
    });

    it('has a header row with the column headers Name, Organ, Columns and Length', async () => {
      const {add, element} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      const headers = [...element.querySelectorAll('thead th')]
        .map((th) => th.textContent?.trim() ?? '')
        .filter((header) => header !== '');
      expect(headers).toEqual(expect.arrayContaining(['Name', 'Organ', 'Columns', 'Length']));
    });

    it('gives every column header an accessible name, the menu "Actions"', async () => {
      const {add, element} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      const headers = [...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
      expect(headers.every((header) => header !== '')).toBe(true);
      expect(headers).toEqual(expect.arrayContaining(['Actions']));
    });

    it('lists each Tape with its name, its Organ, and its length in Columns and in mm', async () => {
      const {add, text, element} = await render();
      const tape = await add(testOrgan('Street organ', 3), 'Melody');

      expect(element.querySelectorAll('[data-testid="tape"]')).toHaveLength(1);
      expect(text('[data-testid="tape-name"]')).toBe('Melody');
      expect(text('[data-testid="tape-organ"]')).toBe('Street organ');
      expect(text('[data-testid="tape-length-columns"]')).toBe(`${tape.length}`);
      expect(text('[data-testid="tape-length-mm"]')).toBe(`${tapeLengthInMillimetres(tape)} mm`);
    });

    it('writes the length in mm with the decimal comma in German', async () => {
      const {add, text} = await render({language: 'de'});
      const tape = await add(testOrgan('Street organ', 3), 'Melody', true, 0.25);

      const mm = `${tapeLengthInMillimetres(tape)}`;
      expect(mm).toContain('.');
      expect(text('[data-testid="tape-length-mm"]')).toBe(`${mm.replace('.', ',')} mm`);
    });

    it('holds the name in a link to the Tape view', async () => {
      const {add, element} = await render();
      const tape = await add(testOrgan('Street organ', 3), 'Melody');

      const link = element.querySelector('[data-testid="open-tape"]');
      expect(link?.getAttribute('href')).toBe(`/tapes/${tape.id}`);
      expect(link?.querySelector('[data-testid="tape-name"]')?.textContent?.trim()).toBe('Melody');
    });

    it('links the Organ to its editor', async () => {
      const {add, element} = await render();
      const organ = testOrgan('Street organ', 3);
      await add(organ, 'Melody');

      expect(element.querySelector('a[data-testid="tape-organ"]')?.getAttribute('href')).toBe(`/organs/${organ.id}`);
    });

    it('lists two Tapes with the same name separately', async () => {
      const {add, element} = await render();
      const organ = testOrgan('Street organ', 3);
      const first = await add(organ, 'Melody');
      const second = await add(organ, 'Melody');

      const names = [...element.querySelectorAll('[data-testid="tape-name"]')].map((node) => node.textContent?.trim());
      expect(names).toEqual(['Melody', 'Melody']);
      const hrefs = [...element.querySelectorAll('[data-testid="open-tape"]')].map((node) => node.getAttribute('href'));
      expect([...hrefs].sort()).toEqual([`/tapes/${first.id}`, `/tapes/${second.id}`].sort());
    });

    it('orders the Tapes by Organ name, then by Tape name, with unknown Organs last', async () => {
      const {add, element} = await render();
      const anton = testOrgan('Anton', 3);
      await add(testOrgan('Zither', 3), 'Alpha');
      await add(anton, 'Beta');
      await add(testOrgan('Lost organ', 3), 'Aaa', false);
      await add(anton, 'Alpha');

      const rows = [...element.querySelectorAll('[data-testid="tape"]')].map(
        (row) =>
          `${collapse(row.querySelector('[data-testid="tape-organ"]')?.textContent)}/${collapse(row.querySelector('[data-testid="tape-name"]')?.textContent)}`,
      );
      expect(rows).toEqual(['Anton/Alpha', 'Anton/Beta', 'Zither/Alpha', 'Organ not available/Aaa']);
    });

    it('opens the Tape view with a click on the row outside the link and the menu', async () => {
      const {add, element, router, fixture} = await render();
      const tape = await add(testOrgan('Street organ', 3), 'Melody');

      element.querySelector<HTMLElement>('[data-testid="tape-length-mm"]')?.click();
      await fixture.whenStable();

      expect(router.url).toBe(`/tapes/${tape.id}`);
    });

    it('does not open the Tape view when the menu button is clicked', async () => {
      const {add, element, router, fixture} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      element.querySelector<HTMLElement>('[aria-label="More actions for Melody"]')?.click();
      await fixture.whenStable();

      expect(router.url).toBe('/');
    });

    describe('with an Organ that is not available', () => {
      it('shows "Organ not available" as plain text and the Tape name as plain text without any link', async () => {
        const {add, text, element} = await render();
        await add(testOrgan('Lost organ', 3), 'Melody', false);

        const row = element.querySelector('[data-testid="tape"]');
        expect(text('[data-testid="tape-organ"]')).toBe('Organ not available');
        expect(element.querySelector('[data-testid="tape-organ"]')?.closest('a')).toBeNull();
        expect(row?.querySelector('[data-testid="tape-name"]')?.textContent?.trim()).toBe('Melody');
        expect(row?.querySelector('[data-testid="tape-name"]')?.closest('a')).toBeNull();
        expect(row?.querySelector('a')).toBeNull();
        expect(element.querySelector('[aria-disabled]')).toBeNull();
      });

      it('does nothing on a click on the row', async () => {
        const {add, element, router, fixture} = await render();
        await add(testOrgan('Lost organ', 3), 'Melody', false);

        element.querySelector<HTMLElement>('[data-testid="tape-length-mm"]')?.click();
        await fixture.whenStable();

        expect(router.url).toBe('/');
      });
    });
  });

  describe('the row menu', () => {
    async function renderWithMenu(dialogConfirms: boolean) {
      const view = await render({dialogConfirms});
      const tape = await view.add(testOrgan('Street organ', 3), 'Kirmes-Walzer');
      return {...view, tape};
    }

    it('is a more_vert button labelled "More actions for Kirmes-Walzer"', async () => {
      const {element} = await renderWithMenu(false);

      expect(element.querySelector('[aria-label="More actions for Kirmes-Walzer"]')?.textContent?.trim()).toBe('more_vert');
    });

    it('holds Rename (edit icon) before Delete Tape', async () => {
      const {fixture} = await renderWithMenu(false);
      const menu = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatMenuHarness.with({selector: '[aria-label="More actions for Kirmes-Walzer"]'}),
      );

      await menu.open();

      const items = await menu.getItems();
      expect(items).toHaveLength(2);
      const [rename] = await menu.getItems({selector: '[data-testid="rename-tape"]'});
      expect((await rename?.getText())?.replace('edit', '').trim()).toBe('Rename');
      expect(await items[0]?.getText()).toContain('edit');
      const [remove] = await menu.getItems({selector: '[data-testid="delete-tape"]'});
      expect((await remove?.getText())?.replace('delete', '').trim()).toBe('Delete Tape');
      expect(await items[1]?.getText()).toContain('Delete Tape');
    });

    it('has no bare delete button in the row', async () => {
      const {element} = await renderWithMenu(false);

      expect(element.querySelector('button[data-testid="delete-tape"]')).toBeNull();
      expect(element.querySelector('[data-testid="remove-tape"]')).toBeNull();
    });

    it('opens the confirm dialog for deleting the Tape', async () => {
      const {fixture, open, tape} = await renderWithMenu(false);
      await chooseFromRowMenu(fixture, 'Kirmes-Walzer', 'delete-tape');
      await fixture.whenStable();

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: tape.id, name: 'Kirmes-Walzer'}},
      });
    });

    it('changes nothing when the dialog is cancelled', async () => {
      const {fixture, tapes, tape} = await renderWithMenu(false);
      await chooseFromRowMenu(fixture, 'Kirmes-Walzer', 'delete-tape');
      await fixture.whenStable();

      expect(tapes.tapeEntities().map(({id}) => id)).toEqual([tape.id]);
    });

    it('removes the Tape from the library when the dialog is confirmed', async () => {
      const {fixture, tapes} = await renderWithMenu(true);
      await chooseFromRowMenu(fixture, 'Kirmes-Walzer', 'delete-tape');
      await fixture.whenStable();

      expect(tapes.tapeEntities()).toEqual([]);
    });
  });

  describe('renaming a Tape', () => {
    const field = () => document.querySelector<HTMLInputElement>('[data-testid="tape-name-field"]');
    const button = (testId: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    const cancelButton = () =>
      [...document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')].find(
        (candidate) => candidate.textContent?.trim() === 'Cancel',
      );

    async function openRenameDialog() {
      const view = await render();
      const tape = await view.add(testOrgan('Street organ', 3), 'Kirmes-Walzer');
      await chooseFromRowMenu(view.fixture, 'Kirmes-Walzer', 'rename-tape');
      await view.fixture.whenStable();
      return {...view, tape};
    }

    async function typeName(fixture: ComponentFixture<TapeListComponent>, name: string) {
      const input = field();
      if (!input) throw new Error('no tape-name-field');
      input.value = name;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
    }

    async function press(fixture: ComponentFixture<TapeListComponent>, element: HTMLElement | null | undefined) {
      if (!element) throw new Error('no such button');
      element.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    afterEach(() => {
      TestBed.inject(MatDialog).closeAll();
    });

    it('opens a dialog with the name field prefilled with the current name', async () => {
      await openRenameDialog();

      expect(field()?.value).toBe('Kirmes-Walzer');
      expect(button('rename-tape-confirm')?.textContent?.trim()).toBe('Rename');
      expect(cancelButton()).toBeDefined();
    });

    it('renames the Tape in the library and shows the new name when Rename is chosen', async () => {
      const {fixture, tapes, tape, text} = await openRenameDialog();
      await typeName(fixture, 'Jahrmarkt');

      await press(fixture, button('rename-tape-confirm'));

      expect(tapes.tapeEntities().map(({id, name}) => ({id, name}))).toEqual([{id: tape.id, name: 'Jahrmarkt'}]);
      expect(text('[data-testid="tape-name"]')).toBe('Jahrmarkt');
      expect(field()).toBeNull();
    });

    it('renames the Tape when Enter is pressed in the name field', async () => {
      const {fixture, tapes, tape} = await openRenameDialog();
      await typeName(fixture, 'Jahrmarkt');

      field()?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tapes.tapeEntities().map(({id, name}) => ({id, name}))).toEqual([{id: tape.id, name: 'Jahrmarkt'}]);
      expect(field()).toBeNull();
    });

    it('changes nothing and closes when Cancel is chosen', async () => {
      const {fixture, tapes, text} = await openRenameDialog();
      await typeName(fixture, 'Jahrmarkt');

      await press(fixture, cancelButton());

      expect(tapes.tapeEntities().map(({name}) => name)).toEqual(['Kirmes-Walzer']);
      expect(text('[data-testid="tape-name"]')).toBe('Kirmes-Walzer');
      expect(field()).toBeNull();
    });

    it('shows an error and neither saves nor closes for a blank name', async () => {
      const {fixture, tapes} = await openRenameDialog();
      await typeName(fixture, '   ');

      await press(fixture, button('rename-tape-confirm'));

      expect(document.querySelector('mat-dialog-container')?.textContent).toContain('Give the Tape a name.');
      expect(field()).not.toBeNull();
      expect(tapes.tapeEntities().map(({name}) => name)).toEqual(['Kirmes-Walzer']);
    });

    it('shows no error before Rename is pressed for the first time', async () => {
      const {fixture} = await openRenameDialog();
      await typeName(fixture, '');

      expect(document.querySelector('[data-testid="tape-name-error"]')).toBeNull();
      expect(field()?.getAttribute('aria-invalid')).not.toBe('true');
    });

    it('shows the blank-name error in the form field error area and marks the name invalid', async () => {
      const {fixture} = await openRenameDialog();
      await typeName(fixture, '');

      await press(fixture, button('rename-tape-confirm'));

      const error = document.querySelector('.mat-mdc-form-field-error-wrapper mat-error');
      expect(error?.textContent?.trim()).toBe('Give the Tape a name.');
      expect(field()?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('the Organ filter', () => {
    /** Street organ with the Tape Melody, Barrel piano with Waltz; the list is at `urlFor(street organ id)`. */
    async function renderTwoOrgans(urlFor: (streetOrganId: string) => string) {
      const street = testOrgan('Street organ', 3);
      const barrel = testOrgan('Barrel piano', 3);
      const view = await render({url: urlFor(street.id)});
      await view.add(street, 'Melody');
      await view.add(barrel, 'Waltz');
      return view;
    }
    const names = (element: HTMLElement) =>
      [...element.querySelectorAll('[data-testid="tape-name"]')].map((node) => node.textContent?.trim());

    it('lists only the Tapes of the Organ in the `organ` query parameter and shows a chip', async () => {
      const {element} = await renderTwoOrgans((id) => `/tapes?organ=${id}`);

      expect(names(element)).toEqual(['Melody']);
      expect(collapse(element.querySelector('[data-testid="organ-filter"]')?.textContent)).toContain('Street organ');
    });

    it('shows all Tapes and no chip for an unknown Organ id', async () => {
      const {element} = await renderTwoOrgans(() => '/tapes?organ=unknown-id');

      expect(names(element)).toEqual(['Waltz', 'Melody']);
      expect(element.querySelector('[data-testid="organ-filter"]')).toBeNull();
    });

    it('shows all Tapes and no chip without the parameter', async () => {
      const {element} = await renderTwoOrgans(() => '/tapes');

      expect(names(element)).toHaveLength(2);
      expect(element.querySelector('[data-testid="organ-filter"]')).toBeNull();
    });

    it('removes the filter with the chip: navigates to /tapes and lists all Tapes', async () => {
      const {element, router, fixture} = await renderTwoOrgans((id) => `/tapes?organ=${id}`);

      element.querySelector<HTMLElement>('[data-testid="organ-filter"] [aria-label="Show all Tapes"]')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(router.url).toBe('/tapes');
      expect(names(element)).toEqual(['Waltz', 'Melody']);
      expect(element.querySelector('[data-testid="organ-filter"]')).toBeNull();
    });
  });

  describe('the page head', () => {
    it('titles the page in a page head', async () => {
      const {element} = await render();

      expect(element.querySelector('cranc-page-head h1')?.textContent?.trim()).toBe('Tapes');
    });

    it('has the subtitle', async () => {
      const {element} = await render();

      expect(element.querySelector('cranc-page-head p')?.textContent?.trim()).toBe(
        'Each Tape is punched for one Organ and holds a Song as Holes.',
      );
    });

    it('holds the only new-tape button while there are Tapes, and there is no empty state', async () => {
      const {add, element} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      const link = element.querySelector('cranc-page-head [data-testid="new-tape"]');
      expect(link?.textContent?.trim()).toContain('Bring a Song onto a Tape');
      expect(link?.getAttribute('href')).toBe('/tapes/new');
      expect(element.querySelectorAll('[data-testid="new-tape"]')).toHaveLength(1);
      expect(element.querySelector('[data-testid="empty-state"]')).toBeNull();
    });
  });

  describe('ticking Tapes for a side-by-side cut', () => {
    /** The tick box of the Tape named `name`; Material puts the aria-label on its input. */
    function tickOf(element: HTMLElement, name: string): HTMLInputElement {
      const input = element.querySelector<HTMLInputElement>(
        `[data-testid="tick-tape"] input[aria-label="Pick ${name} for a side-by-side cut"]`,
      );
      if (!input) throw new Error(`no tick box for ${name}`);
      return input;
    }

    function cutButton(element: HTMLElement): HTMLElement {
      const button = element.querySelector<HTMLElement>('[data-testid="cut-side-by-side"]');
      if (!button) throw new Error('no cut-side-by-side button');
      return button;
    }

    it('has a tick box named for the Tape in the first column of its row', async () => {
      const {add, element} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      expect(element.querySelector('[data-testid="tick-tape"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="tape"] td')?.querySelector('[data-testid="tick-tape"]')).not.toBeNull();
      expect(tickOf(element, 'Melody').checked).toBe(false);
    });

    it('disables the tick box of a Tape whose Organ is not available', async () => {
      const {add, element} = await render();
      await add(testOrgan('Lost organ', 3), 'Melody', false);

      expect(tickOf(element, 'Melody').disabled).toBe(true);
    });

    it('does not open the Tape when its tick box is clicked', async () => {
      const {add, element, router, fixture} = await render();
      await add(testOrgan('Street organ', 3), 'Melody');

      tickOf(element, 'Melody').click();
      await fixture.whenStable();

      expect(tickOf(element, 'Melody').checked).toBe(true);
      expect(router.url).toBe('/');
    });

    it('shows "Cut side by side (n)" with one or more ticks and not without', async () => {
      const organ = testOrgan('Street organ', 3);
      const {add, element, fixture} = await render();
      await add(organ, 'Melody');
      await add(organ, 'Waltz');
      expect(element.querySelector('[data-testid="cut-side-by-side"]')).toBeNull();

      tickOf(element, 'Melody').click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(collapse(cutButton(element).textContent)).toBe('Cut side by side (1)');

      tickOf(element, 'Waltz').click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(collapse(cutButton(element).textContent)).toBe('Cut side by side (2)');
    });

    it('navigates to the side-by-side page with the ticked Tapes in the order they were ticked', async () => {
      const organ = testOrgan('Street organ', 3);
      const {add, element, router, fixture} = await render();
      const melody = await add(organ, 'Melody');
      const waltz = await add(organ, 'Waltz');

      tickOf(element, 'Waltz').click();
      tickOf(element, 'Melody').click();
      fixture.detectChanges();
      await fixture.whenStable();
      cutButton(element).click();
      await fixture.whenStable();

      expect(router.url).toBe(`/tapes/side-by-side?tape=${waltz.id}&tape=${melody.id}`);
    });

    it('leaves a Tape out of the cut when it is unticked again', async () => {
      const organ = testOrgan('Street organ', 3);
      const {add, element, router, fixture} = await render();
      const melody = await add(organ, 'Melody');
      const waltz = await add(organ, 'Waltz');

      tickOf(element, 'Melody').click();
      tickOf(element, 'Waltz').click();
      tickOf(element, 'Melody').click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(collapse(cutButton(element).textContent)).toBe('Cut side by side (1)');
      cutButton(element).click();
      await fixture.whenStable();

      expect(router.url).toBe(`/tapes/side-by-side?tape=${waltz.id}`);
      expect(router.url).not.toContain(melody.id);
    });
  });

  describe('without Tapes', () => {
    it('with an Organ, says "No Tapes yet. Bring a Song onto a Tape." and holds the only filled new-tape button', async () => {
      const {organs, element, fixture} = await render();
      await organs.put(testOrgan('Street organ', 3));
      await fixture.whenStable();

      const empty = element.querySelector('[data-testid="empty-state"]');
      expect(collapse(empty?.textContent)).toContain('No Tapes yet. Bring a Song onto a Tape.');
      expect(element.querySelectorAll('[data-testid="new-tape"]')).toHaveLength(1);
      const button = empty?.querySelector('[data-testid="new-tape"]');
      expect(button?.getAttribute('href')).toBe('/tapes/new');
      expect(button?.classList.contains('mat-mdc-unelevated-button')).toBe(true);
      expect(button?.textContent?.trim()).toContain('Bring a Song onto a Tape');
      expect(element.querySelector('table')).toBeNull();
    });

    it('without an Organ, the only filled button is "Describe your Organ" and Bring a Song onto a Tape is absent', async () => {
      const {element} = await render();

      const empty = element.querySelector('[data-testid="empty-state"]');
      expect(collapse(empty?.textContent)).toContain('A Tape is punched for one Organ: describe your Organ first.');
      const button = empty?.querySelector('[data-testid="empty-new-organ"]');
      expect(button?.textContent?.trim()).toBe('Describe your Organ');
      expect(button?.getAttribute('href')).toBe('/organs/new');
      expect(button?.classList.contains('mat-mdc-unelevated-button')).toBe(true);
      expect(element.querySelectorAll('.mat-mdc-unelevated-button')).toHaveLength(1);
      expect(element.querySelector('[data-testid="new-tape"]')).toBeNull();
    });

    it('filtered without a match, says "No Tapes for the Street organ yet.", with the chip and new-tape', async () => {
      const street = testOrgan('Street organ', 3);
      const {organs, element, fixture} = await render({url: `/tapes?organ=${street.id}`});
      await organs.put(street);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(collapse(element.querySelector('[data-testid="empty-state"]')?.textContent)).toContain(
        'No Tapes for the Street organ yet.',
      );
      expect(element.querySelector('[data-testid="organ-filter"]')).not.toBeNull();
      expect(element.querySelectorAll('[data-testid="new-tape"]')).toHaveLength(1);
    });
  });
});
