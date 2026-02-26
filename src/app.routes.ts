import {Route} from "@angular/router";
import {HomeComponent} from "./app/home/home.component";
import {DetailComponent} from "./app/detail/detail.component";
import {PageNotFoundComponent} from "./app/shared/components";

export const routes: Route[] = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: HomeComponent
  },
  {
    path: 'detail',
    component: DetailComponent
  },
  {
    path: '**',
    component: PageNotFoundComponent
  }
];
