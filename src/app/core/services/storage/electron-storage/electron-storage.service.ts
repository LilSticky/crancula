import {Injectable} from '@angular/core';
import {Bridge} from "@api/model/bridge";
import {PersistenceBridge} from "../../persistence-bridge";

@Injectable({
  providedIn: 'root',
})
export class ElectronStorageService implements PersistenceBridge {
  bridge: Bridge;

  constructor() {
    this.bridge = window.bridge;
  }
}
