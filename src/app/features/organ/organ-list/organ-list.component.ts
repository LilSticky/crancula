import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {MatListItem, MatListItemLine, MatListItemTitle, MatNavList} from '@angular/material/list';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {OrganLibrary} from '../organ-library.store';

@Component({
  selector: 'cranc-organ-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatButton, MatIcon, MatNavList, MatListItem, MatListItemTitle, MatListItemLine],
  template: `
    <h2>{{ 'ORGAN.LIST.TITLE' | translate }}</h2>
    <a matButton="filled" routerLink="/organs/new" data-testid="new-organ">
      <mat-icon>add</mat-icon>
      {{ 'ORGAN.LIST.NEW' | translate }}
    </a>
    @if (library.entities().length === 0) {
      <p>{{ 'ORGAN.LIST.EMPTY' | translate }}</p>
    } @else {
      <mat-nav-list>
        @for (organ of library.entities(); track organ.id) {
          <a mat-list-item [routerLink]="['/organs', organ.id]" data-testid="organ">
            <span matListItemTitle>{{ organ.name }}</span>
            <span matListItemLine>{{ 'ORGAN.LIST.PIPE_COUNT' | translate: {count: organ.pipes.length} }}</span>
          </a>
        }
      </mat-nav-list>
    }
  `,
})
export class OrganListComponent {
  protected readonly library = inject(OrganLibrary);
}
