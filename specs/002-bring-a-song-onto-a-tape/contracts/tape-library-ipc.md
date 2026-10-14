# Contract: Tape library over IPC

This extends the boundary of [slice 001](../../001-describe-my-organ/contracts/organ-library-ipc.md)
between the renderer (Angular) and the main process (Electron), following ADR 4. The types live in
`api/` and are shared by both sides. The main process validates every payload it receives. The
Organ channels are unchanged.

Bringing a Song onto a Tape needs **no** new channel: the renderer reads the MIDI file the user
picked (`File.arrayBuffer()`) and parses it itself (research R1, R10.6). The main process never
sees MIDI bytes or file paths.

## Renderer API (`window.crancula`, exposed by `app/preload.ts`)

```ts
interface CranculaApi {
  organs: { /* unchanged, slice 001 */ };
  tapes: {
    load(): Promise<TapeLibraryLoadResult>;
    save(snapshot: TapeLibrarySnapshot): Promise<TapeLibrarySaveResult>;
  };
  app: { /* unchanged */ };
}
```

`CranculaApi` moves from `api/organ/crancula-api.ts` to `api/app/crancula-api.ts` (research
R10.1); its import path through `@api/index` stays the same.

## Channels (allow-list)

| Channel | Direction | Request | Reply |
|---------|-----------|---------|-------|
| `organs:load` | renderer → main (`invoke`) | none | `OrganLibraryLoadResult` (001) |
| `organs:save` | renderer → main (`invoke`) | `OrganLibrarySnapshot` | `OrganLibrarySaveResult` (001) |
| `tapes:load` | renderer → main (`invoke`) | none | `TapeLibraryLoadResult` |
| `tapes:save` | renderer → main (`invoke`) | `TapeLibrarySnapshot` | `TapeLibrarySaveResult` |
| `app:set-language` | renderer → main (`invoke`) | `Language` | `SetLanguageResult` (unchanged) |

`app/tape-library-ipc.ts` exports `TAPE_LIBRARY_CHANNELS = {load: 'tapes:load', save:
'tapes:save'} as const`; the preload script uses the same names through a type-only import, as for
the Organ channels. Any other channel is neither registered nor exposed.

## Payloads

The snapshot format is in [tape-library-snapshot.md](tape-library-snapshot.md).

```ts
type TapeLibraryLoadResult =
  | { status: 'loaded'; snapshot: TapeLibrarySnapshot }          // file read and valid
  | { status: 'empty' }                                          // no file yet
  | { status: 'unreadable'; backupPath: string; reason: string }; // file moved aside, no Tapes in memory

type TapeLibrarySaveResult =
  | { status: 'saved' }
  | { status: 'rejected'; reason: string }   // payload failed validation; nothing written
  | { status: 'failed'; reason: string };    // I/O error; previous file left intact
```

The shapes equal the Organ results; an implementation may define them once as generic
`SnapshotLoadResult<S>` and `SnapshotSaveResult` and keep the named aliases.

## Rules

- **Validating the snapshot:** `parseTapeLibrarySnapshot(unknown)` in `api/tape` is used on both
  the load and the save path. It checks everything that doesn't need an Organ (see the snapshot
  contract). It never checks Organ-relative rules, so it works while `organs.json` is unreadable
  (FR-023).
- **Unreadable file:** bad JSON, failed validation or an unknown `version` → the main process
  renames the file to `tapes.unreadable-<ISO timestamp>.json` in the same folder and never writes
  into it (FR-023, SC-007). The reply is `unreadable` with that path. The Organs are loaded
  independently and stay usable.
- **Saving:** exactly as `organs:save` (ADR 8): coalesced with about 250 ms trailing debounce, one
  write at a time, atomic (`tapes.json.tmp`, then rename), and `save` resolves after the write
  that contains this snapshot has finished. The shared code lives in `app/snapshot-file.ts`
  (research R10.4).
- **Quit:** `before-quit` flushes the Organ file and the Tape file, then quits.
- **Cascades:** the renderer writes Tapes before Organs (research R7, R10.3). The main process
  doesn't know about cascades; each channel saves its own file.
- **Overriding the folder:** `CRANCULA_USER_DATA` overrides Electron's `userData` path, for tests
  (unchanged).

## In-memory stand-in

`createInMemoryCranculaApi` in `src/app/core/crancula-api.token.ts` gains a `tapes` part with the
same behaviour as its `organs` part, and an optional initial Tape snapshot, for the browser dev
server and component tests.
