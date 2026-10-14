# 11. UI preferences in localStorage

Date: 2026-10-14

## Status

Accepted

## Context

ADR 3 makes the in-memory state the truth and writes it as snapshots into Electron's `userData`
folder, through the main process (ADR 8). That fits domain state such as Organs and Tapes.

User Story 5 of "Describe my organ" adds a language switch (English or German). The chosen language
must survive a restart, but it is a UI preference, not domain state. A snapshot would need its own
IPC channel, validation and file for a single value.

## Decision

We will keep UI preferences, such as the language, in the renderer's `localStorage` (key
`crancula.language`). Domain state (Organs, Tapes, Songs) never goes into `localStorage`; it stays
in snapshots.

## Consequences

- No settings IPC channel or snapshot file is needed for the language.
- The preference lives in the Electron profile's browser storage. It is lost if that storage is
  cleared; the app then falls back to English. This is acceptable for a UI preference.
- Specs that run in jsdom need a `localStorage` stand-in.
- If preferences grow, or the main process needs them, move them into a settings snapshot (ADR 8).
