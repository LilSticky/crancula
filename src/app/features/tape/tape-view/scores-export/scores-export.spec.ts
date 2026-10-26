import {ApplicationRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {midiNoteNumber, scoresFileName, scoresMusicXml, type Organ, type ScoresChoices} from '@api/index';
import {referenceOrgan, referenceTape} from '@api/tape/tape-fixture';
import {note, part, song, songId, tick, ticksPerQuarter, type Song} from '@api/song/song';
import {vi} from 'vitest';
import {
  CRANCULA_API,
  createInMemoryCranculaApi,
  type InMemoryCranculaApi,
  type InMemoryCranculaApiFailures,
} from '../../../../core/crancula-api.token';
import {provideTestTranslations} from '../../../../../testing/test-translations';
import {ScoresExport} from './scores-export';

const QUARTER = 480;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing ${what}`);
  return value;
}

/** A Song in 3/4 from Tick 0 with an upbeat of one quarter. */
function songWithUpbeat(): Song {
  const melody = defined(
    part({
      name: 'Melody',
      percussion: false,
      notes: [
        defined(
          note({
            noteNumber: defined(midiNoteNumber(61), 'note number'),
            start: defined(tick(0), 'start'),
            duration: defined(tick(QUARTER), 'duration'),
          }),
          'note',
        ),
      ],
    }),
    'part',
  );
  return defined(
    song({
      id: defined(songId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'song id'),
      name: 'Waltz',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [melody],
      timeSignatures: [{start: defined(tick(0), 'start'), beats: 3, beatType: 4}],
      upbeat: defined(tick(QUARTER), 'upbeat'),
    }),
    'song',
  );
}

/** The choices the dialog is prefilled with for this Song and the reference Organ: 3/4 as in the Song, an upbeat of 8 Columns, no split note. */
const PREFILLED: ScoresChoices = {timeSignature: 'song', upbeat: 8, splitNotes: []};

function setUp(failures: InMemoryCranculaApiFailures = {}) {
  const api: InMemoryCranculaApi = createInMemoryCranculaApi(undefined, undefined, failures);
  TestBed.configureTestingModule({providers: [provideTestTranslations('en'), {provide: CRANCULA_API, useValue: api}]});
  const organ: Organ = referenceOrgan();
  const tape = referenceTape(organ);
  const waltz = songWithUpbeat();
  const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
  const translate = TestBed.inject(TranslateService);
  return {api, organ, tape, song: waltz, snackBar, translate, scoresExport: TestBed.inject(ScoresExport)};
}

/** Presses a button of the export dialog once it is open; the export is still running until it is awaited. */
function pressInDialog(testId: 'scores-confirm' | 'scores-cancel'): void {
  TestBed.inject(ApplicationRef).tick();
  required(document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), testId).click();
}

describe('ScoresExport', () => {
  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('saves nothing and shows no snackbar when the export dialog is cancelled', async () => {
    const {api, organ, tape, song, snackBar, scoresExport} = setUp();
    const save = vi.spyOn(api.scores, 'save');

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-cancel');
    await pending;

    expect(save).not.toHaveBeenCalled();
    expect(snackBar).not.toHaveBeenCalled();
    expect(scoresExport.saving()).toBe(false);
  });

  it('asks the main process to save the suggested file name, the MusicXML of the prefilled choices and the translated dialog texts', async () => {
    const {api, organ, tape, song, translate, scoresExport} = setUp();

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    expect(api.scores.lastSaveRequest).toEqual({
      suggestedFileName: scoresFileName(tape.name),
      musicXml: scoresMusicXml({tape, organ, song, choices: PREFILLED}),
      dialogTitle: translate.instant('TAPE.SCORES.DIALOG_TITLE'),
      filterName: translate.instant('TAPE.SCORES.FILTER_NAME'),
    });
    expect(api.scores.lastSaveRequest?.dialogTitle).not.toBe('TAPE.SCORES.DIALOG_TITLE');
    expect(api.scores.lastSaveRequest?.filterName).not.toBe('TAPE.SCORES.FILTER_NAME');
  });

  it('names the path in a snackbar when the Scores file was saved', async () => {
    const {organ, tape, song, translate, snackBar, scoresExport} = setUp();

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    expect(snackBar).toHaveBeenCalledTimes(1);
    expect(snackBar.mock.calls[0]?.[0]).toBe(
      translate.instant('TAPE.SCORES.SAVED', {name: `in-memory/${scoresFileName(tape.name)}`}),
    );
  });

  it('shows no snackbar when the save dialog was cancelled', async () => {
    const {organ, tape, song, snackBar, scoresExport} = setUp({scores: {save: 'cancelled'}});

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    expect(snackBar).not.toHaveBeenCalled();
    expect(scoresExport.saving()).toBe(false);
  });

  it('tells the reason in a snackbar that stays until dismissed, with Try again, when saving failed', async () => {
    const {organ, tape, song, translate, snackBar, scoresExport} = setUp({scores: {save: 'failed'}});

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toBe(
      translate.instant('TAPE.SCORES.FAILED', {reason: 'the Scores file could not be written'}),
    );
    expect(action).toBe(translate.instant('TAPE.SCORES.RETRY'));
    expect(config?.duration ?? 0).toBe(0);
    expect(scoresExport.saving()).toBe(false);
  });

  it('tells the reason of a rejected request in the failure snackbar, with Try again', async () => {
    const {api, organ, tape, song, translate, snackBar, scoresExport} = setUp();
    vi.spyOn(api.scores, 'save').mockResolvedValue({status: 'rejected', reason: 'the request is not valid'});

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    const [message, action] = snackBar.mock.calls[0] ?? [];
    expect(message).toBe(translate.instant('TAPE.SCORES.FAILED', {reason: 'the request is not valid'}));
    expect(action).toBe(translate.instant('TAPE.SCORES.RETRY'));
  });

  it('tells the message of an error thrown while saving in the failure snackbar, with Try again', async () => {
    const {api, organ, tape, song, translate, snackBar, scoresExport} = setUp();
    vi.spyOn(api.scores, 'save').mockRejectedValue(new Error('the disk is full'));

    const pending = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await pending;

    const [message, action] = snackBar.mock.calls[0] ?? [];
    expect(message).toBe(translate.instant('TAPE.SCORES.FAILED', {reason: 'the disk is full'}));
    expect(action).toBe(translate.instant('TAPE.SCORES.RETRY'));
    expect(scoresExport.saving()).toBe(false);
  });

  it('keeps saving true while the Scores file is being saved and ignores a second export meanwhile', async () => {
    const {api, organ, tape, song, scoresExport} = setUp();
    let finish: () => void = () => undefined;
    const save = vi.spyOn(api.scores, 'save').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({status: 'saved', filePath: 'in-memory/Waltz.musicxml'});
        }),
    );

    const first = scoresExport.export(tape, organ, song);
    pressInDialog('scores-confirm');
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(scoresExport.saving()).toBe(true);

    await scoresExport.export(tape, organ, song);
    expect(save).toHaveBeenCalledTimes(1);

    finish();
    await first;
    expect(scoresExport.saving()).toBe(false);
  });
});
