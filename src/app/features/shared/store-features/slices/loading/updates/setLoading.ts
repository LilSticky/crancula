import {LoadingState} from "@shared/store-features/slices/loading/state";

export function setLoading(loading: boolean): LoadingState {
  return {_isLoading: loading};
}
