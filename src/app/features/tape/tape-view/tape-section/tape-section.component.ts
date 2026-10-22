import {ChangeDetectionStrategy, Component, computed, ElementRef, Injectable, input, linkedSignal, output, signal, viewChild} from '@angular/core';
import {type Field, form, FormField, validate} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatError, MatFormField, MatInput, MatLabel, MatSuffix} from '@angular/material/input';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {changeColumnLength, type Tape} from '@api/index';
import {DecimalInputDirective} from '../../../shared/decimal-input.directive';

/** What the Tape section tells, with numbers already formatted for the language of the user. */
export interface TapeSectionView {
  readonly organId: string;
  readonly organName: string;
  readonly columnLengthText: string;
  readonly lengthText: string;
  readonly lengthMmText: string;
  readonly leadInMm: number;
  readonly leadInText: string;
  readonly holesText: string;
  readonly partNames: readonly {readonly index: number; readonly name: string | undefined}[];
}

/** Shows the Column length field's error as soon as its text is invalid, not only after a blur. */
@Injectable()
class ColumnLengthErrorMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    return field?.().invalid() ?? false;
  }
}

/** The Tape section of the side panel. */
@Component({
  selector: 'cranc-tape-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatIcon, MatError, MatFormField, MatInput, MatLabel, MatSuffix, DecimalInputDirective, FormField, RouterLink, TranslatePipe],
  providers: [{provide: ErrorStateMatcher, useClass: ColumnLengthErrorMatcher}],
  template: `
    <section data-testid="tape-section">
      <header>
        <h2>{{ 'TAPE.SECTION.TITLE' | translate }}</h2>
        <button matIconButton type="button" data-testid="tape-section-toggle" aria-controls="tape-section-content" [attr.aria-expanded]="expanded()" [attr.aria-label]="'TAPE.SECTION.TOGGLE' | translate" (click)="expanded.set(!expanded())">
          <mat-icon aria-hidden="true">{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
      </header>
      @if (expanded()) {
      <dl id="tape-section-content">
        <dt>{{ 'TAPE.SECTION.ORGAN' | translate }}</dt>
        <dd><a matButton [routerLink]="['/organs', view().organId]">{{ view().organName }}</a></dd>
        <dt>{{ 'TAPE.SECTION.COLUMN_LENGTH' | translate }}</dt>
        <dd class="column-length">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>{{ 'TAPE.SECTION.COLUMN_LENGTH' | translate }}</mat-label>
            <input matInput crancDecimalInput data-testid="column-length-input" [formField]="columnLength" (keydown)="onKeydown($event)" (blur)="onBlur($event)" />
            <span matTextSuffix>mm</span>
            <mat-error data-testid="column-length-error">{{ 'TAPE.SECTION.COLUMN_LENGTH_INVALID' | translate }}</mat-error>
          </mat-form-field>
          <button matButton type="button" data-testid="column-length-apply" [disabled]="changed() === undefined" (click)="apply()" #applyButton>{{ 'TAPE.SECTION.COLUMN_LENGTH_APPLY' | translate }}</button>
        </dd>
        <dt>{{ 'TAPE.SECTION.COLUMNS' | translate }}</dt>
        <dd>{{ view().lengthText }}</dd>
        <dt>{{ 'TAPE.SECTION.LENGTH' | translate }}</dt>
        <dd>{{ 'TAPE.SECTION.MM' | translate: {value: view().lengthMmText} }}</dd>
        <dt>{{ 'TAPE.SECTION.LEAD_IN' | translate }}</dt>
        <dd>{{ view().leadInMm === 0 ? ('TAPE.SECTION.LEAD_IN_NONE' | translate) : ('TAPE.SECTION.MM' | translate: {value: view().leadInText}) }}</dd>
        <dt>{{ 'TAPE.SECTION.HOLES' | translate }}</dt>
        <dd>{{ view().holesText }}</dd>
      </dl>
      <h3>{{ 'TAPE.SECTION.PARTS' | translate }}</h3>
      <ul class="parts" [attr.aria-label]="'TAPE.VIEW.PARTS' | translate">
        @for (part of view().partNames; track part.index) {
          <li data-testid="selected-part">{{ part.name ?? ('TAPE.PARTS.UNNAMED' | translate: {number: part.index + 1}) }}</li>
        }
      </ul>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2,
    h3 {
      margin: 0 0 0.5rem;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    dd {
      margin: 0;
      text-align: right;
    }
    .column-length {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .parts {
      margin: 0;
      padding-left: 1.25rem;
    }
  `,
})
export class TapeSectionComponent {
  readonly view = input.required<TapeSectionView>();
  readonly tape = input.required<Tape>();
  /** The Tape with the Column length the user applied; the Tape view saves it. */
  readonly columnLengthChange = output<Tape>();

  protected readonly expanded = signal(true);
  private readonly applyButton = viewChild<ElementRef<HTMLButtonElement>>('applyButton');

  /** The Column length as typed; starts with, and goes back to, the Column length of the Tape. */
  private readonly draft = linkedSignal<number | null>(() => this.tape().columnLength);
  /** The field: its text is a parse error or the Column length is not above 0. */
  protected readonly columnLength = form(this.draft, (path) => {
    validate(path, ({value}) => (changeColumnLength(this.tape(), value() ?? Number.NaN).ok ? undefined : {kind: 'column-length-must-be-positive'}));
  });
  /** The Tape with the typed Column length, if the field is valid and the length differs from the Tape's. */
  protected readonly changed = computed<Tape | undefined>(() => {
    const value = this.draft();
    if (value === null || this.columnLength().invalid()) return undefined;
    const result = changeColumnLength(this.tape(), value);
    return result.ok && result.value !== this.tape() ? result.value : undefined;
  });

  protected apply(): void {
    const changed = this.changed();
    if (changed !== undefined) this.columnLengthChange.emit(changed);
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
   * Leaving the field without applying puts the Column length of the Tape back; a click on Apply keeps the typed value.
   * The view is checked before the decimal input's own blur handler runs, so that handler does not write its stale value back.
   */
  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && next === this.applyButton()?.nativeElement) return;
    this.restore();
  }

  private restore(): void {
    this.draft.set(this.tape().columnLength);
  }
}
