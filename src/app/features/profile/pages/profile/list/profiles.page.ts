import {Component, inject} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ProfileListComponent} from "../../../components/profile-list/profile-list.component";
import {ProfilesStore} from "../../../store/profiles.store";

@Component({
  selector: 'cranc-profiles-page',
  template: `
      <h1 class="title">
        {{ 'PAGES.PROFILES.TITLE' | translate }}
      </h1>

      <cranc-profile-list
        [profiles]="profiles()"
      />
  `,
  styles: `
    .title {
      margin-left: 1%;
    }
  `,
  standalone: true,
  imports: [TranslateModule, ProfileListComponent]
})
export class ProfilesPage {
  store = inject(ProfilesStore);
  profiles = this.store.entities;
}
