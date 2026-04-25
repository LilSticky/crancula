import {Component, inject} from '@angular/core';
import {OrganFormComponent} from "../../../components/organ-form/organ-form.component";
import {ActivatedRoute, Params} from "@angular/router";
import {map} from "rxjs";
import {OrgansStore} from "../../../store/organs.store";
import {TranslatePipe} from "@ngx-translate/core";

const getId = (params: Params): string => (params["id"] || '') as string;

@Component({
  selector: 'cranc-organ-page',
  imports: [
    OrganFormComponent,
    TranslatePipe
  ],
  template: `
    @let selected = store.selectedOrgan();
    @if (selected) {
      <cranc-organ-form
        [organModel]="selected"
      />
    } @else if (store.isLoading()) {
      {{ 'PAGES.ORGAN.FORM.LOADING' | translate }}
    } @else {
      {{ 'PAGES.ORGAN.FORM.ERROR.NO_ORGAN_SELECTED' | translate }}
    }
  `,
  styles: ``,
})
export class OrganPage {
  readonly store = inject(OrgansStore);

  private readonly route = inject(ActivatedRoute);

  constructor() {
    // keep updating the selected organ id of the store with the organ id of the route
    this.route.params.pipe(map(getId)).subscribe((id?: string) => ({
      next: () => {
        if (this.store.isSelectable(id)) {
          this.store.selectOrgan(id)
        }
      }
    }));
  }
}
