# Contract: Saving Tape pieces into one folder over IPC

Extends [the Plotter IPC of spec 003](../../003-punch-a-tape/contracts/plotter-ipc.md) by one channel
([ADR 28](../../../documentation/adr/0028-tape-pieces-saved-into-one-folder-by-main.md)). `plotter:save-svg`
is unchanged and still saves a one-piece Tape (FR-022). The renderer builds every piece's SVG and file name;
main shows the folder dialog and the replace question and writes. Main never receives a Tape, an Organ, a
Plotter or a path.

## Renderer API

```ts
readonly plotter: {
  saveSvg(request: SvgSaveRequest): Promise<SvgSaveResult>; // unchanged
  /** Asks for a folder, asks once before replacing, and writes every piece into it. */
  savePieces(request: SvgPiecesSaveRequest): Promise<SvgPiecesSaveResult>;
};
```

## Channel

| Channel | Request | Reply |
|---------|---------|-------|
| `plotter:save-svg-pieces` | `SvgPiecesSaveRequest` | `SvgPiecesSaveResult` |

`PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg', savePieces: 'plotter:save-svg-pieces'} as const`.

## Payloads (`api/app/svg-pieces-save-request.ts`)

```ts
interface SvgPiecesSaveRequest {
  readonly pieces: readonly {readonly fileName: string; readonly svg: string}[];
  readonly dialogTitle: string;     // TAPE.EXPORT.PIECES_DIALOG_TITLE
  readonly dialogButton: string;    // TAPE.EXPORT.PIECES_DIALOG_BUTTON ("Save here")
  readonly replaceMessage: string;  // TAPE.EXPORT.PIECES_REPLACE_MESSAGE ("Some of these files already exist. Replace them?")
  readonly replaceButton: string;   // TAPE.EXPORT.PIECES_REPLACE
  readonly cancelButton: string;    // TAPE.EXPORT.PIECES_CANCEL
}

type SvgPiecesSaveResult =
  | {readonly status: 'saved'; readonly folderPath: string; readonly fileNames: readonly string[]}
  /** Folder dialog or replace question cancelled; nothing written. */
  | {readonly status: 'cancelled'}
  /** Validation failed; no dialog shown. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing `fileName` failed with the OS error code; `written` stay in the folder. */
  | {readonly status: 'failed'; readonly fileName: string; readonly reason: string; readonly written: readonly string[]};
```

## Validation (`parseSvgPiecesSaveRequest`)

| Field | Rule |
|-------|------|
| the payload | plain object with exactly these six fields |
| `pieces` | array of 2–999 plain objects with exactly `fileName` and `svg` |
| `fileName` | the rule of `suggestedFileName` in spec 003 (safe `.svg` name, 5–255 characters, no separator or control character); distinct ignoring case |
| `svg` | the rule of spec 003 per piece; the sum of all pieces ≤ 64 × 2²⁰ characters |
| texts | 1–200 characters, no control character |

## Behaviour (`registerPlotterHandlers`)

```ts
interface PlotterEffects {
  showSaveDialog(...): ...;                    // unchanged
  showOpenDialog(window: BrowserWindow, options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  showMessageBox(window: BrowserWindow, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
  exists(filePath: string): Promise<boolean>;
  writeFile(filePath: string, text: string): Promise<void>; // unchanged
  documentsFolder(): string;
}
```

1. Invalid request → `rejected`; no dialog.
2. `showOpenDialog` modal to the sender's window: `title` = `dialogTitle`, `buttonLabel` = `dialogButton`,
   `defaultPath` = last export folder (shared with `saveSvg`) or Documents, `properties`
   `['openDirectory', 'createDirectory', 'promptToCreate']`. Cancelled or no path → `cancelled`.
3. `exists(join(folder, fileName))` for every piece. If any exist: `showMessageBox` with `type: 'question'`,
   `message` = `replaceMessage`, `detail` = the existing names, one per line, `buttons` =
   `[replaceButton, cancelButton]`, `defaultId` 1, `cancelId` 1. Any answer but 0 → `cancelled`, nothing written.
4. Write the pieces in order as UTF-8, replacing. On the first error → `failed` with that `fileName`, the
   OS error code (as `saveSvg`) and the names written before. All written → remember the folder → `saved`.
5. Nothing in `userData` is read or written (FR-025).

`main.ts` wires `dialog.showOpenDialog`, `dialog.showMessageBox` (both looked up at call time for e2e),
`fs.promises.access` for `exists`, and the existing `writeFile`.

## Renderer flow (`PlotterExport`)

| Situation | Result |
|-----------|--------|
| Cutting Problems (any kind) or too wide | Cutting Problems dialog with every reason; no IPC call |
| No Plotter, roll plotter, or one piece | `saveSvg` with `plotterFileName`, as spec 003 |
| Two or more pieces | `savePieces`; `saved` → snackbar "Saved 3 files in <folder>"; `cancelled` → nothing; `failed` → snackbar naming the file and reason, with Retry; `rejected` → as failed |

## In-memory stand-in

Validates with `parseSvgPiecesSaveRequest`, records the last request, answers `saved` with
`folderPath: 'in-memory'`; `failures.plotter.savePieces` may be `'cancelled' | 'failed'`.
