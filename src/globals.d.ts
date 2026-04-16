import {CranculaApi} from "@api/index";

declare global {
  interface Window {
    process: any;
    require: any;
    api: CranculaApi;
  }
}
