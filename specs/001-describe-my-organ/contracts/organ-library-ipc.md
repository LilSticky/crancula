# Contract: Organ library over IPC

This is the boundary between the renderer (Angular) and the main process (Electron), following
ADR 4. The types live in `api/` and are shared by both sides. The main process validates every
payload it receives.

## Renderer API (`window.crancula`, exposed by `app/preload.ts`)

```ts
interface CranculaApi {
  organs: {
    load(): Promise<OrganLibraryLoadResult>;
    save(snapshot: OrganLibrarySnapshot): Promise<OrganLibrarySaveResult>;
  };
}
```

## Channels (allow-list)

| Channel | Direction | Request | Reply |
|---------|-----------|---------|-------|
| `organs:load` | renderer → main (`invoke`) | none | `OrganLibraryLoadResult` |
| `organs:save` | renderer → main (`invoke`) | `OrganLibrarySnapshot` | `OrganLibrarySaveResult` |

Any other channel is neither registered nor exposed.

## Payloads

```ts
/** Snapshot file format, version 2 (amended 2026-10-15, #74). Stored at <userData>/snapshots/organs.json */
interface OrganLibrarySnapshot {
  version: 2;
  organs: OrganSnapshot[];
}

interface OrganSnapshot {
  id: string;
  name: string;
  tapeBed: { tapeWidth: number; holeDiameter: number; rowSpacing: number };
  minimumGap: number;
  pipes: { note: number }[]; // array order = row order
}

type OrganLibraryLoadResult =
  | { status: 'loaded'; snapshot: OrganLibrarySnapshot }      // file read and valid
  | { status: 'empty' }                                       // no file yet
  | { status: 'unreadable'; backupPath: string; reason: string }; // file moved aside, library starts empty

type OrganLibrarySaveResult =
  | { status: 'saved' }
  | { status: 'rejected'; reason: string }   // payload failed validation; nothing written
  | { status: 'failed'; reason: string };    // I/O error; previous file left intact
```

## Rules

- **Validating the snapshot:** `parseOrganLibrarySnapshot(unknown)` in `api/organ` checks the
  shape, unique ids, and that every Organ passes `validateOrgan`. Both the load
  and the save path use it. Version 2 is current. Version 1 (with a `border`) is still read: the
  `border` is ignored and the Organ is validated without it; saving always writes version 2
  (ADR 20). Other versions are rejected.
- **Unreadable file:** if the file is unreadable (bad JSON, failed validation, unknown version),
  the main process renames it to `organs.unreadable-<ISO timestamp>.json` in the same folder and
  never writes into it. The reply is `unreadable` with that path.
- **Saving:**
  - Saves are coalesced: only the latest pending snapshot is written, with about 250 ms trailing
    debounce.
  - Each write is atomic: written to `organs.json.tmp`, then renamed over the real file.
  - Pending writes are flushed on `before-quit`.
  - `save` resolves only after the coalesced write that contains this snapshot has finished.
- **Overriding the folder:** `CRANCULA_USER_DATA` overrides Electron's `userData` path, for tests.
