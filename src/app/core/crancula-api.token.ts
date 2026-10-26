import {InjectionToken} from '@angular/core';
import {
  parsePlotterLibrarySnapshot,
  parseRecordingChooseRequest,
  parseRecordingWriteRequest,
  parseScoresSaveRequest,
  parseSvgPiecesSaveRequest,
  parseSvgSaveRequest,
  parseTapeLibrarySnapshot,
  type CranculaApi,
  type OrganLibrarySnapshot,
  type PlotterLibraryLoadResult,
  type PlotterLibrarySaveResult,
  type PlotterLibrarySnapshot,
  type RecordingChooseResult,
  type RecordingWriteResult,
  type ScoresSaveResult,
  type SvgPiecesSaveRequest,
  type SvgPiecesSaveResult,
  type SvgSaveRequest,
  type SvgSaveResult,
  type TapeLibraryLoadResult,
  type TapeLibrarySaveResult,
  type TapeLibrarySnapshot,
} from '@api/index';

/** The main-process API (ADR 4); an in-memory stand-in in the browser dev server and in tests. */
export const CRANCULA_API = new InjectionToken<CranculaApi>('CranculaApi', {
  providedIn: 'root',
  factory: () => window.crancula ?? createInMemoryCranculaApi(),
});

/** Failures the in-memory API answers on request, so tests can reach the error paths. */
export interface InMemoryCranculaApiFailures {
  readonly plotter?: {
    readonly saveSvg?: 'cancelled' | 'failed';
    readonly savePieces?: 'cancelled' | 'failed';
  };
  readonly recording?: {
    readonly chooseFile?: 'cancelled';
    readonly writeFile?: 'failed';
  };
  readonly tapes?: {
    readonly load?: 'unreadable';
    readonly save?: 'failed';
  };
}

/** The in-memory API, which also reveals what the Plotter was last asked to save. */
export type InMemoryCranculaApi = CranculaApi & {
  readonly plotter: CranculaApi['plotter'] & {
    readonly lastSaveSvgRequest: SvgSaveRequest | undefined;
    readonly lastSavePiecesRequest: SvgPiecesSaveRequest | undefined;
  };
};

/** The token the in-memory Recording target carries; a real target is a random UUID. */
const IN_MEMORY_TARGET = '00000000-0000-4000-8000-000000000001';

/** Keeps the snapshots in memory; nothing survives a reload. */
export function createInMemoryCranculaApi(
  initial?: OrganLibrarySnapshot,
  initialTapes?: TapeLibrarySnapshot,
  failures: InMemoryCranculaApiFailures = {},
  initialPlotters?: PlotterLibrarySnapshot,
): InMemoryCranculaApi {
  let stored = initial;
  let storedTapes = initialTapes;
  let storedPlotters = initialPlotters;
  let lastSaveSvgRequest: SvgSaveRequest | undefined;
  let lastSavePiecesRequest: SvgPiecesSaveRequest | undefined;
  let chosenFileName: string | undefined;
  return {
    organs: {
      load: () => Promise.resolve(stored ? {status: 'loaded', snapshot: stored} : {status: 'empty'}),
      save: (snapshot) => {
        stored = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    tapes: {
      load: (): Promise<TapeLibraryLoadResult> => {
        if (failures.tapes?.load === 'unreadable') {
          return Promise.resolve({
            status: 'unreadable',
            backupPath: 'tapes.json.bak',
            reason: 'the Tape library could not be read',
          });
        }
        return Promise.resolve(storedTapes ? {status: 'loaded', snapshot: storedTapes} : {status: 'empty'});
      },
      save: (snapshot): Promise<TapeLibrarySaveResult> => {
        if (failures.tapes?.save === 'failed') {
          return Promise.resolve({status: 'failed', reason: 'the Tape library could not be written'});
        }
        const parsed = parseTapeLibrarySnapshot(snapshot);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        storedTapes = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    plotters: {
      load: (): Promise<PlotterLibraryLoadResult> =>
        Promise.resolve(storedPlotters ? {status: 'loaded', snapshot: storedPlotters} : {status: 'empty'}),
      save: (snapshot): Promise<PlotterLibrarySaveResult> => {
        const parsed = parsePlotterLibrarySnapshot(snapshot);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        storedPlotters = snapshot;
        return Promise.resolve({status: 'saved'});
      },
    },
    plotter: {
      get lastSaveSvgRequest(): SvgSaveRequest | undefined {
        return lastSaveSvgRequest;
      },
      get lastSavePiecesRequest(): SvgPiecesSaveRequest | undefined {
        return lastSavePiecesRequest;
      },
      savePieces: (request): Promise<SvgPiecesSaveResult> => {
        const parsed = parseSvgPiecesSaveRequest(request);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        lastSavePiecesRequest = parsed.value;
        if (failures.plotter?.savePieces === 'cancelled') return Promise.resolve({status: 'cancelled'});
        if (failures.plotter?.savePieces === 'failed') {
          return Promise.resolve({
            status: 'failed',
            fileName: parsed.value.pieces[0]?.fileName ?? '',
            reason: 'the Tape pieces could not be written',
            written: [],
          });
        }
        return Promise.resolve({
          status: 'saved',
          folderPath: 'in-memory',
          fileNames: parsed.value.pieces.map((piece) => piece.fileName),
        });
      },
      saveSvg: (request): Promise<SvgSaveResult> => {
        const parsed = parseSvgSaveRequest(request);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        lastSaveSvgRequest = parsed.value;
        if (failures.plotter?.saveSvg === 'cancelled') return Promise.resolve({status: 'cancelled'});
        if (failures.plotter?.saveSvg === 'failed') {
          return Promise.resolve({status: 'failed', reason: 'the Plotter file could not be written'});
        }
        return Promise.resolve({status: 'saved', filePath: `in-memory/${parsed.value.suggestedFileName}`});
      },
    },
    scores: {
      save: (request): Promise<ScoresSaveResult> => {
        const parsed = parseScoresSaveRequest(request);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        return Promise.resolve({status: 'saved', filePath: `in-memory/${parsed.value.suggestedFileName}`});
      },
    },
    recording: {
      chooseFile: (request): Promise<RecordingChooseResult> => {
        const parsed = parseRecordingChooseRequest(request);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        if (failures.recording?.chooseFile === 'cancelled') return Promise.resolve({status: 'cancelled'});
        chosenFileName = `${parsed.value.suggestedFileName}.wav`;
        return Promise.resolve({status: 'chosen', target: IN_MEMORY_TARGET, format: 'wav', fileName: chosenFileName});
      },
      writeFile: (request): Promise<RecordingWriteResult> => {
        const parsed = parseRecordingWriteRequest(request);
        if (!parsed.ok) return Promise.resolve({status: 'rejected', reason: parsed.error});
        if (failures.recording?.writeFile === 'failed') {
          return Promise.resolve({status: 'failed', reason: 'the Recording could not be written'});
        }
        return Promise.resolve({status: 'saved', filePath: `in-memory/${chosenFileName ?? 'recording.wav'}`});
      },
    },
    app: {
      setLanguage: () => Promise.resolve({status: 'set'}),
    },
    edit: {
      // The browser has no application menu, so no Edit Command ever arrives.
      onCommand: () => () => undefined,
    },
  };
}
