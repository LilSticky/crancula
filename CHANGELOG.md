# Changelog

What changed for organ owners in each release of Crancula. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) as described in the `release` skill
(`.claude/skills/release/references/versioning.md`). The release workflow uses a version's section
as its GitHub Release notes.

## [Unreleased]

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

[Unreleased]: https://github.com/LilSticky/crancula/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LilSticky/crancula/releases/tag/v0.1.1
[0.1.0]: https://github.com/LilSticky/crancula/releases/tag/v0.1.0
[0.0.1]: https://github.com/LilSticky/crancula/releases/tag/v0.0.1
