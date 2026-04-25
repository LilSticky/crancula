import {Bridge} from "../app/bridge";

declare global {
  interface Window {
    process: any;
    require: any;
    bridge: Bridge
  }
}
