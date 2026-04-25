import {Injectable} from '@angular/core';
import {Organ} from "@api/model/organ";

import {DataStore} from "@api/data-store";


@Injectable({
  providedIn: 'root',
})
export class ElectronApiService implements DataStore {
}
