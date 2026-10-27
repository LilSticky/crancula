import type {ParamMap} from '@angular/router';
import {tapeId, type TapeId} from '@api/index';

/** The Tape ids of the repeated `tape` query parameters in their order; values that are no Tape id are dropped. */
export function laneTapeIds(parameters: ParamMap): TapeId[] {
  return parameters.getAll('tape').flatMap((value): TapeId[] => {
    const id = tapeId(value);
    return id === undefined ? [] : [id];
  });
}

/** The query parameters that open the side-by-side page with these Tapes as Lanes, in their order. */
export function laneQueryParams(ids: readonly TapeId[]): {tape: string[]} {
  return {tape: [...ids]};
}
