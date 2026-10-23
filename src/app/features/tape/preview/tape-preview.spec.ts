import {Component, inject} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  column,
  columnCount,
  emptyOrganDraft,
  midiNoteNumber,
  millimetres,
  organId,
  tapeId,
  transposition,
  validateOrgan,
  type Column,
  type Hole,
  type MidiNoteNumber,
  type Organ,
  type Tape,
} from '@api/index';
import {tapeOf} from '@api/tape/tape-fixture';
import {PREVIEW_SOUND, type PreviewSound, type PreviewVoice} from './preview-sound';
import {TapePreview} from './tape-preview';

/*
 * Intended API (red phase, implementer builds exactly this):
 *
 * preview-sound.ts
 *   export type PreviewVoice = object;                       // opaque handle, the fake creates one with {}
 *   export interface PreviewSound {
 *     now(): number;                                         // seconds, like AudioContext.currentTime
 *     start(pipe: MidiNoteNumber, at: number): PreviewVoice;
 *     stop(voice: PreviewVoice, at: number): void;
 *     resume(): Promise<void>;
 *     close(): void;
 *   }
 *   export const PREVIEW_SOUND: InjectionToken<() => PreviewSound>;  // a factory
 *
 * tape-preview.ts
 *   export class TapePreview {                               // provided per component
 *     readonly playing: Signal<boolean>;
 *     readonly playhead: Signal<number>;                     // Column, fractional while playing
 *     play(tape: Tape, organ: Organ, from: Column): void;
 *     stop(): void;
 *     setPlayhead(column: Column): void;                     // only when stopped
 *     changeTape(tape: Tape): void;                          // not tested here
 *     // stops on destroy
 *   }
 */

/** Seconds of fake clock at the start of every test; not zero, so a missing anchor cannot pass by accident. */
const START_SECONDS = 10;
/** 5 mm Columns, 100 mm of Tape per Crank turn, 60 turns a minute: one Column is 50 ms. */
const COLUMN_SECONDS = 0.05;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

function col(value: number): Column {
  return defined(column(value), `column ${value}`);
}

function hole(pipe: number, start: number, length: number): Hole {
  return {pipe: note(pipe), start: col(start), length: defined(columnCount(length), `length ${length}`)};
}

/** An Organ with the Pipes 60 and 62, Tape per Crank turn 100 mm, or none when `tapePerCrankTurn` is `null`. */
function organOf(tapePerCrankTurn: number | null): Organ {
  const result = validateOrgan({
    ...emptyOrganDraft(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 10, rowSpacing: 11},
    minimumGap: 1.5,
    leadIn: 20,
    tapePerCrankTurn,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** A Tape of `length` Columns of 5 mm, at the default Crank speed. */
function aTape(length: number, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'), 'organ id'),
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(5), 'column length'),
    length: defined(columnCount(length), `length ${length}`),
    holes,
  });
}

/** A PreviewSound with a clock the test moves; records every start and stop. */
class FakePreviewSound implements PreviewSound {
  readonly starts: {readonly pipe: MidiNoteNumber; readonly at: number; readonly voice: PreviewVoice}[] = [];
  readonly stops: {readonly voice: PreviewVoice; readonly at: number}[] = [];
  private elapsedMs = 0;

  now(): number {
    return START_SECONDS + this.elapsedMs / 1000;
  }

  start(pipe: MidiNoteNumber, at: number): PreviewVoice {
    const voice: PreviewVoice = {};
    this.starts.push({pipe, at, voice});
    return voice;
  }

  stop(voice: PreviewVoice, at: number): void {
    this.stops.push({voice, at});
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}

  elapse(ms: number): void {
    this.elapsedMs += ms;
  }
}

/** Moves the fake clock and the fake timers together, one millisecond at a time, so each 25 ms tick and animation frame runs at its moment. */
function advance(sound: FakePreviewSound, ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed++) {
    sound.elapse(1);
    vi.advanceTimersByTime(1);
  }
}

function startAt(sound: FakePreviewSound, index: number): FakePreviewSound['starts'][number] {
  return defined(sound.starts[index], `start ${index}`);
}

/** Hosts the TapePreview the way the Tape view does: provided per component. */
@Component({selector: 'cranc-preview-host', template: '', providers: [TapePreview]})
class PreviewHostComponent {
  readonly preview = inject(TapePreview);
}

