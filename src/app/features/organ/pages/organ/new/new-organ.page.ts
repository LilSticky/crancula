import {Component, inject} from '@angular/core';
import {OrganFormComponent} from "../../../components/organ-form/organ-form.component";
import {OrgansStore} from "../../../store/organs.store";
import {Organ} from "@api/model/organ";


@Component({
  selector: 'cranc-organ-page',
  imports: [
    OrganFormComponent
  ],
  template: `
    <cranc-organ-form
      [organModel]="selectedOrgan"
    />
  `,
  styles: ``,
})
export class NewOrganPage {
  private readonly store = inject(OrgansStore);
  protected readonly selectedOrgan: Organ;

  constructor() {
    const organ: Organ = this.store.newOrgan();
    this.selectedOrgan = organ;
    this.store.selectOrgan(organ.id)
  }
}
