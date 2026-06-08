import {withEntities} from "@ngrx/signals/entities";
import {HasId} from "@shared/store-features/model/hasId";
import {signalStoreFeature} from "@ngrx/signals";
import {withLoading} from "@shared/store-features/slices/loading/withLoading";
import {withKnownId} from "@shared/store-features/slices/withKnownId";
import {withCrud} from "@shared/store-features/slices/withCrud";
import {withSelected} from "@shared/store-features/slices/selected/withSelected";

export function withSelectedEntityModule<Entity extends HasId>() {
  return signalStoreFeature(
    withEntities<Entity>(),
    withLoading<Entity>(),
    withKnownId<Entity>(),
    withCrud<Entity>(),
    withSelected<Entity>()
  )
}
