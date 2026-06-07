import {signalStore} from "@ngrx/signals";
import {Organ} from "@api/model/organ"
import {withSelectedEntityModule} from "@shared/store-features/withSelectedEntityStore";

const ORGANS_CHANNEL = "organs";

export const OrganStore = signalStore(
  {providedIn: 'root'},
  withSelectedEntityModule<Organ>(ORGANS_CHANNEL)
)
