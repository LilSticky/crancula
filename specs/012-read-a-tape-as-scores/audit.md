# Audit: slice 012 Read a tape as Scores

Spec audit (`spec-auditor`, 2026-10-26) of branch `012-read-a-tape-as-scores`, diff `origin/main...HEAD`
(78 files), plus the findings of `angular-reviewer` and `electron-reviewer`. Read-only audit; fixes are
listed under [Follow-up](#follow-up).

## Summary

1. No real gap against the P1 or P2 behaviour: every acceptance scenario of Stories 1–5 and FR-001..FR-019
   has a covering test.
2. Partial: voices 3–4 (and "five layers → voice 4, cut into tied pieces") are tested in `voices.spec.ts`
   only; the writer's `(staff−1)×4+voice` numbering for voices 3–4 is not covered.
3. Partial: flat Key spelling (F major, FR-014) is tested in `spell.spec.ts` only, not in the writer.
4. Partial: "last Bar filled with rests when the Tape is not a whole number of Bars" is tested at the Bar
   level only.
5. Partial: Story 4.5 (several Song changes replaced by one) and Story 1.4 (4/4 then 3/4) have no writer
   test.
6. Minor: "Gap closing meets the Tape's end" has no explicit test (holds by design).
7. Minor: no e2e for a Hole whose Pipe is not on the Organ or for German; acceptable under the test pyramid.

## Test and lint at audit time

- `npm run test:node`: 85 files, 1724 passed, 1 skipped (`app/plotter-ipc.spec.ts:304`, symlink, unrelated).
- `npm run test`: 86 files, 1825 passed.
- `npm run lint -- --quiet`: clean.
- e2e, `i18n:check`, `build`: not run by the auditor (T056).

## Requirements and scenarios → tests

| Requirement / scenario | Covering tests | Status |
|---|---|---|
| US1.1, FR-001: "Export as Scores" in the Export menu, also with Cutting Problems | `tape-view.component.spec.ts`; `e2e/tape-layout.spec.ts`; `e2e/tape-export.spec.ts` | covered |
| US1.2, FR-002/003: dialog, save dialog with `<name>.musicxml`, one file, told where | `scores-export.spec.ts`; `app/scores-ipc.spec.ts`; `scores-file-name.spec.ts`; `scores-save-request.spec.ts`; `e2e/read-a-tape-as-scores.spec.ts` | covered |
| US1.3 (3/4, upbeat 1/4, one sharp) | `scores-bars.spec.ts`; `scores-musicxml.spec.ts` (golden `scores.reference.musicxml`); e2e | covered |
| US1.4 (4/4 then 3/4 from Column 64) | `scores-bars.spec.ts`; writer tie across a Time signature change | Bars level (gap 5) |
| US1.5, FR-013 (tempo 150) | `scores-tempo.spec.ts`; `scores-musicxml.spec.ts`; e2e | covered |
| US1.6, FR-007 (Pipe 67 → G4) | `scores-musicxml.spec.ts` | covered |
| US1.7, FR-017, SC-006 (nothing changes) | `scores-musicxml.spec.ts`; `tape-view.component.spec.ts`; e2e | covered |
| US2.1–2.2, FR-008 (gap closing) | `close-gaps.spec.ts`; `scores-musicxml.spec.ts` | covered |
| US2.3, FR-009 (fewest note values) | `scores-musicxml.spec.ts`; `note-values.spec.ts` | covered |
| US2.4 (tie over the bar line) | `scores-musicxml.spec.ts` | covered |
| US2.5, FR-010 (whole-bar rest, full Bars) | `scores-musicxml.spec.ts` | covered |
| US2.6, FR-012 (chord) | `voices.spec.ts`; `scores-musicxml.spec.ts` | covered |
| US2.7, FR-012 (further voices) | `voices.spec.ts`; `scores-musicxml.spec.ts` (voice 2) | voices 3–4 domain only (gap 2) |
| US2.8 (no Hole lengthened in the Tape) | `close-gaps.spec.ts`; Tape deep-equal test | covered |
| US3.1, FR-005 (prefill split at C4) | `scores-choices.spec.ts`; `scores-staves.spec.ts`; writer | covered |
| US3.2 (add, remove, move split notes) | dialog spec; `scores-choices.spec.ts`; writer | covered |
| US3.3, FR-006 (clefs, octave clefs) | `scores-staves.spec.ts`; `scores-musicxml.spec.ts` | covered |
| US3.4 (remembered per Organ) | `scores-staves-preference.spec.ts`; `scores-export.spec.ts` | covered |
| US3.5, FR-007 (Pipe not on the Organ) | `scores-musicxml.spec.ts`; `scores-staves.spec.ts` | covered |
| US4.1–4.4, FR-004 | `scores-choices.spec.ts`; `scores-bars.spec.ts`; dialog spec; e2e | covered |
| US4.5 (several changes replaced by one) | `scores-bars.spec.ts`; `scores-choices.spec.ts` | partial (gap 5) |
| FR-004 3/64 Song counts as none | `scores-choices.spec.ts`; dialog spec; `scores-bars.spec.ts` | covered |
| FR-007 MIDI 0–11 one octave up | `scores-musicxml.spec.ts`; `spell.spec.ts` | covered |
| FR-011 (Bars cover every Column) | `scores-bars.spec.ts`; e2e | Bar level (gap 4) |
| FR-014 (Key, flats or sharps) | `scores-bars.spec.ts`; `spell.spec.ts`; writer (G major) | partial (gap 3) |
| FR-015 (title) | `scores-musicxml.spec.ts` | covered |
| FR-016 (Organ as it is now) | writer takes the current Organ | implicit |
| FR-018 (write fails → told why) | `app/scores-ipc.spec.ts`; `scores-export.spec.ts` | covered |
| FR-019, US5.1 (de and en) | `tape-i18n.spec.ts`; `tape-german.spec.ts` | covered |
| SC-003 (fewest tied values) | `note-values.spec.ts` | covered |
| SC-005 (10 minutes under 5 s) | T055 | to come |

## Tasks

- T001–T052 are ticked and present in the diff. T021's "Partly done" note is stale.
- No scope creep found: the in-memory `scores.save` in specs is test support.

## Reviews

- `electron-reviewer`: no findings against ADR 4 / ADR 29. Nit: the `isXmlDocument` comment claims a start
  tag check; it only checks that `<root ` appears.
- `angular-reviewer`: must fix — `scoresMusicXml` runs outside the try/catch in `ScoresExport.save()`, so a
  throw shows no failure snackbar. Should fix — `TAPE.SCORES.ERROR.UPBEAT` speaks of Columns but the field
  counts note values; the dialog uses hand-wired signals and a manual `updateErrorState()` effect instead of
  signal forms like the Organ and Plotter editors. Nit — "Another one" starts at 4/4 even when the Song's
  Time signature lies on Columns.

## Follow-up

All findings above are fixed in the commit after this audit (gaps 2–5 get writer tests, gap 6 an explicit
test); gap 7 is accepted.
