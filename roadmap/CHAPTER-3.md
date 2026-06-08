# Chapter 3: Tape Model & Song↔Tape Conversion

**Goal**: Define the Tape data model and implement bidirectional conversion between Song and Tape.

- [ ] Define Tape data model (rows = pipes, columns = time units, holes = intervals)
- [ ] Define Hole model (pipe index, start column, length)
- [ ] Implement `Song → Tape` conversion (map notes to holes per pipe row)
- [ ] Implement `Tape → Song` conversion (reverse mapping for editing round-trips)
- [ ] Apply Organ tape settings (rows per inch, hole diameter) to Tape geometry
- [ ] Unit tests for conversion logic with edge cases (overlapping notes, polyphony)
- [ ] Persist Tape via DataStore
