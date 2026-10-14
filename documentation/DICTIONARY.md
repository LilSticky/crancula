# Organ
* Has a defined set of pipes
* Has a Tape Bed
* Defines the Minimum Hole Length and Minimum Gap its tapes must respect
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
* Holds no tempo: playing speed is set by the Crank
* Effectively a table
  * each row represents one pipe
    * extending a hole further along the row extends the duration the pipe is played
  * each column represents one Column (time step)
    * actual speed depends on cranking speed of the musician

# Hole
* Each hole in the tape represents one note being played by a pipe
* Can be extended along the row to extend the note duration
* Has position (its Pipe, start column) and dimensions (length)
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
* Has an optional name and its Notes; may be percussion
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
* Defines tape width, border, hole diameter and spacing between rows
* German: Bandbett; its spacing between rows: Reihenabstand

# Song Source
* The material a Song is imported from: MIDI, MusicXML, PDF or printed Scores
* MIDI is supported first

# Transposition
* Shifting the notes of a Tape (all or a selection) by a number of semitones
* Used to fit a song to the Organ's pipes or to make it sound better

# Unplayable Note
* A Note of a Song that no Pipe of the Organ can play, not even after the Transposition and a move by whole octaves
* Is not put on the Tape; listed when the Song is brought onto a Tape

# Quantisation
* Moving the start and end of every Note onto Column boundaries
* Done when a Song is brought onto a Tape

# Minimum Hole Length
* Shortest Hole in mm the Organ can play reliably; a hard physical limit
* Equals the hole diameter of the Tape Bed; not set separately
* Together with the Crank speed it gives the shortest note duration
* Limits a Hole's length, not where it starts: a Hole's start can be shifted by less than this length
* German: Mindestlochlänge

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

# Barrel
* Physical cylinder the Tape is rolled up on; no rules in Crancula
