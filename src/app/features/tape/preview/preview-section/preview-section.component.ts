import {ChangeDetectionStrategy, Component, computed, ElementRef, Injectable, input, linkedSignal, output, viewChild} from '@angular/core';
import {type Field, form, FormField, validate} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton} from '@angular/material/button';
import {MatError, MatFormField, MatInput, MatLabel} from '@angular/material/input';
import {TranslatePipe} from '@ngx-translate/core';
import {MAX_CRANK_SPEED, MIN_CRANK_SPEED, previewLength, type Organ, type Tape} from '@api/index';
import {DecimalInputDirective} from '../../../shared/decimal-input.directive';
import {type CrankSpeedChange, crankSpeedChangeTo} from '../../tape-view/crank-speed-change';

/** Shows the Crank speed field's error as soon as its text is invalid, not only after a blur. */
@Injectable()
class CrankSpeedErrorMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    return field?.().invalid() ?? false;
  }
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
  imports: [MatButton, MatError, MatFormField, MatInput, MatLabel, DecimalInputDirective, FormField, TranslatePipe],
  providers: [{provide: ErrorStateMatcher, useClass: CrankSpeedErrorMatcher}],
  template: `
    <section data-testid="preview-section">
      <h2>{{ 'TAPE.PREVIEW.SECTION_TITLE' | translate }}</h2>
      <div class="crank-speed">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'TAPE.PREVIEW.CRANK_SPEED' | translate }}</mat-label>
          <input matInput crancDecimalInput data-testid="crank-speed-input" [formField]="crankSpeed" (keydown)="onKeydown($event)" (blur)="onBlur($event)" />
          <mat-error data-testid="crank-speed-error">{{ 'TAPE.PREVIEW.CRANK_SPEED_INVALID' | translate: {min: minimum, max: maximum} }}</mat-error>
        </mat-form-field>
        <button matButton type="button" data-testid="crank-speed-apply" [disabled]="changed() === undefined" (click)="apply()" #applyButton>{{ 'TAPE.PREVIEW.CRANK_SPEED_APPLY' | translate }}</button>
      </div>
      @if (length(); as length) {
        <p data-testid="preview-length">{{ 'TAPE.PREVIEW.LENGTH' | translate: {time: length} }}</p>
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
    .crank-speed mat-form-field {
      width: 9rem;
      min-width: 0;
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
  /** The Tape with the typed Crank speed; the Tape view saves it. */
  readonly crankSpeedChange = output<Tape>();

  protected readonly minimum = MIN_CRANK_SPEED;
  protected readonly maximum = MAX_CRANK_SPEED;
  private readonly applyButton = viewChild<string, ElementRef<HTMLButtonElement>>('applyButton', {read: ElementRef});

  /** The Crank speed as typed; starts with, and goes back to, the Crank speed of the Tape. */
  private readonly draft = linkedSignal<number | null>(() => this.tape().crankSpeed);
  /** The field: its text is a parse error, blank, or a Crank speed that is not from 1 to 300. */
  protected readonly crankSpeed = form(this.draft, (path) => {
    validate(path, ({value}) => {
      const typed = value();
      return typed !== null && crankSpeedChangeTo(this.tape(), typed).state !== 'invalid' ? undefined : {kind: 'crank-speed-out-of-range'};
    });
  });
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
