import {err, ok, type Result} from '../result';

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
/** The largest SVG document, in characters. */
export const MAXIMUM_SVG_LENGTH = 64 * 2 ** 20;
const MAXIMUM_FILE_NAME_LENGTH = 255;
const MINIMUM_FILE_NAME_LENGTH = 5;
/** The longest text of a dialog, a button or a label, in characters. */
export const MAXIMUM_LABEL_LENGTH = 200;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const FILE_NAME = /^[^/\\:]*[^./\\:][^/\\:]*\.svg$/i;

/** A Plotter file name: a `.svg` name of 5 to 255 characters, no separator and no control character. */
export function isSafeSvgFileName(name: string): boolean {
  return (
    name.length >= MINIMUM_FILE_NAME_LENGTH &&
    name.length <= MAXIMUM_FILE_NAME_LENGTH &&
    !CONTROL.test(name) &&
    FILE_NAME.test(name)
  );
}

/** An SVG document within the size limit: an XML declaration and an `<svg ` root. */
export function isSvgDocument(svg: string): boolean {
  return svg.length <= MAXIMUM_SVG_LENGTH && svg.startsWith('<?xml') && svg.includes('<svg ');
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

  if (!isSafeSvgFileName(suggestedFileName)) return err('suggestedFileName is not a safe .svg file name');
  if (!isSvgDocument(svg)) return err('svg is not an SVG document within the size limit');
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
