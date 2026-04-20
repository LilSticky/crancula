import {CranculaRoute, RouteData} from "../../../../model/crancula-routes";

export class CranculaNavigation implements RouteData {
  path: string;
  showIn: {
    navbar: boolean
  };
  translate: {
    title: string
  };

  constructor({data, path}: CranculaRoute, parentPath: string = '') {
    this.path = (parentPath ? ['', parentPath, path] : [parentPath, path]).join('/');
    this.showIn = {
      navbar: data?.showIn.navbar ?? false
    };
    this.translate = {
      title: data?.translate.title ?? ''
    };
  }
}

