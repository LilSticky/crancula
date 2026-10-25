# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues)

## Current slice

**In progress:** v0.3 [Bring Scores onto a tape](https://github.com/LilSticky/crancula/issues/167) (#167, branch
`010-bring-scores-onto-a-tape`, [spec](../specs/010-bring-scores-onto-a-tape/spec.md)): MusicXML only, one Part per staff,
repeats played out. [Plan](../specs/010-bring-scores-onto-a-tape/plan.md) ([ADR 27](adr/0027-own-musicxml-reader-in-the-domain.md):
own MusicXML reader in the domain, fflate 0.8.3 for `.mxl`; Tape snapshot v3) and [tasks.md](../specs/010-bring-scores-onto-a-tape/tasks.md)
(64 tasks). US1 (MVP) done: Phases 1–3 implemented, full e2e 158/158 green locally.
- Song keeps Time signatures, upbeat and Keys (Tape snapshot v3); `readSongSource` picks MIDI or MusicXML by first bytes.
- Own XML reader, `.mxl` unzip, score-measures, lay-out and `readScoreSong`; the import page takes MIDI or MusicXML (Song Source); `e2e/score-import` green.
- Decision: a sounding pitch outside MIDI 0–127 is folded by octaves ([research.md](../specs/010-bring-scores-onto-a-tape/research.md)).
- Known: one Angular test skipped until T039 (grace notes are left out of the Import Summary). `api/` is not covered by
  `npm run lint` (`ng lint` only covers `src/` and `e2e/`, pre-existing; [#175](https://github.com/LilSticky/crancula/issues/175)).

**Decisions (2026-10-25):** Keys stay at each Tick (dictionary updated); the import button reads "Choose a Song Source"
(German "Notenquelle wählen"); German term for Song Source is Notenquelle.

**Next step:** Phase 4 US2 of slice 010 (repeats played out, T028) in `tasks.md`.

**Done:** [Record a tape](../specs/009-record-a-tape/spec.md) ([#165](https://github.com/LilSticky/crancula/issues/165), v0.2,
branch `009-record-a-tape`, PR [#166](https://github.com/LilSticky/crancula/pull/166)): save the whole Tape at its Crank speed as a
WAV or MP3 Recording. WAV is mono 44.1 kHz 16 bit; MP3 is 128 kbit/s via LAME (LGPL, unmodified) in a Worker. The
Recording is rendered offline with the Preview voices; two IPC calls (`recording.chooseFile`, `recording.writeFile`)
with a single-use target, [ADR 26](adr/0026-recording-rendered-offline-saved-by-main.md). Record is disabled without a
Tape per Crank turn or while the Preview plays; the page head actions are icon-only below 1180 px so Record fits at
1024 px. Reviews (electron, angular, UX, spec audit, [audit.md](../specs/009-record-a-tape/audit.md)) fixed; open
follow-ups [#172](https://github.com/LilSticky/crancula/issues/172) and [#173](https://github.com/LilSticky/crancula/issues/173).
Gate: 1009 node and 1435 Angular unit tests, lint, i18n; e2e `record-a-tape`, `boundary` and `tape-layout` green locally,
full e2e in CI. **Sound not checked by hand yet**: the user has not listened to a Recording (WAV or MP3).

**Done:** Discovery of the later slices (2026-10-25, branch `docs/later-slices-discovery`): user decisions 15–28 in
[discovery/later.md](discovery/later.md), their terms in the dictionary, slice issues
[#167](https://github.com/LilSticky/crancula/issues/167) (Bring Scores onto a tape),
[#168](https://github.com/LilSticky/crancula/issues/168) (Cut a tape in pieces),
[#169](https://github.com/LilSticky/crancula/issues/169) (Read a tape as Scores) and
[#170](https://github.com/LilSticky/crancula/issues/170) (Cut several tapes side by side, discovery still to do).
The specs 010–012 are written on their own branches, each with a draft pull request. The Project board now holds
every issue (29 were missing); its built-in auto-add workflow is on (it adds only new issues, so the older ones had to be added by hand).

**Done:** [Ready-made Organs (#162)](https://github.com/LilSticky/crancula/issues/162) (2026-10-24, branch
`claude/issue-162-20261024-2112`): the term is Preset (German Vorlage); a new Organ offers the Presets as starting
points (buttons in the Organ editor's page head). `api/organ/organ-preset.ts` holds the 20er-Drehorgel (Carl Frei,
F-based, 110 mm, 3 mm holes, 3.85 mm rows) and the 31er-Drehorgel (Raffin, 140 mm, 2.5 mm holes, 3.86 mm rows). Notes
and Tape Bed come from Wally Venable's MIDIBoek gamma files. **Guessed** (user-approved): Minimum Gap 3 mm, Lead-in
30 mm, Tape per Crank turn 70 mm, Crank speed 40–90. The real 20er rows are off-centre; the Preset is centred until
[#163](https://github.com/LilSticky/crancula/issues/163). Kept small: no `specs/` folder and no new e2e (unit and
component tests cover it). Gate: 1378 Vitest tests and lint green locally.

**Done:** [Stop preview label wraps at 1280 px (#159)](https://github.com/LilSticky/crancula/issues/159) (2026-10-24,
branch `159-stop-preview-label`): the Preview toggle no longer wraps, in English and German (`white-space: nowrap`, as
Export). New e2e in `e2e/tape-layout.spec.ts` measures the toggle while a Preview plays at 1280×800. Gate: 1375 Angular
unit tests, lint, `tape-layout` e2e locally; full e2e in CI.

**Done:** [Touch review follow-ups (#156)](https://github.com/LilSticky/crancula/issues/156) (2026-10-24, branch
`156-touch-review-follow-ups`): a Hole under a cell is looked up in the Tape (`holeCovering` in `api`); the Spot is
`aria-hidden` and the review nits are fixed; a touch ended by `lostpointercapture` no longer blocks touch edits, and a
moved capture keeps the touch (review finding). The Crank speed toast is dropped (user decision, 2026-10-24). The
Crank speed label fits in German. The zoom segment and side panel at 1024 px were already fine since #151 and now have
regression e2e. Dark-mode playhead grip on the page raised from 2.15:1 to 4.1:1 via `--cr-select-on-page` (grips and
playhead on the Tape were already 4.8:1). `ux:screens` captures 08h, 08i and 08j, with no leftover toast. Gate: 883
node and 1375 Angular unit tests, lint, i18n (317 keys); e2e in CI.

**Done:** [UX findings in #151](https://github.com/LilSticky/crancula/issues/151) (2026-10-24, branch
`151-preview-ux-findings`): the German page head no longer clips the 2:1 zoom toggle; the Export button stays on one
line; the Tape section's Organ row sits on one baseline with a gap before Parts on the Tape; the Tape per Crank turn
label and Lead-in height finding no longer reproduces at 1440×900 (regression e2e added). The README fixture now has a
Tape per Crank turn and the README screenshots are retaken. New layout e2e: `e2e/tape-layout.spec.ts` and
`e2e/organ-layout.spec.ts`.

**Done:** [Edit a tape by touch](../specs/008-edit-a-tape-by-touch/spec.md)
([#152](https://github.com/LilSticky/crancula/issues/152), v0.2, merged 2026-10-24, branch `008-edit-a-tape-by-touch`,
PR [#155](https://github.com/LilSticky/crancula/pull/155)): all five stories. Tap selects a Spot and a second tap adds
a Hole; grips outside the selected Hole, double-tap removes; a finger drag on empty Tape scrolls, two fingers edit
nothing; drag the playhead; a Crank speed range per Organ (Organ snapshot v5, older Organs 30–120) with a Crank speed
slider. [ADR 25](adr/0025-one-gesture-model-for-all-pointer-types.md): one gesture model for all pointer types.
Reviewed (angular, UX, spec audit) and fixed; open follow-ups in
[#156](https://github.com/LilSticky/crancula/issues/156), notes in [audit.md](../specs/008-edit-a-tape-by-touch/audit.md).
Gate: 879 node and 1369 Angular unit tests, lint, i18n (317 keys); e2e green in CI on Linux, Windows and macOS.

**Done:** [Crank a tape](../specs/007-crank-a-tape/spec.md) ([#149](https://github.com/LilSticky/crancula/issues/149),
v0.2, 2026-10-24, branch `007-crank-a-tape`, PR #150): Preview a Tape with a synthesised tone per Pipe and a
playhead (toolbar button or Space), from any Column (ruler or field); each Tape keeps an undoable Crank speed
(1–300 turns per minute, 60 to begin with; Tape snapshot v2); an Organ may describe its Tape per Crank turn
(Organ snapshot v4; older Organs have none until entered, and their Tapes can't be heard). Editing waits while it
plays. [ADR 24](adr/0024-preview-synthesised-with-web-audio.md): Web Audio in the renderer behind a port, look-ahead
scheduler on the audio clock. Review findings fixed; accepted test gaps in
[audit.md](../specs/007-crank-a-tape/audit.md). T044 (ux-review) not done: [#151](https://github.com/LilSticky/crancula/issues/151). Gate: 844 node
and 1270 Angular unit tests, lint, i18n (309 keys); e2e in CI. Sound itself is not tested automatically; the user
listened to a Preview by hand on Windows on 2026-10-24 and it works ([quickstart](../specs/007-crank-a-tape/quickstart.md)).

**Done:** v0.2.0 released (2026-10-24, [CHANGELOG](../CHANGELOG.md#020---2026-10-24)): Crank a tape (Preview, Crank
speed, Tape per Crank turn). README describes v0.2.0 but keeps the v0.1.1 screenshots: the retaken ones showed the
layout bugs listed in #151.

**Done:** [Adjust a tape](../specs/006-adjust-a-tape/spec.md) ([#107](https://github.com/LilSticky/crancula/issues/107),
2026-10-23, branch `006-adjust-a-tape`, PR #143), the last part of Edit a tape
[#103](https://github.com/LilSticky/crancula/issues/103), which is now done with
[#105](https://github.com/LilSticky/crancula/issues/105), [#106](https://github.com/LilSticky/crancula/issues/106) and #107.
The Column length is a field in the Tape section of the side panel; Apply or Enter changes the Tape, and a hint shows
the Cutting Problems now and after the change. One undo step; German comma input. Review fixes: Cutting Problems are
counted once per Tape, and the section gets the saved Tape, not the drag preview. The field no longer makes the side
panel scroll sideways (e2e at 1280×800 and 1024×700). UX capture 08g; review notes in
[audit.md](../specs/006-adjust-a-tape/audit.md). Gate: 778 node and 1151 Angular unit tests, lint, i18n (295 keys)
and the full e2e suite green in CI on Linux, Windows and macOS.

**Done:** v0.1.1 released (2026-10-23, [CHANGELOG](../CHANGELOG.md#011---2026-10-23)): Edit a tape (place Holes
by hand, transpose Holes, change the Column length, undo and redo), Rename a Tape, the live Tape preview on the import
screen, and fixes. README describes v0.1.1 with new screenshots.

**Done:** discovery for the roadmap's "Later" items (2026-10-23, [discovery/later.md](discovery/later.md)): 14
decisions by the user. Order and versions: v0.2 Crank a tape (turns per minute, the Organ gains Tape per Crank turn,
synthesised tone, playhead) and Record a tape; v0.3 Bring Scores onto a tape (MusicXML only, one Part per staff,
repeats played out); v0.4 Cut a tape in pieces (a described Plotter, Hole-free Joins with a glue overlap); then Read a
tape as Scores. DXF/HPGL wait for a device. Open: the minor-versus-patch rule for releases.

**Done:** flaky Electron launch on Linux CI ([#145](https://github.com/LilSticky/crancula/issues/145), 2026-10-23):
one launch in ~117 failed with "Missing X server or $DISPLAY" although Xvfb was up. `launchApp` now retries only that
error (3 attempts, 500 and 1000 ms apart); other launch failures still fail. The retry path is verified by review
only; reopen if it recurs.

**Done:** Air Demand dropped from scope (2026-10-22, user decision): it came from a misunderstanding and was never
meant to be built; removed from ROADMAP, README and the constitution (1.1.3).

**Done:** flaky tape-rename e2e on Windows ([#139](https://github.com/LilSticky/crancula/issues/139), 2026-10-22): a
blocked snapshot rename (EPERM/EBUSY/EACCES) was retried only 10 × 40 ms, and a failed write is never retried on its
own, so a longer antivirus lock left `tapes.json` with the old name. The retry now doubles its wait (7 attempts,
about 2.5 s). Not proven from the CI trace (an Electron trace has no app log); reopen if it recurs.

**Done:** flaky Transpose e2e on Windows ([#133](https://github.com/LilSticky/crancula/issues/133), PR #134): keyboard tests wait for focus to enter the dialog before tabbing.


**Done:** menu Undo and Redo act on the Tape ([#122](https://github.com/LilSticky/crancula/issues/122), PR #135, 2026-10-22, branch
`122-menu-undo-redo`). The menu sends an Edit Command over `edit:command`; text fields keep their own undo, the
Tape view handles the rest, and a dialog that is open stops it. Design: [discovery/menu-undo-redo.md](discovery/menu-undo-redo.md).
Gate: 765 node + 1114 Angular unit tests, lint, i18n and 113 e2e green. Known gap: not tried on a real Mac yet.

**Done:** Transpose holes ([#106](https://github.com/LilSticky/crancula/issues/106), part of Edit a tape
[#103](https://github.com/LilSticky/crancula/issues/103), branch `005-transpose-holes`, PR #130, 2026-10-22): transpose all or
the selected Holes by semitones, in a dialog that shows the outcome (octave moves, removals, merges) before it
applies. Several Holes are selected by Ctrl/Cmd-click, frame drag, Ctrl/Cmd+Arrow and Ctrl/Cmd+A; each
transposition is one undo. Gate: 1092 unit tests (Angular) and 737 node tests, lint and i18n green; 105 e2e green locally.
Also: the `test-first` agent runs on Haiku ([#129](https://github.com/LilSticky/crancula/issues/129), PR #128); the
`implementer` too, and `angular-reviewer`/`electron-reviewer` on Opus ([#132](https://github.com/LilSticky/crancula/issues/132), PR #131).

**Done:** [Tape view UX findings 14–18](https://github.com/LilSticky/crancula/issues/121) (2026-10-20, branch
`121-tape-view-ux`): sections editable first in the side panel, with Tape details and Import Summary collapsible.
A Cutting Problem mark shows a "!" glyph also on a selected Hole; handle hit areas are at least 24 px. Pipe and
Column sit on one row in Add a Hole, with a Column hint. Cutting Problems entries have accessible names, an icon and
a hover state; Selected Hole warnings are shorter. Undo and Redo icons are disabled in on-surface-variant (their
labels already name the shortcut). Gate: 1037 unit tests, lint, i18n, build and e2e/tape-edit green locally; full
e2e in CI.

**Done:** [Place holes by hand](../specs/004-place-holes-by-hand/spec.md)
([#105](https://github.com/LilSticky/crancula/issues/105), part of Edit a tape
[#103](https://github.com/LilSticky/crancula/issues/103), branch `004-place-holes-by-hand`, PR #108, merged 2026-10-20 as 973f89f):
all 76 tasks in [tasks](../specs/004-place-holes-by-hand/tasks.md). Move, resize, add and remove Holes by pointer and
keyboard; Cutting Problems as you edit; undo and redo; the Tape grows. Decisions in
[discovery/edit-a-tape.md](discovery/edit-a-tape.md) and [ADR 22](adr/0022-tape-edits-as-domain-commands.md). A
refused drop shows a ghost (`hole-ghost`) at the pointer. Polish (Phase 9) and the `spec-auditor` pass found no
gaps; ux-review 38/50 (captures 08d–08f). Findings 14–18 are in [#121](https://github.com/LilSticky/crancula/issues/121)
(T077–T086). Gate: lint, i18n (273 keys), 1016 Angular and 714 node unit tests, build and 104 e2e green locally.

**Done:** [Bring a song onto a tape](../specs/002-bring-a-song-onto-a-tape/spec.md)
([#2](https://github.com/LilSticky/crancula/issues/2), PR #51, 2026-10-14): all 78 tasks. MIDI Song
import, Tape domain (Quantisation, Transposition, Fit, Hole fixes), Tape library snapshot, IPC and
UI in German and English. Gate: lint, i18n (136 keys), 456 node and 251 Angular tests, build and
31 e2e green locally. The slice's ADRs are 17 and 18.

**Done:** [Describe my organ](../specs/001-describe-my-organ/spec.md) (PR #15, 2026-10-14). Change from
the plan: Angular specs in jsdom ([ADR 9](adr/0009-angular-specs-in-jsdom.md)).

**Tech stack updated** (2026-10-14, [#13](https://github.com/LilSticky/crancula/issues/13),
[ADR 14](adr/0014-current-major-versions-with-dependabot.md)): Angular 22, Material 22, NgRx Signals 22,
ngx-translate 18, Electron 44, TypeScript 6, Vitest 5, Playwright 1.64, ESLint 10 flat config, Node 24;
Dependabot opens weekly grouped updates. Migration fixes: ngx-translate 18 standalone `TranslatePipe`,
`withXhr()` for the HTTP loader, TS 6 `paths` without `baseUrl`, `node16` modules for the main process,
and a storage problem is reported once again (an effect re-ran on language changes). Local gate:
lint, i18n, 130 node + 108 Angular tests and 16 e2e green.

Other changes on 2026-10-14: README for organ owners and MIT license; punched-tape logo, favicon and
app icon; splash for the portable Windows build; fonts ship with the app (#24).

**Organ editor on signal forms** (2026-10-14, [#13](https://github.com/LilSticky/crancula/issues/13),
research R6 revised): `form()` over `OrganDraft`, `[formField]` inputs, one `validateTree` rule fed by
`validateOrgan`, a `ShownViolationMatcher` instead of the `crancErrorState` directive. Lint, i18n,
120 Angular tests and 18 e2e green. Unreadable number text shows "Enter a number.".

**Design guide** (2026-10-15, [#12](https://github.com/LilSticky/crancula/issues/12)):
[DESIGN-GUIDE.md](DESIGN-GUIDE.md) and [design/theme.scss](design/theme.scss), direction "the organ
builder's workshop" with borrowings, chosen by the user from four parallel variants
([COMPARISON.md](design/COMPARISON.md)); the current UI scores 29/50 in the `ux-review` rubric, the
variants 40–42 (self-reviews). New tooling: `ux-review` skill, `ux-designer` agent, `npm run ux:screens`.
The Tape is drawn horizontally, row 1 on top (user decision). German for Tape is now Lochband
(dictionary, UI texts). Applying the guide to the app: [#59](https://github.com/LilSticky/crancula/issues/59).

**Done:** [#62](https://github.com/LilSticky/crancula/issues/62) theme and fonts
(2026-10-15, PR #70). Noto Sans and Libertinus Serif bundled, Roboto removed.
Workshop theme with light-dark tokens; the scheme follows the system until #63. `provideFormFieldDefaults()`
makes fields outlined app-wide, because the theme's density -2 hides fill-field labels (found by the
ux-review). The Libertinus licence now carries the upstream notice. `ux:screens` waits for dialogs and
animations. ux-review 30/50 (was 29/50), see [design/screens/current/ux-review.md](design/screens/current/ux-review.md).
Gate: lint, 253 Angular tests and node tests, 31 e2e green locally.

**Done:** #63 shell and navigation (2026-10-15, PR #71). Walnut rail in a `mat-sidenav`
shell (icon rail with tooltips below 1180 px; only the content scrolls). Organs is the start page,
Overview removed. Language and scheme toggles sit in the rail; scheme is System, Light or Dark and is
remembered in localStorage like the language (`SchemePreference`, `LanguagePreference`). Shared
`cranc-page-head` on every page, `cranc-action-bar` ready for #64. Toggle outlines on walnut lightened
to 3:1. ux-review 33/50 (was 30/50), see [design/screens/current/ux-review.md](design/screens/current/ux-review.md).
Gate: lint, i18n, unit tests and 32 e2e green locally.

**Done:** #74 derived Border (2026-10-15, PR #75, merged 2026-10-15). The Border is derived, not entered:
(tape width - Row Span) / 2, rows centred, row 1 nearest the top; 0 is valid, negative means the rows
don't fit. Domain (`border`, `tapeBedFit`, no `border` in `TapeBed`/draft/validation), Organ snapshot
version 2 without `border` (version 1 still reads, [ADR 20](adr/0020-snapshots-migrated-on-read.md)),
dictionary (Tape Bed, Border, Row Span), Organ editor shows the Border read-only, spec 001 amended.
Gate: lint, i18n, 485 node and 315 Angular tests and 34 e2e.

**Done:** #64 Organ editor (2026-10-16, PR #77 merged 2026-10-16). Two sheets: the Tape Bed with a fit
check and a drawing, plus read-only Border and Minimum Hole Length; the Pipes in a 3-column rack
(2 columns below 1180 px) with a row menu and Alt+arrow moves. Decimal fields take a comma or a point,
in the language's notation. Action bar with save state and Discard changes; an error summary on Save;
Delete and the subtitle sit in the page head; "Organ saved" snackbar; calmer leave dialog. The editor
fits one screen at 1280×800 and 1024×700. ux-review 36/50 (was 31/50; values in
[design/screens/current/ux-review.md](design/screens/current/ux-review.md)). #72 fixed on this branch.
Gate: lint, i18n (162 keys), 486 node and 447 Angular tests, e2e green locally. Follow-up:
[#76](https://github.com/LilSticky/crancula/issues/76) splits the editor component.

**Done:** #78 Lead-in (2026-10-16, PR #79 merged 2026-10-16). Every Organ has a Lead-in, the blank Tape
before Column 1 with an angled start (Vorlauf): mm, 0 is valid, negative is not, new Organs start
empty and required. Organ snapshot version 3 with `leadIn`; versions 1 and 2 load with 0
([ADR 20](adr/0020-snapshots-migrated-on-read.md)). The Organ editor shows it after Minimum Gap;
dictionary (Lead-in) and spec 001 (FR-017) amended. Gate: lint, i18n, 495 node and 457 Angular tests,
44 e2e green locally.

**Done:** #65 Tape view (2026-10-16, PR #81 merged 2026-10-16). Tape at true millimetres with the Lead-in
(angled start), rows centred with row 1 on top, Holes drawn as cut (slots with half-circle ends). mm
ruler and Column numbers; zoom Whole Tape / 1:1 / 2:1; overview strip. Side panel with a Tape section,
Import Summary (Transposition, Notes moved by octaves, Unplayable Notes, Holes fixed; dismissable) and
Selected Hole inspector (gap to the next Hole or the Tape's end, warnings below Minimum Hole Length /
Minimum Gap). Keyboard selection; status line with pointer position and save state; Tape details toggle
below 1180 px; only visible Columns render. User decisions 2026-10-16 recorded in
[DICTIONARY](DICTIONARY.md) (Hole shape, Import Summary / Importübersicht / Angepasste Löcher, Lead-in /
Vorlauf). ux-review 38/50 (see [design/screens/current/ux-review.md](design/screens/current/ux-review.md)).
Gate: lint, i18n (197 keys), 495 node and 585 Angular tests, 56 e2e green locally. On macOS CI the
21 layout e2e tests skip because the runner's screen is too small; they run on Windows and Linux.
Follow-up: [#80](https://github.com/LilSticky/crancula/issues/80) splits the Tape view.

**Done:** #66 Organ and Tape lists (2026-10-16, PR #83 merged 2026-10-17). Ledgers (mat-table with column
headers) sorted by name per language. Organ rows show the Pipe range, Tape Bed facts, a Tape Bed
miniature and a Tapes link that filters the Tape list; row menus with Delete. The Tape list is grouped
by Organ with an Organ filter chip. Empty states lead to the next step (describe an Organ first; bring a
Song onto a Tape); next-step strip. User decisions 2026-10-16: no created date, order by name, Pipe range
lowest–highest only, Rename a Tape split to [#82](https://github.com/LilSticky/crancula/issues/82).
ux-review 38/50. Gate: lint, i18n (213 keys), 495 node and 640 Angular tests, 60 e2e green locally.

**Done:** #69 Tape import (2026-10-17, PR #86 merged 2026-10-17). Import screen in two sheets: Song with a
file chip; Organ with the Pipe range, Parts list, Transposition stepper with the proposal explained; Fit
as a result card. Each Fit count expands to its Notes before Create, via a new domain function
`fitNotesOf` that `createTape` shares. Warning when Unplayable Notes are above 0 (Create stays possible).
Column length in mm in the language's notation. The action bar says why Create is disabled. Empty state
without an Organ. Fits one screen at 1024×700; long Parts and Note lists scroll inside. Import Summary
shows "None" for empty items. User decisions 2026-10-17: live Tape preview split to
[#84](https://github.com/LilSticky/crancula/issues/84); Note lists expandable; German percussion is
Schlagwerk (dictionary). ux-review 39/50. Gate: lint, i18n (242 keys), 512 node and 696 Angular tests,
76 e2e green locally. With #69, all sub-issues of [#59](https://github.com/LilSticky/crancula/issues/59)
(apply the design guide) are done; #59 closes with this pull request.

**Done:** Punch a tape ([#3](https://github.com/LilSticky/crancula/issues/3), PR #87 merged 2026-10-17).
Export for the Plotter saves the Tape as one 1:1 SVG: Holes as Slots in cut order by start from the
Lead-in, row 1 first, then the Tape Outline with the Lead-in's diagonal and the end cut one Minimum Gap
after the last Column. A Tape that can't be cut opens a dialog naming every problem Hole (no Pipe, too
short, too close); nothing is written. Selected Hole warnings follow the same Column rules. Below 1180 px
Export is an icon button. German texts. ux-review 40/50 (see [design/screens/current/ux-review.md](design/screens/current/ux-review.md)).
Gate: lint, i18n (251 keys), 640 node and 746 Angular tests, 84 e2e green locally. Tasks in
[tasks](../specs/003-punch-a-tape/tasks.md). **Released:** v0.1.0 (2026-10-18). README shows v0.1 with screenshots (`e2e/ux/readme.capture.ts`, `README_SHOTS=1`); open UI bugs from the captures fixed (#96, #97).

Follow-ups:
[#76](https://github.com/LilSticky/crancula/issues/76), [#80](https://github.com/LilSticky/crancula/issues/80) and
[#85](https://github.com/LilSticky/crancula/issues/85) (component splits),
Lead-in label in the Tape drawing (ux-review finding 11, not filed).
Open issues carry `priority:` and `size:` labels; triage sets them.
Fixed 2026-10-19: flaky cut-order export e2e ([#99](https://github.com/LilSticky/crancula/issues/99)); it read
the SVG as soon as the file existed, before `writeFile` finished, and now waits for the success snackbar.
Done 2026-10-19: Rename a Tape ([#82](https://github.com/LilSticky/crancula/issues/82)) from the Tape list's
row menu, in a dialog with the name field; a blank name is refused (`renameTape`, `TapeLibrary.rename`).
Not in the Tape view's page head (left out while Edit a tape works there).
Done 2026-10-19: ESM main process ([#47](https://github.com/LilSticky/crancula/issues/47),
[ADR 23](adr/0023-esm-main-process-commonjs-preload.md), supersedes ADR 12): `app/main.mjs` in ESM,
the sandboxed preload stays CommonJS; electron-reloader 2.0.0, its Dependabot hold removed. Gate: lint,
802 tests, 91 e2e, a packaged launch and a `--serve` reload checked locally.
Done 2026-10-19: live Tape preview on the import screen ([#84](https://github.com/LilSticky/crancula/issues/84)):
`cranc-tape-preview` draws the first Columns from `tapeGeometry`, 160 px tall at any Tape width (user decision:
a fixed-height strip, not 1:1, which made the Fit card scroll). The Fit sheet scrolls in short windows. It
uses `outline` from the Tape view but not `holeRects`, which slice 004 changes.
Fixed 2026-10-19: the import screen's Song sheet spilled under the action bar in short windows
([#118](https://github.com/LilSticky/crancula/issues/118)); it now scrolls inside itself, and only the Parts list shrinks.

## Known broken / WIP

- Fixed (#97, 2026-10-19): at Whole Tape the ruler numbers and row labels overlapped; the ruler steps
  10/20/50/100/… mm to keep numbers 40 px apart and crowded rows are labelled every k-th row
  (`e2e/tape-whole-tape-marks.spec.ts`).
- Fixed (#96, 2026-10-18): the Pipe rack's MIDI note fields clipped to one digit at 1280 px and their
  width varied by row; the note field now has a fixed width (`e2e/pipe-note-width.spec.ts`).
- Fixed (#58, 2026-10-18): saving a snapshot failed for good on Windows when another process held the file open
  during the atomic rename (EPERM/EBUSY/EACCES); the rename is now retried up to 10 times, 40 ms apart.
- Fixed (#57, 2026-10-18): View > Reload showed a file-not-found page after any navigation (path URLs under
  `file://`; it also made `e2e/fonts.spec.ts` flaky). The router uses hash location and the build sets the base
  href to `./index.html`, so every URL stays on `index.html`.

## Open questions

- Release workflow ([#11](https://github.com/LilSticky/crancula/issues/11)): `.github/workflows/release.yml`
  packages on Linux, Windows and macOS. A pushed tag `v*` also creates a draft GitHub Release; a
  manual run, or a pull request that changes the workflow or `electron-builder.json`, only builds
  artifacts. Builds are unsigned. v0.0.1 (2026-10-14) is the first release from a tag; v0.1.0
  (2026-10-18) completes v0.1. Release with `/release` (ADR 19); notes come from `CHANGELOG.md`.
  `/release` also brings the README up to date, including its **Releases** list (one row per version).

## Process changes

- 2026-10-17: sessions wrap up before the plan limit cuts them off. The project status line
  (`.claude/hooks/usage-guard.mjs`) records the 5-hour and 7-day usage; at 95% used
  (`CRANCULA_USAGE_WRAP_UP` changes it) a PostToolUse hook tells the session once to commit the work in progress,
  update STATUS with the next step, push and stop. Only Pro/Max sessions get the usage data.
- 2026-10-15: a machine that last pulled before the 2026-10-14 rewrite has a local `main` with no merge
  base; reset it to `origin/main` after checking that every local commit subject exists there.
- 2026-10-15: after every merge the `housekeeper` cleans up the local Git state (pruned remote
  branches, merged local branches and worktrees, stale build output); part of the workflow in AGENTS.md.
- 2026-10-14: commits are authored as LilSticky with the GitHub noreply address, set per repository.
  `main` was rewritten once (force-push with the ruleset paused) to remove `Co-authored-by` lines
  with a work email; the trees are unchanged, all commit SHAs changed. Open branches were rewritten too.
- 2026-10-14: branches reach `main` only through pull requests that reference their issues
  (`Closes #N` / `Refs #N`), then get squash-merged by the agent (ADR 10, constitution 1.1.0).
- 2026-10-14: the e2e suite runs in CI on Linux, Windows and macOS and replaces the manual
  walkthrough as proof that a slice runs in Electron (ADR 13, constitution 1.1.1).
- 2026-10-14: the repository is public, and the ruleset "No direct push to main" enforces ADR 10
  ([#18](https://github.com/LilSticky/crancula/issues/18)): no direct or force pushes, no deletion,
  pull request required (no approvals), the three CI checks "Lint, test and build" and
  "References an issue (ADR 10)" must pass,
  squash merge only; merged branches are deleted. Merging with red CI is no longer possible.
- 2026-10-14: e2e runs keep the Electron window out of sight (`CRANCULA_HEADLESS`, set by the e2e
  launcher); `HEADED=1` shows it, slowed down and traced.
- 2026-10-14: GitHub issue tooling: issue forms per label, a pull request template, a CI check
  that the pull request body references an issue, and the Spec Kit `github` extension
  (`/speckit-github-taskstoissues`). Board automation and the Claude GitHub Action are still open
  ([AGENTIC-TODO](AGENTIC-TODO.md#github)).
- 2026-10-14: automatic issue triage ([#34](https://github.com/LilSticky/crancula/issues/34), ADR 15):
  issue forms add `triage`, the Claude triage Action labels and comments, `/triage` does the same
  locally; `@claude` works in issues and pull requests. Triage verified on [#37](https://github.com/LilSticky/crancula/issues/37) (labelled, commented, `triage` removed). The first runs failed with HTTP 429 because the Claude subscription had hit its session limit; triage shares the user's subscription quota. The Claude GitHub App is installed (`@claude` works) and the board adds new issues itself.
- 2026-10-14: Dependabot pull requests skip the issue reference check, and patch and minor updates
  squash-merge automatically once CI is green; major updates stay manual (ADR 16, amends ADR 10 and 14).
  The repository setting "Allow auto-merge" is on (checked 2026-10-15); no patch or minor update has
  merged itself yet.
- 2026-10-14: Dependabot major updates evaluated ([#49](https://github.com/LilSticky/crancula/issues/49)):
  `actions/checkout`, `setup-node` and `upload-artifact` moved to v7. Majors of `@types/node` (until the
  Electron Node runtime moves beyond 24) and `electron-reloader` are held in `dependabot.yml`;
  `electron-reloader` waits for the ESM main process ([#47](https://github.com/LilSticky/crancula/issues/47)).
  A flaky macOS e2e test is tracked in [#48](https://github.com/LilSticky/crancula/issues/48).
- 2026-10-22: TypeScript 7 held in `dependabot.yml` ([#136](https://github.com/LilSticky/crancula/issues/136)):
  Angular 22 (including 22.3.0-next) requires TypeScript `>=6.0 <6.1`, so `npm ci` failed on #116,
  which is closed. Remove the hold once Angular's peer range allows 7.
