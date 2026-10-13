# 1. Record architecture decisions

Date: 2026-10-13

## Status

Accepted

## Context

The project has stalled several times, and every restart began with working out again what had
been decided and why. Humans and autonomous agents both need to recover that from the
repository alone.

## Decision

We record significant architecture decisions as Architecture Decision Records in
`documentation/adr/`, using Michael Nygard's format: title, date, status, context, decision,
consequences. Files are numbered `NNNN-kebab-title.md` and listed in `README.md` in this folder.
An ADR is never deleted or rewritten after acceptance; a new ADR supersedes it, and both are
marked accordingly.

## Consequences

- Every slice that makes a significant decision adds an ADR in the same change.
- Amendments to the constitution require an ADR.
- The index must be kept in sync, which an ADR skill is meant to automate.
