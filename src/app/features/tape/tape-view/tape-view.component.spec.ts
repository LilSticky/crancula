import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {
  createTape,
  defaultSelectedParts,
  proposeTransposition,
  readMidiSong,
  type Tape,
  toTapeLibrarySnapshot,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {TapeViewComponent} from './tape-view.component';

@Component({template: 'Tapes'})
class TapeListStubComponent {}

const TICKS_PER_QUARTER = 480;

async function render(options: {deferLoad?: boolean} = {}) {
  const inMemory = createInMemoryCranculaApi();
  let finishLoad: () => void = () => undefined;
  let deferredSnapshot: ReturnType<typeof toTapeLibrarySnapshot> | null = null;
  const api = options.deferLoad
    ? {
        ...inMemory,
        tapes: {
          ...inMemory.tapes,
          load: () =>
            new Promise<Awaited<ReturnType<typeof inMemory.tapes.load>>>((resolve) => {
              finishLoad = () =>
                resolve(deferredSnapshot ? {status: 'loaded', snapshot: deferredSnapshot} : {status: 'empty'});
            }),
        },
      }
    : inMemory;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {path: 'tapes', component: TapeListStubComponent},
        {path: 'tapes/:id', component: TapeViewComponent},
      ]),
      provideTestTranslations(),
      {provide: CRANCULA_API, useValue: api},
    ],
  });
  const organ = testOrgan('Street organ', 3);
  await TestBed.inject(OrganLibrary).put(organ);

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
    name: song.name,
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  const tape: Tape = created.value.tape;
  const library = TestBed.inject(TapeLibrary);
  let loading: Promise<void> = Promise.resolve();
  if (options.deferLoad) {
    deferredSnapshot = toTapeLibrarySnapshot([tape], [song]);
    loading = library.load();
  } else {
    await library.load();
    await library.create(tape, song);
  }

  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const open = async (url: string, importSummary?: unknown) => {
    await router.navigateByUrl(url, importSummary ? {state: {importSummary}} : {});
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  const summaryShown = () => harness.routeNativeElement?.querySelector('[data-testid="import-summary"]') ?? null;
  const finish = async () => {
    finishLoad();
    await loading;
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  return {tape, importSummary: created.value.importSummary, open, summaryShown, router, finish};
}

describe('TapeViewComponent', () => {
  it('shows the Import Summary given as navigation state', async () => {
    const {tape, importSummary, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`, importSummary);

    expect(summaryShown()).not.toBeNull();
  });

  it('shows no Import Summary when opened without one', async () => {
    const {tape, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`);

    expect(summaryShown()).toBeNull();
  });

  it('redirects an unknown id to the Tape list', async () => {
    const {open, router} = await render();

    await open('/tapes/00000000-0000-0000-0000-000000000000');

    expect(router.url).toBe('/tapes');
  });

  it('does not redirect an existing Tape while the Tape library is still loading', async () => {
    const {tape, open, router, finish} = await render({deferLoad: true});

    await open(`/tapes/${tape.id}`);

    expect(router.url).toBe(`/tapes/${tape.id}`);
    await finish();
    expect(router.url).toBe(`/tapes/${tape.id}`);
  });

  it('redirects an unknown id to the Tape list only after loading', async () => {
    const {open, router, finish} = await render({deferLoad: true});

    await open('/tapes/00000000-0000-0000-0000-000000000000');
    expect(router.url).toBe('/tapes/00000000-0000-0000-0000-000000000000');

    await finish();
    expect(router.url).toBe('/tapes');
  });

  it('ignores an importSummary in the navigation state that has no Import Summary shape', async () => {
    const {tape, open, summaryShown} = await render();

    await open(`/tapes/${tape.id}`, {foo: 1});

    expect(summaryShown()).toBeNull();
  });
});
