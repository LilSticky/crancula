# Organ

The instrument the user owns and describes.

## Organ
* Has a defined set of pipes
* Has a Tape Bed
* Defines the Minimum Hole Length and Minimum Gap its tapes must respect
* Defines the length of the Lead-in its tapes start with
* Defines its Tape per Crank turn
* Defines the physical characteristics and capabilities of a barrel organ
* Plays punched tape
  * tape is drawn through a pneumatic system
  * holes in tape control airflow
  * airflow reaches selected pipes
  * those pipes produce a note
* German: Drehorgel

## Preset
* A ready-made Organ the user starts from when describing a new Organ; a starting point, not an Organ of the library
* Choosing one fills the Organ editor, which the user then adapts and saves as an ordinary Organ
* Shipped with Crancula: the 20er-Drehorgel (Carl Frei scale) and the 31er-Drehorgel (Raffin scale)
* German: Vorlage (approved by the user, 2026-10-24, #162)

## Pipe
* Can play one musical note
* Identified by the MIDI note number of the note it plays
* Part of Organ
* On Tape represented by one row
* German: Pfeife

## Tape Bed
* The surface in the Organ the Tape runs over while being played
* Defines tape width, hole diameter and spacing between rows (centre to centre)
* Row 1 is nearest the guide edge, the Tape's top edge as drawn in the Tape view
* Rows are centred across the Tape unless the Tape Bed has a Guide margin
* German: Bandbett; its spacing between rows: Reihenabstand

## Guide margin
* The distance from the guide edge of the Tape (row 1's edge) to the centre of row 1, as gamma files give it
* Optional on the Tape Bed; left empty, the rows are centred
* Must leave both Borders at 0 or more: at least half the hole diameter, and no more than tape width − (Row Span − hole diameter / 2)
* German: Führungsrand

## Border
* The free strip between a Tape edge and the holes of the outermost row on that side
* Derived, never entered: (tape width − Row Span) / 2 on both sides when the rows are centred; with a Guide margin,
  Guide margin − hole diameter / 2 on the guide side and tape width − Row Span − guide-side Border on the far side
* Depends on the Organ's number of Pipes, not on the Tape Bed alone
* A Border of 0 is valid: the holes may touch the Tape's edge
* An Organ whose Border would be negative on either side is invalid: its rows don't fit across the Tape
* Shown read-only in the Organ editor and drawn in the Tape view
* Its two sides are the guide side (row 1's edge) and the far side
* German: Rand; guide side: Führungsseite; far side: Gegenseite

## Row Span
* The width the rows take across the Tape, from the outer edge of row 1's holes to the outer edge of the last row's holes
* (Pipes − 1) × spacing between rows + hole diameter
* German: Reihenbreite

## Minimum Hole Length
* Shortest Hole in mm the Organ can play reliably; a hard physical limit
* Equals the hole diameter of the Tape Bed; not set separately
* Together with the Crank speed it gives the shortest note duration
* Limits a Hole's length, not where it starts: a Hole's start can be shifted by less than this length
* German: Mindestlochlänge

## Minimum Gap
* Shortest space in mm between two Holes in the same row the Organ can separate; a hard physical limit
* German: Mindestabstand

# Song

The music the user brings in.

## Song
* A specific sequence of sounds forming music
* Imported from a Song Source
* One straight sequence: repeats, voltas, da capo and dal segno of its Song Source are played out at import
* Converted to tape format for playback on barrel organs
* Not exported itself; its Tape can be exported as Scores (see Tape)
* Made of Parts
* Keeps its Time signatures and Keys (each at its Tick) and its upbeat from its Song Source, where the Song Source has them
* Shows its Metre (read-only)
* German: Stück

## Song Source
* The material a Song is imported from: MIDI or MusicXML
* PDF and printed Scores reach Crancula as MusicXML from an outside music recognition tool (e.g. Audiveris)
* German: Notenquelle

## Part
* One staff or instrument of a Song, such as melody, bass or drums
* Has an optional name and its Notes; may be percussion (German: Schlagwerk)
* From Scores: one Part per staff (a piano's right and left hand are two Parts)
* The user chooses which Parts go onto a Tape
* German: Stimme

## Note
* Specific perceivable frequency defined by a name
* Identified by its MIDI note number; the name (e.g. C4) is for display
* Part of a song's musical structure

## Scores
* Human-readable notation of music
* Widely used to compose songs
* Can be printed on paper and read by most musicians
* One possible Song Source (printed, PDF, MusicXML); a MIDI file is not Scores
* Crancula reads and writes Scores as MusicXML
* The singular "Score" names one Song Source written in MusicXML (German: Noten)
* German: Noten

## Tick
* The unit of musical time in a Song and its Song Source (MIDI ticks, MusicXML divisions)
* The Song Source gives the number of Ticks per quarter note
* Only matters inside the Song Source and the Song read from it; Quantisation turns Ticks into Columns

## Time signature
* How a Song's beats are grouped into Bars (e.g. 3/4)
* Kept on the Song from its Song Source; it may change, each change at its Tick
* German: Taktart

## Bar
* One group of beats under a Time signature
* The first Bar may be shorter (an upbeat); the Song keeps its length
* German: Takt

## Key
* A key signature a Song keeps from its Song Source, from its Tick on
* German: Tonart

## Metre
* A Song's first Time signature, Key and upbeat, e.g. "3/4, G major, upbeat 1/4"
* Shows only what the Song keeps; read-only
* Shown next to the Song on the import screen and in the Tape details
* German: Takt und Tonart

# Bringing a Song onto a Tape

How a Song becomes Holes.

## Transposition
* Transposing Holes moves each of them by a number of semitones to another Pipe (all Holes of a Tape or the selected ones)
* The Tape's Transposition is the one it was created with
* Used to fit a song to the Organ's pipes or to make it sound better

## Fit
* How well a Song fits an Organ under one Transposition
* Three counts: Notes that match a Pipe, Notes moved by octaves, Unplayable Notes
* Shown for the proposed Transposition and for any other the user tries

## Unplayable Note
* A Note of a Song that no Pipe of the Organ can play, not even after the Transposition and a move by whole octaves
* Is not put on the Tape; listed when the Song is brought onto a Tape

## Quantisation
* Moving the start and end of every Note onto Column boundaries
* Done when a Song is brought onto a Tape

## Import Summary
* What the user sees after a Song is brought onto a Tape
* Shows the Transposition, the Notes moved by octaves, the Unplayable Notes, the Holes fixed and, for Scores, how many grace notes and ornaments were left out; nothing else
* "Holes fixed" is its name for the Holes changed to respect the Minimum Hole Length and Minimum Gap (not "Changed Holes")
* German: Importübersicht; Holes fixed: Angepasste Löcher; grace notes: Vorschlagsnoten; ornaments: Verzierungen; left out: weggelassen
* Shown once; not stored with the Tape

# Tape

The punched strip and what is on it.

## Tape
* Represents a song to a specific barrel organ
* Belongs to exactly one Organ (referenced by id)
* May be created from a Song (referenced by id) or composed from scratch
* Defines the physical length of one Column in mm
* Always editable in Crancula; the tool does not track whether it has been punched
* Can be exported for the Plotter only when every Hole has a Pipe on its Organ and respects the Minimum Hole Length and Minimum Gap; exporting does not change the Tape
* For a Plotter that is not a roll plotter, a Tape longer than its working length is cut in Tape pieces
* Can be exported as Scores (MusicXML) to read or print; exporting does not change the Tape
* Keeps a Crank speed, the tempo its Preview plays at; changing it is an edit like the Column length
* German: Lochband (plural Lochbänder); compounds keep "Band": Bandbett, Bandbreite
* Effectively a table
  * each row represents one pipe
    * extending a hole further along the row extends the duration the pipe is played
  * each column represents one Column (time step)
    * actual speed depends on cranking speed of the musician

## Column
* One time step on a Tape; all Holes start and end on Column boundaries
* Its musical duration is fixed at a 1/32 note, the finest time grid
* Its physical length in mm is defined by the Tape

## Hole
* Each hole in the tape represents one note being played by a pipe
* Can be lengthened or shortened at either end along its row, which changes the note duration
* Has position (its Pipe, start column) and dimensions (length)
* Cut as a slot from the start of its first Column to the end of its last Column, one hole diameter wide, with half-circle ends inside that length; the Tape view draws exactly this shape
* Belongs to its Pipe, not to a row number: when the Organ's Pipes are reordered, the Hole moves with its Pipe
* Usually placed on regular note-value boundaries; can be moved by single Columns for finer adjustment
* Can be moved to another Pipe or Column, or removed
* Must be at least the Minimum Hole Length long and keep the Minimum Gap to the next hole in its row; otherwise it has a Cutting Problem
* Similar to a single musical score, but for punched tape

## Spot
* One Column in one Pipe's row where no Hole is, selected in the Tape view to add a Hole there
* Drawn as the outline of the Hole that would be added (Minimum Hole Length long)
* Selecting a Spot clears the Hole selection, and the other way round
* German: Stelle

## Lead-in
* The blank Tape before Column 1 that threads the Tape into the Organ; carries no Holes
* Its length in mm is set per Organ; 0 means no Lead-in (Organs saved before it existed load with 0)
* Starts with an angled cut: a straight diagonal over its whole length, from the full tape width at Column 1 to a point on the Tape's top edge
* A Tape cut in Tape pieces has it on the first Tape piece only
* German: Vorlauf

## Tape Outline
* The cut around a Tape: both long edges, the Lead-in's diagonal (a square cut at Column 1 when the Lead-in is 0) and a square end cut one Minimum Gap after the last Column, so no Hole touches it (no blank tail beyond that)
* The Tape is cut out of a wider sheet or roll; the Plotter cuts the Tape Outline after all Holes
* A Tape cut in Tape pieces: each Tape piece has its own outline, square at a Join
* Several Tapes cut side by side: one Tape Outline per Tape, Tape spacing apart
* German: Bandumriss

# Playing

Cranking a Tape and listening to it.

## Crank
* Turned by the musician to draw the Tape through the Organ
* Its speed sets the tempo; in Crancula's Preview the Crank speed is adjustable

## Crank speed
* Crank turns per minute
* Kept by each Tape
* Together with the Organ's Tape per Crank turn and the Tape's Column length it sets how long a Column plays
* German: Kurbelgeschwindigkeit

## Crank speed range
* The Crank speeds an Organ is meant to be turned at, from its Slowest to its Fastest Crank speed
* Defined by the Organ; Organs saved before it existed load with 30–120 turns per minute
* Bounds the Preview's speed slider; a Tape's Crank speed may lie outside it and still plays
* German: Kurbelbereich; Slowest / Fastest Crank speed: langsamste / schnellste Kurbelgeschwindigkeit

## Tape per Crank turn
* How far one Crank turn draws the Tape through the Organ, in mm
* Defined by the Organ
* German: Bandvorschub pro Umdrehung

## Barrel
* Physical cylinder the Tape is rolled up on; no rules in Crancula

## Preview
* Playing a Tape in Crancula at a Crank speed, to hear it before it is cut
* Changes nothing: no Hole, not the Organ (only the Tape's Crank speed can be changed while it plays)

## Recording
* An audio file (WAV or MP3) of a whole Tape played through at its Crank speed, sounding like its Preview
* Written once by Crancula, never read back
* German: Aufnahme

## Record
* Saving a Recording of a Tape; changes nothing
* A Tape with Cutting Problems can be recorded; it plays as drawn
* German: Aufnehmen

# Cutting

Turning a Tape into a physical one.

## Punch
* Cutting a Hole into a physical Tape; irreversible
* Done by a Plotter from an exported Tape (or by hand)

## Plotter
* Machine that punches a Tape from an exported file (SVG; other formats such as DXF or HPGL only for a concrete device)
* Described once by the user, like an Organ: name, format, Working area, Overlap length and whether it is a roll plotter
* A roll plotter (a vinyl cutter) cuts near-endless lengths: it has no working length and never splits a Tape
* A roll plotter can cut several Tapes side by side, each in its own Lane, Tape spacing apart
* Cuts a Tape longer than its working length in Tape pieces; refuses a Tape wider than its working width
* Without a described Plotter, a Tape is exported as one file
* First target: a vinyl cutter that cuts long sheets
* Crancula exports exact 1:1 geometry in mm; blade offset and kerf are left to the cutter's own software
* German: Plotter (Schneideplotter in prose)

## Sheet plotter
* A Plotter that is not a roll plotter: it cuts within its Working area (working length and working width)
* Has an Overlap; a Tape longer than its working length is cut in Tape pieces
* German: Bogenplotter

## Working area
* The largest length (working length) and width (working width) a Plotter cuts in one go
* A roll plotter has only a working width
* German: Arbeitsbereich (working width: Arbeitsbreite, working length: Arbeitslänge)

## Cutting Problem
* Why a Hole can't be cut: its Pipe is not on the Organ, it is shorter than the Minimum Hole Length, or it is closer than the Minimum Gap to the next Hole in its row
* With a Plotter picked in the Tape view, also: a stretch longer than its working length where no Join is possible; no Plotter picked, or a roll plotter, means no such Cutting Problem
* A Tape with Cutting Problems can be edited but not exported for the Plotter
* German: Schnittproblem

## Tape piece
* A part of a Tape cut on its own, ending at a Join; glued to the next Tape piece
* Exported as its own SVG file, numbered in order ("<tape> 1 of 3"); all pieces are saved together into one folder
* German: Bandstück

## Join
* Where two Tape pieces meet; only between Columns no Hole crosses
* Lies as close as possible before the Plotter's working length
* German: Klebestelle

## Overlap
* The strip of a Tape piece that lies under the next Tape piece for gluing
* Repeats the Holes of the stretch it lies under, so both layers are cut through
* Its length is set on the Plotter (20 mm unless changed)
* German: Klebezugabe

## Lane
* The strip of a roll plotter's working width one Tape takes in a side-by-side cut
* One Tape per Lane, in the order the user picks
* German: Bahn

## Tape spacing
* The blank strip between two Lanes in a side-by-side cut
* Set on the roll plotter (3 mm unless changed); the same between all Lanes
* Not "gap", which means the Minimum Gap
* German: Bandabstand
