import {CranculaRoute, RouteData} from "../../../../model/crancula-routes";

export class CranculaNavigation implements RouteData {
  path: string;
  showIn: {
    rail: boolean
    icon: string
  };
  translate: {
    title: string
  };

  constructor({data, path}: CranculaRoute, parentPath: string = '') {
    this.path = (parentPath ? ['', parentPath, path] : [parentPath, path]).join('/');
    this.showIn = {
      rail: data?.showIn.rail ?? false,
      icon: data?.showIn.icon ?? ''
    };
    this.translate = {
      title: data?.translate.title ?? ''
    };
  }
}
