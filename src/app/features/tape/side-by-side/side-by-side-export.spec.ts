import {ApplicationRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {vi} from 'vitest';
import {
  column,
  columnCount,
  createTape,
  defaultSelectedParts,
  type LaneTape,
  midiNoteNumber,
  newPlotterId,
  type Organ,
  proposeTransposition,
  readMidiSong,
  type RollPlotter,
  sideBySideCut,
  sideBySideSvg,
  type Tape,
  validatePlotter,
} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {
  CRANCULA_API,
  createInMemoryCranculaApi,
  type InMemoryCranculaApi,
  type InMemoryCranculaApiFailures,
} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {SideBySideExport} from './side-by-side-export';

const TICKS_PER_QUARTER = 480;

/** Three quarter notes on three rows of `organ`, as a Tape named `name`. */
function tapeNamed(organ: Organ, name: string): Tape {
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
  const read = readMidiSong(bytes, `${name}.mid`);
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const selectedParts = defaultSelectedParts(read.value);
  const created = createTape({
    song: read.value,
    selectedParts,
    organ,
    transposition: proposeTransposition(read.value, selectedParts, organ),
    name,
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  return created.value.tape;
}

/** The roll plotter "Vinyl cutter": working width 300 mm unless given, Tape spacing 3 mm. */
function rollPlotter(workingWidth = 300): RollPlotter {
  const result = validatePlotter({
    id: newPlotterId(),
    name: 'Vinyl cutter',
    workingWidth,
    roll: true,
    workingLength: null,
    overlap: null,
    tapeSpacing: 3,
  });
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  const plotter = result.value;
  if (plotter.roll !== true) throw new Error('invalid test Plotter: not a roll plotter');
  return plotter;
}

function setUp(failures: InMemoryCranculaApiFailures = {}, language: 'en' | 'de' = 'en') {
  const api: InMemoryCranculaApi = createInMemoryCranculaApi(undefined, undefined, failures);
  TestBed.configureTestingModule({providers: [provideTestTranslations(language), {provide: CRANCULA_API, useValue: api}]});
  const street = testOrgan('Street organ', 3, {tapeBed: {tapeWidth: 100, holeDiameter: 2.5, rowSpacing: 3.5}});
  const barrel = testOrgan('Barrel piano', 3, {tapeBed: {tapeWidth: 60, holeDiameter: 2.5, rowSpacing: 3.5}});
  const lanes: readonly LaneTape[] = [
    {tape: tapeNamed(street, 'Reference'), organ: street},
    {tape: tapeNamed(barrel, 'Waltz'), organ: barrel},
  ];
  const plotter = rollPlotter();
  const translate = TestBed.inject(TranslateService);
  const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
  return {
    api,
    lanes,
    street,
    barrel,
    plotter,
    translate,
    snackBar,
    cut: sideBySideCut(lanes, plotter),
    plotterExport: TestBed.inject(SideBySideExport),
  };
}

function text(translate: TranslateService, key: string, params?: Record<string, string>): string {
  return String(translate.instant(key, params));
}

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** The Waltz with one Hole on note 70, which no Pipe of its Organ has: one Cutting Problem, at Column 1. */
function waltzWithoutPipe(waltz: Tape): Tape {
  return tapeOf({
    ...waltz,
    holes: [
      ...waltz.holes,
      {
        pipe: defined(midiNoteNumber(70), 'note 70'),
        start: defined(column(0), 'start'),
        length: defined(columnCount(3), 'length'),
      },
    ],
  });
}

describe('SideBySideExport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks the Plotter to save the Lanes under one file name with the SVG of the side-by-side cut', async () => {
    const {api, lanes, plotter, cut, translate, plotterExport} = setUp();

    await plotterExport.export(lanes, plotter);

    expect(api.plotter.lastSaveSvgRequest).toEqual({
      suggestedFileName: 'Reference and 1 more.svg',
      svg: sideBySideSvg(cut),
      dialogTitle: text(translate, 'TAPE.EXPORT.DIALOG_TITLE'),
      filterName: text(translate, 'TAPE.EXPORT.FILTER_NAME'),
    });
  });

  it('proposes the German file name, with und weitere, when the export is in German', async () => {
    const {api, lanes, plotter, plotterExport} = setUp({}, 'de');

    await plotterExport.export(lanes, plotter);

    expect(api.plotter.lastSaveSvgRequest?.suggestedFileName).toBe('Reference und 1 weitere.svg');
  });

  it('names the saved path in a snackbar', async () => {
    const {lanes, plotter, translate, snackBar, plotterExport} = setUp();

    await plotterExport.export(lanes, plotter);

    expect(snackBar).toHaveBeenCalledTimes(1);
    expect(snackBar.mock.calls[0]?.[0]).toBe(
      text(translate, 'TAPE.EXPORT.SAVED', {name: 'in-memory/Reference and 1 more.svg'}),
    );
  });

  it('keeps the saved path in a snackbar for six seconds, as the Plotter export does', async () => {
    const {lanes, plotter, snackBar, plotterExport} = setUp();

    await plotterExport.export(lanes, plotter);

    const [, , config] = snackBar.mock.calls[0] ?? [];
    expect(config?.duration).toBe(6000);
  });

  it('shows no snackbar when the dialog was cancelled', async () => {
    const {lanes, plotter, snackBar, plotterExport} = setUp({plotter: {saveSvg: 'cancelled'}});

    await plotterExport.export(lanes, plotter);

    expect(snackBar).not.toHaveBeenCalled();
    expect(plotterExport.saving()).toBe(false);
  });

  it('tells the reason in a snackbar that stays until dismissed, with Retry, when saving failed', async () => {
    const {lanes, plotter, translate, snackBar, plotterExport} = setUp({plotter: {saveSvg: 'failed'}});

    await plotterExport.export(lanes, plotter);

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toBe(text(translate, 'TAPE.EXPORT.FAILED', {reason: 'the Plotter file could not be written'}));
    expect(action).toBe(text(translate, 'TAPE.EXPORT.RETRY'));
    expect(config?.duration ?? 0).toBe(0);
    expect(plotterExport.saving()).toBe(false);
  });

  it('tells the reason of a rejected request in the same way', async () => {
    const {api, lanes, plotter, translate, snackBar, plotterExport} = setUp();
    vi.spyOn(api.plotter, 'saveSvg').mockResolvedValueOnce({status: 'rejected', reason: 'the request was refused'});

    await plotterExport.export(lanes, plotter);

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toBe(text(translate, 'TAPE.EXPORT.FAILED', {reason: 'the request was refused'}));
    expect(action).toBe(text(translate, 'TAPE.EXPORT.RETRY'));
    expect(config?.duration ?? 0).toBe(0);
  });

  it('saves the same cut again when Retry is chosen', async () => {
    const {api, lanes, plotter, snackBar, plotterExport} = setUp({plotter: {saveSvg: 'failed'}});
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

    await plotterExport.export(lanes, plotter);
    const shown = snackBar.mock.results[0];
    if (shown?.type !== 'return') throw new Error('no snackbar was shown');
    shown.value.dismissWithAction();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveSvg).toHaveBeenCalledTimes(2);
    expect(saveSvg.mock.calls[1]).toEqual(saveSvg.mock.calls[0]);
  });

  it('keeps saving true while a save runs and ignores a second call meanwhile', async () => {
    const {api, lanes, plotter, plotterExport} = setUp();
    let finish: () => void = () => undefined;
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({status: 'saved', filePath: 'in-memory/Reference and 1 more.svg'});
        }),
    );

    const first = plotterExport.export(lanes, plotter);
    expect(plotterExport.saving()).toBe(true);
    await plotterExport.export(lanes, plotter);
    expect(saveSvg).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(plotterExport.saving()).toBe(false);
  });

  it('saves no Tape, Organ or Plotter', async () => {
    const {api, lanes, plotter, plotterExport} = setUp();
    const saveTapes = vi.spyOn(api.tapes, 'save');
    const saveOrgans = vi.spyOn(api.organs, 'save');
    const savePlotters = vi.spyOn(api.plotters, 'save');

    await plotterExport.export(lanes, plotter);

    expect(saveTapes).not.toHaveBeenCalled();
    expect(saveOrgans).not.toHaveBeenCalled();
    expect(savePlotters).not.toHaveBeenCalled();
  });

  describe('for Lanes that can not be cut together (Story 3)', () => {
    afterEach(() => TestBed.inject(MatDialog).closeAll());

    /** The texts the Cutting Problems dialog lists now, in order. */
    function dialogEntries(): string[] {
      TestBed.inject(ApplicationRef).tick();
      return [...document.querySelectorAll('[data-testid="export-problem"]')].map((item) =>
        (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
    }

    it('opens the Cutting Problems dialog with one entry per reason, the Lane that does not fit first, and saves nothing', async () => {
      const {api, lanes, street, barrel, plotterExport} = setUp();
      const reference = defined(lanes.at(0), 'reference Lane').tape;
      const cannotBeCut: readonly LaneTape[] = [
        {tape: reference, organ: street},
        {tape: waltzWithoutPipe(defined(lanes.at(1), 'waltz Lane').tape), organ: barrel},
      ];
      const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

      await plotterExport.export(cannotBeCut, rollPlotter(150));

      expect(dialogEntries()).toEqual([
        'Lane 2: Waltz needs 63 mm, only 50 mm free',
        'Waltz: A#4 at Column 1: the Organ has no Pipe for this note.',
      ]);
      expect(saveSvg).not.toHaveBeenCalled();
    });

    it('names a Tape with a Cutting Problem and saves no file, shows no snackbar', async () => {
      const {api, lanes, street, barrel, snackBar, plotterExport} = setUp();
      const reference = defined(lanes.at(0), 'reference Lane').tape;
      const waltz = waltzWithoutPipe(defined(lanes.at(1), 'waltz Lane').tape);
      const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

      await plotterExport.export(
        [
          {tape: reference, organ: street},
          {tape: waltz, organ: barrel},
        ],
        rollPlotter(),
      );

      expect(dialogEntries()).toEqual(['Waltz: A#4 at Column 1: the Organ has no Pipe for this note.']);
      expect(saveSvg).not.toHaveBeenCalled();
      expect(snackBar).not.toHaveBeenCalled();
      expect(plotterExport.saving()).toBe(false);
    });

    it('never opens the Cutting Problems dialog empty for a refused save', async () => {
      const {api, lanes, plotterExport} = setUp();
      const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

      await plotterExport.export(lanes, undefined);

      expect(dialogEntries()).toEqual(['No roll plotter is picked: pick one to cut side by side.']);
      expect(saveSvg).not.toHaveBeenCalled();
    });
  });
});
