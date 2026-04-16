import {Route} from "@angular/router";

export type MenuData = {
  navbar?: boolean
};
export type TranslateData = {
  title?: string
};
export type RouteData = {
  path: string
  showIn: MenuData,
  translate: TranslateData
};
export type CranculaRoute = { data?: RouteData, children?: CranculaRoutes } & Route;
export type CranculaRoutes = CranculaRoute[];
