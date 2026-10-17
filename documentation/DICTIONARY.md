# Organ
* Has a defined set of pipes
* Has a Tape Bed
* Defines the Minimum Hole Length and Minimum Gap its tapes must respect
* Defines the length of the Lead-in its tapes start with
* Defines the physical characteristics and capabilities of a barrel organ
* Plays punched tape
  * tape is drawn through a pneumatic system
  * holes in tape control airflow
  * airflow reaches selected pipes
  * those pipes produce a note
* German: Drehorgel

# Pipe
* Can play one musical note
* Identified by the MIDI note number of the note it plays
* Part of Organ
* On Tape represented by one row
* German: Pfeife

# Tape
* Represents a song to a specific barrel organ
* Belongs to exactly one Organ (referenced by id)
* May be created from a Song (referenced by id) or composed from scratch
* Defines the physical length of one Column in mm
* Always editable in Crancula; the tool does not track whether it has been punched
* Can be exported for the Plotter only when every Hole has a Pipe on its Organ and respects the Minimum Hole Length and Minimum Gap; exporting does not change the Tape
* Holds no tempo: playing speed is set by the Crank
* German: Lochband (plural Lochbänder); compounds keep "Band": Bandbett, Bandbreite
* Effectively a table
  * each row represents one pipe
    * extending a hole further along the row extends the duration the pipe is played
  * each column represents one Column (time step)
    * actual speed depends on cranking speed of the musician

# Hole
* Each hole in the tape represents one note being played by a pipe
* Can be extended along the row to extend the note duration
* Has position (its Pipe, start column) and dimensions (length)
* Cut as a slot from the start of its first Column to the end of its last Column, one hole diameter wide, with half-circle ends inside that length; the Tape view draws exactly this shape
* Belongs to its Pipe, not to a row number: when the Organ's Pipes are reordered, the Hole moves with its Pipe
* Usually placed on regular note-value boundaries; can be shifted by single Columns for finer adjustment
* Can be moved to another pipe or column, or removed
* Must be at least the Minimum Hole Length long and keep the Minimum Gap to the next hole in its row
* Similar to a single musical score, but for punched tape

# Song
* A specific sequence of sounds forming music
* Imported from a Song Source
* Converted to tape format for playback on barrel organs
* Converted to scores for human reading
* Made of Parts

# Part
* One voice or instrument of a Song, such as melody, bass or drums
* Has an optional name and its Notes; may be percussion (German: Schlagwerk)
* The user chooses which Parts go onto a Tape

# Scores
* Human-readable notation of music
* Widely used to compose songs
* Can be printed on paper and read by most musicians
* One possible Song Source (printed, PDF, MusicXML); a MIDI file is not Scores

# Note
* Specific perceivable frequency defined by a name
* Identified by its MIDI note number; the name (e.g. C4) is for display
* Part of a song's musical structure

# Column
* One time step on a Tape; all Holes start and end on Column boundaries
* Its musical duration is fixed at a 1/32 note, the finest time grid
* Its physical length in mm is defined by the Tape

# Tape Bed
* The surface in the Organ the Tape runs over while being played
* Defines tape width, hole diameter and spacing between rows (centre to centre)
* Rows are always centred across the Tape; row 1 is nearest the Tape's top edge, as drawn in the Tape view
* German: Bandbett; its spacing between rows: Reihenabstand

# Border
* The free strip between a Tape edge and the holes of the outermost row; the same on both sides
* Derived, never entered: (tape width − Row Span) / 2
* Depends on the Organ's number of Pipes, not on the Tape Bed alone
* A Border of 0 is valid: the holes may touch the Tape's edge
* An Organ whose Border would be negative is invalid: its rows don't fit across the Tape
* Shown read-only in the Organ editor and drawn in the Tape view
* German: Rand

# Row Span
* The width the rows take across the Tape, from the outer edge of row 1's holes to the outer edge of the last row's holes
* (Pipes − 1) × spacing between rows + hole diameter
* German: Reihenbreite

# Song Source
* The material a Song is imported from: MIDI, MusicXML, PDF or printed Scores
* MIDI is supported first

# Tick
* The unit of musical time in a MIDI Song Source
* The Song Source gives the number of Ticks per quarter note
* Only matters inside the Song Source and the Song read from it; Quantisation turns Ticks into Columns

# Transposition
* Shifting the notes of a Tape (all or a selection) by a number of semitones
* Used to fit a song to the Organ's pipes or to make it sound better

# Fit
* How well a Song fits an Organ under one Transposition
* Three counts: Notes that match a Pipe, Notes moved by octaves, Unplayable Notes
* Shown for the proposed Transposition and for any other the user tries

# Unplayable Note
* A Note of a Song that no Pipe of the Organ can play, not even after the Transposition and a move by whole octaves
* Is not put on the Tape; listed when the Song is brought onto a Tape

# Quantisation
* Moving the start and end of every Note onto Column boundaries
* Done when a Song is brought onto a Tape

# Import Summary
* What the user sees after a Song is brought onto a Tape
* Shows the Transposition, the Notes moved by octaves, the Unplayable Notes and the Holes fixed, nothing else
* "Holes fixed" is its name for the Holes changed to respect the Minimum Hole Length and Minimum Gap (not "Changed Holes")
* German: Importübersicht; Holes fixed: Angepasste Löcher
* Shown once; not stored with the Tape

# Minimum Hole Length
* Shortest Hole in mm the Organ can play reliably; a hard physical limit
* Equals the hole diameter of the Tape Bed; not set separately
* Together with the Crank speed it gives the shortest note duration
* Limits a Hole's length, not where it starts: a Hole's start can be shifted by less than this length
* German: Mindestlochlänge

# Lead-in
* The blank Tape before Column 1 that threads the Tape into the Organ; carries no Holes
* Its length in mm is set per Organ; 0 means no Lead-in (Organs saved before it existed load with 0)
* Starts with an angled cut: a straight diagonal over its whole length, from the full tape width at Column 1 to a point on the Tape's top edge
* German: Vorlauf

# Tape Outline
* The cut around a Tape: both long edges, the Lead-in's diagonal (a square cut at Column 1 when the Lead-in is 0) and a square end cut one Minimum Gap after the last Column, so no Hole touches it (no blank tail beyond that)
* The Tape is cut out of a wider sheet or roll; the Plotter cuts the Tape Outline after all Holes
* German: Bandumriss

# Minimum Gap
* Shortest space in mm between two Holes in the same row the Organ can separate; a hard physical limit
* German: Mindestabstand

# Crank
* Turned by the musician to draw the Tape through the Organ
* Its speed sets the tempo; in Crancula's preview the crank speed is adjustable

# Punch
* Cutting a Hole into a physical Tape; irreversible
* Done by a Plotter from an exported Tape (or by hand)

# Plotter
* Machine that punches a Tape from an exported file (SVG first; DXF and HPGL later)
* First target: a vinyl cutter that cuts long sheets
* Crancula exports exact 1:1 geometry in mm; blade offset, kerf and working area are left to the cutter's own software

# Barrel
* Physical cylinder the Tape is rolled up on; no rules in Crancula
