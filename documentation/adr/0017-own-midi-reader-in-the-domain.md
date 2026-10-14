# 17. Own MIDI reader in the domain

Date: 2026-10-14

## Status

Accepted

## Context

[ADR 5](0005-midi-in-svg-out-first.md) makes MIDI the first Song Source and leaves the choice of
a MIDI parser library to the slice "Bring a song onto a tape", naming `@tonejs/midi` as the
candidate. That slice's spec needs a Part per MIDI track and channel, no Note lost silently
(SC-003), explicit rejection of format 2 and time-code files (FR-002), and typed reasons instead
of exceptions.

Research R1 of slice 002 checked the candidates (2026-10-14):
- `@tonejs/midi` 2.0.28 (last release 2022) splits tracks by program change too, silently drops
  never-released notes, yields NaN times for time-code files instead of rejecting them, and pairs
  repeated same-pitch notes so that a repetition can be merged away.
- `midi-file` 1.2.4 is a plain event parser that is acceptable, but it throws strings, doesn't
  bounds-check truncated data, and has loose types. We would still write all the Note and Part
  logic ourselves.

The subset of Standard MIDI Files (SMF) we need is small and has been stable since 1988. A MIDI
file the user picks is untrusted input.

## Decision

We will read MIDI Song Sources with our own Standard MIDI File reader, written in pure
TypeScript in the domain:
- `readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, SongRejection>` lives in
  `api/song/midi/`, as an adapter that depends on the Song model in `api/song/`, never the reverse
  (ADR 2).
- It supports formats 0 and 1 with Ticks per quarter note, running status, note-on with
  velocity 0 as note-off, and names from Sequence/Track Name events. It skips every other event
  and unknown chunks by their length.
- It never throws. Every read is bounds-checked, and files over 16 MiB are rejected.
  Rejections are `not-a-midi-file`, `format-2`, `not-timed-in-beats` and `no-notes`.
- It runs in the renderer on the bytes of a file the user picked through an HTML file input.
  No IPC channel and no main-process file access are added (ADR 4).

## Consequences

- No new runtime dependency, no licence question, and nothing extra in the renderer bundle. The
  domain stays framework-free.
- We own about 200 lines of byte parsing plus their tests. Test fixtures are SMF bytes built by a
  test helper, so no third-party MIDI files enter the repository.
- The reader implements exactly the spec's rules for Parts, re-triggered notes and
  never-released notes. Changing those rules means changing our code, not working around a
  library.
- MIDI features we don't read (tempo, velocity, programs, SMPTE timing) stay unsupported until a
  slice needs them. Format 2 and time-code files are rejected.
- Playwright feeds the file input with `setInputFiles`, so e2e tests need no native dialog
  mocking. A native open dialog later would only deliver bytes; parsing stays in the domain.
