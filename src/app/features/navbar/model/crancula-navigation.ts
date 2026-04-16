import {CranculaRoute, RouteData} from "../../../../model/crancula-routes";

export class CranculaNavigation implements RouteData {
  path: string;
  showIn: {
    navbar: boolean
  };
  translate: {
    title: string
  };

  constructor({path, showIn, translate}: RouteData) {
    this.path = path;
    this.showIn = {
      navbar: showIn.navbar ?? false
    };
    this.translate = {
      title: translate.title ?? ''
    };
  }

  static of = ({data, path}: CranculaRoute, parentPath: string = ''): CranculaNavigation => new CranculaNavigation({
    path: [parentPath, path ?? ''].join('/'),
    showIn: data?.showIn ?? {
      navbar: data?.showIn.navbar ?? false
    },
    translate: data?.translate ?? {
      title: data?.translate.title
    }
  });

  static childrenOf = (route: CranculaRoute) => (route.children ?? [])
    .map((next: CranculaRoute) => this.of(next, route.path))
}

