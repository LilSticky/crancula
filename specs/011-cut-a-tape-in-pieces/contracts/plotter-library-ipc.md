# Contract: The Plotter library over IPC

Follows the Organ and Tape libraries ([slice 001](../../001-describe-my-organ/), [ADR 18](../../../documentation/adr/0018-tape-snapshot-and-cascade-order.md)):
one snapshot file per aggregate, two allow-listed channels, the payload validated in main (ADR 4).

## Renderer API (`window.crancula`)

```ts
interface CranculaApi {
  // organs, tapes, plotter, recording, app, edit: unchanged except plotter.savePieces (tape-pieces-ipc.md)
  readonly plotters: {
    load(): Promise<PlotterLibraryLoadResult>;   // SnapshotLoadResult<PlotterLibrarySnapshot>
    save(snapshot: PlotterLibrarySnapshot): Promise<PlotterLibrarySaveResult>; // SnapshotSaveResult
  };
}
```

`e2e/boundary.spec.ts` then expects the keys `app`, `edit`, `organs`, `plotter`, `plotters`, `recording`,
`tapes`.

## Channels

| Channel | Request | Reply |
|---------|---------|-------|
| `plotters:load` | none | `PlotterLibraryLoadResult` |
| `plotters:save` | `PlotterLibrarySnapshot` | `PlotterLibrarySaveResult` |

`app/plotter-library-ipc.ts` exports `PLOTTER_LIBRARY_CHANNELS = {load: 'plotters:load', save: 'plotters:save'} as const`;
the preload uses the same names through a type-only import.

## File

`app/plotter-library-file.ts`: `createSnapshotFile(dir, {fileName: 'plotters.json', parse: parsePlotterLibrarySnapshot, normalise: toPlotterSnapshot})`
in `<userData>/snapshots/`. Same behaviour as the other files (ADR 8): atomic, debounced write; an unreadable
file is moved to `plotters.unreadable-<timestamp>.json` and the library starts empty with a load problem
shown on the Plotter list; flushed in `before-quit` with the Organ and Tape files.

## Format (version 1)

See [data-model.md](../data-model.md#plotter-library-snapshot-new-apiplotterplotter-library-snapshotts).
Example:

```json
{
  "version": 1,
  "plotters": [
    {"id": "…uuid…", "name": "Cutting mat", "format": "svg", "workingWidth": 120, "roll": false, "workingLength": 300, "overlap": 20},
    {"id": "…uuid…", "name": "Vinyl cutter", "format": "svg", "workingWidth": 120, "roll": true}
  ]
}
```

Later versions migrate on read and write the newest (ADR 20).

## In-memory stand-in

`createInMemoryCranculaApi` gains a fourth optional initial `PlotterLibrarySnapshot` (passed as an options
field to keep the call sites readable) and `plotters.load/save` that validate with
`parsePlotterLibrarySnapshot`.
