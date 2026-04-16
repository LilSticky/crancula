import {routes} from "../../../../app.routes";
import {CranculaRoute, CranculaRoutes, MenuData, RouteData, TranslateData} from "../../../../model/crancula-routes";

export class CranculaNavigation implements RouteData {
  fullPath: string;
  showIn: MenuData;
  translate: TranslateData;

  constructor({fullPath, showIn, translate}: Partial<RouteData> = {}) {
    this.fullPath = fullPath ?? '';
    this.showIn = showIn ?? {
      navbar: false
    };
    this.translate = translate ?? {
      title: ''
    };
  }
}

const joinRoutes = (previousValue: CranculaRoute[], currentValue: CranculaRoute[]): CranculaRoute[] => [...previousValue, ...currentValue];

const toNavigation = ({data}: CranculaRoute): CranculaNavigation => new CranculaNavigation(data);

const toChildren = (route: CranculaRoute): CranculaRoutes => route.children ?? [];

const addTo = (navigations: CranculaNavigation[]) => {
  return (item: CranculaNavigation): number => navigations.push(item)
};

const hasChildren = (child: CranculaRoute): boolean => !!child.children;

function addChildren(routes: CranculaRoute[], add: (navigation: CranculaNavigation) => unknown): void {
  const children = routes.map(toChildren).reduce(joinRoutes);
  children.map(toNavigation).forEach(add);
  if (children.some(hasChildren)) {
    return addChildren(children, add)
  }
}

function getNavigations(routes: CranculaRoutes): CranculaNavigation[] {
  const navigations = routes.map(toNavigation);
  addChildren(routes, addTo(navigations));
  return navigations
}

export const forNavBar = ({showIn}: RouteData): boolean => !!showIn.navbar
export const selectNavigations = (select: (route: RouteData) => boolean) => getNavigations(routes).filter(select)
