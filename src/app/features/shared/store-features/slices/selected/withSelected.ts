import {patchState, signalStoreFeature, type, withComputed, withMethods, withState} from "@ngrx/signals";
import {EntityId, EntityProps, EntityState} from "@ngrx/signals/entities";
import {computed} from "@angular/core";
import {setSelected} from "@shared/store-features/slices/selected/updates/setSelected";
import {SelectedState} from "@shared/store-features/slices/selected/state";
import {isId} from "@shared/store-features/slices/selected/isId";
import {HasId} from "@shared/store-features/model/hasId";

export function withSelected<Entity extends HasId>() {
  return signalStoreFeature(
    {
      state: type<EntityState<Entity>>(),
      methods: type<{
        _isKnown(id?: EntityId): boolean,
        createEntity(entity: Entity): Entity
      }>(),
      props: type<EntityProps<Entity>>()
    },
    withState<SelectedState>({_selectedId: null}),
    withMethods((store) => {
      return {
        /**
         * Alias to combine {@link selectEntity} and {@link store.createEntity} for convenience.
         * @param entity
         * @return id of selected entity
         */
        selectNewEntity(entity: Entity): EntityId {
          store.createEntity(entity);
          this.selectEntity(entity.id)
          return entity.id
        },
        /**
         * select an entity by its {@link id}
         * @param id
         */
        selectEntity(id?: EntityId): void {
          if (this._isSelectable(id)) {
            console.debug("selected entity", id)
            patchState(store, setSelected(id))
          }
        },
        /**
         * @param id
         * @return is the given {@link value} a valid id, known to the {@link store} and not yet selected
         */
        _isSelectable(id?: EntityId | string | number): id is EntityId {
          return !!(isId(id) && store._isKnown(id) && !this._isSelected(id))
        },
        /**
         * @param id
         * @return is the {@link id} currently selected
         */
        _isSelected(id: EntityId): boolean {
          return store._selectedId() == id
        },
      }
    }),
    withComputed((store) => {
      return {
        selectedEntity: computed((): Entity | null => {
          const id: EntityId | null = store._selectedId();
          return (id && store.entityMap()[id]) as Entity | null;
        }),
      }
    })
  )
}
