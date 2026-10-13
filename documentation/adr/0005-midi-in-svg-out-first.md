# 5. MIDI in and SVG out first

Date: 2026-10-13

## Status

Accepted

## Context

Songs can come from many Song Sources (printed Scores, PDF, MusicXML, MIDI), and Tapes can be
punched by hand or by different Plotters (SVG, DXF, HPGL; some need the tape split into
pieces). The user's first Plotter is a vinyl cutter that cuts long sheets.

## Decision

v0.1 supports MIDI as the only Song Source and SVG as the only export, sized in mm for a vinyl
cutter, without splitting the Tape. Both are adapters around the Tape domain, so further
formats can be added without changing it.

## Consequences

- A MIDI parser library (candidate: `@tonejs/midi`) is chosen in the Song import slice.
- DXF, HPGL, splitting the Tape and other Song Sources are later slices.
