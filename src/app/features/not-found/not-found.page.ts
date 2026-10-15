import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';
import {PageHeadComponent} from '../shared/components/page-head/page-head.component';

@Component({
  selector: 'cranc-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeadComponent],
  template: `
    <cranc-page-head [title]="'NOT_FOUND.TITLE' | translate"/>
    <p>{{ 'NOT_FOUND.MESSAGE' | translate }}</p>
  `,
  styles: ``,
})
export class NotFoundPage {
}
