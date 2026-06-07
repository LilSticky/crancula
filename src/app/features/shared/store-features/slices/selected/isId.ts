import {EntityId} from "@ngrx/signals/entities";

export function isId(value: any): value is EntityId {
  return !!value && (typeof value == "string" || typeof value == "number")
}