describe('TapePreview', () => {
  let sound: FakePreviewSound;
  let fixture: ComponentFixture<PreviewHostComponent>;
  let preview: TapePreview;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    sound = new FakePreviewSound();
    TestBed.configureTestingModule({providers: [{provide: PREVIEW_SOUND, useValue: () => sound}]});
    fixture = TestBed.createComponent(PreviewHostComponent);
    preview = fixture.componentInstance.preview;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a voice for a note inside the look-ahead window at its Column time', () => {
    const organ = organOf(100);
    const tape = aTape(100, [hole(60, 1, 2)]);

    preview.play(tape, organ, col(0));

    expect(sound.starts).toHaveLength(1);
    const start = startAt(sound, 0);
    expect(start.pipe).toBe(60);
    expect(start.at).toBeCloseTo(START_SECONDS + 1 * COLUMN_SECONDS, 6);
  });

  it('stops the voice at the end of its note', () => {
    const organ = organOf(100);
    const tape = aTape(100, [hole(60, 1, 2)]);

    preview.play(tape, organ, col(0));
    advance(sound, 100);

    const start = startAt(sound, 0);
    const stop = sound.stops.find((candidate) => candidate.voice === start.voice);
    expect(stop?.at).toBeCloseTo(START_SECONDS + 3 * COLUMN_SECONDS, 6);
  });

  it('does not start a note beyond the look-ahead window yet', () => {
    const organ = organOf(100);
    // Column 10 is 500 ms after the start: outside the 100 ms look-ahead window at the first tick
    const tape = aTape(100, [hole(60, 10, 2)]);

    preview.play(tape, organ, col(0));
    advance(sound, 25);

    expect(sound.starts).toEqual([]);
  });

  it('starts at once, at the current time, a note that covers the start Column', () => {
    const organ = organOf(100);
    const tape = aTape(100, [hole(60, 2, 6)]);

    preview.play(tape, organ, col(5));

    expect(sound.starts).toHaveLength(1);
    expect(startAt(sound, 0).at).toBeCloseTo(sound.now(), 9);
  });

  it('stop() stops every sounding voice now and keeps the playhead where it was', () => {
    const organ = organOf(100);
    const tape = aTape(100, [hole(60, 0, 10), hole(62, 0, 10)]);

    preview.play(tape, organ, col(0));
    advance(sound, 320);
    preview.stop();
    const stoppedNow = sound.stops.filter((stop) => stop.at === sound.now()).map((stop) => stop.voice);
    const kept = preview.playhead();
    advance(sound, 200);

    expect(stoppedNow).toEqual(expect.arrayContaining(sound.starts.map((start) => start.voice)));
    expect(preview.playing()).toBe(false);
    // six Columns in, within one animation frame (16 ms is about a third of a Column)
    expect(kept).toBeCloseTo(6, 0);
    expect(preview.playhead()).toBe(kept);
  });

  it('stops by itself at the last Column, with the playhead at the end of the Tape', () => {
    const organ = organOf(100);
    const tape = aTape(4);

    preview.play(tape, organ, col(0));
    advance(sound, 4 * 50 + 50);

    expect(preview.playing()).toBe(false);
    expect(preview.playhead()).toBe(4);
  });

  it('plays with the playhead following the clock', () => {
    const organ = organOf(100);
    const tape = aTape(100);

    preview.play(tape, organ, col(2));
    expect(preview.playing()).toBe(true);
    expect(preview.playhead()).toBeCloseTo(2, 6);
    // 160 ms is 3.2 Columns: 5.2 Columns from Column 2, within one animation frame
    advance(sound, 160);

    expect(preview.playing()).toBe(true);
    expect(preview.playhead()).toBeCloseTo(5.2, 0);
  });

  it('does nothing when the Organ has no Tape per Crank turn', () => {
    const organ = organOf(null);
    const tape = aTape(100, [hole(60, 0, 10)]);

    preview.play(tape, organ, col(0));
    advance(sound, 100);

    expect(preview.playing()).toBe(false);
    expect(sound.starts).toEqual([]);
  });

  it('stops its sounding voices when it is destroyed', () => {
    const organ = organOf(100);
    const tape = aTape(100, [hole(60, 0, 10)]);

    preview.play(tape, organ, col(0));
    fixture.destroy();

    const stoppedNow = sound.stops.filter((stop) => stop.at === sound.now()).map((stop) => stop.voice);
    expect(stoppedNow).toEqual(expect.arrayContaining(sound.starts.map((start) => start.voice)));
  });
});
