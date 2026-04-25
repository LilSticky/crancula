import {getState, patchState, signalStore, withComputed, withHooks, withMethods, withState} from "@ngrx/signals";
import {addEntity, removeEntity, withEntities} from "@ngrx/signals/entities";
import {Organ} from "@api/model/organ"
import {effect} from "@angular/core";

type OrgansStoreState = {
  _selectedOrganId: string;
  _isLoading: boolean;
}

const initialState: OrgansStoreState = {
  _selectedOrganId: '',
  _isLoading: false,
}

export const OrgansStore = signalStore(
  {providedIn: 'root'},
  withState<OrgansStoreState>(initialState),
  withEntities<Organ>(),
  withComputed((store) => ({
      selectedOrgan(): Organ | null {
        const id = store._selectedOrganId();
        return store.entityMap()[id] ?? null;
      },
      isLoading(): boolean {
        return store._isLoading();
      }
    })
  ),
  withMethods((store) => ({
    setLoading(loading: boolean): void {
      patchState(store, {_isLoading: loading})
    },
    newOrgan(): Organ {
      const organ = new Organ();
      this._addOrgan(organ)
      return organ;
    },
    isKnown(id: Organ["id"]): boolean {
      return store.ids().includes(id)
    },
    isSelectable(id: any): id is Organ["id"] {
      if (typeof id !== "string") {
        return false
      }
      return !!id && this.isKnown(id) && !this._isSelected(id)
    },
    selectOrgan(id?: string): void {
      if (this.isSelectable(id)) {
        patchState(store, {_selectedOrganId: id})
      }
    },
    _addOrgan(organ: Organ): void {
      patchState(store, addEntity(organ))
    },
    _deleteOrgan(id: string): void {
      patchState(store, removeEntity(id))
    },
    _isSelected(id: string): boolean {
      return store._selectedOrganId() == id
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
