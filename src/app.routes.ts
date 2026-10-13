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
      path: '/home',
      showIn: {
        navbar: true
      },
      translate: {
        title: 'PAGES.HOME.TITLE'
      }
    }
  },
  {
    path: '**',
    component: NotFoundPage
  }
];
