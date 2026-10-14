import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideRouter} from '@angular/router';
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

function tapeFor(organ: Organ, name: string) {
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
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  const tape: Tape = created.value.tape;
  return {tape, song};
}

async function render(dialogConfirms?: boolean) {
  const open = vi.fn<(component: unknown, config: unknown) => {afterClosed: () => Observable<boolean>}>(() => ({
    afterClosed: () => of(dialogConfirms === true),
  }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideTestTranslations(),
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi()},
      ...(dialogConfirms === undefined ? [] : [{provide: MatDialog, useValue: {open}}]),
    ],
  });
  const organs = TestBed.inject(OrganLibrary);
  const tapes = TestBed.inject(TapeLibrary);
  const fixture = TestBed.createComponent(TapeListComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const add = async (organ: Organ, name: string, known = true) => {
    if (known) await organs.put(organ);
    const {tape, song} = tapeFor(organ, name);
    await tapes.create(tape, song);
    await fixture.whenStable();
    return tape;
  };
  const text = (selector: string) => element.querySelector(selector)?.textContent?.trim() ?? '';
  return {fixture, element, tapes, add, text, open};
}

describe('TapeListComponent', () => {
  it('says that there are no Tapes yet', async () => {
    const {element} = await render();

    expect(element.textContent).toContain('No Tapes yet.');
  });

  it('lists each Tape with its name, its Organ, and its length in Columns and in mm', async () => {
    const {add, text, element} = await render();
    const tape = await add(testOrgan('Street organ', 3), 'Melody');

    expect(element.querySelectorAll('[data-testid="tape"]')).toHaveLength(1);
    expect(text('[data-testid="tape-name"]')).toBe('Melody');
    expect(text('[data-testid="tape-organ"]')).toContain('Street organ');
    expect(text('[data-testid="tape-length-columns"]')).toContain(`${tape.length}`);
    expect(text('[data-testid="tape-length-mm"]')).toContain(`${tapeLengthInMillimetres(tape)}`);
    expect(element.textContent).not.toContain('No Tapes yet.');
  });

  it('links the open action to the Tape', async () => {
    const {add, element} = await render();
    const tape = await add(testOrgan('Street organ', 3), 'Melody');

    expect(element.querySelector('[data-testid="open-tape"]')?.getAttribute('href')).toBe(`/tapes/${tape.id}`);
  });

  it('shows "Organ not available" and disables the open action when the Organ is unknown', async () => {
    const {add, text, element} = await render();
    await add(testOrgan('Lost organ', 3), 'Melody', false);

    const open = element.querySelector('[data-testid="open-tape"]');
    expect(text('[data-testid="tape-organ"]')).toBe('Organ not available');
    expect(open?.getAttribute('aria-disabled')).toBe('true');
    expect(open?.hasAttribute('href')).toBe(false);
  });

  it('offers to bring a song onto a tape', async () => {
    const {element} = await render();
    const link = element.querySelector('[data-testid="new-tape"]');

    expect(link?.textContent?.trim()).toContain('Bring a song onto a tape');
    expect(link?.getAttribute('href')).toBe('/tapes/new');
  });

  describe('remove', () => {
    async function renderAndRemove(confirmed: boolean) {
      const view = await render(confirmed);
      const tape = await view.add(testOrgan('Street organ', 3), 'Melody');
      const button = view.element.querySelector<HTMLButtonElement>('[data-testid="remove-tape"]');
      if (!button) throw new Error('no remove-tape button');
      button.click();
      await view.fixture.whenStable();
      return {...view, tape};
    }

    it('opens the confirm dialog for deleting the Tape', async () => {
      const {open, tape} = await renderAndRemove(false);

      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
      expect(open.mock.calls[0]?.[1]).toMatchObject({
        data: {action: ConfirmableAction.DELETE, entity: {id: tape.id, name: 'Melody'}},
      });
    });

    it('changes nothing when the dialog is cancelled', async () => {
      const {tapes, tape} = await renderAndRemove(false);

      expect(tapes.tapeEntities().map(({id}) => id)).toEqual([tape.id]);
    });

    it('removes the Tape from the library when the dialog is confirmed', async () => {
      const {tapes} = await renderAndRemove(true);

      expect(tapes.tapeEntities()).toEqual([]);
    });
  });
});
