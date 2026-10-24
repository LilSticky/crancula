import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import type {Tape} from '../tape/tape';

/** What the Preview sounds: one Pipe sounding from `startColumn` up to, not including, `endColumn`. */
export interface PreviewNote {
  readonly pipe: MidiNoteNumber;
  readonly startColumn: number;
  /** Exclusive: the Column after the last one the Pipe sounds on. */
  readonly endColumn: number;
}

const SECONDS_PER_MINUTE = 60;
const A4 = 69;
const A4_FREQUENCY = 440;
const SEMITONES_PER_OCTAVE = 12;

/**
 * What a Preview of `tape` plays on `organ`: one PreviewNote per Hole whose Pipe is on the Organ,
 * touching Holes of one row joined. Holes without a Pipe are left out.
 * @returns them sorted by start Column, then by Pipe
 */
export function performance(tape: Tape, organ: Organ): readonly PreviewNote[] {
  const pipes = new Set(organ.pipes.map((pipe) => pipe.note));
  const notes: PreviewNote[] = [];
  // the Holes are sorted by Pipe, then start, so a Hole can only touch the PreviewNote before it
  for (const hole of tape.holes) {
    if (!pipes.has(hole.pipe)) continue;
    const end = hole.start + hole.length;
    const last = notes.at(-1);
    if (last !== undefined && last.pipe === hole.pipe && last.endColumn === hole.start) {
      notes[notes.length - 1] = {...last, endColumn: end};
    } else {
      notes.push({pipe: hole.pipe, startColumn: hole.start, endColumn: end});
    }
  }
  return notes.sort((a, b) => a.startColumn - b.startColumn || a.pipe - b.pipe);
}

/**
 * Seconds one Column takes to pass the Tape Bed at the Tape's Crank speed.
 * @returns the seconds, or `undefined` if the Organ has no Tape per Crank turn
 */
export function columnDuration(tape: Tape, organ: Organ): number | undefined {
  if (organ.tapePerCrankTurn === undefined) return undefined;
  const secondsPerTurn = SECONDS_PER_MINUTE / tape.crankSpeed;
  return (tape.columnLength / organ.tapePerCrankTurn) * secondsPerTurn;
}

/**
 * Seconds the whole Tape takes to play at the Tape's Crank speed.
 * @returns the seconds, or `undefined` if the Organ has no Tape per Crank turn
 */
export function previewLength(tape: Tape, organ: Organ): number | undefined {
  const duration = columnDuration(tape, organ);
  return duration === undefined ? undefined : tape.length * duration;
}

/** The frequency in Hz of a Pipe's note, with A4 (MIDI note 69) at 440 Hz. */
export function noteFrequency(pipe: MidiNoteNumber): number {
  return A4_FREQUENCY * 2 ** ((pipe - A4) / SEMITONES_PER_OCTAVE);
}
