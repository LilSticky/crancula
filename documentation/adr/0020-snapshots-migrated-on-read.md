# 20. Snapshots are migrated on read and written in the newest version

Date: 2026-10-15

## Status

Accepted

## Context

ADR 3 gives every snapshot format a version so that it can be migrated, and ADR 8 moves a
snapshot that can't be read to `<aggregate>.unreadable-<timestamp>.json` and starts empty. No
policy says yet which older versions are read or when a file is upgraded.

The first format change is now due: the Tape Bed's Border is no longer entered but derived from
the tape width and the Row Span ([#74](https://github.com/LilSticky/crancula/issues/74)), so the
Organ snapshot drops `border` and goes from version 1 to version 2. Organ owners must not lose
their Organs when they update the app.

## Decision

We will migrate snapshots on read and write only the newest version:

- The reader accepts every older version it knows and turns it into the current in-memory state.
  Data the newer format no longer has (such as a version 1 `border`) is ignored.
- The writer always writes the newest version, so the next save upgrades the file. There is no
  separate migration step and no backup copy.
- A version the reader doesn't know (for example one written by a newer app) is unreadable and is
  handled as in ADR 8: moved aside, never overwritten.

This applies to the Organ and the Tape snapshot alike.

## Consequences

- Updating the app keeps all data; old files upgrade silently on the next save.
- Downgrading after such a save makes the snapshot unreadable for the older app: the file is moved
  aside and the app starts empty. The CHANGELOG of every release that bumps a snapshot version says
  so.
- Every version bump adds reader tests for each older version, and the reader keeps old-format code
  for as long as those versions are supported.
