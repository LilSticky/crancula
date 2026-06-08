# Chapter 3: Tape Model & Song↔Tape Conversion

**Goal**: Define the Tape data model and implement bidirectional conversion between Song and Tape.

## Prerequisites
- [ ] CHAPTER-1 complete (Organ has tape-physics properties: tapeWidthMm, holeDiameterMm, rowsPerInch, etc.)
- [ ] CHAPTER-2 complete (Song model + MIDI parser exist)

## Tape Domain Model (api/model/)
- [ ] Create `Hole` model — pipeIndex (number), startColumn (number), length (number in columns)
- [ ] Create `Tape` model:
  - `id`: string
  - `organId`: string (reference to Organ)
  - `songId`: string (reference to Song)
  - `name`: string (auto-generated or user-defined)
  - `holes`: Hole[] (flat list of all holes)
  - `columnCount`: number (total time units)
  - `rowCount`: number (pipe count — derived from Organ)
  - `createdAt`: Date
  - `updatedAt`: Date
- [ ] Add `TapeSettings` model (snapshot of Organ's tape settings at conversion time — allows independent tweaking):
  - `tapeWidthMm`: number
  - `holeDiameterMm`: number
  - `rowsPerInch`: number
  - `feedPerRevolutionMm`: number
  - `sprocketHoleSpacingMm`: number

## Grid Resolution Strategy
- [ ] Decide time quantization: columns per beat (e.g. 12 columns = 12th notes, or configurable)
- [ ] Implement time quantization function: `quantizeTime(seconds, ticksPerQuarter, columnsPerBeat) → columnIndex`
- [ ] Handle triplets, dotted notes within quantization resolution
- [ ] Handle very short notes (grace notes, flams) — minimum hole length = 1 column

## Conversion Service (Song → Tape)
- [ ] Create `TapeConversionService`
- [ ] Implement `songToTape(song: Song, organ: Organ, settings?: ConversionSettings): Tape`
- [ ] Steps for each note in song:
  - [ ] Determine which pipe row the note maps to (pitch → pipe index lookup)
  - [ ] Quantize note start time → start column
  - [ ] Quantize note duration → length in columns
  - [ ] Create `Hole` at (pipeIndex, startColumn, length)
  - [ ] Handle overlapping holes on same pipe (extend existing hole or create separate)
- [ ] Strategy for overlapping same-pipe notes:
  - [ ] Option A: Merge overlapping → extend the hole (legato behavior)
  - [ ] Option B: Keep as separate holes with gap (staccato behavior)
  - [ ] Make strategy configurable via `ConversionSettings`
- [ ] Build polymetric handling: notes from different MIDI channels may map to same pipe
- [ ] Handle notes with pitch not found in any pipe → log warning, skip note
- [ ] Compute `columnCount` from song duration + quantization

## Conversion Service (Tape → Song)
- [ ] Implement `tapeToSong(tape: Tape, organ: Organ): Song`
- [ ] For each hole: map pipe index back to MIDI pitch via Organ pipes
- [ ] Convert start column → time in seconds (reverse quantization)
- [ ] Convert hole length → duration in seconds
- [ ] Handle gaps between holes on same pipe → separate notes
- [ ] Handle consecutive holes on same pipe → one continuous note or multiple (preserve intent)
- [ ] Produce `SongNote[]` with reconstructed timing

## Tape Settings & Geometry
- [ ] Implement `TapeGeometryService` — computes physical dimensions:
  - [ ] Physical tape length (columns × feedPerRevolutionMm / columnsPerRevolution)
  - [ ] Physical row spacing (25.4 / rowsPerInch)
  - [ ] Physical hole positions (mm from tape edge, mm from start)
  - [ ] Sprocket hole positions (along one or both edges)
- [ ] Store computed geometry on Tape model (optional cache)

## Tape Persistence
- [ ] Create `TapeStorage` implementing `DataStore<Tape>`
- [ ] Create `TapeStore` using `withSelectedEntityModule<Tape>()` + persistence
- [ ] Wire into routes: `/tape` list, `/tape/:id` detail

## Tape List UI (src/app/features/tape/)
- [ ] Create `tape.routes.ts` — `/tape` and `/tape/:id`
- [ ] Create `TapesPage` — list all tapes with Material table
  - Columns: name, organ name, song name, hole count, created date
- [ ] Create `TapeDetailPage` — tape summary + actions (edit, export, delete)
- [ ] Create `TapeStore` following pattern from OrganStore
- [ ] Wire routes into `src/app.routes.ts`
- [ ] Add navbar entry for Tapes

## Conversion UI
- [ ] Create "Convert to Tape" button on song detail page
- [ ] Show conversion settings dialog:
  - [ ] Select target Organ (dropdown)
  - [ ] Columns per beat / quantization resolution
  - [ ] Overlap handling strategy (merge or separate)
- [ ] Show conversion progress (for large songs, show "Converting..." spinner)
- [ ] On success: navigate to new Tape detail, show summary (dimensions, hole count)
- [ ] Show "Convert to Song" button on tape detail page (reverse conversion)

## Validation & Edge Cases
- [ ] Validate: Song has at least one note
- [ ] Validate: Organ has at least one pipe
- [ ] Validate: All notes can be mapped to a pipe (warn if not)
- [ ] Handle empty conversion result (no valid holes)
- [ ] Handle extremely large songs (memory/performance considerations)
- [ ] Handle variable tempo MIDI files (tempo map → time quantization)

## Testing
- [ ] Unit tests for `Hole` model construction
- [ ] Unit tests for `Tape` model construction
- [ ] Unit tests for time quantization (normal notes, triplets, dotted notes)
- [ ] Unit tests for `songToTape` — simple song, polyphonic song, overlapping notes
- [ ] Unit tests for `tapeToSong` — round-trip fidelity
- [ ] Unit tests for pipe pitch lookup (exact match, closest match, no match)
- [ ] Unit tests for `TapeGeometryService` computations
- [ ] Integration test: parse MIDI (Ch.2) → convert to tape → convert back → verify note counts
- [ ] Unit tests for `TapeStore`

## Code Quality
- [ ] Run `npm run lint` — no new errors
- [ ] Run `npm run test` — all tests pass
- [ ] Manual test: convert imported MIDI song to tape, inspect hole grid data
