import {ProfilesPage} from "./profile/list/profiles.page";
import {ProfilePage} from "./profile/id/profile.page";

import {CranculaRoutes} from "../../../../model/crancula-routes";

export const PROFILE_BASE_PATH = 'profile'
export const profileRoutes: CranculaRoutes = [
  {
    path: PROFILE_BASE_PATH,
    children: [
      {
        path: 'list',
        component: ProfilesPage,
        pathMatch: "full",
        title: "Profiles",
        data: {
          fullPath: '/profile/list',
          showIn: {
            navbar: true
          },
          translate: {
            title: 'ROUTES.TO_PROFILES'
          }
        }
      },
      {
        path: 'new',
        component: ProfilePage,
        pathMatch: "full",
        title: "New Profile"
      },
      {
        path: ':id',
        component: ProfilePage,
        pathMatch: "full",
        title: "Profile"
      }
    ]
  }];
