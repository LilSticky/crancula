import {TestBed} from '@angular/core/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  columnDuration,
  createTape,
  defaultSelectedParts,
  pcm16,
  performance as notesOf,
  proposeTransposition,
  readMidiSong,
  RECORDING_SAMPLE_RATE,
  recordingFileName,
  wavFile,
  type Organ,
  type RecordingChooseResult,
  type Song,
  type Tape,
} from '@api/index';
import {afterEach, describe, expect, it, type Mock, vi} from 'vitest';
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
import {MP3_ENCODER, type Mp3Encoder} from './mp3-encoder';
import {RECORDING_RENDERER, type RecordingRenderer} from './recording-renderer';
import {TapeRecorder} from './tape-recorder';

/*
 * Intended API (red phase, implementer builds exactly this):
 *
 * recording-renderer.ts
 *   export interface RecordingScore {                       // what the offline renderer plays
 *     readonly notes: readonly PreviewNote[];               // performance(tape, organ)
 *     readonly columns: number;                             // tape.length
 *     readonly columnSeconds: number;                       // columnDuration(tape, organ)
 *   }
 *   export interface RecordingRenderer {
 *     render(score: RecordingScore, onProgress: (fraction: number) => void): Promise<Float32Array>; // mono, 44100 Hz
 *   }
 *   export const RECORDING_RENDERER: InjectionToken<RecordingRenderer>;
 *
 * mp3-encoder.ts
 *   export interface Mp3Encoder {
 *     encode(samples: Float32Array, onProgress: (fraction: number) => void): Promise<Uint8Array>;
 *   }
 *   export const MP3_ENCODER: InjectionToken<Mp3Encoder>;
 *
 * tape-recorder.ts
 *   export type RecordingState =
 *     | {readonly status: 'idle'}
 *     | {readonly status: 'choosing'}
 *     | {readonly status: 'rendering'; readonly progress: number}   // 0-1
 *     | {readonly status: 'encoding'; readonly progress: number}    // 0-1, MP3 only
 *     | {readonly status: 'writing'};
 *   @Injectable({providedIn: 'root'})
 *   export class TapeRecorder {
 *     readonly state: Signal<RecordingState>;
 *     readonly recording: Signal<boolean>;                          // true in every state but idle
 *     record(tape: Tape, organ: Organ): Promise<void>;              // a second call while recording does nothing
 *   }
 */

const TICKS_PER_QUARTER = 480;
/** The Recording's samples in the fake renderer: mono, 44100 Hz, already in [-1, 1]. */
const SAMPLES = new Float32Array([0, 0.5, -1, 0.25]);
/** The MP3 bytes the fake encoder answers with. */
const MP3_BYTES = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
/** The target the main process hands out for one Record; a real one is a random UUID. */
const TARGET = '6f1c2b8e-9d4a-4c3b-8e7f-1a2b3c4d5e6f';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

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

/** Makes the next render wait until the test finishes it, and gives the test its progress reports. */
function holdNextRender(render: Mock<RecordingRenderer['render']>) {
  let report: (fraction: number) => void = () => undefined;
  let release: (samples: Float32Array) => void = () => undefined;
  render.mockImplementationOnce((_score, onProgress) => {
    report = onProgress;
    return new Promise<Float32Array>((resolve) => {
      release = resolve;
    });
  });
  return {
    progress: (fraction: number) => {
      report(fraction);
    },
    finish: (samples: Float32Array) => {
      release(samples);
    },
  };
}

/** Makes the next encode wait until the test finishes it, and gives the test its progress reports. */
function holdNextEncode(encode: Mock<Mp3Encoder['encode']>) {
  let report: (fraction: number) => void = () => undefined;
  let release: (bytes: Uint8Array) => void = () => undefined;
  encode.mockImplementationOnce((_samples, onProgress) => {
    report = onProgress;
    return new Promise<Uint8Array>((resolve) => {
      release = resolve;
    });
  });
  return {
    progress: (fraction: number) => {
      report(fraction);
    },
    finish: (bytes: Uint8Array) => {
      release(bytes);
    },
  };
}

