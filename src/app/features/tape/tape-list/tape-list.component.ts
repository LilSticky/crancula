import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {type Tape, tapeLengthInMillimetres} from '@api/index';
import {ConfirmableAction, ConfirmDialogComponent} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {OrganLibrary} from '../../organ/organ-library.store';
import {TapeLibrary} from '../tape-library.store';

@Component({
  selector: 'cranc-tape-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, PageHeadComponent],
  template: `
    <cranc-page-head [title]="'TAPE.LIST.TITLE' | translate">
      <a pageHeadActions matButton="filled" routerLink="/tapes/new" data-testid="new-tape">
        <mat-icon>add</mat-icon>
        {{ 'TAPE.LIST.NEW' | translate }}
      </a>
    </cranc-page-head>
    @if (rows().length === 0) {
      <p>{{ 'TAPE.LIST.EMPTY' | translate }}</p>
    } @else {
      @for (row of rows(); track row.tape.id) {
        <div class="tape-row" data-testid="tape">
          <div class="tape-details">
            <strong data-testid="tape-name">{{ row.tape.name }}</strong>
            <span data-testid="tape-organ">{{ row.organName ?? ('TAPE.LIST.ORGAN_NOT_AVAILABLE' | translate) }}</span>
            <span data-testid="tape-length-columns">{{ 'TAPE.LIST.LENGTH_COLUMNS' | translate: {count: row.tape.length} }}</span>
            <span data-testid="tape-length-mm">{{ 'TAPE.LIST.LENGTH_MM' | translate: {length: row.lengthInMillimetres} }}</span>
          </div>
          <a matButton data-testid="open-tape"
             [routerLink]="row.organName === undefined ? null : ['/tapes', row.tape.id]"
             [disabled]="row.organName === undefined">
            {{ 'TAPE.LIST.OPEN' | translate }}
          </a>
          <button matIconButton type="button" data-testid="remove-tape"
                  [attr.aria-label]="'TAPE.LIST.REMOVE' | translate: {name: row.tape.name}"
                  (click)="remove(row.tape)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      }
    }
  `,
  styles: `
    .tape-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .tape-details {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
  `,
})
export class TapeListComponent {
  private readonly tapes = inject(TapeLibrary);
  private readonly organs = inject(OrganLibrary);
  private readonly dialog = inject(MatDialog);

  protected readonly rows = computed(() => {
    const organNames = new Map(this.organs.entities().map((organ) => [organ.id, organ.name]));
    return this.tapes.tapeEntities().map((tape) => ({
      tape,
      organName: organNames.get(tape.organId),
      lengthInMillimetres: tapeLengthInMillimetres(tape),
    }));
  });

  protected remove(tape: Tape): void {
    this.dialog
      .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DELETE, entity: {id: tape.id, name: tape.name}}})
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) void this.tapes.remove(tape.id);
      });
  }
}
