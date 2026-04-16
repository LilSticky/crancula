import {Component} from '@angular/core';
import {TranslatePipe} from "@ngx-translate/core";
import {RouterLink} from "@angular/router";
import {MatButton} from "@angular/material/button";
import {forNavBar, selectNavigations} from "./crancula-navigation";

@Component({
  selector: 'cranc-navbar',
  imports: [
    TranslatePipe,
    RouterLink,
    MatButton
  ],
  template: `
    <div class="flex-row">
      @for (item of items; track $index) {
        <a matButton [routerLink]="item.fullPath">{{ item.translate.title | translate }}</a>
      }
    </div>
  `,
  styles: `
    .flex-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }`,
})
export class NavbarComponent {
  items = selectNavigations(forNavBar)
}
