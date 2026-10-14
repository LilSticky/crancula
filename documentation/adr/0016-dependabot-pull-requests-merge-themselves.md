# 16. Dependabot pull requests merge themselves

Date: 2026-10-14

## Status

Accepted

## Context

[ADR 10](0010-merge-through-pull-requests.md) requires every pull request body to reference an
issue, checked by CI. [ADR 14](0014-current-major-versions-with-dependabot.md) has Dependabot open
weekly pull requests, which are merged like any other. A Dependabot pull request has no issue, so
the check fails on every one, and each routine update waits for a manual squash-merge even when the
full CI run, including e2e (ADR 13), is green.

## Decision

We will exempt Dependabot pull requests from the issue reference check and merge safe ones
automatically.

- The "References an issue (ADR 10)" job is skipped when the pull request author is
  `dependabot[bot]`. A job skipped by its `if` reports as skipped, which counts as passing for a
  required check.
- `.github/workflows/dependabot-automerge.yml` reads the update type with
  `dependabot/fetch-metadata` and, for patch and minor updates, runs `gh pr merge --auto --squash`.
  The ruleset on `main` still requires the green CI checks before the merge happens.
- Major updates are not enabled for auto-merge; they follow the migration guide and are merged by
  hand (ADR 14).
- The repository setting "Allow auto-merge" must be on.

## Consequences

- Routine updates need no attention once CI passes; the ruleset remains the gate.
- Behaviour changes in a minor update that the tests do not cover will merge unnoticed. Behaviour
  belongs in tests (ADR 14).
- Grouped updates are classified by the highest update type in the group.
- The exemption keys on the author login; it must be revisited if Dependabot's login changes.
