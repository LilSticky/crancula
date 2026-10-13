# 10. Merge through pull requests that reference issues

Date: 2026-10-14

## Status

Accepted

## Context

[ADR 6](0006-autonomous-slices-squash-merge.md) lets the agent squash-merge a branch into the
main branch locally. Tasks, bugs and open questions live in GitHub Issues and on the Project
board, but a local merge leaves no link between an issue and the change that resolved it. The user
wants to look at an issue and find the change behind it. CI already runs on every pull request.

ADR numbers 7 to 9 are taken on the branch of the slice "Describe my organ", so this ADR is 10.

## Decision

We supersede ADR 6. Everything it decided stays, except how a branch reaches the main branch:

- Each slice, and any other branch, is built on its own branch with small, descriptive commits
  (conventional-commit style, one concern each).
- Agents work autonomously and only stop to ask the user about domain questions, dictionary
  changes and scope changes.
- Every branch reaches the main branch through a GitHub pull request (`gh pr create`), never
  through a local merge or a direct push to the main branch.
- The pull request references every issue it touches: `Closes #N` for issues it resolves,
  `Refs #N` for issues it only advances. A slice has its own issue, which the pull request closes.
- When the Definition of Done gate is green and CI passes on the pull request, the agent
  squash-merges it itself (`gh pr merge --squash --delete-branch`). The squash commit carries the
  pull request number.

## Consequences

- Each issue links to the pull request that resolved it, and the pull request shows the detailed
  commit history, CI result and diff. The main branch still has one commit per slice.
- Closing issues happens through GitHub when the pull request merges, not by hand.
- Merging needs `gh` with network access; a local-only merge is no longer allowed.
- STATUS must still be accurate after every change, because it is the user's main view.
- Lint, tests and CI must be reliable, since they gate merges without human review.
