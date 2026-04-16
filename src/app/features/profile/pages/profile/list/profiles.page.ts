import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {ProfileListComponent} from "../../../components/profile-list/profile-list.component";
import {ProfilesStore} from "../../../store/profiles.store";

@Component({
  selector: 'cranc-profiles-page',
  template: `
    <div class="container">
      <h1 class="title">
        {{ 'PAGES.PROFILES.TITLE' | translate }}
      </h1>

      <a routerLink="/">{{ 'PAGES.PROFILES.BACK_TO_HOME' | translate }}</a>
      <cranc-profile-list
        [profiles]="profiles()"
      />
    </div>
  `,
  styles: '',
  standalone: true,
  imports: [RouterLink, TranslateModule, ProfileListComponent]
})
export class ProfilesPage {
  store = inject(ProfilesStore);
  profiles = this.store.entities;
}
