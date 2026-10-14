---
name: release
description: Cut a new Crancula release end to end — propose the SemVer version from the diff and the merged slices, write the CHANGELOG.md section, bump the version through a pull request, tag the squash commit, let the release workflow build Windows/macOS/Linux, check the draft and publish it. Use when the user says "release", "ship a version", "cut v0.0.2", "time for a new version", or asks for a changelog.
---

# Release

Adapted from the `github-release` skill in
[github/awesome-copilot](https://github.com/github/awesome-copilot/tree/main/skills/github-release)
(MIT): read-only reconnaissance first, the code diff as the main signal, Keep a Changelog. Changed
for Crancula: an app for organ owners instead of a library, releases go through a pull request
(ADR 10), and the agent tags and publishes itself (ADR 19).

Versioning rules: [references/versioning.md](references/versioning.md).

## Pieces

| Piece | Role |
|-------|------|
| `CHANGELOG.md` | Source of the release notes. `## [Unreleased]` collects entries; a release turns it into `## [X.Y.Z] - YYYY-MM-DD`. |
| `package.json`, `app/package.json` (+ lockfiles), README badge | Carry the version; the build names its files after `app/package.json`. |
| `.github/workflows/release.yml` | On a pushed tag `vX.Y.Z`: lint and test, package on three OSes, create a **draft** GitHub Release whose notes are the changelog section plus the install note. Fails if the section is missing. |
| Issue [#11](https://github.com/LilSticky/crancula/issues/11) | Tracks the v0.1 release; comment there for each release. |

## Steps

Steps 1–3 only read. Use `gh` and `git`; repo `LilSticky/crancula`.

1. **Preconditions.** `gh auth status`; `git status` clean (otherwise stop and tell the user);
   `git fetch --tags --prune`; `main` up to date. CI on `main` is green
   (`gh run list --branch main --workflow CI --limit 1`). No open pull request that the user wants
   in this release (`gh pr list`); ask if unsure.
2. **Last release.** `PREV=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)`.
   Check it is on the remote (`git ls-remote --tags origin "$PREV"`). If nothing changed since
   (`git log $PREV..HEAD --oneline` is empty), say there is nothing to release and stop.
3. **What changed.** Follow [versioning.md](references/versioning.md): diff first, then merged
   slices and closed issues (`gh issue list --state closed --search "closed:>$(git log -1 --format=%cs $PREV)"`),
   then squash commits. Merge with what `## [Unreleased]` already lists.
4. **Propose** the version and the changelog section in **one** `AskUserQuestion`: the version
   with a two-line rationale citing the diff, and the section as preview. Options: accept,
   different version, edit entries. A version given by the user wins; still show the section.
5. **Branch** `release/vX.Y.Z` from `origin/main` (in this session's tree, or a worktree if
   another session uses it). Then:
   - `npm version X.Y.Z --no-git-tag-version` in the root and in `app/`;
   - README badge: `version-X.Y.Z-b08fd8" alt="Version X.Y.Z"`;
   - `CHANGELOG.md`: move the entries under a new `## [X.Y.Z] - <today, UTC>` below an empty
     `## [Unreleased]`; update the link lines at the bottom
     (`[Unreleased]: …/compare/vX.Y.Z...HEAD`, `[X.Y.Z]: …/releases/tag/vX.Y.Z`);
   - `documentation/STATUS.md`: one line that vX.Y.Z is released (and ROADMAP if it is a
     milestone such as 0.1.0).
   Commit as `chore(release): version X.Y.Z` (version files and changelog) and
   `docs(status): release vX.Y.Z` separately.
6. **Pull request.** `gh pr create --title "chore(release): version X.Y.Z" --body-file <file>`
   with `Refs #11` (or `Closes #11` for 0.1.0), the changelog section, and "Tag `vX.Y.Z` on the
   squash commit after merging". Wait for CI (`gh pr checks --watch`), then
   `gh pr merge --squash --delete-branch`.
7. **Tag** the squash commit, never a branch commit:
   `git switch main && git pull --ff-only`, check `git log -1` is the release commit and
   `grep '"version"' package.json` says X.Y.Z, then
   `git tag -a vX.Y.Z -m "Crancula X.Y.Z" && git push origin vX.Y.Z`.
8. **Build.** `gh run list --workflow release.yml --limit 1`, then `gh run watch <id>`. On failure,
   read `gh run view <id> --log-failed`, fix through a pull request, delete the tag
   (`git push origin :refs/tags/vX.Y.Z && git tag -d vX.Y.Z`) and the draft release
   (`gh release delete vX.Y.Z --yes`) if one exists, and tag again.
9. **Check the draft.** `gh release view vX.Y.Z --json isDraft,body,assets`: three assets
   (`.exe`, `.dmg`, `.AppImage`) named with X.Y.Z, notes equal the changelog section.
10. **Publish** — the user asked for a release, so this is covered:
    `gh release edit vX.Y.Z --draft=false`. Comment the release URL on #11.
11. **Report** in three lines: version, release URL, anything that needs the user.

## Rules

- Never tag before the version pull request is merged; never move or reuse a published tag.
  A broken published release gets a new PATCH version.
- Never push to `main`; the version bump goes through a pull request like any change.
- Changelog entries are for organ owners, in dictionary terms; tooling and refactors stay out
  unless the user notices them.
- Between releases, a pull request with a user-visible change may add its entry under
  `## [Unreleased]`; the release step collects the rest from the diff.
