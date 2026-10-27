import {err, ok, type Result} from '../result';
import {isLabel, isSafeFileName, isXmlDocument, MAXIMUM_DOCUMENT_LENGTH, MAXIMUM_LABEL_LENGTH} from './svg-save-request';

/** One Tape piece as the renderer built it: its Plotter file name and its SVG document. */
export interface SvgPiece {
  readonly fileName: string;
  readonly svg: string;
}

/** What the renderer asks the main process to save: every Tape piece, into one folder the user picks. */
export interface SvgPiecesSaveRequest {
  readonly pieces: readonly SvgPiece[];
  readonly dialogTitle: string;
  readonly dialogButton: string;
  readonly replaceMessage: string;
  /** Translated; holds a literal {count} that the main process replaces with the number of names not listed. */
  readonly replaceMoreLine: string;
  readonly replaceButton: string;
  readonly cancelButton: string;
}

export type SvgPiecesSaveResult =
  /** Written into `folderPath`; `fileNames` in piece order. */
  | {readonly status: 'saved'; readonly folderPath: string; readonly fileNames: readonly string[]}
  /** The folder dialog or the replace question was cancelled; nothing was written. */
  | {readonly status: 'cancelled'}
  /** The request failed validation; no dialog was shown. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing `fileName` failed; the names in `written` stay in the folder. */
  | {
      readonly status: 'failed';
      readonly fileName: string;
      readonly reason: string;
      readonly written: readonly string[];
    };

const FIELDS = [
  'pieces',
  'dialogTitle',
  'dialogButton',
  'replaceMessage',
  'replaceMoreLine',
  'replaceButton',
  'cancelButton',
] as const;
const PIECE_FIELDS = ['fileName', 'svg'] as const;
const MINIMUM_PIECES = 2;
const MAXIMUM_PIECES = 999;
const MORE_COUNT_PLACEHOLDER = '{count}';

/** A plain object with exactly `fields`; `path` names it in the reason. */
function recordOf(input: unknown, fields: readonly string[], path: string): Result<Record<string, unknown>, string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return err(`${path} is not an object`);
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) return err(`unexpected field ${path}.${key}`);
  }
  for (const field of fields) {
    if (!(field in record)) return err(`${path}.${field} is missing`);
  }
  return ok(record);
}

function textOf(field: string, value: unknown): Result<string, string> {
  if (typeof value !== 'string') return err(`request.${field} is not a string`);
  if (!isLabel(value)) {
    return err(`request.${field} must be 1 to ${MAXIMUM_LABEL_LENGTH} characters without control characters`);
  }
  return ok(value);
}

/** The translated more line; it holds the `{count}` placeholder exactly once, where main writes the count. */
function moreLineOf(value: unknown): Result<string, string> {
  const line = textOf('replaceMoreLine', value);
  if (!line.ok) return line;
  if (line.value.split(MORE_COUNT_PLACEHOLDER).length !== 2) {
    return err(`request.replaceMoreLine must contain ${MORE_COUNT_PLACEHOLDER} exactly once`);
  }
  return line;
}

function piecesOf(value: unknown): Result<readonly SvgPiece[], string> {
  if (!Array.isArray(value)) return err('request.pieces is not a list');
  const items: unknown[] = value;
  if (items.length < MINIMUM_PIECES || items.length > MAXIMUM_PIECES) {
    return err(`request.pieces must hold ${MINIMUM_PIECES} to ${MAXIMUM_PIECES} pieces`);
  }
  const pieces: SvgPiece[] = [];
  for (const [index, item] of items.entries()) {
    const path = `request.pieces[${index}]`;
    const record = recordOf(item, PIECE_FIELDS, path);
    if (!record.ok) return err(record.error);
    const {fileName, svg} = record.value;
    if (typeof fileName !== 'string') return err(`${path}.fileName is not a string`);
    if (!isSafeFileName(fileName, 'svg')) return err(`${path}.fileName is not a safe .svg file name`);
    if (typeof svg !== 'string') return err(`${path}.svg is not a string`);
    if (!isXmlDocument(svg, 'svg')) return err(`${path}.svg is not an SVG document within the size limit`);
    pieces.push({fileName, svg});
  }

  const names = new Set<string>();
  for (const {fileName} of pieces) {
    const key = fileName.toLowerCase();
    if (names.has(key)) return err('request.pieces fileName values must be distinct, ignoring case');
    names.add(key);
  }
  const totalLength = pieces.reduce((sum, piece) => sum + piece.svg.length, 0);
  if (totalLength > MAXIMUM_DOCUMENT_LENGTH) {
    return err(`request.pieces svg of all pieces together exceed ${MAXIMUM_DOCUMENT_LENGTH} characters`);
  }
  return ok(pieces);
}

/** Checks a request to save Tape pieces (ADR 28); the renderer builds the names and SVGs, main only writes them. */
export function parseSvgPiecesSaveRequest(input: unknown): Result<SvgPiecesSaveRequest, string> {
  const record = recordOf(input, FIELDS, 'request');
  if (!record.ok) return err(record.error);
  const pieces = piecesOf(record.value.pieces);
  if (!pieces.ok) return err(pieces.error);
  const dialogTitle = textOf('dialogTitle', record.value.dialogTitle);
  if (!dialogTitle.ok) return err(dialogTitle.error);
  const dialogButton = textOf('dialogButton', record.value.dialogButton);
  if (!dialogButton.ok) return err(dialogButton.error);
  const replaceMessage = textOf('replaceMessage', record.value.replaceMessage);
  if (!replaceMessage.ok) return err(replaceMessage.error);
  const replaceMoreLine = moreLineOf(record.value.replaceMoreLine);
  if (!replaceMoreLine.ok) return err(replaceMoreLine.error);
  const replaceButton = textOf('replaceButton', record.value.replaceButton);
  if (!replaceButton.ok) return err(replaceButton.error);
  const cancelButton = textOf('cancelButton', record.value.cancelButton);
  if (!cancelButton.ok) return err(cancelButton.error);
  return ok({
    pieces: pieces.value,
    dialogTitle: dialogTitle.value,
    dialogButton: dialogButton.value,
    replaceMessage: replaceMessage.value,
    replaceMoreLine: replaceMoreLine.value,
    replaceButton: replaceButton.value,
    cancelButton: cancelButton.value,
  });
}
