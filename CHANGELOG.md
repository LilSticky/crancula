# Changelog

What changed for organ owners in each release of Crancula. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) as described in the `release` skill
(`.claude/skills/release/references/versioning.md`). The release workflow uses a version's section
as its GitHub Release notes.

## [Unreleased]

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

[Unreleased]: https://github.com/LilSticky/crancula/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/LilSticky/crancula/releases/tag/v0.0.1
