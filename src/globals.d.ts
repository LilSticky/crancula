import {DataStore} from "@api/index";

declare global {
  interface Window {
    process: any;
    require: any;
    bridge: DataStore;
  }
}
