import {Bridge} from "@api/model/bridge";

declare global {
  interface Window {
    process: any;
    require: any;
    bridge: Bridge
  }
}
