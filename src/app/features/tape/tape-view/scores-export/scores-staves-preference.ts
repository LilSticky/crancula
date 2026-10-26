import {Injectable} from '@angular/core';
import {midiNoteNumber, type MidiNoteNumber, type OrganId} from '@api/index';

const SPLIT_NOTES_KEY = 'crancula.scoresSplitNotes';

/** The split notes stored for each Organ, as the JSON object `{[organId]: number[]}` (research R12). */
type StoredByOrgan = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is StoredByOrgan {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The split notes of a stored value: distinct MIDI notes in ascending order, or undefined when it is not that. */
function splitNotesOfStored(value: unknown): readonly MidiNoteNumber[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: readonly unknown[] = value;
  const notes: MidiNoteNumber[] = [];
  for (const item of items) {
    const note = typeof item === 'number' ? midiNoteNumber(item) : undefined;
    const previous = notes[notes.length - 1];
    if (note === undefined || (previous !== undefined && note <= previous)) return undefined;
    notes.push(note);
  }
  return notes;
}

/** Everything stored under the key, or nothing when it is absent, broken or cannot be read. */
function readStored(): StoredByOrgan {
  try {
    const text = localStorage.getItem(SPLIT_NOTES_KEY);
    if (text === null) return {};
    const parsed: unknown = JSON.parse(text);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The split notes the user confirmed for each Organ, remembered in `localStorage` so that the next export of a
 * Tape of the Organ starts with them (FR-005, Story 3.4, research R12). Storage that is blocked remembers nothing.
 */
@Injectable({providedIn: 'root'})
export class ScoresStavesPreference {
  /** The split notes remembered for the Organ; undefined when none are stored for it. */
  splitNotesFor(organ: OrganId): readonly MidiNoteNumber[] | undefined {
    return splitNotesOfStored(readStored()[organ]);
  }

  /** Remembers the split notes for the Organ and keeps those of the other Organs. */
  remember(organ: OrganId, splitNotes: readonly MidiNoteNumber[]): void {
    try {
      localStorage.setItem(SPLIT_NOTES_KEY, JSON.stringify({...readStored(), [organ]: splitNotes}));
    } catch {
      // Storage is blocked or full: the split notes are not remembered, and the export is not affected.
    }
  }
}
