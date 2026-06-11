import {patchState, signalStoreFeature, type, withMethods} from "@ngrx/signals";
import {addEntity, EntityId, EntityProps, EntityState, removeEntity} from "@ngrx/signals/entities";
import {HasId} from "@shared/store-features/model/hasId";

export function withCrud<Entity extends HasId>() {
  return signalStoreFeature(
    {
      state: type<EntityState<Entity>>(),
      methods: type<{
        _isKnown(id?: EntityId): boolean;
      }>(),
      props: type<EntityProps<Entity>>()
    },
    withMethods((store) => ({
      /**
       * add a new Entity to {@link store} if it is not known
       * @param entity
       */
      createEntity(entity: Entity): Entity {
        if (!store._isKnown(entity.id)) {
          patchState(store, addEntity(entity))
        } else {
          console.warn(`entity ${entity.id} already exists, cannot create`)
        }
        // now definitely exists
        return this._readEntity(entity.id)!
      },
      /**
       * get entity by {@link id} from {@link store}
       * @param id
       * @return entity or null
       */
      _readEntity(id: EntityId): Entity | null {
        return store.entityMap()[id];
      },
      /**
       * update an existing entity in {@link store} if it is known
       * @param entity
       */
      updateEntity(entity: Entity): void {
        const id: EntityId = entity.id;
        if (store._isKnown(id)) {
          patchState(store, removeEntity(id), addEntity(entity))
        } else {
          console.warn(`entity ${entity.id} does not exist yet, cannot update`)
        }
      },
      /**
       * delete an existing entity by its {@link id} from the {@link store} if it is known
       * @param id
       */
      deleteEntity(id: EntityId): void {
        if (store._isKnown(id)) {
          patchState(store, removeEntity(id))
        } else {
          console.warn(`entity ${id} does not exist, cannot delete`)
        }
      },
    }))
  )
}
