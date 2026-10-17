import {TestBed} from '@angular/core/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  createTape,
  defaultSelectedParts,
  plotterFileName,
  plotterSvg,
  proposeTransposition,
  readMidiSong,
  tapeGeometry,
  type Organ,
  type Song,
  type Tape,
} from '@api/index';
import {vi} from 'vitest';
import {encodeSmf} from '../../../../../api/song/midi/smf-test-helper';
import {
  CRANCULA_API,
  createInMemoryCranculaApi,
  type InMemoryCranculaApi,
  type InMemoryCranculaApiFailures,
} from '../../../core/crancula-api.token';
import {testOrgan} from '../../../../testing/organs';
import {provideTestTranslations} from '../../../../testing/test-translations';
import {TapeLibrary} from '../tape-library.store';
import {PlotterExport} from './plotter-export';

const TICKS_PER_QUARTER = 480;

function waltz(organ: Organ): {readonly tape: Tape; readonly song: Song} {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {
        events: [
          {delta: 0, event: {type: 'trackName' as const, text: 'Lead'}},
          ...[61, 63, 65].flatMap((note) => [
            {delta: 0, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
            {delta: TICKS_PER_QUARTER, event: {type: 'noteOff' as const, channel: 0, note, velocity: 0}},
          ]),
        ],
      },
    ],
  });
  const read = readMidiSong(bytes, 'waltz.mid');
  if (!read.ok) throw new Error(`invalid test Song: ${read.error}`);
  const selectedParts = defaultSelectedParts(read.value);
  const created = createTape({
    song: read.value,
    selectedParts,
    organ,
    transposition: proposeTransposition(read.value, selectedParts, organ),
    name: 'Waltz',
    columnLength: 2.5,
  });
  if (!created.ok) throw new Error(`invalid test Tape: ${JSON.stringify(created.error)}`);
  return {tape: created.value.tape, song: read.value};
}

async function setUp(failures: InMemoryCranculaApiFailures = {}) {
  const api: InMemoryCranculaApi = createInMemoryCranculaApi(undefined, undefined, failures);
  TestBed.configureTestingModule({providers: [provideTestTranslations('en'), {provide: CRANCULA_API, useValue: api}]});
  const organ = testOrgan('Street organ', 3);
  const {tape, song} = waltz(organ);
  const library = TestBed.inject(TapeLibrary);
  await library.load();
  await library.create(tape, song);
  const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
  const translate = TestBed.inject(TranslateService);
  return {api, organ, tape, library, snackBar, translate, plotterExport: TestBed.inject(PlotterExport)};
}

describe('PlotterExport', () => {
  it('asks the Plotter to save the Plotter file name and the SVG of the Tape geometry', async () => {
    const {api, organ, tape, translate, plotterExport} = await setUp();

    await plotterExport.export(tape, organ);

    expect(api.plotter.lastSaveSvgRequest).toEqual({
      suggestedFileName: plotterFileName(tape.name),
      svg: plotterSvg(tapeGeometry(tape, organ)),
      dialogTitle: translate.instant('TAPE.EXPORT.DIALOG_TITLE'),
      filterName: translate.instant('TAPE.EXPORT.FILTER_NAME'),
    });
    expect(api.plotter.lastSaveSvgRequest?.dialogTitle).not.toBe('TAPE.EXPORT.DIALOG_TITLE');
    expect(api.plotter.lastSaveSvgRequest?.filterName).not.toBe('TAPE.EXPORT.FILTER_NAME');
  });

  it('names the path in a snackbar when the file was saved', async () => {
    const {organ, tape, snackBar, plotterExport} = await setUp();

    await plotterExport.export(tape, organ);

    expect(snackBar).toHaveBeenCalledTimes(1);
    expect(snackBar.mock.calls[0]?.[0]).toContain('in-memory/Waltz.svg');
  });

  it('shows no snackbar when the dialog was cancelled', async () => {
    const {organ, tape, snackBar, plotterExport} = await setUp({plotter: {saveSvg: 'cancelled'}});

    await plotterExport.export(tape, organ);

    expect(snackBar).not.toHaveBeenCalled();
    expect(plotterExport.saving()).toBe(false);
  });

  it('tells the reason in a snackbar that stays until dismissed when saving failed, and a later export works', async () => {
    const {api, organ, tape, snackBar, plotterExport} = await setUp({plotter: {saveSvg: 'failed'}});

    await plotterExport.export(tape, organ);

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toContain('the Plotter file could not be written');
    expect(action).toBeTruthy();
    expect(config?.duration ?? 0).toBe(0);
    expect(plotterExport.saving()).toBe(false);

    // The retry reaches the Plotter again.
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg');
    await plotterExport.export(tape, organ);
    expect(saveSvg).toHaveBeenCalledTimes(1);
  });

  it('keeps saving true while a save runs and ignores a second call meanwhile', async () => {
    const {api, organ, tape, plotterExport} = await setUp();
    let finish: () => void = () => undefined;
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({status: 'saved', filePath: 'in-memory/Waltz.svg'});
        }),
    );

    const first = plotterExport.export(tape, organ);
    expect(plotterExport.saving()).toBe(true);
    await plotterExport.export(tape, organ);
    expect(saveSvg).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(plotterExport.saving()).toBe(false);
  });

  it('leaves the Tape library unchanged and exports twice', async () => {
    const {api, library, organ, tape, snackBar, plotterExport} = await setUp();
    const before = structuredClone(library.tapeEntities());
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

    await plotterExport.export(tape, organ);
    await plotterExport.export(tape, organ);

    expect(saveSvg).toHaveBeenCalledTimes(2);
    expect(snackBar).toHaveBeenCalledTimes(2);
    expect(library.tapeEntities()).toEqual(before);
  });
});
