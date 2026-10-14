import {Component} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'cranc-home-page',
  template: `
    <div class="container">
      <h1 class="title">
        {{ 'PAGES.HOME.TITLE' | translate }}
      </h1>
    </div>
  `,
  styles: `
    :host {

    }
  `,
  standalone: true,
  imports: [TranslatePipe]
})
export class HomePage {
}
