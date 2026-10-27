import {ApplicationRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  column,
  columnCount,
  createTape,
  defaultSelectedParts,
  cuttingProblems,
  type Hole,
  millimetres,
  pieceGeometry,
  plotterFileName,
  plotterSvg,
  proposeTransposition,
  readMidiSong,
  tapeGeometry,
  tapePieceFileNames,
  tapePieces,
  validatePlotter,
  type Organ,
  type Plotter,
  type PlotterDraft,
  type Song,
  type SvgPiecesSaveRequest,
  type Tape,
  type TapePiece,
} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
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
import {CuttingProblemsDialogComponent} from './cutting-problems-dialog/cutting-problems-dialog.component';
import {PlotterExport} from './plotter-export';

const TICKS_PER_QUARTER = 480;

/** Rests before each note of the long Tape: long enough for Joins between the Holes of the three rows. */
const LONG_TAPE_RESTS = 60;

/** The reference Plotter of spec 011: a sheet Plotter with working length 300 mm, working width 120 mm and Overlap 20 mm. */
const REFERENCE_PLOTTER: PlotterDraft = {name: 'Cutting mat', workingWidth: 120, roll: false, workingLength: 300, overlap: 20};

/** A roll plotter: it never splits a Tape. */
const ROLL_PLOTTER: PlotterDraft = {name: 'Vinyl cutter', workingWidth: 120, roll: true, workingLength: null, overlap: 20};

