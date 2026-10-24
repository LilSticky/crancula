import {ChangeDetectionStrategy, Component, computed, ElementRef, Injectable, input, linkedSignal, output, viewChild} from '@angular/core';
import {type Field, form, FormField, validate} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatError, MatFormField, MatInput, MatLabel} from '@angular/material/input';
import {MatSlider, MatSliderThumb} from '@angular/material/slider';
import {TranslatePipe} from '@ngx-translate/core';
import {MAX_CRANK_SPEED, MIN_CRANK_SPEED, nearestInRange, previewLength, type Organ, type Tape} from '@api/index';
import {DecimalInputDirective} from '../../../shared/decimal-input.directive';
import {type CrankSpeedChange, crankSpeedChangeTo} from '../../tape-view/crank-speed-change';

/** Shows the Crank speed field's error as soon as its text is invalid, not only after a blur. */
@Injectable()
class CrankSpeedErrorMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    return field?.().invalid() ?? false;
  }
}

/** The Crank speed the slider's thumb is at, from its native input; `undefined` if the input is not a number. */
function sliderSpeed(event: Event): number | undefined {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return undefined;
  const speed = Number(input.value);
  return Number.isFinite(speed) ? speed : undefined;
}

/** Seconds as "m:ss", with the seconds padded to two digits. */
function minutesAndSeconds(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The Preview section of the side panel: the Crank speed of the Tape, which the user changes while the Preview plays
 * too, and how long the Tape plays. It emits the Tape with the typed Crank speed; the Tape view saves it.
 */
@Component({
  selector: 'cranc-preview-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatError, MatFormField, MatInput, MatLabel, MatSlider, MatSliderThumb, DecimalInputDirective, FormField, TranslatePipe],
  providers: [{provide: ErrorStateMatcher, useClass: CrankSpeedErrorMatcher}],
  template: `
    <section data-testid="preview-section">
      <h2>{{ 'TAPE.PREVIEW.SECTION_TITLE' | translate }}</h2>
      <div class="start-column">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'TAPE.PREVIEW.START_COLUMN' | translate }}</mat-label>
          <input matInput type="text" inputmode="numeric" data-testid="preview-start-column" [formField]="startColumn" (keydown)="onStartKeydown($event)" />
        </mat-form-field>
      </div>
      <div class="crank-speed">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'TAPE.PREVIEW.CRANK_SPEED' | translate }}</mat-label>
          <input matInput crancDecimalInput data-testid="crank-speed-input" [formField]="crankSpeed" (keydown)="onKeydown($event)" (blur)="onBlur($event)" />
          <mat-error data-testid="crank-speed-error">{{ 'TAPE.PREVIEW.CRANK_SPEED_INVALID' | translate: {min: minimum, max: maximum} }}</mat-error>
        </mat-form-field>
        <button matButton type="button" data-testid="crank-speed-apply" [disabled]="changed() === undefined" (click)="apply()" #applyButton>{{ 'TAPE.PREVIEW.CRANK_SPEED_APPLY' | translate }}</button>
      </div>
      <mat-slider class="crank-speed-slider" data-testid="crank-speed-slider" [min]="range().slowest" [max]="range().fastest" [step]="1">
        <input matSliderThumb [value]="sliderValue()" [attr.aria-label]="'TAPE.PREVIEW.CRANK_SPEED_SLIDER' | translate" (input)="onSliderInput($event)" (change)="onSliderRelease()" />
      </mat-slider>
      @if (outsideRange()) {
        <p data-testid="crank-speed-outside-range">{{ 'TAPE.PREVIEW.OUTSIDE_RANGE' | translate: {slowest: range().slowest, fastest: range().fastest} }}</p>
      }
      @if (length(); as length) {
        <p data-testid="preview-length">{{ 'TAPE.PREVIEW.LENGTH' | translate: {time: length} }}</p>
      }
      @if (playing()) {
        <p role="status" data-testid="editing-paused">{{ 'TAPE.PREVIEW.EDITING_PAUSED' | translate }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    .crank-speed {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .start-column mat-form-field,
    .crank-speed mat-form-field {
      width: 9rem;
      min-width: 0;
    }
    .crank-speed-slider {
      width: 100%;
    }
    p {
      margin: 0.5rem 0 0;
    }
  `,
})
export class PreviewSectionComponent {
  readonly tape = input.required<Tape>();
  /** The Organ of the Tape, which gives the length of the Preview. */
  readonly organ = input.required<Organ>();
  /** Whether a Preview plays; the Crank speed field stays usable meanwhile, a change re-anchors the Preview. */
  readonly playing = input(false);
  /** The Column under the playhead, 0-based and fractional while playing; the start field shows it counted from 1. */
  readonly playhead = input(0);
  /** The Tape with the typed Crank speed; the Tape view saves it. */
  readonly crankSpeedChange = output<Tape>();
  /** The 0-based Column the typed start Column counts to; the Tape view moves the playhead there. */
  readonly startColumnChange = output<number>();
  /** The Crank speed while the slider moves: the Tape view plays it, and saves nothing. */
  readonly crankSpeedTrial = output<number>();

  protected readonly minimum = MIN_CRANK_SPEED;
  protected readonly maximum = MAX_CRANK_SPEED;
  /** The Crank speed range of the Organ, which the slider spans. */
  protected readonly range = computed(() => this.organ().crankSpeedRange);
  /** Where the Crank speed of the Tape sits on the slider: the nearest end of the range when it is outside. */
  private readonly sliderPlacement = computed(() => nearestInRange(this.tape().crankSpeed, this.range()));
  /** The thumb's value: the slider steps by whole turns, so the placement rounded to one (the field keeps the exact speed). */
  protected readonly sliderValue = computed(() => Math.round(this.sliderPlacement().value));
  protected readonly outsideRange = computed(() => this.sliderPlacement().outside);
  private readonly applyButton = viewChild<string, ElementRef<HTMLButtonElement>>('applyButton', {read: ElementRef});
  /** The Crank speed the slider moved to since it was last released; `undefined` while it has not moved. */
  private movedTo: number | undefined;

  /** The Crank speed as typed; starts with, and goes back to, the Crank speed of the Tape. */
  private readonly draft = linkedSignal<number | null>(() => this.tape().crankSpeed);
  /** The field: its text is a parse error, blank, or a Crank speed that is not from 1 to 300. */
  protected readonly crankSpeed = form(this.draft, (path) => {
    validate(path, ({value}) => {
      const typed = value();
      return typed !== null && crankSpeedChangeTo(this.tape(), typed).state !== 'invalid' ? undefined : {kind: 'crank-speed-out-of-range'};
    });
  });
  /** The Column under the playhead, counted from 1 and rounded down: what the start field shows. */
  private readonly shownStart = computed(() => Math.floor(this.playhead()) + 1);
  /** The start Column as typed; goes back to the shown Column when the playhead moves to another Column. */
  private readonly startDraft = linkedSignal(() => String(this.shownStart()));
  /** The start field: its text, counted from 1. */
  protected readonly startColumn = form(this.startDraft);
  /** What the typed Crank speed does to the Tape. */
  private readonly change = computed<CrankSpeedChange>(() => crankSpeedChangeTo(this.tape(), this.draft()));
  /** The change, if the field is valid and the Tape changes. */
  private readonly readyChange = computed(() => {
    const change = this.change();
    return change.state === 'ready' && !this.crankSpeed().invalid() ? change : undefined;
  });
  /** The Tape with the typed Crank speed, if the field is valid and the Crank speed differs from the Tape's. */
  protected readonly changed = computed<Tape | undefined>(() => this.readyChange()?.tape);
  /** How long the Tape plays at its Crank speed, as "m:ss"; none without a Tape per Crank turn on the Organ. */
  protected readonly length = computed<string | undefined>(() => {
    const seconds = previewLength(this.tape(), this.organ());
    return seconds === undefined ? undefined : minutesAndSeconds(seconds);
  });

  protected apply(): void {
    const changed = this.changed();
    if (changed !== undefined) this.crankSpeedChange.emit(changed);
  }

  /** A move of the slider, before it is released: the Tape view plays the Crank speed; nothing is saved. */
  protected onSliderInput(event: Event): void {
    const speed = sliderSpeed(event);
    if (speed === undefined) return;
    this.movedTo = speed;
    this.crankSpeedTrial.emit(speed);
  }

  /** The slider is released after it moved: that is one change of the Tape, saved as one edit. A release without a move changes nothing. */
  protected onSliderRelease(): void {
    const speed = this.movedTo;
    this.movedTo = undefined;
    if (speed === undefined) return;
    const change = crankSpeedChangeTo(this.tape(), speed);
    if (change.state === 'ready') this.crankSpeedChange.emit(change.tape);
  }

  /** Enter moves the playhead to the typed Column, if it is a Column of the Tape; other keys are left alone. */
  protected onStartKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const typed = this.startColumn().value().trim();
    if (!/^\d+$/.test(typed)) return;
    const number = Number(typed);
    if (number < 1 || number > this.tape().length) return;
    this.startColumnChange.emit(number - 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.apply();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.restore();
    }
  }

  /**
   * Leaving the field without applying puts the Crank speed of the Tape back; a click on Apply keeps the typed value.
   * The view is checked before the decimal input's own blur handler runs, so that handler does not write its stale value back.
   */
  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && next === this.applyButton()?.nativeElement) return;
    this.restore();
  }

  private restore(): void {
    this.draft.set(this.tape().crankSpeed);
  }
}