async function setUp(failures: InMemoryCranculaApiFailures = {}) {
  const api: InMemoryCranculaApi = createInMemoryCranculaApi(undefined, undefined, failures);
  const render = vi.fn<RecordingRenderer['render']>(() => Promise.resolve(SAMPLES));
  const encode = vi.fn<Mp3Encoder['encode']>(() => Promise.resolve(MP3_BYTES));
  TestBed.configureTestingModule({
    providers: [
      provideTestTranslations('en'),
      {provide: CRANCULA_API, useValue: api},
      {provide: RECORDING_RENDERER, useValue: {render}},
      {provide: MP3_ENCODER, useValue: {encode}},
    ],
  });
  const organ = testOrgan('Street organ', 3, {tapePerCrankTurn: 100});
  const {tape, song} = waltz(organ);
  const library = TestBed.inject(TapeLibrary);
  await library.load();
  await library.create(tape, song);
  const snackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
  const translate = TestBed.inject(TranslateService);
  return {api, organ, tape, library, snackBar, translate, render, encode, recorder: TestBed.inject(TapeRecorder)};
}

function chosen(target: string, format: 'wav' | 'mp3', fileName: string): RecordingChooseResult {
  return {status: 'chosen', target, format, fileName};
}

describe('TapeRecorder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for the file of a Recording named after the Tape, with the translated dialog texts', async () => {
    const {api, organ, tape, translate, recorder} = await setUp();
    const choose = vi.spyOn(api.recording, 'chooseFile');

    await recorder.record(tape, organ);

    expect(choose).toHaveBeenCalledWith({
      suggestedFileName: recordingFileName(tape.name),
      dialogTitle: translate.instant('TAPE.RECORD.DIALOG_TITLE'),
      wavFilterName: translate.instant('TAPE.RECORD.WAV_FILTER'),
      mp3FilterName: translate.instant('TAPE.RECORD.MP3_FILTER'),
    });
  });

  it('renders and saves nothing, and shows no snackbar, when the dialog was cancelled', async () => {
    const {organ, tape, render, encode, api, snackBar, recorder} = await setUp({recording: {chooseFile: 'cancelled'}});
    const write = vi.spyOn(api.recording, 'writeFile');

    await recorder.record(tape, organ);

    expect(render).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(snackBar).not.toHaveBeenCalled();
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('renders the whole Tape: its notes, its Columns and the Column time of its Crank speed', async () => {
    const {organ, tape, render, recorder} = await setUp();

    await recorder.record(tape, organ);

    expect(render).toHaveBeenCalledWith(
      {
        notes: notesOf(tape, organ),
        columns: tape.length,
        columnSeconds: defined(columnDuration(tape, organ), 'column duration'),
      },
      expect.any(Function),
    );
  });

  it('writes a WAV of the rendered samples, 44.1 kHz mono 16 bit, to the chosen target', async () => {
    const {api, organ, tape, recorder} = await setUp();
    vi.spyOn(api.recording, 'chooseFile').mockResolvedValueOnce(chosen(TARGET, 'wav', 'Waltz.wav'));
    const write = vi.spyOn(api.recording, 'writeFile');

    await recorder.record(tape, organ);

    expect(write).toHaveBeenCalledWith({target: TARGET, bytes: wavFile(pcm16(SAMPLES), RECORDING_SAMPLE_RATE)});
  });

  it('shows the saved path in a snackbar that lasts six seconds', async () => {
    const {organ, tape, snackBar, recorder} = await setUp();

    await recorder.record(tape, organ);

    expect(snackBar).toHaveBeenCalledTimes(1);
    expect(snackBar.mock.calls[0]?.[0]).toContain('in-memory/Waltz.wav');
    expect(snackBar.mock.calls[0]?.[2]?.duration).toBe(6000);
  });

  it('encodes the samples as MP3 and writes the encoder bytes to the chosen target', async () => {
    const {api, organ, tape, encode, recorder} = await setUp();
    vi.spyOn(api.recording, 'chooseFile').mockResolvedValueOnce(chosen(TARGET, 'mp3', 'Waltz.mp3'));
    const write = vi.spyOn(api.recording, 'writeFile');

    await recorder.record(tape, organ);

    expect(encode).toHaveBeenCalledWith(SAMPLES, expect.any(Function));
    expect(write).toHaveBeenCalledWith({target: TARGET, bytes: MP3_BYTES});
  });

  it('shows the reason in a snackbar that stays until dismissed, with a Retry action, when writing failed', async () => {
    const {organ, tape, snackBar, recorder} = await setUp({recording: {writeFile: 'failed'}});

    await recorder.record(tape, organ);

    expect(snackBar).toHaveBeenCalledTimes(1);
    const [message, action, config] = snackBar.mock.calls[0] ?? [];
    expect(message).toContain('the Recording could not be written');
    expect(action).toBeTruthy();
    expect(config?.duration ?? 0).toBe(0);
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('shows the reason in the same snackbar when the main process rejects the write', async () => {
    const {api, organ, tape, snackBar, recorder} = await setUp();
    vi.spyOn(api.recording, 'writeFile').mockResolvedValueOnce({status: 'rejected', reason: 'the Recording is too large'});

    await recorder.record(tape, organ);

    expect(snackBar.mock.calls[0]?.[0]).toContain('the Recording is too large');
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('shows the error message in the same snackbar when the save call throws', async () => {
    const {api, organ, tape, snackBar, recorder} = await setUp();
    vi.spyOn(api.recording, 'writeFile').mockRejectedValueOnce(new Error('the disk is gone'));

    await recorder.record(tape, organ);

    expect(snackBar.mock.calls[0]?.[0]).toContain('the disk is gone');
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('goes choosing, rendering with progress, writing and back to idle when saving a WAV', async () => {
    const {api, organ, tape, render, recorder} = await setUp();
    const held = holdNextRender(render);
    let finishWrite: () => void = () => undefined;
    vi.spyOn(api.recording, 'writeFile').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishWrite = () => resolve({status: 'saved', filePath: 'in-memory/Waltz.wav'});
        }),
    );

    const pending = recorder.record(tape, organ);
    expect(recorder.state()).toEqual({status: 'choosing'});

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalled();
    });
    held.progress(0.5);
    expect(recorder.state()).toEqual({status: 'rendering', progress: 0.5});

    held.finish(SAMPLES);
    await vi.waitFor(() => {
      expect(recorder.state()).toEqual({status: 'writing'});
    });
    finishWrite();
    await pending;
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('goes through encoding with progress when saving an MP3', async () => {
    const {api, organ, tape, encode, recorder} = await setUp();
    vi.spyOn(api.recording, 'chooseFile').mockResolvedValueOnce(chosen(TARGET, 'mp3', 'Waltz.mp3'));
    const held = holdNextEncode(encode);

    const pending = recorder.record(tape, organ);

    await vi.waitFor(() => {
      expect(encode).toHaveBeenCalled();
    });
    held.progress(0.25);
    expect(recorder.state()).toEqual({status: 'encoding', progress: 0.25});

    held.finish(MP3_BYTES);
    await pending;
    expect(recorder.state()).toEqual({status: 'idle'});
  });

  it('is recording in every state but idle', async () => {
    const {organ, tape, render, recorder} = await setUp();
    const held = holdNextRender(render);
    expect(recorder.recording()).toBe(false);

    const pending = recorder.record(tape, organ);
    expect(recorder.recording()).toBe(true);

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalled();
    });
    expect(recorder.recording()).toBe(true);

    held.finish(SAMPLES);
    await pending;
    expect(recorder.recording()).toBe(false);
  });

  it('ignores a second Record while a Recording runs', async () => {
    const {api, organ, tape, recorder} = await setUp();
    const choose = vi.spyOn(api.recording, 'chooseFile');

    const first = recorder.record(tape, organ);
    await recorder.record(tape, organ);

    expect(choose).toHaveBeenCalledTimes(1);
    await first;
  });

  it('leaves the Tape and the Tape library unchanged', async () => {
    const {organ, tape, library, recorder} = await setUp();
    const tapeBefore = structuredClone(tape);
    const libraryBefore = structuredClone(library.tapeEntities());

    await recorder.record(tape, organ);

    expect(tape).toEqual(tapeBefore);
    expect(library.tapeEntities()).toEqual(libraryBefore);
  });
});
