# Changelog

What changed for organ owners in each release of Crancula. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) as described in the `release` skill
(`.claude/skills/release/references/versioning.md`). The release workflow uses a version's section
as its GitHub Release notes.

## [Unreleased]

### Added
- Start a new Organ from a Preset: the 20er-Drehorgel (Carl Frei) or the 31er-Drehorgel (Raffin), offered in the Organ
  editor's page head. Their Pipes and Tape Bed come from the organs' gamma files; Minimum Gap, Lead-in, Tape per Crank
  turn and Crank speed range are reasonable guesses you can change.
- An Organ can set a Guide margin in the Organ editor: the distance from the guide edge of the Tape to the centre of
  row 1. Leave it empty and the rows stay centred, as before. The 20er and 31er Presets fill it in (10 mm and 11 mm), so
  their rows sit where the real organs expect them.
- The Border is shown for each side of the Tape: the guide side (row 1's edge) and the far side. The Tape view draws both.
- Edit a Tape by touch: tap an empty place to select a Spot, tap it again to add a Hole. A selected
  Hole has grips beside its ends to lengthen or shorten it; drag a Hole to move it, double-tap it to
  remove it. A finger drag on empty Tape scrolls; the mouse still draws a selection frame.
- Drag the playhead along the ruler; while the Preview plays it goes on from where you let go.
- Each Organ has a Crank speed range, its slowest and fastest Crank speed (30–120 turns per minute
  to begin with). A slider in the Preview sets the Crank speed within it; the number field still
  takes 1–300.
- Record a Tape as a WAV or MP3 file to listen to without Crancula: choose Record in the Tape view.
  The file holds the whole Tape at its Crank speed, and the Tape is not changed. Cancel stops a running Recording and
  writes nothing.
- Bring a MusicXML Score onto a Tape (`.musicxml`, `.xml` or `.mxl`): each staff becomes a Part. Repeats, endings, D.C.,
  D.S., fine and coda are played out; ties are joined. Time signatures, Keys and upbeat are kept, and the Metre is shown
  on the import screen and in the Tape details. Grace notes and ornaments are left out and counted in the Import Summary.
- A PDF or printed Score cannot be read directly: a how-to dialog explains how to get MusicXML from it.
- Export a Tape as Scores (MusicXML) from the new Export menu: staves are split by notes, with clefs, Key, tempo and
  Time signature.
- Describe your Plotters like Organs: a sheet plotter cuts within its working length and width, a roll plotter within
  its working width. Pick a Plotter in the Tape view; the choice is remembered on this computer.
- A Tape longer than the Plotter's working length is exported in Tape pieces, cut at the furthest Joins, each piece
  with an Overlap for gluing. The pieces are saved into one folder. Joins, Overlaps and the stretches are drawn on the
  Tape. A stretch without a Join, or a Plotter too narrow for the Tape, is a Cutting Problem and refuses the export.
- Cut several Tapes side by side on a roll plotter: tick them in the Tape list, choose "Cut side by side", order the
  Lanes and save one SVG. Tapes of different Organs and widths can share a cut, and the same Tape can be added twice. A
  drawing shows the roll and the width still free; a Tape that doesn't fit or has Cutting Problems is named and nothing
  is saved. A roll plotter has a Tape spacing (3 mm unless changed): the blank strip between two Tapes. The drawing
  shows the whole Tape or 1:1 and hatches the part past the working width; the Tape list ticks all Tapes at once and
  shows the Cutting Problems of each Tape before you tick it.

### Changed
- The import button says "Choose a Song Source": a MIDI file or a MusicXML Score.
- A double-click on a Hole now removes it (two taps on one Hole).
- In German, a Song is now called "Stück".
- Undo, Redo and Transpose are disabled while a Recording runs.
- Saved files move to new versions the next time you save: Organs to version 6 (`organs.json`, for the Crank speed range
  and the Guide margin), Tapes to version 3 (`tapes.json`, for the Metre), Plotters to version 2 (`plotters.json`, for
  the Tape spacing). Older files load as before: Organs with their rows centred and a Crank speed range of 30–120,
  Plotters with a Tape spacing of 3 mm. Downgrade note: an older Crancula can't read the upgraded files.

### Fixed
- In German, the Tape view's page head no longer clips Export at 1280 px: its actions show as icons below 1440 px, with
  their names as tooltips.
- The Stop preview label and the Export button stay on one line, and the German page head no longer clips the 2:1 zoom.
- The Crank speed label fits in German, and the playhead grip is easier to see in dark mode.
- The import screen shows the Parts block only once a Song is chosen.

## [0.2.0] - 2026-10-24

### Added
- Hear a Tape before you cut it: Preview (toolbar button or Space) plays it with an organ-like tone
  per Pipe while a playhead moves along the Tape. Start from any Column by clicking the ruler or
  entering a Column; editing waits until the Preview stops.
- Each Tape keeps a Crank speed in turns per minute (60 to begin with). Change it in the Preview
  section of the side panel, also while it plays; one Undo takes it back. The section shows how long
  the Tape plays.
- An Organ can describe its Tape per Crank turn in mm, in the Tape Bed part of the Organ editor. An
  Organ needs it before its Tapes can be heard; Organs saved before keep working without it.

## [0.1.1] - 2026-10-23

### Added
- Edit a Tape's Holes by hand. Move a Hole by dragging it or with the arrow keys, lengthen or shorten
  it by its end, add a Hole (double-click, or the Add a Hole form), and remove it with Delete.
  Keyboard users get the same controls, in German and English.
- Cutting Problems show as you edit: a Hole that can't be cut is outlined, and the Selected Hole
  lists its problems.
- Undo and redo for Tape edits: the Undo and Redo buttons, the Edit menu, and Ctrl+Z, Ctrl+Y or
  Ctrl+Shift+Z (⌘Z and ⇧⌘Z on macOS).
- The Tape grows when you move a Hole past its end; the view scrolls while you drag near an edge.
- Transpose all or the selected Holes of a Tape.
- Change a Tape's Column length in the Tape section of the side panel. A hint shows the Cutting
  Problems now and after the change; Apply (or Enter) changes the Tape, and one Undo takes it back.
- Rename a Tape: choose Rename in the Tape's menu in the Tape list.
- Bringing a Song onto a Tape shows a live preview of the Tape's first Columns under the Fit. It
  follows the Parts, the Transposition and the Column length before you create the Tape.

### Fixed
- The Pipe note fields in the Organ editor are no longer clipped.
- At Whole Tape, the ruler numbers and row labels are thinned out so they don't overlap.
- The import screen's Song sheet scrolls in short windows instead of spilling into the action bar.
- Saving on Windows retries longer when another program holds the saved file open.

## [0.1.0] - 2026-10-18

### Added
- Every Organ has a Lead-in (German Vorlauf): the blank Tape before Column 1, with an angled start,
  in millimetres. Enter it in the Organ editor after Minimum Gap; 0 means none. Your saved Organs get
  a Lead-in of 0.
- Export a Tape for the Plotter as an SVG at true size (1:1 mm): the Holes in cutting order, row 1
  first, inside the Tape outline with its angled Lead-in.
- A Tape that can't be cut is not exported. Crancula lists every Hole that is the problem (no Pipe,
  too short, too close) in a dialog and writes no file.

