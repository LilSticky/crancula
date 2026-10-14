# Versioning Crancula

Crancula is a desktop app, not a library. A version number tells an **organ owner** what to
expect, so "public API" means what they see and keep: the app's behaviour, its files on disk and
the downloads. Adapted from the `github-release` skill in
[github/awesome-copilot](https://github.com/github/awesome-copilot/tree/main/skills/github-release) (MIT).

## Signals, in order of weight

1. **The diff** since the last tag, read first:
   `git diff <prev>..HEAD --stat -- api src app electron-builder.json` and then the files that matter.
   Skip tests (`*.spec.ts`, `e2e/`), docs, lockfiles and `.claude/`.
2. **The specs**: a slice merged since the last tag (`specs/NNN-*/`, closed `slice` issue) is a
   new capability.
3. **Squash commits** (`git log <prev>..HEAD --oneline`), one per pull request, conventional style.

When they disagree, trust the diff and say so in the version proposal.

## What counts as what

| Change | Bump | Changelog section |
|--------|------|-------------------|
| Snapshot of an older version no longer loads or is migrated one-way; a supported OS or download format is dropped; a capability is removed | MAJOR (from 1.0) | Removed / Changed, marked **Breaking** |
| New slice or new user capability; a new download format; a new language | MINOR | Added |
| Visible change to existing behaviour, no data loss | MINOR | Changed |
| Bug fix, performance, security fix, wording | PATCH | Fixed / Security |
| Refactoring, tests, CI, dependencies, agent tooling, docs | PATCH, or no release | omit unless the user notices |

Snapshots are versioned files in `userData` (ADR 3, ADR 8, ADR 18): any change to a snapshot's
shape or version number needs a close look, it is the most likely breaking change.

## Before 1.0

While the version is `0.x.y`, breaking changes bump MINOR and everything else bumps PATCH. The
[ROADMAP](../../../../documentation/ROADMAP.md) names the milestones: **0.1.0** is the release
once all v0.1 slices ("Describe my organ", "Bring a song onto a tape", "Punch a tape") are done.
Propose 0.1.0 only then; until then stay on `0.0.x`.

## Conventional commit prefixes

| Prefix | Usually |
|--------|---------|
| `feat` | Added (MINOR) |
| `fix`, `perf` | Fixed (PATCH) |
| `feat!`, `fix!`, `BREAKING CHANGE:` footer | Breaking |
| `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `style` | omit unless user-visible |
| `chore(deps)` | omit, unless it changes what the user sees (e.g. a new Electron drops an OS) |

Write entries for organ owners, in dictionary terms (Organ, Pipe, Tape, Hole, Song, …): "Bring a
MIDI Song onto a Tape", not "feat(tape): add midi import".
