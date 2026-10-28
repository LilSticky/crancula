# Status

Where work stands right now. Updated in every change (constitution, principle VI).
Plan: [ROADMAP.md](ROADMAP.md) · Decisions: [adr/](adr/README.md) · Language: [DICTIONARY.md](DICTIONARY.md) ·
Issues: [GitHub](https://github.com/LilSticky/crancula/issues) · What shipped: [CHANGELOG.md](../CHANGELOG.md)

Finished work is not kept here: it lives in the [CHANGELOG](../CHANGELOG.md), the [ROADMAP](ROADMAP.md), the slice folders
in `specs/` and the Git history. Cleaned up on 2026-10-28.

## Current slice

[014 Off-centre rows on a Tape Bed (#163)](../specs/014-off-centre-rows-on-a-tape-bed/spec.md), PR [#202](https://github.com/LilSticky/crancula/pull/202), implemented; reviews fixed ([review-angular.md](../specs/014-off-centre-rows-on-a-tape-bed/review-angular.md), [audit.md](../specs/014-off-centre-rows-on-a-tape-bed/audit.md)).
An optional Guide margin on the Tape Bed (guide edge to the centre of row 1; empty means centred); the Border is per side
(guide side, far side). Organs snapshot v6; v1–5 load centred ([ADR 20](adr/0020-snapshots-migrated-on-read.md)). Presets
20er and 31er carry Guide margins 10 and 11 mm.

**Next step:** merge PR [#202](https://github.com/LilSticky/crancula/pull/202) once CI is green, then [#198](https://github.com/LilSticky/crancula/issues/198) (side-by-side UX follow-ups).
Nothing has been released since v0.2.0 (2026-10-24); `[Unreleased]` in the CHANGELOG holds Presets, Record, Scores in and
out, Plotters and Tape pieces, side by side and the Guide margin, so a release (`/release`) is due.

**Open in slice 014:** T017 (`ux:screens` and `ux-review` of the Organ editor), a small field change.

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

- [#198](https://github.com/LilSticky/crancula/issues/198): side-by-side UX follow-ups from the slice 013 review.
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
