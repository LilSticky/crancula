import {Component, inject} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {OrganListComponent} from "../../../components/organ-list/organ-list.component";
import {OrganStore} from "../../../store/organStore";
import {Organ} from "@api/model/organ";
import {EntityId} from "@ngrx/signals/entities";
import {Router} from "@angular/router";
import {ORGAN_BASE_PATH} from "../../routes";

@Component({
  selector: 'cranc-organs-page',
  template: `
    <h1 class="title">
      {{ 'PAGES.ORGANS.TITLE' | translate }}
    </h1>

    <cranc-organ-list
      [organs]="organs()"
      (addNewOrgan)="onAddNewOrgan()"
      (selectOrgan)="onSelectOrgan($event)"
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
  private router = inject(Router);
  private store = inject(OrganStore);
  protected organs = this.store.entities;
  onAddNewOrgan = () => this.store.selectNewEntity(new Organ());
  onSelectOrgan = async (id: EntityId) => {
    this.store.selectEntity(id);
    await this.router.navigate(['/', ORGAN_BASE_PATH, id])
  };
}