### Changed
- A new look, the organ builder's workshop: new theme and fonts, navigation, Organ editor,
  Tape view, Organ and Tape lists, and import screen. The Tape is drawn horizontally, row 1 on top.
- The Border is no longer entered. Crancula derives it as (tape width - Row Span) / 2, with the rows
  centred across the Tape, and shows it read-only in the Organ editor (6,25 mm for a street organ
  with 31 Pipes, 120 mm tape, 2,5 mm holes, 3,5 mm spacing). A Border of 0 is fine; a negative one
  means the rows don't fit. Your saved Organs keep working.
- Saved Organs are upgraded to the new file format (version 3) the next time you save. Downgrade
  note: older versions of Crancula can't read the upgraded file; they move it aside and start with
  no Organs.

### Fixed
- View > Reload keeps the current page instead of showing a file-not-found page.
- Saving no longer fails on Windows when another program (antivirus, the indexer) briefly holds the
  saved file open.

## [0.0.1] - 2026-10-14

### Added
- Describe your Organ: its Pipes (MIDI note numbers), Tape Bed, Minimum Hole Length and Minimum
  Gap. Crancula shows every broken rule next to its field and never stores an invalid Organ.
- Save changes explicitly. Leaving with unsaved changes asks first and lists what still needs fixing.
- Reorder and remove Pipes, change and delete Organs.
- Bring a MIDI Song onto a Tape for one of your Organs, with automatic Transposition so the notes
  fit its Pipes. Choose which parts go onto the Tape, try another Transposition, and look at the Tape.
- Organs and Tapes are kept between starts. An unreadable snapshot is reported and kept, never
  overwritten.
- German and English, switchable in the app and remembered between starts, including the
  application menu.
- Downloads for Windows (portable `.exe`), macOS (`.dmg`, Apple silicon) and Linux (`.AppImage`).

[Unreleased]: https://github.com/LilSticky/crancula/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/LilSticky/crancula/releases/tag/v0.2.0
[0.1.1]: https://github.com/LilSticky/crancula/releases/tag/v0.1.1
[0.1.0]: https://github.com/LilSticky/crancula/releases/tag/v0.1.0
[0.0.1]: https://github.com/LilSticky/crancula/releases/tag/v0.0.1
