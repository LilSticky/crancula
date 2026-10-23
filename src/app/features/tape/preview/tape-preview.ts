import {DestroyRef, inject, Injectable, NgZone, signal} from '@angular/core';
import {columnDuration, performance as notesOf, type Column, type Organ, type PreviewNote, type Tape} from '@api/index';
import {PREVIEW_SOUND, type PreviewSound, type PreviewVoice} from './preview-sound';

/** How far ahead of the audio clock notes are scheduled, in seconds. */
export const LOOK_AHEAD_SECONDS = 0.1;
/** How often the scheduler looks ahead, in milliseconds. */
const TICK_MILLISECONDS = 25;

/** A Pipe that sounds, and the time in seconds its stop is scheduled for. */
interface SoundingVoice {
  readonly voice: PreviewVoice;
  readonly end: number;
}

/** One Preview from `play` to `stop`: the clock anchor, the notes not yet started and the voices sounding. */
interface Session {
  readonly sound: PreviewSound;
  readonly length: number;
  /** Seconds of the audio clock at `anchorColumn`. */
  readonly anchorTime: number;
  readonly anchorColumn: number;
  readonly columnSeconds: number;
  readonly pending: PreviewNote[];
  sounding: SoundingVoice[];
  timer?: ReturnType<typeof setInterval>;
  frame?: number;
}

function columnAt(session: Session, time: number): number {
  return session.anchorColumn + (time - session.anchorTime) / session.columnSeconds;
}

function timeAt(session: Session, column: number): number {
  return session.anchorTime + (column - session.anchorColumn) * session.columnSeconds;
}

/**
 * Plays a Tape through the Organ's Pipes and moves a playhead along it, on one clock.
 * Provided per component, so each Tape view has at most one Preview.
 */
@Injectable()
export class TapePreview {
  private readonly factory = inject(PREVIEW_SOUND);
  private readonly zone = inject(NgZone);
  private sound: PreviewSound | undefined;
  private session: Session | undefined;
  private readonly playingSignal = signal(false);
  private readonly playheadSignal = signal(0);

  /** Whether a Preview is playing. */
  readonly playing = this.playingSignal.asReadonly();
  /** The Column under the playhead, fractional while playing. */
  readonly playhead = this.playheadSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Plays `tape` on `organ` from `from`. Does nothing if the Organ has no Tape per Crank turn. */
  play(tape: Tape, organ: Organ, from: Column): void {
    const secondsPerColumn = columnDuration(tape, organ);
    if (secondsPerColumn === undefined) return;
    this.stop();
    const sound = this.soundPort();
    const session: Session = {
      sound,
      length: tape.length,
      anchorTime: sound.now(),
      anchorColumn: from,
      columnSeconds: secondsPerColumn,
      pending: [...notesOf(tape, organ)],
      sounding: [],
    };
    this.session = session;
    this.playingSignal.set(true);
    this.playheadSignal.set(from);
    // Outside the zone: the scheduler and the playhead ticks must not keep the view unstable.
    session.timer = this.zone.runOutsideAngular(() => setInterval(() => this.tick(session), TICK_MILLISECONDS));
    this.follow(session);
    this.tick(session);
  }

  /** Stops every sounding voice now; the playhead stays where it is. */
  stop(): void {
    const session = this.session;
    if (session === undefined) return;
    const now = session.sound.now();
    this.release(session, now);
    this.playheadSignal.set(Math.min(columnAt(session, now), session.length));
  }

  /** Moves the playhead; ignored while a Preview plays. */
  setPlayhead(column: Column): void {
    if (this.session === undefined) this.playheadSignal.set(column);
  }

  private soundPort(): PreviewSound {
    if (this.sound === undefined) this.sound = this.factory();
    return this.sound;
  }

  private tick(session: Session): void {
    const now = session.sound.now();
    if (columnAt(session, now) >= session.length) {
      this.release(session, now);
      this.playheadSignal.set(session.length);
      return;
    }
    const horizon = now + LOOK_AHEAD_SECONDS;
    let next = session.pending[0];
    while (next !== undefined && timeAt(session, next.startColumn) <= horizon) {
      session.pending.shift();
      this.startNote(session, next, now);
      next = session.pending[0];
    }
    const stillSounding: SoundingVoice[] = [];
    for (const sounding of session.sounding) {
      if (sounding.end <= horizon) session.sound.stop(sounding.voice, sounding.end);
      else stillSounding.push(sounding);
    }
    session.sounding = stillSounding;
  }

  private startNote(session: Session, note: PreviewNote, now: number): void {
    const end = timeAt(session, note.endColumn);
    if (end <= now) return;
    const start = Math.max(timeAt(session, note.startColumn), now);
    session.sounding.push({voice: session.sound.start(note.pipe, start), end});
  }

  private follow(session: Session): void {
    session.frame = this.zone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.playheadSignal.set(Math.min(columnAt(session, session.sound.now()), session.length));
        this.follow(session);
      }),
    );
  }

  /** Ends the session: cancels the scheduler and the playhead, stops the voices still sounding now. */
  private release(session: Session, now: number): void {
    this.session = undefined;
    this.playingSignal.set(false);
    clearInterval(session.timer);
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    for (const sounding of session.sounding) session.sound.stop(sounding.voice, now);
    session.sounding = [];
  }
}
