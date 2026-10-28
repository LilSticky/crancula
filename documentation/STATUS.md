# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues) · What shipped: [CHANGELOG.md](../CHANGELOG.md)

Finished work is not kept here: it lives in the [CHANGELOG](../CHANGELOG.md), the [ROADMAP](ROADMAP.md), the slice folders
in `specs/` and the Git history. Cleaned up on 2026-10-28.

## Current slice

None. The last one, [014 Off-centre rows on a Tape Bed (#163)](../specs/014-off-centre-rows-on-a-tape-bed/spec.md), merged on
2026-10-28 (PR [#202](https://github.com/LilSticky/crancula/pull/202)): an optional Guide margin on the Tape Bed, the Border per
side (guide side, far side), Organs snapshot v6, Guide margins on the 20er and 31er Presets. Its T017 (`ux:screens` and
`ux-review` of the Organ editor, a small field change) was not done.

[#198](https://github.com/LilSticky/crancula/issues/198) (side-by-side UX follow-ups, branch `198-side-by-side-ux`) is done:
Whole Tape / 1:1 zoom, hatched overflow, Save disabled with its reason without a roll plotter, an all/none tick box and the
Cutting Problems count in the Tape list, Lane rows in measure columns, the Tape spacing hint in the card subtitle
([tasks-198.md](../specs/013-cut-several-tapes-side-by-side/tasks-198.md),
[review-angular-198.md](../specs/013-cut-several-tapes-side-by-side/review-angular-198.md), all fixed).

**Next step:** release v0.3.0 (`/release`; version decided by the user on 2026-10-28, hand checks below stay open).
Nothing has been released since v0.2.0 (2026-10-24); `[Unreleased]` in the CHANGELOG holds Presets, Record, Scores in and
out, Plotters and Tape pieces, side by side and the Guide margin, so a release (`/release`) is due.

## Not checked by hand yet

These need the user, a real file or a real machine; the automated tests pass.

- 014 T021: cut and play a 20er Tape with the Guide margin.
- 013 T043: a side-by-side SVG in Inkscape and on the vinyl cutter.
- 012 T057: an exported MusicXML in MuseScore 4 (SC-001, SC-002, SC-004). T056 (gate run) is unticked: its e2e results
  were not recorded.
- 011 T062: Tape piece SVGs in Inkscape, and a real Tape glued from pieces.
- 010 T063: real MuseScore and Audiveris files.
- 009: listening to a Recording (WAV and MP3).
- [#122](https://github.com/LilSticky/crancula/issues/122): menu Undo and Redo on a real Mac.

## Follow-ups

- Lead-in label in the Tape drawing (ux-review finding 11, not filed).

## Known broken / WIP

None.

Watch: the Linux CI launch retry ([#145](https://github.com/LilSticky/crancula/issues/145)) and the Windows snapshot
rename retry ([#139](https://github.com/LilSticky/crancula/issues/139)) are verified by review only; reopen if either
flake recurs. On macOS CI the layout e2e tests skip because the runner's screen is too small; they run on Windows and
Linux.

## Open questions

None.

## Standing notes

- Dependabot holds in `dependabot.yml`: TypeScript 7 until Angular's peer range allows it
  ([#136](https://github.com/LilSticky/crancula/issues/136)); majors of `@types/node` until Electron's Node runtime moves
  beyond 24. Patch and minor updates squash-merge themselves once CI is green (ADR 16).
- Sessions wrap up before the plan limit: `.claude/hooks/usage-guard.mjs` tells a session once, at 95% of the 5-hour or
  7-day usage (`CRANCULA_USAGE_WRAP_UP`), to commit, update STATUS, push and stop.
- A machine that last pulled before the 2026-10-14 rewrite of `main` has no merge base; reset its local `main` to
  `origin/main` after checking that every local commit subject exists there.
- The Claude triage Action shares the user's subscription quota; it fails with HTTP 429 when that limit is hit.
- The Project board adds new issues itself; issues from before its auto-add workflow were added by hand.
