import {Injectable} from '@angular/core';
import {Bridge} from "@api/model/bridge";
import {LocalContextBridge} from "./model/local-context-bridge";
import {PersistenceBridge} from "../../persistence-bridge";

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService implements PersistenceBridge {
  bridge: Bridge;

  constructor() {
    this.bridge = new LocalContextBridge();
  }
}
