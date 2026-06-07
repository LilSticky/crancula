import {Bridge} from "@api/model/bridge";
import {DataStore} from "@api/index";
import {Organ} from "@api/model/organ";
import {OrganDataStore} from "./local-organ-store";

export class LocalContextBridge implements Bridge {
  organs: DataStore<Organ>;

  constructor() {
    this.organs = new OrganDataStore();
  }
}
