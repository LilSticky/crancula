# Contract: The MusicXML file

What `scoresMusicXml` writes ([data-model.md](../data-model.md), research R1–R10). This is the external
interface the notation program reads (FR-003). MusicXML 4.0, `score-partwise`, uncompressed, UTF-8.

## Document

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>{Tape name, XML-escaped}</work-title></work>
  <identification><encoding><software>Crancula</software></encoding></identification>
  <part-list>
    <score-part id="P1"><part-name/></score-part>
  </part-list>
  <part id="P1">
    <measure number="0" implicit="yes">…</measure>   <!-- only with an upbeat -->
    <measure number="1">…</measure>
    …
  </part>
</score-partwise>
```

One part for the Organ; its staves are the staves of the export (FR-005). No other parts, names, dynamics,
lyrics, beams or layout (spec "No other markings", research R10).

## First measure

```xml
<attributes>
  <divisions>8</divisions>                    <!-- one Column per division -->
  <key><fifths>1</fifths><mode>major</mode></key>
  <time><beats>3</beats><beat-type>4</beat-type></time>
  <staves>2</staves>                          <!-- left out with one staff -->
  <clef number="1"><sign>G</sign><line>2</line></clef>
  <clef number="2"><sign>F</sign><line>4</line></clef>
</attributes>
<direction placement="above">                 <!-- left out without Tape per Crank turn -->
  <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>150</per-minute></metronome></direction-type>
  <staff>1</staff>
  <sound tempo="150"/>
</direction>
```

Octave clefs add `<clef-octave-change>1</clef-octave-change>` (treble 8va) or `-1` (bass 8vb). A later
measure repeats `<attributes>` with only what changes: `<key>` from the Bar a Key starts in, `<time>` where
the Time signature changes. Pitches are always the true pitch (FR-007).

## Measure body

For each staff from the top, for each voice written in that Bar (voice 1 always; 2–4 only with a note in the
Bar), the voice's notes and rests in time order, each stream followed by
`<backup><duration>{Bar length}</duration></backup>` except the last of the measure.

```xml
<note>
  <pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>
  <duration>6</duration>
  <tie type="start"/>
  <voice>1</voice>              <!-- (staff − 1) × 4 + voice -->
  <type>eighth</type><dot/>
  <stem>up</stem>               <!-- only in a Bar with more than one voice on the staff -->
  <staff>1</staff>              <!-- left out with one staff -->
  <notations><tied type="start"/></notations>
</note>
<note>
  <chord/>                      <!-- every further pitch of a chord -->
  <pitch>…</pitch> …
</note>
<note>
  <rest/><duration>2</duration><voice>1</voice><type>16th</type><staff>1</staff>
</note>
<note>
  <rest measure="yes"/><duration>24</duration><voice>1</voice><staff>2</staff>   <!-- whole-bar rest, no type -->
</note>
```

- `<alter>` only when not 0. No `<accidental>`.
- A tied note's middle pieces carry `<tie type="stop"/><tie type="start"/>` and the same `<tied>` pair.
- Every voice stream of a measure adds up to its Bar's length exactly (SC-002).

## Invariants (tested)

| Invariant | Test |
|-----------|------|
| Each measure's every voice stream sums to the Bar length | sum on the parsed text (`parseXml`) |
| Read back with `readScoreSong`, each staff is a Part whose Notes equal the staff's `ScoresNote`s (ties joined) | round trip |
| Time signatures, upbeat and Key read back as written | round trip |
| Same input, same text, byte for byte | determinism |
| The Tape, Song and Organ are deep-equal before and after | FR-017, SC-006 |
| The reference Tape gives `api/scores/scores.reference.musicxml` | golden file |
