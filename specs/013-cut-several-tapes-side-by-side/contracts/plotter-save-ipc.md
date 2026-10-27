# Contract: Saving the side-by-side cut over IPC (reused)

No new channel. The side-by-side cut is saved through the unchanged `plotter:save-svg` of
[spec 003](../../003-punch-a-tape/contracts/plotter-ipc.md) (ADR 21). Main never sees a Tape, Organ, Plotter
or Lane; the renderer never sends a path.

## Request (unchanged, `api/app/svg-save-request.ts`)

```ts
api.plotter.saveSvg({
  suggestedFileName: sideBySideFileName(firstTape.name, lanes.length, more), // e.g. "Reference and 1 more.svg"
  svg: sideBySideSvg(cut),
  dialogTitle: t('TAPE.EXPORT.DIALOG_TITLE'),
  filterName: t('TAPE.EXPORT.FILTER_NAME'),
});
```

`parseSvgSaveRequest` already accepts it: exactly these four fields; a safe `.svg` name of 5–255 characters;
an SVG starting with `<?xml` containing `<svg ` within 64 × 2²⁰ characters; labels 1–200 characters without
control characters. A test in `api/app/svg-save-request.spec.ts` is not needed; the side-by-side tests assert
that `sideBySideFileName` passes `isSafeFileName(…, 'svg')`.

## Result handling (`SideBySideExport`)

| Result | Shown |
|--------|-------|
| `saved` | snackbar `TAPE.EXPORT.SAVED` with the path |
| `cancelled` | nothing |
| `failed`, `rejected` | snackbar `TAPE.EXPORT.FAILED` with the reason, action Retry (saves the same cut again) |

## In-memory stand-in

Unchanged: records the last `saveSvg` request, which the component specs read.
