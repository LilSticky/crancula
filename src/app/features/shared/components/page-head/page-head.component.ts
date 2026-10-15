import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** Titles a page: serif h1, an optional one-sentence subtitle, and the page's primary actions on the right. */
@Component({
  selector: 'cranc-page-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="titles">
      <h1>{{ title() }}</h1>
      @if (subtitle(); as text) {
        <p>{{ text }}</p>
      }
    </div>
    <div class="actions" data-testid="page-head-actions">
      <ng-content select="[pageHeadActions]"/>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      padding-bottom: 18px;
    }

    h1 {
      margin: 0;
      font-size: 1.875rem;
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: -0.005em;
    }

    p {
      margin: 6px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
      align-items: center;
    }
  `,
})
export class PageHeadComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
