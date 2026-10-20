import {ChangeDetectionStrategy, Component, input, signal} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';

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

/** The Tape section of the side panel. */
@Component({
  selector: 'cranc-tape-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatIcon, RouterLink, TranslatePipe],
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
        <dd>{{ 'TAPE.SECTION.MM' | translate: {value: view().columnLengthText} }}</dd>
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
    .parts {
      margin: 0;
      padding-left: 1.25rem;
    }
  `,
})
export class TapeSectionComponent {
  readonly view = input.required<TapeSectionView>();
  protected readonly expanded = signal(true);
}
