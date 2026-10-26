# Contract: Tape library snapshot, version 3

The `tapes:load` and `tapes:save` IPC payloads and `<userData>/snapshots/tapes.json` carry the
Tape library snapshot (ADR 8, ADR 18). No channel is added or changed; only the payload's Song entries grow.

- `version`: `3`. The main process and the renderer parse it with `parseTapeLibrarySnapshot` from `@api`
  (ADR 4); versions 1, 2 and 3 are read, version 3 is written (ADR 20). A higher version is unreadable (ADR 8).
- `songs[]` (`SongSnapshot`): as version 2, plus, each omitted when the Song keeps none:
  - `timeSignatures`: `[start, beats, beatType][]`, starts strictly increasing, `beats` 1–99, `beatType` a
    power of two 1–64;
  - `upbeat`: integer Tick > 0, shorter than the first Bar, only with a Time signature at Tick 0;
  - `keys`: `[start, fifths, mode][]`, starts strictly increasing, `fifths` −7…7, `mode` `"major"` or `"minor"`.
- `tapes[]`: unchanged from version 2.
- A version 1 or 2 file loads with every Song keeping no Time signature, no upbeat and no Key; the next save
  writes version 3. The CHANGELOG says that an older app can't read the file after that save.

Field rules and an example: [data-model.md](../data-model.md#tape-snapshot-version-3).
