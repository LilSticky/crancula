import {signalStore} from "@ngrx/signals";
import {Organ} from "@api/model/organ"
import {withSelectedEntityModule} from "@shared/store-features/withSelectedEntityStore";
import {withStorageSync} from "@angular-architects/ngrx-toolkit";
import {organStorageConfig} from "./organ-storage-config";

export const OrganStore = signalStore(
  {providedIn: 'root'},
  withSelectedEntityModule<Organ>(),
  withStorageSync(organStorageConfig)
)
