# 19. Releases from the changelog, tagged by the agent

Date: 2026-10-15

## Status

Accepted

## Context

v0.0.1 was released by hand on 2026-10-14: version bump through a pull request, a tag on the
squash commit (as [ADR 10](0010-merge-through-pull-requests.md) requires a pull request for
every change), the release workflow from pull request #26 building a draft, release notes written ad hoc. The steps are easy to get wrong
(tagging a branch commit, version files out of step with the tag, notes that drift from what
changed), and the project stalls when such knowledge lives only in a chat.

The `github-release` skill in github/awesome-copilot (MIT) describes a release for libraries:
SemVer from the code diff, Keep a Changelog, a release pull request, tagging left to the user.

## Decision

We will release with a `release` skill (`.claude/skills/release/`) adapted from it:

- `CHANGELOG.md` (Keep a Changelog) is the source of the release notes. The release workflow
  takes the version's section as the GitHub Release notes and fails if it is missing.
- SemVer is judged from the organ owner's view: snapshots that no longer load, removed
  capabilities or dropped platforms are breaking; a new slice is a minor version. Before 1.0,
  `0.0.x` until all v0.1 slices are done, then 0.1.0 (ROADMAP).
- The version bump and changelog go through a pull request (ADR 10). After the squash merge, the
  agent tags that commit, waits for the build, checks the draft and publishes it. Published tags
  are never moved; a broken release gets a new patch version.
- The user confirms the version and the changelog section once; the rest runs autonomously.

## Consequences

- Release notes, version files and tag agree by construction, and the steps survive lost context.
- Each release needs a changelog section; a forgotten one stops the workflow before anything is
  published.
- Pull requests may add user-visible entries under `## [Unreleased]`, but are not required to;
  the release step reconstructs the rest from the diff.
- The agent publishes releases without a human review of the binaries; the three packaging jobs
  and the e2e suite in CI are the only checks.
