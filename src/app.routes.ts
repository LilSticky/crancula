import {organRoutes} from "./app/features/organ/routes";
import {plotterRoutes} from "./app/features/plotter/routes";
import {tapeRoutes} from "./app/features/tape/routes";
import {NotFoundPage} from "./app/features/not-found/not-found.page";
import {CranculaRoutes} from "./model/crancula-routes";

export const routes: CranculaRoutes = [
  {
    path: '',
    redirectTo: 'organs',
    pathMatch: 'full'
  },
  ...organRoutes,
  ...tapeRoutes,
  ...plotterRoutes,
  {
    path: '**',
    component: NotFoundPage
  }
];
