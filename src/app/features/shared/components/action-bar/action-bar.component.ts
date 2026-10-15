import {ChangeDetectionStrategy, Component, input} from '@angular/core';

/** Sticky bottom bar of a page: state on the left, actions on the right. */
@Component({
  selector: 'cranc-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {role: 'region', '[attr.aria-label]': 'label()'},
  template: `
    <div class="state" data-testid="action-bar-state">
      <ng-content select="[actionBarState]"/>
    </div>
    <div class="actions" data-testid="action-bar-actions">
      <ng-content/>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      background: var(--cr-paper);
      border-top: 1px solid var(--cr-paper-edge);
    }

    .actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
      align-items: center;
    }
  `,
})
export class ActionBarComponent {
  readonly label = input.required<string>();
}
