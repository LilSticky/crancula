import {err, ok, type Result} from '../result';
import {isLabel, isSafeFileName, isXmlDocument, MAXIMUM_LABEL_LENGTH} from './svg-save-request';

/** What the renderer asks the main process to save as the Scores file (ADR 29). */
export interface ScoresSaveRequest {
  readonly suggestedFileName: string;
  readonly musicXml: string;
  readonly dialogTitle: string;
  readonly filterName: string;
}

export type ScoresSaveResult =
  /** Written; the absolute path the user chose. */
  | {readonly status: 'saved'; readonly filePath: string}
  /** The dialog was cancelled; nothing was written. */
  | {readonly status: 'cancelled'}
  /** The request failed validation; no dialog was shown. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the reason is the OS error code. */
  | {readonly status: 'failed'; readonly reason: string};

const FIELDS = ['suggestedFileName', 'musicXml', 'dialogTitle', 'filterName'] as const;

export function parseScoresSaveRequest(input: unknown): Result<ScoresSaveRequest, string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err('the request is not an object');
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(FIELDS as readonly string[]).includes(key)) return err(`unexpected field ${key}`);
  }
  const {suggestedFileName, musicXml, dialogTitle, filterName} = record;
  if (typeof suggestedFileName !== 'string') return err('suggestedFileName is not a string');
  if (typeof musicXml !== 'string') return err('musicXml is not a string');
  if (typeof dialogTitle !== 'string') return err('dialogTitle is not a string');
  if (typeof filterName !== 'string') return err('filterName is not a string');

  if (!isSafeFileName(suggestedFileName, 'musicxml')) {
    return err('suggestedFileName is not a safe .musicxml file name');
  }
  if (!isXmlDocument(musicXml, 'score-partwise')) {
    return err('musicXml is not a MusicXML score-partwise document within the size limit');
  }
  for (const [field, text] of [
    ['dialogTitle', dialogTitle],
    ['filterName', filterName],
  ] as const) {
    if (!isLabel(text)) {
      return err(`${field} must be 1 to ${MAXIMUM_LABEL_LENGTH} characters without control characters`);
    }
  }
  return ok({suggestedFileName, musicXml, dialogTitle, filterName});
}
