import {Component, inject} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {OrganListComponent} from "../../../components/organ-list/organ-list.component";
import {OrgansStore} from "../../../store/organs.store";
@Component({
  selector: 'cranc-organs-page',
  template: `
      <h1 class="title">
        {{ 'PAGES.ORGANS.TITLE' | translate }}
      </h1>

      <cranc-organ-list
        [organs]="organs()"
      />
  `,
  styles: `
    .title {
      margin-left: 1%;
    }
  `,
  standalone: true,
  imports: [TranslateModule, OrganListComponent]
})
export class OrgansPage {
  store = inject(OrgansStore);
  organs = this.store.entities;
}
