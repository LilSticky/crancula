import {Component} from '@angular/core';
import {TranslatePipe} from "@ngx-translate/core";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {MatButton} from "@angular/material/button";
import {CranculaNavigations} from "./model/crancula-navigations";
import {CranculaNavigation} from "./model/crancula-navigation";

@Component({
  selector: 'cranc-navbar',
  imports: [
    TranslatePipe,
    RouterLink,
    MatButton,
    RouterLinkActive
  ],
  template: `
    <div class="flex-row">
      @for (item of items; track $index) {
        <a matButton routerLinkActive="router-link-active"
           [routerLink]="item.path">{{ item.translate.title | translate }}</a>
      }
    </div>
  `,
  styles: `
    .flex-row {
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      align-items: center;
    }

    .router-link-active {
      background-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary) !important;
    }
  `,
})
export class NavbarComponent {
  protected readonly items: CranculaNavigation[];

  constructor() {
    this.items = CranculaNavigations.forNavbar();
  }
}
