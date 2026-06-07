import {EntityId} from "@ngrx/signals/entities";
import {SelectedState} from "@shared/store-features/slices/selected/state";

export function setSelected(id: EntityId): SelectedState {
  return {_selectedId: id};
}
