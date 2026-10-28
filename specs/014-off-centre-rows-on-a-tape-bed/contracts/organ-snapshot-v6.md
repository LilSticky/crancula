# Contract: Organ library snapshot version 6

File: `<userData>/snapshots/organs.json` (ADR 8, ADR 20). Same as version 5 except:

```jsonc
{
  "version": 6,
  "organs": [{
    "tapeBed": {"tapeWidth": 110, "holeDiameter": 3, "rowSpacing": 3.85, "guideMargin": 10}
    // guideMargin absent when the rows are centred
  }]
}
```

- Reading versions 1–5: no Guide margin (centred); a `guideMargin` key there is ignored.
- Reading version 6: `guideMargin`, when present, must be a number and pass `validateOrgan`; otherwise the whole
  snapshot is refused, as for every other Organ value.
- Writing: always version 6; `guideMargin` only when the Organ has one.
- IPC: unchanged channels; the payload is the snapshot and is parsed with `parseOrganLibrarySnapshot`.
