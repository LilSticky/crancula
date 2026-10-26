# Open questions: Read a tape as Scores

Clarify scan of [spec.md](spec.md), 2026-10-25. Decisions 13–14 and 25–28 and the confirmed rules are
already in the spec's Clarifications; these are the questions left that change the spec. Each is
marked in the spec as `[NEEDS CLARIFICATION: Qn]`. The first option is the recommendation. Plan-level
questions (file layout, upbeat entry widget, beaming, note order inside a tie) are left to the plan.

## Q1. How does the user pick the Pipe ranges of the staves?

Where: Story 3 scenario 1, FR-005. Decision 26 says "one staff per range of Pipes"; it doesn't say
whether a range is by pitch or by row, nor what the dialog starts with. An Organ's Pipes can be in any
row order (Pipes can be reordered), so the two differ.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | By pitch, with split notes: each staff holds every pitch from its split note up to the next one; the lowest staff reaches all the way down, the highest all the way up. Prefilled with one split at C4 (middle C) when the Organ has Pipes on both sides of it, else one staff. | Every Hole lands on exactly one staff, also one whose Pipe is not on the Organ (Q5 becomes only "is it marked?"). Familiar from piano Scores. Can't put a high bass Pipe below a low melody Pipe. |
| B | By row: each staff holds a run of consecutive rows in the Organ's order, as in the Tape view. Prefilled as for A, split at the first row whose Pipe is below C4. | Follows the Organ's layout (melody and bass blocks of a scale); pitches on one staff may jump if rows aren't sorted by pitch. Holes whose Pipe is not on the Organ have no row and need a rule (Q5). |
| C | Free: each Pipe is ticked into a staff, in any combination. | Most flexible; most work per export, and a staff's pitches may interleave with another's. |

## Q2. Are the picked staves remembered?

Where: Story 3 scenario 4, FR-005. Decision 27 keeps the Time signature unstored because it belongs to
one Tape; staves depend on the Organ instead.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | Per Organ, as a UI preference (ADR 11): the next export of any Tape of that Organ is prefilled with the staves last used for it. Not on the Organ or the Tape. | Picked once per Organ, no snapshot changes; lost with cleared browser storage, which only resets the prefill. |
| B | Not remembered: prefilled the same way at every export. | Simplest, matches decision 27; repetitive for an owner who always picks the same staves. |
| C | On the Organ, as part of its description (edited in the Organ editor too). | Survives anything and is shared by all Tapes; changes the Organ, its editor and its snapshot for a Scores-only concern. |

## Q3. Which clef does each staff get?

Where: Story 3 scenario 3, FR-006.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | Chosen by Crancula from the staff's Pipes: treble clef if the middle of its Pipes' range is at or above C4, else bass clef; an octave clef (treble 8va or bass 8vb) when that saves more than two ledger lines for most of its notes. | No extra field; good for most Organs; the owner can still change clefs in the notation program. |
| B | Chosen by the user per staff in the export dialog, prefilled as in A. | Full control; one more field per staff; remembered or not as in Q2. |
| C | Treble clef on the top staff, bass clef on all others. | Simplest; wrong for an Organ whose second staff is a high countermelody or whose top staff is low. |

## Q4. How are overlapping notes of different lengths written on one staff?

Where: Story 2 scenario 7, FR-012. Barrel organ arrangements often hold an accompaniment Pipe while
the melody moves on the same staff.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | In further voices: notes with the same start and length are a chord in one voice; a note that overlaps them with another length goes into a second voice on that staff (stems up and down), and a third or fourth if needed. | Reads like ordinary piano Scores; needs a rule for which note goes into which voice (left to the plan, e.g. highest notes in voice 1). |
| B | In one voice: every note is cut into tied pieces at each start and end of another note on the staff, so all notes sounding together share their values. | Always one voice, simple to write; many ties, which makes held notes hard to read. |

## Q5. How does a Hole whose Pipe is not on the Organ appear?

Where: Story 3 scenario 5, FR-007, Edge Cases. The confirmed rule says every Hole is exported. Its
pitch is known (a Hole's Pipe is a MIDI note number), but the Organ can't play it.

| Option | Answer | Implications |
|--------|--------|--------------|
| A (recommended) | As an ordinary note on the staff whose range holds its pitch (by Q1), with no mark. | The Scores show the Tape as it is; the Cutting Problem is already shown in the Tape view and blocks "Export for the Plotter". A reader can't tell which notes won't sound. |
| B | On the same staff, with a cross notehead, so the reader sees that the Organ won't play it. | Matches the Preview, where such Holes are silent; one more notation rule, and the mark disappears if the Pipe is added to the Organ. |

## Answers (user, 2026-10-25)

Q4 A (further voices), 2026-10-25. Asked again on 2026-10-26 in one prompt: Q1 A (by pitch, split
notes), Q2 A (per Organ, UI preference), Q3 A (Crancula chooses the clef), Q5 A (ordinary note).

All folded into spec.md (Clarifications and FR-005, FR-006, FR-007, FR-012); no markers remain.
