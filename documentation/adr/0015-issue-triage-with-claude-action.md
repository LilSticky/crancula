# 15. Issue triage with the Claude GitHub Action

Date: 2026-10-14

## Status

Accepted

## Context

[ADR 10](0010-merge-through-pull-requests.md) made GitHub Issues and pull requests the record of
all work: slices, tasks, bugs and domain questions. Agents in local sessions pick work from issues,
but a new issue arrives raw: the type label may be wrong, it may duplicate another issue, it may
lack the information needed to start, or it may use words that are not in the dictionary. Sorting
this by hand is the kind of upkeep that stalled the project before.

Claude Code runs in GitHub Actions through `anthropics/claude-code-action`, with the repository's
`.claude/` agents, skills and hooks. The user has a Claude subscription, so the action can
authenticate with a subscription token instead of a paid API key.

## Decision

We will triage issues automatically with the Claude GitHub Action, and answer `@claude` mentions:

- Issue forms add a `triage` label. `.github/workflows/claude-triage.yml` runs the `triage` skill
  (`.claude/skills/triage/`) whenever an issue gets that label. Adding the label by hand triages
  again; local sessions run the same skill with `/triage`.
- Triage sets the type label, flags likely duplicates (`duplicate`) and missing information
  (`needs-info`), names dictionary terms and the related slice in one short comment, then removes
  `triage`. It never closes an issue, edits its text, or changes code.
- Triage runs for anyone's issue, with only read access to the repository and label/comment tools,
  on Sonnet to save quota. The issue text is treated as untrusted.
- `.github/workflows/claude.yml` runs Claude Code when a user with write access mentions
  `@claude` in an issue, pull request or review. Its changes reach `main` through a pull request
  like any other (ADR 10).
- Both authenticate with the `CLAUDE_CODE_OAUTH_TOKEN` secret (`claude setup-token`); the Claude
  GitHub App gives `@claude` its own identity.
- The Project board's built-in auto-add workflow puts new issues on board 1; no token is needed
  for that.

## Consequences

- New issues are labelled and checked within minutes, so an agent can take them without a sorting
  step. Agent-created issues (task issues, `housekeeper`) carry no `triage` label and are not
  triaged, which keeps quota use low.
- Runs use the user's subscription quota; a burst of issues can exhaust it for a while.
- A prompt injection in an issue can at worst set labels or post a comment.
- Labels and comments written with the workflow token do not trigger further workflows, so triage
  cannot loop.
- The secret and the GitHub App are set up by the user once; without the secret both workflows fail.
