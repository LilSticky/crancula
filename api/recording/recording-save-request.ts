import {err, ok, type Result} from '../result';
import type {RecordingFormat} from './recording-format';

/** What the renderer asks the main process before a Recording: the save dialog's texts and suggestion. */
export interface RecordingChooseRequest {
  readonly suggestedFileName: string;
  readonly dialogTitle: string;
  readonly wavFilterName: string;
  readonly mp3FilterName: string;
}

export type RecordingChooseResult =
  /** The owner chose a file; `target` is the token the bytes are written with, `fileName` its basename. */
  | {readonly status: 'chosen'; readonly target: string; readonly format: RecordingFormat; readonly fileName: string}
  /** The dialog was cancelled; nothing is pending. */
  | {readonly status: 'cancelled'}
  /** The request failed validation; no dialog was shown. */
  | {readonly status: 'rejected'; readonly reason: string};

/** The rendered bytes of the Recording, written to the target the owner chose. */
export interface RecordingWriteRequest {
  readonly target: string;
  readonly bytes: Uint8Array;
}

export type RecordingWriteResult =
  /** Written; the absolute path the user chose. */
  | {readonly status: 'saved'; readonly filePath: string}
  /** Unknown or used target, wrong format bytes or too large; nothing was written. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the reason is the OS error code. */
  | {readonly status: 'failed'; readonly reason: string};

const CHOOSE_FIELDS = ['suggestedFileName', 'dialogTitle', 'wavFilterName', 'mp3FilterName'] as const;
const WRITE_FIELDS = ['target', 'bytes'] as const;
const MAXIMUM_TEXT_LENGTH = 200;
/** The largest Recording the renderer may send: about 20 minutes of WAV is 106 MB. */
export const MAXIMUM_RECORDING_BYTES = 128 * 2 ** 20;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const PATH_SEPARATOR = /[\\/]/;
const ONLY_DOTS = /^\.+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fields = Readonly<Record<string, unknown>>;

export function parseRecordingChooseRequest(input: unknown): Result<RecordingChooseRequest, string> {
  const fields = fieldsOf(input, CHOOSE_FIELDS);
  if (!fields.ok) return fields;
  const suggestedFileName = textOf(fields.value, 'suggestedFileName');
  const dialogTitle = textOf(fields.value, 'dialogTitle');
  const wavFilterName = textOf(fields.value, 'wavFilterName');
  const mp3FilterName = textOf(fields.value, 'mp3FilterName');
  if (!suggestedFileName.ok) return suggestedFileName;
  if (!dialogTitle.ok) return dialogTitle;
  if (!wavFilterName.ok) return wavFilterName;
  if (!mp3FilterName.ok) return mp3FilterName;
  if (PATH_SEPARATOR.test(suggestedFileName.value) || ONLY_DOTS.test(suggestedFileName.value)) {
    return err('suggestedFileName is not a safe file name');
  }
  return ok({
    suggestedFileName: suggestedFileName.value,
    dialogTitle: dialogTitle.value,
    wavFilterName: wavFilterName.value,
    mp3FilterName: mp3FilterName.value,
  });
}

export function parseRecordingWriteRequest(input: unknown): Result<RecordingWriteRequest, string> {
  const fields = fieldsOf(input, WRITE_FIELDS);
  if (!fields.ok) return fields;
  const {target, bytes} = fields.value;
  if (typeof target !== 'string' || !UUID.test(target)) return err('target is not a UUID');
  if (!(bytes instanceof Uint8Array)) return err('bytes is not a Uint8Array');
  if (bytes.length < 1 || bytes.length > MAXIMUM_RECORDING_BYTES) {
    return err(`bytes must be 1 to ${MAXIMUM_RECORDING_BYTES} bytes`);
  }
  return ok({target, bytes});
}

/** The payload as a record that has no field beyond `allowed`. */
function fieldsOf(input: unknown, allowed: readonly string[]): Result<Fields, string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err('the request is not an object');
  }
  const record = input as Fields;
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) return err(`unexpected field ${key}`);
  }
  return ok(record);
}

function textOf(fields: Fields, field: string): Result<string, string> {
  const value = fields[field];
  if (typeof value !== 'string') return err(`${field} is not a string`);
  if (value.length < 1 || value.length > MAXIMUM_TEXT_LENGTH || CONTROL.test(value)) {
    return err(`${field} must be 1 to ${MAXIMUM_TEXT_LENGTH} characters without control characters`);
  }
  return ok(value);
}
