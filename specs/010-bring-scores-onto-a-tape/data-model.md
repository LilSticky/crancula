# Data Model: Bring Scores onto a tape

Phase 1 of [plan.md](plan.md). Domain types live in `api/` (pure TypeScript, ADR 2); names follow
[DICTIONARY.md](../../documentation/DICTIONARY.md). Words that are not terms (staff, voice, grace note,
ornament, tie, ending, measure) appear only inside `api/song/musicxml/`.

## Song (changed, `api/song/song.ts`)

| Field | Type | Rule |
|-------|------|------|
| `id`, `name`, `ticksPerQuarter`, `parts` | unchanged | |
| `timeSignatures` | `readonly TimeSignature[]` | sorted by `start`, starts distinct; empty when the Song Source gives none |
| `upbeat` | `Tick \| undefined` | > 0 and shorter than the first Time signature's Bar; only with a Time signature at Tick 0 |
| `keys` | `readonly Key[]` | sorted by `start`, starts distinct; empty when none |

`song(fields)` checks the new rules and returns `undefined` when one is broken. Songs stored before this
slice get `[]`, `undefined`, `[]` (FR-019).

### TimeSignature

| Field | Type | Rule |
|-------|------|------|
| `start` | `Tick` | the Tick where the Bar it starts in begins |
| `beats` | integer 1–99 | `3+2` is read as 5 |
| `beatType` | 1, 2, 4, 8, 16, 32 or 64 | |

### Key

| Field | Type | Rule |
|-------|------|------|
| `start` | `Tick` | |
| `fifths` | integer −7…7 | negative: flats, positive: sharps |
| `mode` | `'major' \| 'minor'` | |

### Bar (derived, not stored)

A Bar's length in Ticks is `beats × ticksPerQuarter × 4 / beatType`. Bars start at Tick 0 (or at `upbeat`
after a shorter first Bar) and restart at every Time signature's `start`. Nothing in this slice derives Bars
beyond the upbeat display; "Read a tape as Scores" will.

### SongMetre (derived, `api/song/song-metre.ts`)

`songMetre(song): { timeSignature?: {beats, beatType}; key?: {fifths, mode}; upbeat?: {numerator, denominator} }`:
the first of each, the upbeat as a reduced fraction of a whole note. Used for the read-only display (FR-020).

## Part (unchanged)

From Scores: one per staff with Notes, in part-list then staff order; `name` = part name, plus " n" when the
part has several staves; `percussion` when the staff has a percussion clef or only unpitched notes.

## SongReading (new, `api/song/read-song-source.ts`)

| Field | Type | Rule |
|-------|------|------|
| `song` | `Song` | |
| `leftOut` | `ReadonlyMap<PartIndex, LeftOut> \| undefined` | present only for a Song from Scores; one entry per Part |

### LeftOut

`{ graceNotes: number; ornaments: number }`, integers ≥ 0, counted in played-out order (research R8).

## SongRejection (changed)

`'too-large' | 'not-a-song-source' | 'pdf' | 'not-a-midi-file' | 'format-2' | 'not-timed-in-beats' |
'not-a-score' | 'damaged-archive' | 'no-score-in-archive' | 'no-notes'`

| Code | When |
|------|------|
| `too-large` | the file, or the Score inside an `.mxl`, is over 16 MiB |
| `not-a-song-source` | neither MIDI, zip, PDF nor XML by its first bytes |
| `pdf` | a PDF file (points to the how-to) |
| `not-a-midi-file`, `format-2`, `not-timed-in-beats` | as before (MIDI) |
| `not-a-score` | XML that is malformed or not `score-partwise`/`score-timewise` |
| `damaged-archive` | a zip that can't be read |
| `no-score-in-archive` | a zip without a rootfile or MusicXML entry |
| `no-notes` | no Part with Notes (MIDI or Scores) |

The existing size check in the import component moves into `readSongSource` (`too-large`).

## CreateTapeInput and ImportSummary (changed, `api/tape/`)

- `CreateTapeInput.leftOut?: ReadonlyMap<PartIndex, LeftOut>`
- `ImportSummary.leftOut?: LeftOut`: the sum over the selected Parts; absent for a Song from MIDI. Nothing
  else in `createTape` changes (FR-011, FR-020).

## MusicXML reader internals (`api/song/musicxml/`, not exported from `@api`)

- `XmlElement { name; attributes: ReadonlyMap<string,string>; children: readonly XmlElement[]; text }`
- `MeasureMarks { forwardRepeat; backwardRepeat?: {times}; endings?: {numbers, type}; segno; coda; toCoda; fine; daCapo; dalSegno }`
- `ScoreMeasure`: per part and written measure, the Notes with staff, written position and length,
  pitch or unpitched, tie start/stop, grace, ornament, arpeggiate flags; plus the divisions, transpose,
  Time signature, Key and staves in force there.

## Tape snapshot version 3 (`api/tape/tape-library-snapshot.ts`)

`SongSnapshot` gains three optional fields; everything else is unchanged.

```jsonc
{
  "version": 3,
  "songs": [{
    "id": "…", "name": "…", "ticksPerQuarter": 480, "parts": [ … ],
    "timeSignatures": [[0, 3, 4], [11520, 2, 4]],   // [start, beats, beatType]; omitted when empty
    "upbeat": 480,                                   // omitted when none
    "keys": [[0, 1, "major"]]                        // [start, fifths, mode]; omitted when empty
  }],
  "tapes": [ … ]
}
```

Reads versions 1, 2 and 3; writes 3 (ADR 20). A Song entry whose new fields break a rule makes the file
unreadable, as for any other broken field (ADR 8).