/** Three quarter notes on three rows, with `restQuarters` rests before each note. */
function waltz(organ: Organ, restQuarters = 0): {readonly tape: Tape; readonly song: Song} {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [
      {
        events: [
          {delta: 0, event: {type: 'trackName' as const, text: 'Lead'}},
          ...[61, 63, 65].flatMap((note) => [
            {delta: restQuarters * TICKS_PER_QUARTER, event: {type: 'noteOn' as const, channel: 0, note, velocity: 80}},
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

function plotterOf(draft: PlotterDraft): Plotter {
  const result = validatePlotter(draft);
  if (!result.ok) throw new Error(`invalid test Plotter: ${JSON.stringify(result.error)}`);
  return result.value;
}

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function text(translate: TranslateService, key: string, params?: Record<string, string>): string {
  return String(translate.instant(key, params));
}

/** A Tape of `length` Columns of 3 mm on `organ` with the given Holes; the other fields are those of a Waltz. */
function tapeOnOrgan(organ: Organ, length: number, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    ...waltz(organ).tape,
    columnLength: defined(millimetres(3), 'column length'),
    length: defined(columnCount(length), 'length'),
    holes,
  });
}

/** The Tape pieces the Plotter cuts the Tape into; throws when no cut exists. */
function cutOf(tape: Tape, organ: Organ, plotter: Plotter): readonly TapePiece[] {
  const cut = tapePieces(tapeGeometry(tape, organ), plotter);
  if (cut.kind !== 'pieces') throw new Error('invalid test Tape: no Tape pieces');
  return cut.pieces;
}

/** The request the export must send for several Tape pieces: every file name and SVG, and the texts of the folder dialog. */
function expectedPiecesRequest(
  tape: Tape,
  organ: Organ,
  plotter: Plotter,
  translate: TranslateService,
): SvgPiecesSaveRequest {
  const geometry = tapeGeometry(tape, organ);
  const pieces = cutOf(tape, organ, plotter);
  const fileNames = tapePieceFileNames(tape.name, pieces.length, (number, count) =>
    text(translate, 'TAPE.EXPORT.PIECE_LABEL', {number, count}),
  );
  return {
    pieces: pieces.map((piece, index) => ({
      fileName: defined(fileNames[index], `file name ${index + 1}`),
      svg: plotterSvg(pieceGeometry(geometry, piece)),
    })),
    dialogTitle: text(translate, 'TAPE.EXPORT.PIECES_DIALOG_TITLE'),
    dialogButton: text(translate, 'TAPE.EXPORT.PIECES_DIALOG_BUTTON'),
    replaceMessage: text(translate, 'TAPE.EXPORT.PIECES_REPLACE_MESSAGE'),
    replaceMoreLine: text(translate, 'TAPE.EXPORT.PIECES_REPLACE_MORE'),
    replaceButton: text(translate, 'TAPE.EXPORT.PIECES_REPLACE'),
    cancelButton: text(translate, 'TAPE.EXPORT.PIECES_CANCEL'),
  };
}

async function setUp(failures: InMemoryCranculaApiFailures = {}, restQuarters = 0) {
  const api: InMemoryCranculaApi = createInMemoryCranculaApi(undefined, undefined, failures);
  TestBed.configureTestingModule({providers: [provideTestTranslations('en'), {provide: CRANCULA_API, useValue: api}]});
  const organ = testOrgan('Street organ', 3);
  const {tape, song} = waltz(organ, restQuarters);
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

    await plotterExport.export(tape, organ, undefined);

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

    await plotterExport.export(tape, organ, undefined);

    expect(snackBar).toHaveBeenCalledTimes(1);
    expect(snackBar.mock.calls[0]?.[0]).toContain('in-memory/Waltz.svg');
  });

  it('shows no snackbar when the dialog was cancelled', async () => {
    const {organ, tape, snackBar, plotterExport} = await setUp({plotter: {saveSvg: 'cancelled'}});

    await plotterExport.export(tape, organ, undefined);

    expect(snackBar).not.toHaveBeenCalled();
    expect(plotterExport.saving()).toBe(false);
  });

  it('tells the reason in a snackbar that stays until dismissed when saving failed, and a later export works', async () => {
    const {api, organ, tape, snackBar, plotterExport} = await setUp({plotter: {saveSvg: 'failed'}});

    await plotterExport.export(tape, organ, undefined);

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toContain('the Plotter file could not be written');
    expect(action).toBeTruthy();
    expect(config?.duration ?? 0).toBe(0);
    expect(plotterExport.saving()).toBe(false);

    // The retry reaches the Plotter again.
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg');
    await plotterExport.export(tape, organ, undefined);
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

    const first = plotterExport.export(tape, organ, undefined);
    expect(plotterExport.saving()).toBe(true);
    await plotterExport.export(tape, organ, undefined);
    expect(saveSvg).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(plotterExport.saving()).toBe(false);
  });

  describe('for a Tape that can not be cut', () => {
    // The Organ's holes were made so wide after the Tape was made that its Holes are shorter than the Minimum Hole Length.
    const widerOrgan = (organ: Organ): Organ =>
      testOrgan(organ.name, 3, {tapeBed: {tapeWidth: 120, holeDiameter: 30, rowSpacing: 30}});

    afterEach(() => TestBed.inject(MatDialog).closeAll());

    /** Starts the export; the dialog may or may not be awaited by the implementation. */
    async function exportRefused() {
      const setup = await setUp();
      const organ = widerOrgan(setup.organ);
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open');
      const saveSvg = vi.spyOn(setup.api.plotter, 'saveSvg');
      const problems = cuttingProblems(setup.tape, organ);
      const before = structuredClone(setup.library.tapeEntities());
      const pending = setup.plotterExport.export(setup.tape, organ, undefined);
      await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 0))]);
      return {...setup, open, saveSvg, problems, before};
    }

    it('opens the problems dialog with exactly the problems of the export check', async () => {
      const {open, problems} = await exportRefused();

      expect(problems.length).toBeGreaterThan(0);
      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]?.[0]).toBe(CuttingProblemsDialogComponent);
      expect(open.mock.calls[0]?.[1]?.data).toEqual(problems);
    });

    it('never asks the Plotter to save, shows no snackbar and leaves the Tape library unchanged', async () => {
      const {saveSvg, snackBar, library, before} = await exportRefused();

      expect(saveSvg).not.toHaveBeenCalled();
      expect(snackBar).not.toHaveBeenCalled();
      expect(library.tapeEntities()).toEqual(before);
    });

    it('opens no problems dialog for a Tape that can be cut', async () => {
      const {organ, tape, plotterExport} = await setUp();
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open');

      await plotterExport.export(tape, organ, undefined);

      expect(open).not.toHaveBeenCalled();
    });
  });

  it('leaves the Tape library unchanged and exports twice', async () => {
    const {api, library, organ, tape, snackBar, plotterExport} = await setUp();
    const before = structuredClone(library.tapeEntities());
    const saveSvg = vi.spyOn(api.plotter, 'saveSvg');

    await plotterExport.export(tape, organ, undefined);
    await plotterExport.export(tape, organ, undefined);

    expect(saveSvg).toHaveBeenCalledTimes(2);
    expect(snackBar).toHaveBeenCalledTimes(2);
    expect(library.tapeEntities()).toEqual(before);
  });

  describe('with no Plotter or a roll plotter', () => {
    it('saves a Tape longer than a working length as one file when no Plotter is picked (FR-020)', async () => {
      const {api, organ, tape, plotterExport} = await setUp({}, LONG_TAPE_RESTS);

      await plotterExport.export(tape, organ, undefined);

      expect(api.plotter.lastSaveSvgRequest?.suggestedFileName).toBe(plotterFileName(tape.name));
      expect(api.plotter.lastSavePiecesRequest).toBeUndefined();
    });

    it('saves a Tape longer than a working length as one file with a roll plotter picked', async () => {
      const {api, organ, tape, translate, plotterExport} = await setUp({}, LONG_TAPE_RESTS);
      const plotter = plotterOf(ROLL_PLOTTER);

      await plotterExport.export(tape, organ, plotter);

      expect(api.plotter.lastSaveSvgRequest).toEqual({
        suggestedFileName: plotterFileName(tape.name),
        svg: plotterSvg(tapeGeometry(tape, organ)),
        dialogTitle: text(translate, 'TAPE.EXPORT.DIALOG_TITLE'),
        filterName: text(translate, 'TAPE.EXPORT.FILTER_NAME'),
      });
      expect(api.plotter.lastSavePiecesRequest).toBeUndefined();
    });
  });

  describe('with a sheet Plotter picked', () => {
    it('saves a Tape that fits one Tape piece as one file through the save dialog (FR-022)', async () => {
      const {api, organ, tape, translate, plotterExport} = await setUp();
      const plotter = plotterOf(REFERENCE_PLOTTER);
      expect(cutOf(tape, organ, plotter)).toHaveLength(1);

      await plotterExport.export(tape, organ, plotter);

      expect(api.plotter.lastSaveSvgRequest).toEqual({
        suggestedFileName: plotterFileName(tape.name),
        svg: plotterSvg(tapeGeometry(tape, organ)),
        dialogTitle: text(translate, 'TAPE.EXPORT.DIALOG_TITLE'),
        filterName: text(translate, 'TAPE.EXPORT.FILTER_NAME'),
      });
      expect(api.plotter.lastSavePiecesRequest).toBeUndefined();
    });

    it('saves every Tape piece of a Tape longer than the working length through the folder dialog (FR-021)', async () => {
      const {api, organ, tape, translate, plotterExport} = await setUp({}, LONG_TAPE_RESTS);
      const plotter = plotterOf(REFERENCE_PLOTTER);
      expect(cutOf(tape, organ, plotter).length).toBeGreaterThan(1);

      await plotterExport.export(tape, organ, plotter);

      expect(api.plotter.lastSavePiecesRequest).toEqual(expectedPiecesRequest(tape, organ, plotter, translate));
      expect(api.plotter.lastSaveSvgRequest).toBeUndefined();
    });

    it('sends the translated more line with the count left as a placeholder for the main process to fill in', async () => {
      const {api, organ, tape, plotterExport} = await setUp({}, LONG_TAPE_RESTS);
      const plotter = plotterOf(REFERENCE_PLOTTER);

      await plotterExport.export(tape, organ, plotter);

      const moreLine = api.plotter.lastSavePiecesRequest?.replaceMoreLine;
      expect(moreLine).toContain('{count}');
      expect(moreLine).not.toBe('TAPE.EXPORT.PIECES_REPLACE_MORE');
    });

    it('tells the folder and the number of files in a snackbar when the pieces were saved', async () => {
      const {organ, tape, translate, snackBar, plotterExport} = await setUp({}, LONG_TAPE_RESTS);
      const plotter = plotterOf(REFERENCE_PLOTTER);
      const count = cutOf(tape, organ, plotter).length;

      await plotterExport.export(tape, organ, plotter);

      expect(snackBar).toHaveBeenCalledTimes(1);
      expect(snackBar.mock.calls[0]?.[0]).toBe(
        text(translate, 'TAPE.EXPORT.PIECES_SAVED', {count: String(count), folder: 'in-memory'}),
      );
    });

    it('shows no snackbar when the folder dialog was cancelled', async () => {
      const {organ, tape, snackBar, plotterExport} = await setUp({plotter: {savePieces: 'cancelled'}}, LONG_TAPE_RESTS);

      await plotterExport.export(tape, organ, plotterOf(REFERENCE_PLOTTER));

      expect(snackBar).not.toHaveBeenCalled();
      expect(plotterExport.saving()).toBe(false);
    });

    it('names the file that could not be written in a snackbar that stays until dismissed, with Retry', async () => {
      const {organ, tape, translate, snackBar, plotterExport} = await setUp({plotter: {savePieces: 'failed'}}, LONG_TAPE_RESTS);
      const plotter = plotterOf(REFERENCE_PLOTTER);
      const firstFile = defined(expectedPiecesRequest(tape, organ, plotter, translate).pieces[0], 'first Tape piece').fileName;

      await plotterExport.export(tape, organ, plotter);

      expect(snackBar).toHaveBeenCalledTimes(1);
      const [message, action, config] = snackBar.mock.calls[0] ?? [];
      expect(message).toBe(
        text(translate, 'TAPE.EXPORT.PIECES_FAILED', {
          file: firstFile,
          reason: 'the Tape pieces could not be written',
        }),
      );
      expect(action).toBe(text(translate, 'TAPE.EXPORT.RETRY'));
      expect(config?.duration ?? 0).toBe(0);
      expect(plotterExport.saving()).toBe(false);
    });

    it('leaves the Tape library unchanged when the Tape is exported in pieces, and exports again', async () => {
      const {api, library, organ, tape, plotterExport} = await setUp({}, LONG_TAPE_RESTS);
      const plotter = plotterOf(REFERENCE_PLOTTER);
      const before = structuredClone(library.tapeEntities());
      const savePieces = vi.spyOn(api.plotter, 'savePieces');

      await plotterExport.export(tape, organ, plotter);
      await plotterExport.export(tape, organ, plotter);

      expect(savePieces).toHaveBeenCalledTimes(2);
      expect(library.tapeEntities()).toEqual(before);
    });
  });

  describe('for a Tape that the picked Plotter can not cut (T046)', () => {
    afterEach(() => TestBed.inject(MatDialog).closeAll());

    /** The texts the Cutting Problems dialog lists now, in order. */
    function dialogEntries(): string[] {
      TestBed.inject(ApplicationRef).tick();
      return [...document.querySelectorAll('[data-testid="export-problem"]')].map((item) =>
        (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
    }

    /** An Organ of 140 mm tape width, wider than the 120 mm working width of the reference Plotter, with 30 mm Holes. */
    const wideOrgan = (): Organ => testOrgan('Street organ', 3, {tapeBed: {tapeWidth: 140, holeDiameter: 30, rowSpacing: 30}});

    it('opens the Cutting Problems dialog with the stretch that has no place for a Join, and saves nothing (FR-019)', async () => {
      const {api, translate, snackBar, plotterExport} = await setUp();
      const organ = testOrgan('Street organ', 3);
      const pipe = defined(organ.pipes[0], 'first Pipe').note;
      // 200 Columns of 3 mm held from Column 1: the first Join after it lies at 623 mm, past the 300 mm working length.
      const tape = tapeOnOrgan(organ, 400, [
        {pipe, start: defined(column(0), 'start'), length: defined(columnCount(200), 'hole length')},
      ]);
      const saveSvg = vi.spyOn(api.plotter, 'saveSvg');
      const savePieces = vi.spyOn(api.plotter, 'savePieces');

      await plotterExport.export(tape, organ, plotterOf(REFERENCE_PLOTTER));

      expect(dialogEntries()).toEqual([
        text(translate, 'TAPE.CUTTING_PROBLEM.NO_JOIN', {first: '1', last: '201', plotter: 'Cutting mat', length: '300'}),
      ]);
      expect(saveSvg).not.toHaveBeenCalled();
      expect(savePieces).not.toHaveBeenCalled();
      expect(snackBar).not.toHaveBeenCalled();
    });

    it('opens the Cutting Problems dialog with the too-wide reason for a Tape wider than the working width, and saves nothing', async () => {
      const {api, translate, snackBar, plotterExport} = await setUp();
      const organ = wideOrgan();
      const tape = tapeOnOrgan(organ, 100);
      const saveSvg = vi.spyOn(api.plotter, 'saveSvg');
      const savePieces = vi.spyOn(api.plotter, 'savePieces');

      await plotterExport.export(tape, organ, plotterOf(REFERENCE_PLOTTER));

      expect(dialogEntries()).toEqual([text(translate, 'TAPE.EXPORT.TOO_WIDE')]);
      expect(saveSvg).not.toHaveBeenCalled();
      expect(savePieces).not.toHaveBeenCalled();
      expect(snackBar).not.toHaveBeenCalled();
    });

    it('lists the too-wide reason before the Cutting Problems of the Holes', async () => {
      const {translate, plotterExport} = await setUp();
      const organ = wideOrgan();
      const pipe = defined(organ.pipes[0], 'first Pipe').note;
      // Two Columns (6 mm) are shorter than the Minimum Hole Length of 30 mm: a Cutting Problem of the Hole.
      const tape = tapeOnOrgan(organ, 100, [
        {pipe, start: defined(column(10), 'start'), length: defined(columnCount(2), 'hole length')},
      ]);

      await plotterExport.export(tape, organ, plotterOf(REFERENCE_PLOTTER));

      const entries = dialogEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]).toBe(text(translate, 'TAPE.EXPORT.TOO_WIDE'));
    });
  });
});
