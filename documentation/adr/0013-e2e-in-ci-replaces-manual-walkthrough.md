# 13. End-to-end tests in CI replace the manual walkthrough

Date: 2026-10-14

## Status

Accepted

## Context

The first gate item in the constitution, "It runs end to end in the Electron app", was checked by
the user walking through each slice's `quickstart.md` in Electron. That held up slice 001 while it
waited for the user, although the Playwright e2e suite already drives the real Electron app
through every user story.

CI ran lint, translations, unit and component tests, and the build on Linux, Windows and macOS,
but not the e2e suite. So "runs in Electron" was only ever checked on the developer's Windows
machine.

The user decided that a full test run in CI, including the e2e suite, replaces the manual
walkthrough.

## Decision

We will run the e2e suite in CI on Linux, Windows and macOS for every pull request and every push
to `main`.

- On Linux it runs under `xvfb-run`. The Electron sandbox needs unprivileged user namespaces,
  which the job allows through `sysctl`.
- In CI, Playwright runs at full speed and keeps traces only for failing tests. The traces are
  uploaded as an artifact when a job fails.

A green CI run on the pull request fulfils gate item 1. A slice's `quickstart.md` remains a
manual guide, not a gate step. Every acceptance scenario that matters end to end MUST have an e2e
test.

## Consequences

- Agents can merge a slice without waiting for a walkthrough. The user follows along through
  `STATUS.md` and the pull request.
- CI takes longer, mostly on Windows.
- Anything the e2e suite does not cover, such as look and feel or the packaged app, is no longer
  checked by a human before merging. A packaged smoke launch belongs with the release builds
  ([#11](https://github.com/LilSticky/crancula/issues/11)).
- The constitution's gate item 1 is clarified to mean this (version 1.1.1).
