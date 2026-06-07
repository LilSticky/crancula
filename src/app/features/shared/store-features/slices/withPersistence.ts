import {
  getState,
  patchState,
  signalStoreFeature,
  type,
  withHooks,
  withMethods,
  withProps,
  withState
} from "@ngrx/signals";
import {addEntities, EntityProps, EntityState} from "@ngrx/signals/entities";
import {effect, inject} from "@angular/core";
import {Bridge} from "@api/model/bridge";
import {HasId} from "@shared/store-features/model/hasId";
import {StorageService} from "../../../../core/services/storage/storage.service";
import {DataStore} from "@api/index";
import {from, Observable, tap} from "rxjs";

export function withPersistence<Entity extends HasId>(channel: keyof Bridge) {
  return signalStoreFeature(
    {state: type<EntityState<Entity>>(), props: type<EntityProps<Entity>>()},
    withState<{
      previous: Entity[]
    }>({
      previous: []
    }),
    withProps(() => {
      const service = inject(StorageService);
      const db = service.bridge[channel] as DataStore<any> as DataStore<Entity>;
      const get$: Observable<Entity[]> = from(db.get())
      return {db, get$};
    }),
    withMethods((store) => {
      return {
        /**
         * synchronize the current state with the persisted state
         */
        _write(): void {
          const entities = store.entities();
          if (entities.length > 0) {
            console.debug('persist entities', entities)
            store.db.set(entities)
              .then(() => console.debug('state persisted'))
              .catch(console.error);
          } else {
            console.debug('no entities to persist')
          }
        },
        /**
         * initialize empty {@link store} from persisted data
         */
        _read(): void {
          store.db.get()
            .then(data => patchState(store, addEntities(data)))
            .catch(reason => console.error(reason))
            .finally(() => console.debug('store initialized'))
        }
      }
    }),
    withHooks({
      onInit(store) {
        console.debug('initialize store', store.entities())
        store.get$.pipe(
          tap(data => {
            console.log('got state from db', data)
            patchState(store, addEntities(data));
          }),
        )

        // write state on change
        effect(() => {
          const state = getState(store);
          // the effect is now tracking the store state and re-called when it changes (hopefully)
          console.debug('store state changed', state)
          store._write();
        });
      }
    })
  )
}
