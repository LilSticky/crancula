import {Component, inject} from '@angular/core';
import {OrganFormComponent} from "../../../components/organ-form/organ-form.component";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {map} from "rxjs";
import {OrganStore} from "../../../store/organStore";
import {TranslatePipe} from "@ngx-translate/core";
import {Organ} from "@api/model/organ";
import {ORGAN_BASE_PATH} from "../../routes";

const getId = (params: Params): string => (params["id"] || '') as string;

@Component({
  selector: 'cranc-organ-page',
  imports: [
    OrganFormComponent,
    TranslatePipe
  ],
  template: `
    @let model = selected();
    @if (model) {
      <cranc-organ-form
        [organModel]="model"
        (save)="onSave($event)"
        (discard)="onDiscard($event)"
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
  readonly store = inject(OrganStore);
  protected readonly selected = this.store.selectedEntity;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.route.params.pipe(map(getId)).subscribe((id?: string) => ({
      next: () => {
        const selected = this.store.selectedEntity();
        if (!selected) {
          console.debug("selected organ by id from route", selected)
          this.store.selectEntity(id)
        }
      }
    }));
  }

  onSave(organ: Organ): void {
    console.debug("onSave organ")
    this.store.updateEntity(organ)
    // TODO user feedback that the organ was saved
  }

  protected async onDiscard(initialState?: Organ) {
    if (initialState) {
      this.store.updateEntity(initialState)
    }
    await this.router.navigate(['/', ORGAN_BASE_PATH])
  }
}
