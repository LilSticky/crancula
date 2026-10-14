export type SmfDivision =
  | { readonly ticksPerQuarterNote: number }
  | { readonly framesPerSecond: number; readonly ticksPerFrame: number };

export type SmfEvent =
  | { readonly type: 'noteOn' | 'noteOff'; readonly channel: number; readonly note: number; readonly velocity: number }
  | { readonly type: 'controller'; readonly channel: number; readonly controller: number; readonly value: number }
  | { readonly type: 'programChange'; readonly channel: number; readonly program: number }
  | { readonly type: 'trackName'; readonly text: string }
  | { readonly type: 'tempo'; readonly microsecondsPerQuarterNote: number }
  | { readonly type: 'sysEx'; readonly data: readonly number[] };

export interface SmfTimedEvent {
  readonly delta: number;
  readonly event: SmfEvent;
}

export interface SmfTrack {
  readonly events: readonly SmfTimedEvent[];
  readonly runningStatus?: boolean;
  readonly endOfTrack?: boolean;
}

export interface SmfSpec {
  readonly format: 0 | 1 | 2;
  readonly division: SmfDivision;
  readonly tracks: readonly SmfTrack[];
  readonly appendBytes?: readonly number[];
  readonly cutOffBytes?: number;
}

const END_OF_TRACK = [0x00, 0xff, 0x2f, 0x00];

export function encodeVariableLengthQuantity(value: number): number[] {
  const groups = [value & 0x7f];
  for (let rest = value >>> 7; rest > 0; rest >>>= 7) {
    groups.unshift((rest & 0x7f) | 0x80);
  }
  return groups;
}

function uint16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, ...uint16(value)];
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function encodeDivision(division: SmfDivision): number[] {
  if ('ticksPerQuarterNote' in division) {
    return uint16(division.ticksPerQuarterNote);
  }
  return [0x100 - division.framesPerSecond, division.ticksPerFrame];
}

function channelMessage(event: SmfEvent): { status: number; data: number[] } | undefined {
  switch (event.type) {
    case 'noteOn':
      return { status: 0x90 | event.channel, data: [event.note, event.velocity] };
    case 'noteOff':
      return { status: 0x80 | event.channel, data: [event.note, event.velocity] };
    case 'controller':
      return { status: 0xb0 | event.channel, data: [event.controller, event.value] };
    case 'programChange':
      return { status: 0xc0 | event.channel, data: [event.program] };
    default:
      return undefined;
  }
}

function encodeNonChannelEvent(event: SmfEvent): number[] {
  switch (event.type) {
    case 'trackName':
      return [0xff, 0x03, ...encodeVariableLengthQuantity(event.text.length), ...ascii(event.text)];
    case 'tempo':
      return [
        0xff,
        0x51,
        3,
        (event.microsecondsPerQuarterNote >> 16) & 0xff,
        ...uint16(event.microsecondsPerQuarterNote),
      ];
    case 'sysEx':
      return [0xf0, ...encodeVariableLengthQuantity(event.data.length + 1), ...event.data, 0xf7];
    default:
      return [];
  }
}

function encodeTrack(track: SmfTrack): number[] {
  const body: number[] = [];
  let lastStatus: number | undefined;
  for (const { delta, event } of track.events) {
    body.push(...encodeVariableLengthQuantity(delta));
    const message = channelMessage(event);
    if (message) {
      if (!(track.runningStatus && lastStatus === message.status)) {
        body.push(message.status);
      }
      body.push(...message.data);
      lastStatus = message.status;
    } else {
      body.push(...encodeNonChannelEvent(event));
      lastStatus = undefined;
    }
  }
  if (track.endOfTrack !== false) {
    body.push(...END_OF_TRACK);
  }
  return [...ascii('MTrk'), ...uint32(body.length), ...body];
}

export function encodeSmf(spec: SmfSpec): Uint8Array {
  const bytes = [
    ...ascii('MThd'),
    ...uint32(6),
    ...uint16(spec.format),
    ...uint16(spec.tracks.length),
    ...encodeDivision(spec.division),
    ...spec.tracks.flatMap(encodeTrack),
    ...(spec.appendBytes ?? []),
  ];
  return Uint8Array.from(bytes.slice(0, bytes.length - (spec.cutOffBytes ?? 0)));
}
