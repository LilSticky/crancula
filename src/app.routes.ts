import {profileRoutes} from "./app/features/profile/pages/profile-routes";
import {HomePage} from "./app/features/home/home.page";
import {NotFoundPage} from "./app/features/not-found/not-found.page";
import {CranculaRoutes} from "./model/crancula-routes";

export const routes: CranculaRoutes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: HomePage,
    pathMatch: "full",
    title: "Home",
    data: {
      fullPath: '/home',
      showIn: {
        navbar: true
      },
      translate: {
        title: 'ROUTES.TO_HOME'
      }
    }
  },
  ...profileRoutes,
  {
    path: '**',
    component: NotFoundPage
  }
];
