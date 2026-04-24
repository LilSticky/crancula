import {getState, patchState, signalStore, withComputed, withHooks, withMethods, withState} from "@ngrx/signals";
import {addEntity, removeEntity, withEntities} from "@ngrx/signals/entities";
import {Organ} from "@api/model/organ"
import {effect} from "@angular/core";

type ProfilesStoreState = {
  _selectedProfileId: string;
  _isLoading: boolean;
}

const initialState: ProfilesStoreState = {
  _selectedProfileId: '',
  _isLoading: false,
}

export type ProfilesState = typeof ProfilesStore
export const ProfilesStore = signalStore(
  {providedIn: 'root'},
  withState<ProfilesStoreState>(initialState),
  withEntities<Organ>(),
  withComputed((store) => ({
      selectedProfile(): Organ | null {
        const id = store._selectedProfileId();
        return store.entityMap()[id] ?? null;
      },
      isLoading(): boolean {
        return store._isLoading();
      }
    })
  ),
  withMethods((store) => ({
    selectProfile(id?: string): void {
      if (id && this._isKnown(id) && !this._isSelected(id)) {
        this._selectProfile(id)
      }
    },
    newProfile(): Organ {
      const profile = new Organ();
      this._addProfile(profile)
      return profile;
    },
    setLoading(loading: boolean): void {
      patchState(store, {_isLoading: loading})
    },
    _addProfile(profile: Organ): void {
      patchState(store, addEntity(profile))
    },
    _deleteProfile(id: string): void {
      patchState(store, removeEntity(id))
    },
    _isKnown(id: Organ["id"]) {
      return store.ids().includes(id)
    },
    _selectProfile(id: Organ["id"]) {
      patchState(store, {_selectedProfileId: id})
    },
    _isSelected(id: string) {
      return store._selectedProfileId() == id
    }
  })),
  withHooks({
    onInit(store) {
      effect(() => {
        const state = getState(store);
        console.debug('store state changed', state)
      });
    }
  })
)
