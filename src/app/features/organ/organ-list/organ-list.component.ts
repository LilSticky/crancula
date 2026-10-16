import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCard} from '@angular/material/card';
import {MatIcon} from '@angular/material/icon';
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu';
import {
  MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, MatTable,
} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import {Router, RouterLink} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import type {Organ, OrganId} from '@api/index';
import {PageHeadComponent} from '../../shared/components/page-head/page-head.component';
import {formatNumber} from '../../shared/format-number';
import {LanguagePreference} from '../../shared/language-preference';
import {byName} from '../../shared/ledger-order';
import {TapeLibrary} from '../../tape/tape-library.store';
import {OrganDeletion} from '../organ-deletion';
import {OrganLibrary} from '../organ-library.store';
import {pipeRange} from '../pipe-range';
import {tapeBedMiniature} from '../tape-bed-miniature';

const MINIATURE_WIDTH = 132;
const MINIATURE_HEIGHT = 60;
/** The widest Tape of the listed Organs fills this many px of the miniature. */
const MINIATURE_TAPE_HEIGHT = 56;

interface OrganRow {
  readonly organ: Organ;
  readonly range: ReturnType<typeof pipeRange>;
  readonly bed: {readonly tapeWidth: string; readonly hole: string};
  readonly miniature: {readonly top: number; readonly height: number; readonly rowCentres: readonly number[]};
  /** `null` while the Tape library could not be read. */
  readonly tapeCount: number | null;
}

@Component({
  selector: 'cranc-organ-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe, RouterLink, MatButton, MatIconButton, MatIcon, MatCard, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip,
    MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatHeaderRow, MatHeaderRowDef, MatCell, MatCellDef, MatRow, MatRowDef, PageHeadComponent,
  ],
  template: `
    <cranc-page-head [title]="'ORGAN.LIST.TITLE' | translate" [subtitle]="'ORGAN.LIST.SUBTITLE' | translate">
      <ng-container ngProjectAs="[pageHeadActions]">
        @if (rows().length > 0) {
          <a matButton="filled" routerLink="/organs/new" data-testid="new-organ">
            <mat-icon>add</mat-icon>
            {{ 'ORGAN.LIST.NEW' | translate }}
          </a>
        }
      </ng-container>
    </cranc-page-head>
    @if (rows().length === 0) {
      <mat-card appearance="outlined" class="empty" data-testid="empty-state">
        <mat-icon aria-hidden="true">piano</mat-icon>
        <p>{{ 'ORGAN.LIST.EMPTY' | translate }}</p>
        <a matButton="filled" routerLink="/organs/new" data-testid="new-organ">
          <mat-icon>add</mat-icon>
          {{ 'ORGAN.LIST.NEW' | translate }}
        </a>
      </mat-card>
    } @else {
      <mat-card appearance="outlined">
        <table mat-table class="cr-ledger" [dataSource]="rows()" [trackBy]="trackRow">
          <ng-container matColumnDef="miniature">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'ORGAN.LIST.TAPE_BED_HEADER' | translate }}</span></th>
            <td mat-cell *matCellDef="let row">
              <svg data-testid="organ-miniature" aria-hidden="true" [attr.width]="miniatureWidth" [attr.height]="miniatureHeight"
                   [attr.viewBox]="'0 0 ' + miniatureWidth + ' ' + miniatureHeight">
                <rect x="0" [attr.y]="row.miniature.top" [attr.width]="miniatureWidth" [attr.height]="row.miniature.height"
                      fill="var(--cr-tape)" stroke="var(--cr-tape-edge)"/>
                @for (centre of row.miniature.rowCentres; track $index) {
                  <line x1="0" [attr.x2]="miniatureWidth" [attr.y1]="row.miniature.top + centre" [attr.y2]="row.miniature.top + centre"
                        stroke="var(--cr-tape-guide-strong)"/>
                }
              </svg>
            </td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'ORGAN.LIST.NAME' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              <a class="name" [routerLink]="['/organs', row.organ.id]" data-testid="organ" (click)="$event.stopPropagation()">{{ row.organ.name }}</a>
              <div class="facts" data-testid="organ-facts">{{ (row.range.count === 1 ? 'ORGAN.EDITOR.PIPES_RANGE_ONE' : 'ORGAN.EDITOR.PIPES_RANGE') | translate: row.range }}. {{ 'ORGAN.LIST.TAPE_BED_FACTS' | translate: row.bed }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="tapes">
            <th mat-header-cell *matHeaderCellDef>{{ 'ORGAN.LIST.TAPES_HEADER' | translate }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.tapeCount === null) {
                <!-- The Tape library could not be read: no count. -->
              } @else if (row.tapeCount === 0) {
                <span data-testid="organ-tapes">{{ 'ORGAN.LIST.TAPES_NONE' | translate }}</span>
              } @else {
                <a [routerLink]="['/tapes']" [queryParams]="{organ: row.organ.id}" data-testid="organ-tapes" (click)="$event.stopPropagation()">{{ (row.tapeCount === 1 ? 'ORGAN.LIST.TAPES_ONE' : 'ORGAN.LIST.TAPES') | translate: {count: row.tapeCount} }}</a>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'ORGAN.LIST.ACTIONS_HEADER' | translate }}</span></th>
            <td mat-cell *matCellDef="let row">
              <button matIconButton type="button" [matMenuTriggerFor]="rowMenu" (click)="$event.stopPropagation()"
                      [attr.aria-label]="'ORGAN.LIST.MORE_ACTIONS' | translate: {name: row.organ.name}"
                      [matTooltip]="'ORGAN.LIST.MORE_ACTIONS' | translate: {name: row.organ.name}">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #rowMenu="matMenu">
                <button mat-menu-item type="button" class="destructive" data-testid="delete-organ" (click)="delete(row.organ)">
                  <mat-icon>delete</mat-icon>
                  <span>{{ 'ORGAN.EDITOR.DELETE' | translate }}</span>
                </button>
              </mat-menu>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" (click)="open(row.organ.id)"></tr>
        </table>
      </mat-card>
      @if (nextStep()) {
        <div class="next-step" data-testid="next-step">
          <mat-icon aria-hidden="true">music_note</mat-icon>
          <span>{{ 'ORGAN.LIST.NEXT_STEP' | translate }}</span>
          <a matButton="outlined" routerLink="/tapes/new">{{ 'TAPE.LIST.NEW' | translate }}</a>
        </div>
      }
    }
  `,
  styles: `
    tr[mat-row] {
      cursor: pointer;
    }

    .name {
      font-family: var(--mat-sys-headline-small-font);
      font-size: 1.125rem;
      font-weight: 600;
    }

    .facts {
      color: var(--mat-sys-on-surface-variant);
    }

    .destructive {
      --mat-menu-item-label-text-color: var(--mat-sys-error);
      --mat-menu-item-icon-color: var(--mat-sys-error);
    }

    .empty {
      align-items: center;
      gap: 12px;
      padding: 32px;
      text-align: center;
    }

    .next-step {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 18px;
      padding: 14px 20px;
      border: 1px dashed var(--cr-paper-edge);
      border-radius: 3px;
      color: var(--mat-sys-on-surface-variant);

      span {
        flex: 1;
      }
    }
  `,
})
export class OrganListComponent {
  protected readonly library = inject(OrganLibrary);
  private readonly tapes = inject(TapeLibrary);
  private readonly deletion = inject(OrganDeletion);
  private readonly router = inject(Router);
  private readonly language = inject(LanguagePreference).language;

