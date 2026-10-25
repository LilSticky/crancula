# Open questions: Cut a tape in pieces

Result of the `/speckit-clarify` scan of [spec.md](spec.md) on 2026-10-25, not yet asked. Each
question changes the spec; plan-level questions (IPC channels, snapshot format) are left out. The
spec assumes the recommended option (listed first) until the user decides, and marks each spot as
`[NEEDS CLARIFICATION: Qn]`.

## Q1. Where is the Plotter picked in the Tape view kept?

**Question:** When I pick a Plotter in the Tape view, is that pick kept per Tape, or as one choice for
all Tapes? (FR-006, Story 3 scenario 1)

Why it matters: it decides whether picking a Plotter changes the Tape (and its snapshot and undo
history) and what a newly opened Tape shows.

**Recommended:** Option A - most owners have one Plotter; one remembered choice keeps the Tape
unchanged (spec 003: exporting changes nothing) and needs no Tape snapshot change.

| Option | Description |
|--------|-------------|
| A | One choice for all Tapes, remembered across restarts as a UI preference (ADR 11); not part of any Tape |
| B | Kept per Tape across restarts, like its Crank speed; not an undo step |
| C | Kept per Tape and an edit with an undo step, like the Crank speed |
| D | Not remembered: every Tape view starts with "No Plotter" |

## Q2. Where are Plotters listed and edited?

**Question:** Do Plotters get their own screen with a list and an editor, like Organs, or are they
described only from the Tape view's picker? (FR-005, Story 5 scenario 5)

Why it matters: it decides the navigation (a new rail entry and route) and how much UI the slice
builds.

**Recommended:** Option A - Plotters behave like Organs (describe once, change, remove), so the same
pattern is the least surprising, and the picker only needs a link to it.

| Option | Description |
|--------|-------------|
| A | Own screen like Organs: a Plotter list and a Plotter editor in the rail; the picker links to it ("Describe a Plotter…") |
| B | Only a dialog from the Tape view's picker (add, change, remove); no own screen |
| C | A section of the Organs screen ("Organs and Plotters") |

## Q3. How close may a Hole come to a Join or to the end of an Overlap?

**Question:** May a Hole start or end exactly at a Join or at the end of an Overlap, or must it keep
the Organ's Minimum Gap from those cuts? (FR-008, Story 2 scenario 5)

Why it matters: it decides where Joins are possible, so how many Tape pieces a Tape needs and which
stretches become Cutting Problems; the reference tests depend on it.

**Recommended:** Option B - the end cut of spec 003 already keeps one Minimum Gap so no Hole touches
it; a Hole touching a cut edge tears or leaks at the glued edge.

| Option | Description |
|--------|-------------|
| A | Touching allowed: a Join only must not cross a Hole (decision 11 read literally) |
| B | Minimum Gap kept: no Hole closer to a Join or to the end of an Overlap than the Minimum Gap |
| C | Touching allowed at the Join (the upper layer), Minimum Gap kept at the end of the Overlap (the lower layer) |

## Q4. Are the Joins drawn in the Tape view?

**Question:** With a Plotter picked, does the Tape view draw where the Joins and Overlaps fall, or
only say how many Tape pieces there are? (FR-007, Story 3 scenario 9)

Why it matters: seeing the Joins helps to fix a Cutting Problem and to check the pieces before
cutting, but it adds drawing work to a size-L slice.

**Recommended:** Option A - the Tape view is "what you see is what gets cut" (spec 003); without the
Joins the owner sees the pieces only in the files.

| Option | Description |
|--------|-------------|
| A | Draw each Join and its Overlap in the Tape view, plus the count of Tape pieces in the side panel |
| B | Only the count of Tape pieces in the side panel |
| C | Nothing until export; the export message names the pieces |

## Q5. How is a Tape exported that fits in one piece while a Plotter is picked?

**Question:** When a sheet Plotter is picked and the Tape fits its working length in one piece, does
export open the usual save dialog with "<Tape name>.svg", or the folder dialog with
"<Tape name> 1 of 1.svg"? (FR-022, Story 2 scenario 8)

Why it matters: it decides whether the export flow and file name depend on the Tape's length, and
what the e2e tests expect.

**Recommended:** Option A - a single piece is the export the owner knows from spec 003; "1 of 1"
adds nothing.

| Option | Description |
|--------|-------------|
| A | The save dialog of spec 003 with "<Tape name>.svg" |
| B | The folder dialog with "<Tape name> 1 of 1.svg", so a picked sheet Plotter always exports the same way |

## Answers (user, 2026-10-25)

Q1 A (one remembered Plotter choice for all Tapes), Q2 A (own Plotter screen like Organs), Q3 B (Minimum Gap kept from a Join and from the end of an Overlap), Q4 A (Joins and Overlaps drawn, piece count in the side panel), Q5 A (save dialog with "<Tape name>.svg").

Folded into spec.md (Clarifications, Session 2026-10-25).
