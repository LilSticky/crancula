import {encodeSmf, type SmfEvent, type SmfSpec, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';

/** The payload shape of Playwright's `setInputFiles`. */
export interface MidiFilePayload {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

const TICKS_PER_QUARTER = 480;
const PERCUSSION_CHANNEL = 9;
const MIDDLE_C = 60;
const C3 = 48;
const C5 = 72;

function payload(name: string, bytes: Uint8Array, mimeType = 'audio/midi'): MidiFilePayload {
  return {name, mimeType, buffer: Buffer.from(bytes)};
}

function smf(name: string, tracks: SmfSpec['tracks']): MidiFilePayload {
  return payload(name, encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks}));
}

/** One note per quarter, each note-off one quarter after its note-on. */
function noteEvents(channel: number, notes: readonly number[], name: string): readonly SmfTimedEvent[] {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: name}}];
  for (const note of notes) {
    events.push(
      {delta: 0, event: {type: 'noteOn', channel, note, velocity: 80} satisfies SmfEvent},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel, note, velocity: 0}},
    );
  }
  return events;
}

/** A single melody that climbs from C3 to C5 (MIDI 48 to 72), one Part. */
export function melodyC3ToC5(): MidiFilePayload {
  const notes = Array.from({length: C5 - C3 + 1}, (_, index) => C3 + index);
  return smf('melody-c3-c5.mid', [{events: noteEvents(0, notes, 'Melody')}]);
}

/** Three Parts: two melodic voices and one percussion Part on channel 10. */
export function threePartsWithPercussion(): MidiFilePayload {
  return smf('three-parts-percussion.mid', [
    {events: noteEvents(0, [MIDDLE_C, MIDDLE_C + 4, MIDDLE_C + 7], 'Lead')},
    {events: noteEvents(1, [MIDDLE_C - 12, MIDDLE_C - 8, MIDDLE_C - 5], 'Bass')},
    {events: noteEvents(PERCUSSION_CHANNEL, [36, 38, 36, 38], 'Drums')},
  ]);
}

/** Five minutes at 120 beats per minute (600 quarters) in 16 Parts. */
export function longSongWithSixteenParts(): MidiFilePayload {
  const quartersPerPart = 600;
  const tracks = Array.from({length: 16}, (_, index) => ({
    events: [
      ...(index === 0 ? [{delta: 0, event: {type: 'tempo', microsecondsPerQuarterNote: 500000} satisfies SmfEvent}] : []),
      ...noteEvents(
        index === PERCUSSION_CHANNEL ? 0 : index % 16 === 15 ? 14 : index,
        Array.from({length: quartersPerPart}, (_, step) => MIDDLE_C + ((step + index) % 12)),
        `Part ${index + 1}`,
      ),
    ],
  }));
  return smf('long-song-16-parts.mid', tracks);
}

/** A file that is not MIDI at all. */
export function notAMidiFile(): MidiFilePayload {
  return payload('not-midi.txt', new TextEncoder().encode('This is not a MIDI file.'), 'text/plain');
}

/** The MIDI fixtures with the number of Parts `readMidiSong` must find in each. */
export const MIDI_FIXTURES: readonly {readonly file: () => MidiFilePayload; readonly parts: number}[] = [
  {file: melodyC3ToC5, parts: 1},
  {file: threePartsWithPercussion, parts: 3},
  {file: longSongWithSixteenParts, parts: 16},
];
