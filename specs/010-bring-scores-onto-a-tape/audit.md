# Audit: Bring Scores onto a tape

Reviews of T061 (2026-10-26): `angular-reviewer` (src/), `spec-auditor`, `domain-modeler`. No `electron-reviewer`:
`app/` changed only in `app/tape-library-file.spec.ts` (snapshot version), no new IPC channel.

Each finding has an ID; the fix tasks name them. Status: open until ticked.

## Domain (api/song/musicxml)

- [x] D1 Ties break in chords: `lay-out.ts` `addNote` keeps one `waiting` slot per staff, so of a tied chord (C and
  E tie start) only one Note joins. Keep waiting tied Notes per staff **and note number**. Test a tied two-Note chord.
- [x] D2 Ties break with two voices on one staff: voice 2's Notes clear voice 1's waiting tie. Same fix as D1; test a
  tie over the bar line in voice 1 while voice 2 has Notes in the same measure.
- [x] D3 SC-003: an unpitched Note with neither `<midi-unpitched>` nor a display pitch is skipped silently.
  Decision (orchestrator): it takes E4 (MIDI 64, the middle line of the five-line staff) and stays in its percussion
  Part; record in research.md R8.
- [x] D4 A Note with an ornament and an arpeggiate counts as two ornaments; FR-012 / US3.4–3.5: one per Note (an
  arpeggiated chord counts once). Test the combination.
- [x] D5 The played order comes from the first part in part-list order, the Time signatures, Keys and upbeat from the
  first part in document order. Use the same lead part (part-list order) for both; test a Score whose document order
  differs from its part-list order.
- [x] D6 (already right; test added) Upbeat only when the lead measure 1 writes `<time>`: check that the Time signature in force is used, so a
  short first measure is an upbeat whenever a Time signature is in force at Tick 0 (FR-017). Test it.
- [x] D7 `SongMetre` drops the domain rules (`fifths: number`, `beats: number`): reuse the `Key` and `TimeSignature`
  field types (`Pick<…>`) and type Key fifths as a −7…7 union in `api/song/song.ts`, so `tonicKey()` cannot build a key
  that does not exist (ADR 2).
- [x] D8 Wording: `api/song/song-metre.ts:22` "a part the Song does not keep" → "whatever the Song does not keep";
  `api/song/song.ts:32` Part doc "one voice" → "one staff or instrument" (dictionary, user decision 2026-10-26).

## UI (src/)

- [ ] U1 `tape-import.component.ts:261`: the size guard is gone, so `file.arrayBuffer()` reads a file of any size.
  Export the limit from `api/song/read-song-source.ts`; return `too-large` from `file.size` before reading.
- [ ] U2 `tape-view.component.html:188`: `cranc-song-metre` sits loose in the side panel. Spec US4: in the Tape
  details. Pass the metre into `TapeSectionComponent` and show it there as a labelled row (new en/de key, label
  "Metre" / "Takt und Tonart").
- [ ] U3 `tape-import.component.html:33`: two keys joined with a hard-coded `". "`. Make it one key.
- [ ] U4 `song-metre.component.ts:17`: one-line template, hard-coded `", "`, a method called from the template. Use a
  `computed` list rendered with `@for`.
- [ ] U5 `tape-import.component.scss:61`: `cranc-song-metre:not(:empty)` styles the child from the parent. Give the
  component its own spacing when shown.
- [ ] U6 en/de `NOT_A_MIDI_FILE` still says "or larger than 16 MiB"; `too-large` covers that. Drop the clause.
- [ ] U7 de.json: "Notendatei" is not a dictionary word; use "komprimierte MusicXML-Noten" (or similar with Noten).
- [ ] U8 `score-how-to-dialog.component.ts:15`: use `mat-dialog-close` on the button, drop `dialogRef` and `close()`.
- [ ] U9 `e2e/score-import.spec.ts:54` prose: "an implicit first measure … then a full Bar" → "a first Bar of one
  quarter (the upbeat)".

## Dictionary (user decisions, 2026-10-26)

- [x] W1 New term **Metre**: a Song's first Time signature, Key and upbeat, shown read-only next to it; German
  "Takt und Tonart".
- [x] W2 **Part**: "One staff or instrument" instead of "One voice or instrument".
- [x] W3 **Scores**: the singular "Score" names one Song Source in MusicXML (German: Noten). **Import Summary**:
  German "Vorschlagsnoten", "Verzierungen", "weggelassen".

## Accepted

- The PDF hint shows only until a Song is chosen or a rejection shows (Song sheet overflowed at 1280×800 otherwise).
- A sounding pitch outside MIDI 0–127 folds by octaves (research.md).
- `unzipScore` trusts the declared uncompressed size (R3); a lying header could inflate past 16 MiB. The file is the
  owner's own; not fixed.
- Rejections in German are covered by key-parity tests and one e2e rejection, not one e2e per code.
- SC-004 (real MuseScore/Audiveris files) is T063, by hand. SC-005/SC-007 are covered by the synthetic 16-staff test.
