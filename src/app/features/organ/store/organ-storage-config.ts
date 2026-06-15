import {EntityId, EntityMap} from "@ngrx/signals/entities";
import {DriedOrgan, Organ} from "@api/model/organ";

type DriedOrganStoreState = {
  _selectedId: string | number | null;
  ids: EntityId[]
  entities: DriedOrgan[];
};
type OrganStoreState = {
  _isLoading: boolean;
  _selectedId: string | number | null;
  entityMap: EntityMap<Organ>;
  ids: EntityId[]
};

function revive(entity: DriedOrgan) {
  return new Organ(
    entity.id,
    entity.name,
    entity.pipes,
    entity.tape
  );
}

const reconstructMap = (previousValue: EntityMap<Organ>, currentValue: Organ): EntityMap<Organ> => ({
  ...previousValue,
  [currentValue.id]: currentValue
});

function parseEntityMap(hydrated: DriedOrganStoreState) {
  return hydrated.entities
    .map((entity: DriedOrgan): Organ => revive(entity))
    .reduce(reconstructMap, {});
}

function toDried(organ: Organ): DriedOrgan {
  return {
    id: organ.id,
    name: organ.name,
    tape: organ.tape,
    pipes: organ.pipes.toArray()
  }
}

function dryOrganState(state: OrganStoreState): DriedOrganStoreState {
  return {
    _selectedId: state._selectedId,
    ids: state.ids,
    entities: Object.entries(state.entityMap)
      .filter(([key]) => state.ids.includes(key))
      .map(([,organ]) => toDried(organ))
  };
}

function parseOrganState(hydrated: DriedOrganStoreState) {
  return {
    _selectedId: hydrated._selectedId,
    _isLoading: false,
    entityMap: parseEntityMap(hydrated),
    ids: hydrated.entities.map(organ => organ.id)
  };
}

const stringifyOrganStoreState: (state: OrganStoreState) => string = (state) => {
  return JSON.stringify(dryOrganState(state));
};
const parseOrganStoreState: (stateString: string) => OrganStoreState = (stateString) => {
  return parseOrganState(JSON.parse(stateString) as DriedOrganStoreState);
};

// TODO continue here, compiler is happy now, but no persistence
export const organStorageConfig = {
  key: 'organs',
  stringify: stringifyOrganStoreState,
  parse: parseOrganStoreState
}
