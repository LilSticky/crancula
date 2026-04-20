import {routes} from "../../../../app.routes";
import {CranculaRoute, CranculaRoutes} from "../../../../model/crancula-routes";
import {CranculaNavigation} from "./crancula-navigation";

const toNavigation = (route: CranculaRoute): CranculaNavigation => new CranculaNavigation(route);
const toChildNavigation = (route: CranculaRoute, parentPath?: string): CranculaNavigation => new CranculaNavigation(route, parentPath);

export class CranculaNavigations {
  root: CranculaRoutes;
  items: Array<CranculaNavigation>

  constructor(routes: CranculaRoutes) {
    this.root = routes;
    this.items = routes.map(toNavigation);
    routes.forEach((route: CranculaRoute) => this.addChildrenOf(route));
  }

  public static forNavbar(): CranculaNavigation[] {
    return this.fromRoutes().items.filter((nav: CranculaNavigation) => nav.showIn.navbar);
  }

  private static fromRoutes(): CranculaNavigations {
    return new CranculaNavigations(routes);
  }

  private add = (navigation: CranculaNavigation): number => this.items.push(navigation);

  private addChildrenOf({children, path}: CranculaRoute): void {
    (children ?? []).forEach((child: CranculaRoute): void => {
      this.add(toChildNavigation(child, path));
      if (child.children) {
        this.addChildrenOf(child)
      }
    });
  }
}
