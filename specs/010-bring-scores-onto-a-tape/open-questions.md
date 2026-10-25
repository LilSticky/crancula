# Open questions: Bring Scores onto a tape

Clarify scan of [spec.md](spec.md), 2026-10-25. Each question changes the spec; its spot is marked there with
`[NEEDS CLARIFICATION: Qn …]`. The recommendation is listed first. Questions that belong in the plan (reading
and unzipping MusicXML, libraries, where the reader lives, snapshot version step) are left out.

Coverage of the scan: functional scope, domain and data model, interaction flow, edge cases, terminology and
completion signals are clear apart from the five below; non-functional quality (size limit, performance) has
reasonable defaults in the Assumptions and Success Criteria.

## Q1. Repeats after a da capo or dal segno jump

Spec: Story 2 scenario 6, FR-007. In printed music, repeat signs are usually not taken again on the pass after
"D.C." or "D.S." unless the Score says so ("con ripetizione"), but MusicXML from recognition tools rarely marks
this.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | Skipped on the second pass, as most musicians read it; first and second endings then take the last ending | The usual reading of barrel organ tunes; the Tape is shorter. A Score that wants the repeats again has to be written out in the notation program |
| B | Taken again on the second pass | Every repeat plays every time; Tapes get longer, often longer than the tune is played |
| C | Asked at import when the Score has a da capo or dal segno | Always right, but one more choice on the import screen |

## Q2. A Key change in the middle of the Song

Spec: FR-018, Edge Cases. Decision 18 says "the Key"; Time signatures keep every change.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | Every Key change is kept at its Tick, like Time signatures | "Read a tape as Scores" can write the right sharps and flats after a modulation; the dictionary entry says "Keys" in the plural |
| B | Only the first Key | Smaller; later Scores show accidentals after a modulation instead of a new key signature |

## Q3. Are Time signature and Key shown in this slice?

Spec: Story 4, FR-020. They don't change the Tape; they are kept for "Read a tape as Scores".

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | Shown read-only: the first Time signature and Key next to the Song on the import screen and in the Tape view's Tape details, e.g. "3/4, G major, upbeat 1/4" | The owner sees that they were read (useful to spot a recognition error); a few texts in both languages; Story 4 can be tested in the app |
| B | Not shown; kept only for later | Smallest; Story 4 is tested on the stored Song only, and a wrong Time signature is noticed only at "Read a tape as Scores" |
| C | Shown with every change (a list of Time signatures and Keys with their Bar number) | Complete, but takes room on the import screen for information the Tape doesn't use |

## Q4. A MIDI file without a time signature event

Spec: Edge Cases. The MIDI standard says such a file is in 4/4; many MIDI files rely on it.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | The Song keeps no Time signature | The Song keeps only what its Song Source says; "Read a tape as Scores" prefills 4/4 anyway (decision 27), so the owner is asked and sees it |
| B | The Song keeps 4/4 from its first Tick, as the MIDI standard says | Follows the standard; but a MIDI file that is really in 3/4 and has no event is then kept as 4/4 without anyone noticing |

## Q5. Where does the how-to for PDF and printed Scores live?

Spec: Story 5, FR-021. Decision 7 left "README or import screen" open.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | A one-line hint on the import screen that opens a short how-to in the app (a dialog, English and German) | Found where it is needed, works offline, translated; the how-to text is maintained in both languages |
| B | A one-line hint on the import screen with a link to a how-to section in the README | Less to translate; opens the browser and needs a connection; English only |
| C | Only in the README | Smallest; owners who don't read the README won't find it |

## Answers (user, 2026-10-25)

All answered with the recommended option: Q1 A (repeats skipped after D.C./D.S.), Q2 A (every Key change kept), Q3 A (first Time signature and Key shown read-only), Q4 A (MIDI without a time signature event: none kept), Q5 A (in-app how-to dialog).

Folded into spec.md (Clarifications, Session 2026-10-25); no [NEEDS CLARIFICATION] markers remain.
