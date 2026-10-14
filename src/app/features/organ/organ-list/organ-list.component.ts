import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatListItem, MatListItemLine, MatListItemTitle, MatNavList} from '@angular/material/list';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import type {Organ} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {OrganLibrary} from '../organ-library.store';

@Component({
  selector: 'cranc-organ-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, MatNavList, MatListItem, MatListItemTitle, MatListItemLine],
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
          <div class="organ-row">
            <a mat-list-item [routerLink]="['/organs', organ.id]" data-testid="organ">
              <span matListItemTitle>{{ organ.name }}</span>
              <span matListItemLine>{{ 'ORGAN.LIST.PIPE_COUNT' | translate: {count: organ.pipes.length} }}</span>
            </a>
            <button matIconButton type="button" data-testid="delete-organ"
                    [attr.aria-label]="'ORGAN.LIST.DELETE' | translate: {name: organ.name}"
                    (click)="delete(organ)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </mat-nav-list>
    }
  `,
  styles: `
    .organ-row {
      display: flex;
      align-items: center;
    }

    .organ-row a {
      flex: 1;
    }
  `,
})
export class OrganListComponent {
  protected readonly library = inject(OrganLibrary);
  private readonly dialog = inject(MatDialog);

  protected delete(organ: Organ): void {
    this.dialog
      .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DELETE, entity: {id: organ.id, name: organ.name}}})
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) void this.library.remove(organ.id);
      });
  }
}
