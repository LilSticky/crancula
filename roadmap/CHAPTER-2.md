# Chapter 2: MIDI Import

**Goal**: Upload a MIDI file, parse it, and represent it as a Song in the app.

## Prerequisites
- [ ] CHAPTER-1 complete (Organ model has tape-physics properties)
- [ ] Electron IPC/persistence infrastructure in place (preload, dialog handlers)

## Dependency Setup
- [ ] Install MIDI parsing library (`@tonejs/midi` or `midi-file`)
- [ ] Verify library works in Electron renderer (Node.js buffer support)

## Song Model (api/model/)
- [ ] Create `SongNote` model — pitch (MIDI number), startTime (seconds), duration (seconds), velocity, channel
- [ ] Create `Song` model — id, title, notes[], durationSeconds, sourceFormat ('midi'), sourceFileName, createdAt
- [ ] Create `SongMetadata` model — title, duration, noteCount, trackCount, tempo

## MIDI File Parser Service (src/app/core/services/midi/)
- [ ] Create `MidiParserService` class
- [ ] Implement `parseMidiFile(buffer: ArrayBuffer): Song` method
- [ ] Parse MIDI header: format type, track count, time division (ticks per quarter note)
- [ ] Parse tempo events (set-tempo meta events → BPM)
- [ ] Convert ticks to seconds using tempo and time division
- [ ] Parse note-on/note-off events → `SongNote[]` (pitch, start, duration, velocity)
- [ ] Merge note-on/note-off pairs into note-with-duration objects
- [ ] Extract song title from midi meta events (Track Name, Sequence/Track Name)
- [ ] Handle multiple tracks: flatten all tracks into a single note list with channel annotation
- [ ] Handle edge cases: overlapping same-pitch notes, velocity 0 as note-off
- [ ] Provide typed error/success result object

## MIDI File Import UI (Electron IPC)
- [ ] Create preload API: `openMidiFile()` → returns `{ filePath, fileName, buffer }` via IPC
- [ ] Register `ipcMain.handle('dialog:openMidi')` in `app/main.ts` using `dialog.showOpenDialog` with MIDI filter
- [ ] Read file content in main process, pass `Uint8Array` back to renderer
- [ ] Handle cancel (no file selected) gracefully
- [ ] Handle file read errors

## Song Feature Scaffold (src/app/features/song/)
- [ ] Create `song.routes.ts` with `/song` base path
- [ ] Create `SongPage` component — upload button + song list
- [ ] Create `SongDetailPage` — shows parsed song metadata + notes preview
- [ ] Create `SongStore` using `withSelectedEntityModule<Song>()` + persistence
- [ ] Wire routes into `src/app.routes.ts`
- [ ] Add navbar entry for Songs (i18n keys)

## Song Import UI
- [ ] Create `SongUploadComponent` — "Import MIDI" button that triggers IPC file dialog
- [ ] Show loading state during parse (handling large files)
- [ ] On success: navigate to song detail, show metadata (title, duration, track count, note count)
- [ ] On error: show user-friendly error message (invalid MIDI, unsupported format)
- [ ] Show parsed note table preview (pitch, time, duration)

## Song Persistence
- [ ] Create `SongStorage` implementing `DataStore<Song>` (localStorage during dev, IPC/JSON for Electron)
- [ ] Wire `SongStorage` into `SongStore`
- [ ] Verify songs survive page reload

## Song List View
- [ ] Create `SongListComponent` — Material table: title, duration, note count, source, created date
- [ ] Song row click navigates to song detail
- [ ] Delete song (with confirmation)
- [ ] Import another song button

## MIDI-to-Organ Pipe Mapping
- [ ] In song detail page, allow selecting an Organ for pipe mapping
- [ ] Show Organ pipe list alongside parsed MIDI notes
- [ ] Auto-map: match MIDI pitch to Organ pipe pitch (closest match or exact)
- [ ] Manual override: let user remap pipes via drag-drop or select
- [ ] Display unmapped notes/pipes for user attention
- [ ] Persist mapping as part of Song metadata

## Testing
- [ ] Unit tests for `MidiParserService` (parse simple MIDI, multi-track, edge cases)
- [ ] Test tick-to-second conversion with known tempo/BPM
- [ ] Test note-on/note-off pairing (simultaneous notes, velocity-0 as note-off)
- [ ] Test song metadata extraction
- [ ] Test pipe mapping logic
- [ ] Test `SongStore` CRUD
- [ ] E2E test: open MIDI file dialog → verify song appears in list

## Code Quality
- [ ] Run `npm run lint` — no new errors
- [ ] Run `npm run test` — all tests pass
- [ ] Manual test: import a real MIDI file and inspect parsed result
