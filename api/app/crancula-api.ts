import type {EditCommand} from './edit-command';
import type {Language} from './language';
import type {SvgSaveRequest, SvgSaveResult} from './svg-save-request';
import type {
  RecordingChooseRequest,
  RecordingChooseResult,
  RecordingWriteRequest,
  RecordingWriteResult,
} from '../recording/recording-save-request';
import type {OrganLibrarySnapshot} from '../organ/organ-library-snapshot';
import type {TapeLibrarySnapshot} from '../tape/tape-library-snapshot';
import type {PlotterLibrarySnapshot} from '../plotter/plotter-library-snapshot';

export type SnapshotLoadResult<S> =
  /** The snapshot file was read and is valid. */
  | {readonly status: 'loaded'; readonly snapshot: S}
  /** There is no snapshot file yet. */
  | {readonly status: 'empty'}
  /** The snapshot file couldn't be used; it was moved to `backupPath` and the library starts empty. */
  | {readonly status: 'unreadable'; readonly backupPath: string; readonly reason: string};

export type SnapshotSaveResult =
  | {readonly status: 'saved'}
  /** The payload failed validation; nothing was written. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the previous file is left intact. */
  | {readonly status: 'failed'; readonly reason: string};

export type OrganLibraryLoadResult = SnapshotLoadResult<OrganLibrarySnapshot>;
export type OrganLibrarySaveResult = SnapshotSaveResult;
export type TapeLibraryLoadResult = SnapshotLoadResult<TapeLibrarySnapshot>;
export type TapeLibrarySaveResult = SnapshotSaveResult;
export type PlotterLibraryLoadResult = SnapshotLoadResult<PlotterLibrarySnapshot>;
export type PlotterLibrarySaveResult = SnapshotSaveResult;

export type SetLanguageResult =
  | {readonly status: 'set'}
  /** The payload is not a supported language; the menu is unchanged. */
  | {readonly status: 'rejected'; readonly reason: string};

export type {SvgSaveRequest, SvgSaveResult};

/** What the preload script exposes as `window.crancula` (ADR 4). */
export interface CranculaApi {
  readonly organs: {
    load(): Promise<OrganLibraryLoadResult>;
    save(snapshot: OrganLibrarySnapshot): Promise<OrganLibrarySaveResult>;
  };
  readonly tapes: {
    load(): Promise<TapeLibraryLoadResult>;
    save(snapshot: TapeLibrarySnapshot): Promise<TapeLibrarySaveResult>;
  };
  readonly plotters: {
    load(): Promise<PlotterLibraryLoadResult>;
    save(snapshot: PlotterLibrarySnapshot): Promise<PlotterLibrarySaveResult>;
  };
  readonly plotter: {
    /** Shows the save dialog and writes `request.svg` where the user chooses. */
    saveSvg(request: SvgSaveRequest): Promise<SvgSaveResult>;
  };
  readonly recording: {
    /** Shows the save dialog for a Recording; the chosen target is the only place its bytes may be written. */
    chooseFile(request: RecordingChooseRequest): Promise<RecordingChooseResult>;
    /** Writes the rendered Recording to the target `chooseFile` returned. */
    writeFile(request: RecordingWriteRequest): Promise<RecordingWriteResult>;
  };
  readonly app: {
    /** Tells the main process the language, so it can translate the application menu. */
    setLanguage(language: Language): Promise<SetLanguageResult>;
  };
  readonly edit: {
    /** Calls `listener` for every Edit Command the application menu sends; returns the unsubscribe function. */
    onCommand(listener: (command: EditCommand) => void): () => void;
  };
}
