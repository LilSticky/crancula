# Contract: Saving the Plotter file over IPC

This extends the boundary of [slice 002](../../002-bring-a-song-onto-a-tape/contracts/tape-library-ipc.md)
between the renderer (Angular) and the main process (Electron), following ADR 4 and
[ADR 21](../../../documentation/adr/0021-plotter-export-built-in-the-domain.md). The types live in
`api/` and are shared by both sides. The main process validates every payload it receives. The
Organ, Tape and app channels are unchanged.

The renderer builds the SVG text itself (research R2). The main process only shows the save
dialog and writes the text to the path the user chose. It never receives a Tape, an Organ or a
path from the renderer.

## Renderer API (`window.crancula`, exposed by `app/preload.ts`)

```ts
interface CranculaApi {
  organs: { /* unchanged */ };
  tapes: { /* unchanged */ };
  plotter: {
    /** Shows the save dialog and writes `request.svg` where the user chooses. */
    saveSvg(request: SvgSaveRequest): Promise<SvgSaveResult>;
  };
  app: { /* unchanged */ };
}
```

## Channels (allow-list)

| Channel | Direction | Request | Reply |
|---------|-----------|---------|-------|
| `organs:load`, `organs:save` | renderer → main (`invoke`) | unchanged (001) | unchanged |
| `tapes:load`, `tapes:save` | renderer → main (`invoke`) | unchanged (002) | unchanged |
| `plotter:save-svg` | renderer → main (`invoke`) | `SvgSaveRequest` | `SvgSaveResult` |
| `app:set-language` | renderer → main (`invoke`) | unchanged | unchanged |

`app/plotter-ipc.ts` exports `PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg'} as const`; the
preload script uses the same name through a type-only import, as for the other channels. Any
other channel is neither registered nor exposed. `e2e/boundary.spec.ts` expects the keys
`app`, `organs`, `plotter`, `tapes` on `window.crancula`.

## Payloads

```ts
interface SvgSaveRequest {
  readonly suggestedFileName: string; // plotterFileName(tape.name), e.g. "Waltz.svg"
  readonly svg: string;               // plotterSvg(tapeGeometry(tape, organ))
  readonly dialogTitle: string;       // TAPE.EXPORT.DIALOG_TITLE, translated
  readonly filterName: string;        // TAPE.EXPORT.FILTER_NAME, translated ("SVG file")
}

type SvgSaveResult =
  | { status: 'saved'; filePath: string }    // written; the absolute path the user chose
  | { status: 'cancelled' }                  // dialog cancelled; nothing written
  | { status: 'rejected'; reason: string }   // request failed validation; no dialog shown
  | { status: 'failed'; reason: string };    // writing failed; the OS error message
```

## Validation

`parseSvgSaveRequest(unknown): Result<SvgSaveRequest, string>` in `api/app/svg-save-request.ts`,
called by the main process before anything else. It rejects (with a reason naming the field):

| Field | Rule |
|-------|------|
| the payload | a plain object with exactly these four string fields |
| `suggestedFileName` | 5–255 characters, ends in `.svg` (any case), no `/`, `\`, `:` or control character, not only dots before `.svg` |
| `svg` | non-empty, at most 64 × 2²⁰ characters (a 10-minute Tape is about 1 MB), starts with `<?xml` and contains `<svg ` |
| `dialogTitle`, `filterName` | 1–200 characters, no control character |

`plotterFileName` always produces a name that passes; the parser is a second line against a
forged request, not a second sanitiser.

## Behaviour (`registerPlotterHandlers` in `app/plotter-ipc.ts`)

```ts
interface PlotterEffects {
  showSaveDialog(window: BrowserWindow | null, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  writeFile(filePath: string, text: string): Promise<void>;
  documentsFolder(): string;
}
function registerPlotterHandlers(ipcMain: IpcHandlerRegistry, effects: PlotterEffects): void;
```

1. Invalid request → `rejected`; no dialog.
2. Show the dialog modal to the sender's window (`BrowserWindow.fromWebContents(event.sender)`):
   - `title`: `dialogTitle`;
   - `defaultPath`: `join(lastFolder ?? documentsFolder(), basename(suggestedFileName))`;
   - `filters`: `[{name: filterName, extensions: ['svg']}]`;
   - `properties`: `['showOverwriteConfirmation', 'createDirectory']` (Windows and macOS ask
     before replacing by default; this makes Linux ask too).
3. `canceled` or no `filePath` → `cancelled`.
4. `writeFile(filePath, svg)` as UTF-8, replacing an existing file the user confirmed.
   Success → remember `dirname(filePath)` as `lastFolder` (memory only, until quit) → `saved`
   with `filePath`. Error → `failed` with the error's message; `lastFolder` unchanged.
5. Nothing in `userData` is read or written; no snapshot changes (FR-014).

`main.ts` wires the effects to Electron and Node: `showSaveDialog` calls
`dialog.showSaveDialog(...)` looked up **at call time** (so e2e tests can replace it with
`electronApp.evaluate`), `writeFile` is `fs.promises.writeFile(path, text, 'utf8')`, and
`documentsFolder` is `app.getPath('documents')`.

## In-memory stand-in

`createInMemoryCranculaApi` in `src/app/core/crancula-api.token.ts` gains a `plotter` part for the
browser dev server and component tests: it validates with `parseSvgSaveRequest`, records the last
request, and answers `saved` with `filePath: 'in-memory/<suggestedFileName>'`. The existing
`failures` option gains `plotter?: {saveSvg?: 'cancelled' | 'failed'}`.
