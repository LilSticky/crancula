# Contract: Saving Scores over IPC

One new allow-listed channel ([ADR 29](../../../documentation/adr/0029-own-musicxml-writer-in-the-domain.md),
research R13), modelled on `plotter:save-svg` ([spec 003](../../003-punch-a-tape/contracts/plotter-ipc.md)).
The renderer builds the MusicXML and the file name; main shows the save dialog and writes. Main never
receives a Tape, an Organ, a Song or a path.

## Renderer API (`api/app/crancula-api.ts`)

```ts
readonly scores: {
  /** Shows the save dialog and writes `request.musicXml` where the user chooses. */
  save(request: ScoresSaveRequest): Promise<ScoresSaveResult>;
};
```

## Channel

| Channel | Request | Reply |
|---------|---------|-------|
| `scores:save` | `ScoresSaveRequest` | `ScoresSaveResult` |

`SCORES_CHANNELS = {save: 'scores:save'} as const` in `app/scores-ipc.ts`; `preload.ts` exposes
`scores.save` with the same name. `e2e/boundary.spec.ts` lists `scores` among the API keys.

## Payloads (`api/app/scores-save-request.ts`)

```ts
interface ScoresSaveRequest {
  readonly suggestedFileName: string; // scoresFileName(tape.name), e.g. "Waltz.musicxml"
  readonly musicXml: string;          // scoresMusicXml(...)
  readonly dialogTitle: string;       // TAPE.SCORES.DIALOG_TITLE ("Export as Scores")
  readonly filterName: string;        // TAPE.SCORES.FILTER_NAME ("MusicXML file")
}

type ScoresSaveResult =
  | {readonly status: 'saved'; readonly filePath: string}
  | {readonly status: 'cancelled'}
  | {readonly status: 'rejected'; readonly reason: string}
  | {readonly status: 'failed'; readonly reason: string}; // OS error code, e.g. EACCES
```

`parseScoresSaveRequest(input: unknown): Result<ScoresSaveRequest, string>` rejects:

- anything but an object with exactly these four string fields;
- a file name that fails `isSafeFileName(name, 'musicxml')` (5–255 characters, a stem, no forbidden
  character, no Windows device name, ends in `.musicxml`, case-insensitive);
- a text longer than `MAXIMUM_SVG_LENGTH` (64 × 2²⁰ characters, renamed `MAXIMUM_DOCUMENT_LENGTH` and shared)
  or that does not start with `<?xml` and contain `<score-partwise`;
- a label that fails `isLabel` (1–200 characters, no control characters).

## Main process (`app/scores-ipc.ts`)

`registerScoresHandlers(ipcMain, effects, windowOf)` with `ScoresEffects = {showSaveDialog, writeFile,
documentsFolder}` (fakes in tests; Electron and `fs.writeFile` UTF-8 in `main.ts`, looked up at call time so
Playwright can stub `dialog.showSaveDialog`).

1. Parse; on failure reply `rejected` without a dialog.
2. No window: `rejected`.
3. `showSaveDialog` with `title`, `defaultPath` = last folder of this channel (else Documents) joined with
   the base name of `suggestedFileName`, `filters: [{name: filterName, extensions: ['musicxml']}]`,
   `properties: ['showOverwriteConfirmation', 'createDirectory']`.
4. Cancelled or no path: `cancelled`.
5. Write; on error log it and reply `failed` with the error code; nothing else changes.
6. Remember the folder; reply `saved` with the path.

## Tests

- `api/app/scores-save-request.spec.ts`: every rejection above and one valid request.
- `app/scores-ipc.spec.ts`: rejected payload shows no dialog; cancel writes nothing; saved writes the exact
  text to the chosen path; failure returns the code; second save starts in the last folder.
- `e2e/read-a-tape-as-scores.spec.ts`: stubbed save dialog, the file written has the expected content.
