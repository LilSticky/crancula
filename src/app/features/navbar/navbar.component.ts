import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle';
import {firstValueFrom} from 'rxjs';
import {TranslatePipe, TranslateService} from "@ngx-translate/core";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {MatButton} from "@angular/material/button";
import {CranculaNavigations} from "./model/crancula-navigations";
import {CranculaNavigation} from "./model/crancula-navigation";
import {isLanguage, type Language} from "@api/index";
import {CRANCULA_API} from "../../core/crancula-api.token";

const LANGUAGE_KEY = 'crancula.language';

@Component({
  selector: 'cranc-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonToggleGroup,
    MatButtonToggle,
    TranslatePipe,
    RouterLink,
    MatButton,
    RouterLinkActive
  ],
  template: `
    <div class="flex-row" data-testid="navbar">
      <a class="brand" data-testid="brand" routerLink="/home">
        <img src="assets/icons/logo.svg" alt="" width="32" height="32">
        <span>Crancula</span>
      </a>
      @for (item of items; track $index) {
        <a matButton routerLinkActive="router-link-active"
           [routerLink]="item.path">{{ item.translate.title | translate }}</a>
      }
      <mat-button-toggle-group data-testid="language-switch" [value]="language()"
                               [attr.aria-label]="'NAVBAR.LANGUAGE' | translate"
                               (change)="choose($event.value)">
        <mat-button-toggle data-language="en" value="en">EN</mat-button-toggle>
        <mat-button-toggle data-language="de" value="de">DE</mat-button-toggle>
      </mat-button-toggle-group>
    </div>
  `,
  styles: `
    .flex-row {
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: inherit;
      font-weight: 500;
    }

    .brand img {
      height: 32px;
    }

    .router-link-active {
      background-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary) !important;
    }
  `,
})
export class NavbarComponent {
  protected readonly items: CranculaNavigation[];

  private readonly translate = inject(TranslateService);
  private readonly api = inject(CRANCULA_API);
  protected readonly language = signal<Language>('en');

  constructor() {
    this.items = CranculaNavigations.forNavbar();
    const stored = localStorage.getItem(LANGUAGE_KEY);
    const current = this.translate.getCurrentLang();
    const initial: Language = isLanguage(stored) ? stored : isLanguage(current) ? current : 'en';
    this.language.set(initial);
    void firstValueFrom(this.translate.use(initial));
    void this.api.app.setLanguage(initial);
  }

  protected choose(language: Language): void {
    localStorage.setItem(LANGUAGE_KEY, language);
    this.language.set(language);
    void firstValueFrom(this.translate.use(language));
    void this.api.app.setLanguage(language);
  }
}
