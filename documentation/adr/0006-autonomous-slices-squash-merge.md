# 6. Autonomous slices on branches, squash-merged

Date: 2026-10-13

## Status

Accepted

## Context

The user wants agents to work mostly autonomously and to follow progress through
`documentation/STATUS.md`, without approving every step. The history has to stay readable.

## Decision

Each slice is built on its own branch with small, descriptive commits (conventional-commit
style, one concern each). When the Definition of Done gate in the constitution is green, the
agent squash-merges the branch into the main branch itself. Agents only stop to ask the user
about domain questions, dictionary changes and scope changes.

## Consequences

- The main branch has one commit per slice; the detailed history lives on the branch.
- STATUS must be accurate after every change, because it is the user's main view.
- Lint and tests must be reliable, since they gate merges without human review.
