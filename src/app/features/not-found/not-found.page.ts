import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'cranc-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'NOT_FOUND.TITLE' | translate }}</h1>
    <p>{{ 'NOT_FOUND.MESSAGE' | translate }}</p>
  `,
  styles: ``,
})
export class NotFoundPage {
}
