import {err, ok, type Result} from '../result';
import {DEVICE_NAME, FORBIDDEN_CHARACTERS} from './safe-file-name';

/** What the renderer asks the main process to save as the Plotter file. */
export interface SvgSaveRequest {
  readonly suggestedFileName: string;
  readonly svg: string;
  readonly dialogTitle: string;
  readonly filterName: string;
}

export type SvgSaveResult =
  /** Written; the absolute path the user chose. */
  | {readonly status: 'saved'; readonly filePath: string}
  /** The dialog was cancelled; nothing was written. */
  | {readonly status: 'cancelled'}
  /** The request failed validation; no dialog was shown. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the reason is the OS error message. */
  | {readonly status: 'failed'; readonly reason: string};

const FIELDS = ['suggestedFileName', 'svg', 'dialogTitle', 'filterName'] as const;
/** The largest document (a Plotter file or a Scores file), in characters. */
export const MAXIMUM_DOCUMENT_LENGTH = 64 * 2 ** 20;
const MAXIMUM_FILE_NAME_LENGTH = 255;
const MINIMUM_FILE_NAME_LENGTH = 5;
/** The longest text of a dialog, a button or a label, in characters. */
export const MAXIMUM_LABEL_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const STEM_CHARACTER = /[^.]/;

/**
 * A file name with `extension` (without the dot, any case) of 5 to 255 characters: a stem, no forbidden character
 * and no Windows device name, the same rules `safeFileName` applies to the names the app builds.
 */
export function isSafeFileName(name: string, extension: string): boolean {
  const suffix = `.${extension}`;
  if (name.length < MINIMUM_FILE_NAME_LENGTH || name.length > MAXIMUM_FILE_NAME_LENGTH) return false;
  if (name.slice(-suffix.length).toLowerCase() !== suffix) return false;
  return (
    STEM_CHARACTER.test(name.slice(0, -suffix.length)) && !FORBIDDEN_CHARACTERS.test(name) && !DEVICE_NAME.test(name)
  );
}

/** A document within the size limit: an XML declaration and a `<root ` tag (such as `<svg `). */
export function isXmlDocument(text: string, root: string): boolean {
  return text.length <= MAXIMUM_DOCUMENT_LENGTH && text.startsWith('<?xml') && text.includes(`<${root} `);
}

/** A text of 1 to 200 characters without control characters. */
export function isLabel(text: string): boolean {
  return text.length >= 1 && text.length <= MAXIMUM_LABEL_LENGTH && !CONTROL.test(text);
}

export function parseSvgSaveRequest(input: unknown): Result<SvgSaveRequest, string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err('the request is not an object');
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(FIELDS as readonly string[]).includes(key)) return err(`unexpected field ${key}`);
  }
  const {suggestedFileName, svg, dialogTitle, filterName} = record;
  if (typeof suggestedFileName !== 'string') return err('suggestedFileName is not a string');
  if (typeof svg !== 'string') return err('svg is not a string');
  if (typeof dialogTitle !== 'string') return err('dialogTitle is not a string');
  if (typeof filterName !== 'string') return err('filterName is not a string');

  if (!isSafeFileName(suggestedFileName, 'svg')) return err('suggestedFileName is not a safe .svg file name');
  if (!isXmlDocument(svg, 'svg')) return err('svg is not an SVG document within the size limit');
  for (const [field, text] of [
    ['dialogTitle', dialogTitle],
    ['filterName', filterName],
  ] as const) {
    if (!isLabel(text)) {
      return err(`${field} must be 1 to ${MAXIMUM_LABEL_LENGTH} characters without control characters`);
    }
  }
  return ok({suggestedFileName, svg, dialogTitle, filterName});
}
