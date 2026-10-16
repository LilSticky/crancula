import {noteName, type Organ} from '@api/index';

export interface PipeRange {
  readonly count: number;
  readonly lowest: string;
  readonly highest: string;
}

/** The number of Pipes and the names of the lowest and highest note, ordered by MIDI note, not by row. */
export function pipeRange(organ: Organ): PipeRange {
  const notes = organ.pipes.map((pipe) => pipe.note).sort((a, b) => Number(a) - Number(b));
  const [lowest] = notes;
  const highest = notes[notes.length - 1];
  if (lowest === undefined || highest === undefined) throw new Error('An Organ has at least one Pipe.');
  return {count: notes.length, lowest: noteName(lowest), highest: noteName(highest)};
}
