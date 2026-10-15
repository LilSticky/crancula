import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {MatIcon} from '@angular/material/icon';
import {MatListItem, MatListItemIcon, MatListItemTitle, MatNavList} from '@angular/material/list';
import {MatTooltip} from '@angular/material/tooltip';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {LanguagePreference} from '../shared/language-preference';
import {SchemePreference, type Scheme} from '../shared/scheme-preference';
import {CranculaNavigation} from './model/crancula-navigation';
import {CranculaNavigations} from './model/crancula-navigations';

interface SchemeOption {
  readonly value: Scheme;
  readonly icon: string;
  readonly label: string;
}

/** The navigation rail: brand, the pages, and at the bottom the language and colour scheme choices. */
@Component({
  selector: 'cranc-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatListItem,
    MatListItemIcon,
    MatListItemTitle,
    MatNavList,
    MatTooltip,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
  ],
  host: {class: 'cr-rail'},
  template: `
    <div class="rail" data-testid="rail" [class.compact]="compact()">
      <a class="brand" data-testid="brand" routerLink="/organs" [attr.aria-label]="compact() ? 'Crancula' : null">
        <img src="assets/icons/logo.svg" alt="" width="32" height="32">
        @if (!compact()) {
          <span>Crancula</span>
        }
      </a>
      <mat-nav-list data-testid="rail-nav">
        @for (item of items; track item.path) {
          @if (compact()) {
            <a mat-list-item routerLinkActive #active="routerLinkActive" [routerLink]="item.path"
               [activated]="active.isActive" [attr.aria-label]="item.translate.title | translate"
               [matTooltip]="item.translate.title | translate" matTooltipPosition="right">
              <mat-icon matListItemIcon>{{ item.showIn.icon }}</mat-icon>
            </a>
          } @else {
            <a mat-list-item routerLinkActive #active="routerLinkActive" [routerLink]="item.path"
               [activated]="active.isActive">
              <mat-icon matListItemIcon>{{ item.showIn.icon }}</mat-icon>
              <span matListItemTitle>{{ item.translate.title | translate }}</span>
            </a>
          }
        }
      </mat-nav-list>
      <div class="spacer"></div>
      <mat-button-toggle-group data-testid="language-switch" hideSingleSelectionIndicator [vertical]="compact()"
                               [value]="languagePreference.language()" [attr.aria-label]="'RAIL.LANGUAGE' | translate"
                               (change)="languagePreference.choose($event.value)">
        <mat-button-toggle data-language="en" value="en">EN</mat-button-toggle>
        <mat-button-toggle data-language="de" value="de">DE</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-button-toggle-group data-testid="scheme-switch" hideSingleSelectionIndicator [vertical]="compact()"
                               [value]="schemePreference.scheme()" [attr.aria-label]="'RAIL.SCHEME' | translate"
                               (change)="schemePreference.choose($event.value)">
        @for (option of schemes; track option.value) {
          <mat-button-toggle [attr.data-scheme]="option.value" [value]="option.value"
                             [aria-label]="option.label | translate">
            <mat-icon>{{ option.icon }}</mat-icon>
          </mat-button-toggle>
        }
      </mat-button-toggle-group>
      @if (!compact()) {
        <p class="foot">{{ 'RAIL.SAVED_HERE' | translate }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .rail { box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 18px 12px; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 18px; color: inherit; text-decoration: none;
      font: 600 22px/1 var(--mat-sys-headline-small-font); }
    .spacer { flex: 1; }
    mat-button-toggle-group { width: 100%; }
    mat-button-toggle { flex: 1; }
    .foot { margin: 2px 8px 0; font-size: 12px; color: var(--cr-walnut-muted); }
    .compact { padding: 18px 8px; align-items: center; }
    .compact .brand { padding: 4px 0 18px; }
  `,
})
export class RailComponent {
  readonly compact = input(false);

  protected readonly items: CranculaNavigation[] = CranculaNavigations.forRail();
  protected readonly schemes: readonly SchemeOption[] = [
    {value: 'system', icon: 'brightness_auto', label: 'RAIL.SCHEME_SYSTEM'},
    {value: 'light', icon: 'light_mode', label: 'RAIL.SCHEME_LIGHT'},
    {value: 'dark', icon: 'dark_mode', label: 'RAIL.SCHEME_DARK'},
  ];
  protected readonly schemePreference = inject(SchemePreference);
  protected readonly languagePreference = inject(LanguagePreference);
}
