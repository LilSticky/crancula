import {routes} from "../../../../app.routes";
import {CranculaRoute, CranculaRoutes} from "../../../../model/crancula-routes";
import {CranculaNavigation} from "./crancula-navigation";

export class CranculaNavigations extends Array<CranculaNavigation> {
  constructor(...items: CranculaNavigation[]) {
    super(items.length);
    super.push(...items)
  }

  static fromRoutes() {
    const navs = routes.map(route => CranculaNavigation.of(route));
    return new CranculaNavigations(...navs).addChildren(routes)
  }

  static forNavbar() {
    return this.fromRoutes().filter((nav: CranculaNavigation) => nav.showIn.navbar)
  }

  addAll = (next: CranculaNavigation[]): CranculaNavigations => new CranculaNavigations(...this, ...next);

  addChildren(routes: CranculaRoutes): CranculaNavigations {
    routes.map(CranculaNavigation.childrenOf).forEach(this.addAll);
    const children: CranculaRoutes = routes.reduce((previous: CranculaRoutes, route: CranculaRoute): CranculaRoutes => [...previous, ...(route.children ?? [])], []);
    if (children.some((child: CranculaRoute): boolean => !!child.children)) {
      return this.addChildren(children)
    } else {
      return this
    }
  }
}
