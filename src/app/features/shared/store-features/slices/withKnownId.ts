import {signalStoreFeature, type, withMethods} from "@ngrx/signals";
import {EntityId, EntityProps, EntityState} from "@ngrx/signals/entities";
import {HasId} from "@shared/store-features/model/hasId";

export function withKnownId<Entity extends HasId>() {
  return signalStoreFeature(
    {
      state: type<EntityState<Entity>>(),
      props: type<EntityProps<Entity>>()
    },
    withMethods((store) => ({
      /**
       * @param id
       * @return is the {@link id} known to the {@link store}
       */
      _isKnown(id?: EntityId): boolean {
        const isKnown = id ? store.ids().includes(id) : false;
        console.debug(isKnown ? 'known id' : 'unknown id', id)
        return isKnown
      },
    }))
  )
}
