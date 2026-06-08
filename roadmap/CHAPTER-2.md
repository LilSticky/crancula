# Chapter 2: MIDI Import

**Goal**: Upload a MIDI file, parse it, and represent it as a Song in the app.

- [ ] Choose a MIDI parsing library (e.g. `midi-file` or `@tonejs/midi`)
- [ ] Build a MIDI file reader service (Electron `dialog.showOpenDialog` + fs read)
- [ ] Parse MIDI events into a Song model (notes with pitch, start time, duration)
- [ ] Map MIDI tracks/channels to pipe rows based on the active Organ
- [ ] Display imported Song metadata (title, duration, note count)
- [ ] Persist Song via DataStore
- [ ] Unit tests for MIDI parsing logic