  protected readonly columns = ['miniature', 'name', 'tapes', 'actions'];
  protected readonly miniatureWidth = MINIATURE_WIDTH;
  protected readonly miniatureHeight = MINIATURE_HEIGHT;

  protected readonly rows = computed<OrganRow[]>(() => {
    const language = this.language();
    const organs = byName(this.library.entities(), language);
    const widest = Math.max(...organs.map((organ) => organ.tapeBed.tapeWidth));
    const readable = this.tapes.loadProblem() === null;
    return organs.map((organ) => {
      const {bodyHeight, rowCentres} = tapeBedMiniature(organ, widest, MINIATURE_TAPE_HEIGHT);
      return {
        organ,
        range: pipeRange(organ),
        bed: {tapeWidth: formatNumber(organ.tapeBed.tapeWidth, language), hole: formatNumber(organ.tapeBed.holeDiameter, language)},
        miniature: {top: (MINIATURE_HEIGHT - bodyHeight) / 2, height: bodyHeight, rowCentres},
        tapeCount: readable ? this.tapes.tapesOf(organ.id).length : null,
      };
    });
  });

  /** Offered while there is an Organ and no Tape yet. */
  protected readonly nextStep = computed(
    () => this.rows().length > 0 && this.tapes.loadProblem() === null && this.tapes.tapeEntities().length === 0,
  );

  protected trackRow(_index: number, row: OrganRow): OrganId {
    return row.organ.id;
  }

  protected open(id: OrganId): void {
    void this.router.navigate(['/organs', id]);
  }

  protected delete(organ: Organ): void {
    void this.deletion.confirmAndDelete(organ);
  }
}
