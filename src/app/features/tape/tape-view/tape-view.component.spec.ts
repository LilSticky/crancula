import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {
  createTape,
  noteName,
  defaultSelectedParts,
  proposeTransposition,
  readMidiSong,
  type Organ,
  type Tape,
  toTapeLibrarySnapshot,
} from '@api/index';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';
import {TAPE_COLUMN_WIDTH, TAPE_ROW_HEIGHT, TapeViewComponent} from './tape-view.component';

@Component({template: 'Tapes'})
class TapeListStubComponent {}

const TICKS_PER_QUARTER = 480;

interface RenderOptions {
  readonly deferLoad?: boolean;
  /** The Organ library holds no Organ for the Tape. */
  readonly organUnknown?: boolean;
  /** The Organ library holds this Organ (same id as the Tape's Organ) instead of the one the Tape was made for. */
  readonly organNow?: (original: Organ) => Organ;
}

async function render(options: RenderOptions = {}) {
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
  const organs = TestBed.inject(OrganLibrary);
  await organs.put(organ);

  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {name: 'Lead', channel: 0},
      {name: 'Bass', channel: 1},
    ].map(({name, channel}) => ({
      events: [
        {delta: 0, event: {type: 'trackName' as const, text: name}},
        ...[61, 63, 65].flatMap((note) => [
          {delta: 0, event: {type: 'noteOn' as const, channel, note, velocity: 80}},
          {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel, note, velocity: 0}},
        ]),
      ],
    })),
  });
  const read = readMidiSong(bytes, 'melody.mid');
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const song = read.value;
  const selectedParts = new Set([...defaultSelectedParts(song)].slice(0, 1)); // The Bass is left off the Tape.
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

  if (options.organUnknown) await organs.remove(organ.id);
  else if (options.organNow) await organs.put(options.organNow(organ));

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
  const view = () => harness.routeNativeElement;
  return {tape, organ, importSummary: created.value.importSummary, open, summaryShown, router, finish, view};
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

  describe('drawing the Tape (FR-018)', () => {
    const texts = (view: HTMLElement | null, testId: string) =>
      Array.from(view?.querySelectorAll(`[data-testid="${testId}"]`) ?? [], (element) => element.textContent?.trim());
    const holeRects = (view: HTMLElement | null) =>
      Array.from(view?.querySelectorAll('svg rect[data-testid="hole"]') ?? [], (rect) => ({
        x: Number(rect.getAttribute('x')),
        y: Number(rect.getAttribute('y')),
        width: Number(rect.getAttribute('width')),
      }));

    it('labels one row per Pipe with its note name, in the Organ row order', async () => {
      const {tape, organ, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(texts(view(), 'row-label')).toEqual(organ.pipes.map(({note}) => noteName(note)));
    });

    it('draws one rect per Hole at x = start * w, width = length * w, y = row * h', async () => {
      const {tape, organ, open, view} = await render();
      const rows = organ.pipes.map(({note}) => note);
      expect(tape.holes.length).toBeGreaterThan(0);

      await open(`/tapes/${tape.id}`);

      const expected = tape.holes.map((hole) => ({
        x: hole.start * TAPE_COLUMN_WIDTH,
        y: rows.indexOf(hole.pipe) * TAPE_ROW_HEIGHT,
        width: hole.length * TAPE_COLUMN_WIDTH,
      }));
      expect(holeRects(view())).toEqual(expected);
    });

    it('does not draw Holes of Pipes that are not on the Organ', async () => {
      const {tape, organ, open, view} = await render({
        organNow: (original) => ({...testOrgan(original.name, 2), id: original.id}),
      });
      const remaining = new Set(organ.pipes.slice(0, 2).map(({note}) => note));
      const kept = tape.holes.filter((hole) => remaining.has(hole.pipe));
      expect(kept.length).toBeLessThan(tape.holes.length);

      await open(`/tapes/${tape.id}`);

      expect(holeRects(view())).toHaveLength(kept.length);
    });

    it('marks every 8th Column', async () => {
      const {tape, open, view} = await render();
      expect(tape.length).toBeGreaterThan(16);

      await open(`/tapes/${tape.id}`);

      const marks = Array.from(view()?.querySelectorAll('svg [data-testid="column-mark"]') ?? [], (mark) =>
        Number(mark.getAttribute('x') ?? mark.getAttribute('x1')),
      );
      const columns = marks.map((x) => x / TAPE_COLUMN_WIDTH);
      expect(columns).toContain(8);
      expect(columns).toContain(16);
      expect(columns.every((column) => column % 8 === 0 && column < tape.length)).toBe(true);
    });

    it('lets the scroll container cover the whole Tape length', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      const drawing = view()?.querySelector('[data-testid="tape-scroll"] svg');
      expect(drawing).not.toBeNull();
      expect(Number(drawing?.getAttribute('width'))).toBeGreaterThanOrEqual(tape.length * TAPE_COLUMN_WIDTH);
    });

    it('shows the names of the selected Parts only', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(texts(view(), 'selected-part')).toEqual(['Lead']);
    });

    it('offers no control that changes the Tape', async () => {
      const {tape, open, view} = await render();

      await open(`/tapes/${tape.id}`);

      expect(view()?.querySelectorAll('button, input, select, textarea, [contenteditable]')).toHaveLength(0);
    });

    it('cannot be opened when its Organ is unknown', async () => {
      const {tape, open, router} = await render({organUnknown: true});

      await open(`/tapes/${tape.id}`);

      expect(router.url).toBe('/tapes');
    });
  });
});
