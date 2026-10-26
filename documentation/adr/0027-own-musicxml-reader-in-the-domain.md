# 27. Own MusicXML reader in the domain, `.mxl` unzipped with fflate

Date: 2026-10-25

## Status

Accepted

## Context

Bring Scores onto a tape (#167) adds MusicXML as a second Song Source: `.musicxml`/`.xml` and the compressed
`.mxl` (a zip with a container file), from MuseScore and from music recognition tools such as Audiveris.
Repeats, endings, da capo and dal segno are played out into one straight Song at import, ties are joined in
played-out order, grace notes and ornaments are left out and counted. ADR 17 reads MIDI with our own reader
in the domain, on the bytes of the file the owner picked in the renderer. Domain tests run in node (ADR 7),
where `DOMParser` doesn't exist. MusicXML files declare an external DTD; a file the owner picks is untrusted
input. Details: `specs/010-bring-scores-onto-a-tape/research.md` (R1–R7).

## Decision

- We will read MusicXML in the domain, in `api/song/musicxml/`, as an adapter on bytes that depends on the
  Song model, never the reverse (ADR 2). It runs in the renderer like the MIDI reader; no IPC is added.
- We will parse XML with our own small non-validating reader that builds a plain element tree. It never
  resolves the DTD or any entity besides the predefined and numeric ones, and it never throws to its caller.
- We will unzip `.mxl` with `fflate` 0.8.3 (MIT), inflating only the Score named by the container, and only
  if its declared size is within the 16 MiB limit.
- One entry point, `readSongSource(bytes, fileName)`, recognises MIDI, zip, PDF and XML by their first bytes
  and returns the Song, the per-Part counts of grace notes and ornaments left out (Scores only), or a typed
  rejection.
- Playing out repeats is a pure function over per-measure marks, independent of XML.

## Consequences

- One small runtime dependency for deflate; everything MusicXML-specific is our code and our tests. Test
  fixtures are MusicXML strings built in code, so no third-party Scores enter the repository.
- External entity and entity-expansion attacks are impossible by construction; zip bombs are stopped before
  inflating.
- The reader understands the part of MusicXML the spec needs (notes, chords, voices, staves, backup/forward,
  ties, grace, ornaments, transpose, time, key, repeats, endings, jump and marker sounds and words) and
  ignores the rest. Recognition tools that write jumps only as text are covered by a short word list; other
  spellings are not recognised and play straight through.
- Rejected: `DOMParser` (not in node tests, splits the reader), `fast-xml-parser` (large option surface,
  entity history, still needs mapping), `jszip` (async, larger), `DecompressionStream` with our own zip
  directory reader (async, more binary parsing to own).
